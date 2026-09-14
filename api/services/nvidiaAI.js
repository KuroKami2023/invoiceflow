/**
 * Centralized server-side NVIDIA AI service.
 *
 * - Calls NVIDIA Nemotron 3 Nano Omni 30B A3B Reasoning via the
 *   OpenAI-compatible endpoint https://integrate.api.nvidia.com/v1
 * - Accepts text input and (multimodal) image input
 * - Requests structured JSON invoice extraction
 * - Handles malformed model responses, API failures, timeouts, retries
 * - Logs failures WITHOUT exposing API keys or full payload contents
 * - NEVER imported by frontend code. The key lives only in NVIDIA_API_KEY.
 */

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

const DEFAULT_TIMEOUT_MS = 60000;
const MAX_RETRIES = 2; // total attempts = 1 + MAX_RETRIES
const RETRY_BASE_DELAY_MS = 1200;
const MAX_IMAGE_CHARS = 8_000_000; // ~6MB base64 guard before we even call NVIDIA

const SYSTEM_PROMPT = `You are an invoice data extraction engine. Read the provided invoice content (OCR text and/or invoice image) and return ONLY valid JSON — no markdown, no code fences, no commentary.

Required JSON shape (use exactly these keys):
{
  "supplier": "",
  "invoice_number": "",
  "invoice_date": "",
  "due_date": null,
  "currency": "",
  "subtotal": null,
  "tax": null,
  "tax_rate": null,
  "total": null,
  "purchase_order": null,
  "payment_terms": null,
  "line_items": [],
  "confidence": 0,
  "validation_flags": []
}

Line item shape:
{ "description": "", "quantity": null, "unit_price": null, "tax": null, "total": null }

Rules:
- NEVER invent values. If a value cannot be reliably determined, use null (numbers/dates) or "" (strings). line_items defaults to [].
- Dates must be ISO YYYY-MM-DD when known, else null/"". invoice_date "" when unknown.
- currency: 3-letter ISO code (e.g. USD, EUR, GBP) or "" when unknown.
- Numbers must be JSON numbers (no currency symbols, no commas). tax_rate as percentage number (e.g. 20 for 20%) or null.
- confidence: integer 0-100 reflecting your certainty in the extraction.
- validation_flags: subset of ["MISSING_INVOICE_NUMBER","MISSING_SUPPLIER","MISSING_DATE","LOW_CONFIDENCE","TOTAL_MISMATCH","INVALID_DATE","POSSIBLE_DUPLICATE","MISSING_TOTAL","OCR_UNCERTAIN","AI_EXTRACTION_UNCERTAIN"]. Include OCR_UNCERTAIN if the OCR text looks garbled. Do NOT guess POSSIBLE_DUPLICATE unless the input explicitly mentions it.
- Return ONLY the JSON object.`;

function getApiKey() {
  return process.env.NVIDIA_API_KEY || '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Safe log: lengths + truncated preview, never keys or full base64. */
function safeLogError(stage, err, meta = {}) {
  const safeMeta = { ...meta };
  if (safeMeta.imageBase64Length !== undefined) {
    safeMeta.imageBase64Length = Number(safeMeta.imageBase64Length) || 0;
  }
  delete safeMeta.imageBase64;
  delete safeMeta.apiKey;
  const message = err && err.message ? err.message : String(err);
  const status = err && err.status ? ` status=${err.status}` : '';
  console.error(`[nvidiaAI] ${stage} failed:${status} ${message}`, JSON.stringify(safeMeta).slice(0, 1000));
}

function isRetryable(err) {
  if (err && err.name === 'AbortError') return true; // timeout
  const status = err && err.status;
  if (status === 429) return true;
  if (typeof status === 'number' && status >= 500 && status < 600) return true;
  if (err && err.code && ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(err.code)) return true;
  return false;
}

/**
 * Extract the first plausible JSON object from model text.
 * Handles: raw JSON, ```json fences, leading/trailing prose.
 */
export function extractJsonObject(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty model response');
  }
  let cleaned = text.trim();
  // Strip markdown code fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  // Fast path: whole thing parses
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to brace scanning
  }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model response contained no JSON object');
  }
  const candidate = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (err) {
    // Last resort: try to repair trailing commas
    const repaired = candidate.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(repaired);
    } catch {
      throw new Error(`Model returned malformed JSON: ${err.message}`);
    }
  }
}

function buildMessages({ ocrText, imageBase64, mimeType, filename }) {
  const textParts = [];
  if (filename) textParts.push(`Filename: ${filename}`);
  if (ocrText && ocrText.trim()) {
    const truncated = ocrText.length > 12000 ? `${ocrText.slice(0, 12000)}\n[...truncated]` : ocrText;
    textParts.push(`OCR text (may contain errors — cross-check with the image when present):\n${truncated}`);
  } else {
    textParts.push('No OCR text was provided. Rely on the attached invoice image.');
  }
  textParts.push('Return ONLY the JSON object described in the system prompt.');

  const content = [{ type: 'text', text: textParts.join('\n\n') }];

  if (imageBase64) {
    const mime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/png';
    content.push({
      type: 'image_url',
      image_url: { url: `data:${mime};base64,${imageBase64}` },
    });
  }
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content },
  ];
}

async function postChatCompletions({ messages, timeoutMs }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error('NVIDIA_API_KEY is not configured on the server');
    err.status = 500;
    err.publicMessage = 'AI service is not configured. Set NVIDIA_API_KEY in server environment variables.';
    throw err;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages,
        temperature: 0.1,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      const err = new Error(`NVIDIA API error ${res.status}: ${bodyText.slice(0, 300)}`);
      err.status = res.status;
      err.publicMessage =
        res.status === 401 || res.status === 403
          ? 'AI service authentication failed. Check server API key configuration.'
          : res.status === 429
            ? 'AI service is rate-limited. Please retry shortly.'
            : 'AI service request failed. Please retry.';
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function getModelText(response) {
  const text = response?.choices?.[0]?.message?.content;
  if (typeof text === 'string' && text.trim()) return text;
  // Some reasoning models put content in reasoning_content only
  const reasoning = response?.choices?.[0]?.message?.reasoning_content;
  if (typeof reasoning === 'string' && reasoning.trim()) return reasoning;
  throw new Error('Model returned an empty response');
}

/**
 * Run structured invoice extraction.
 * @param {object} input
 * @param {string} [input.ocrText]
 * @param {string} [input.imageBase64] raw base64 (no data: prefix)
 * @param {string} [input.mimeType]
 * @param {string} [input.filename]
 * @param {object} [opts] { timeoutMs, maxRetries }
 */
export async function extractInvoice(input = {}, opts = {}) {
  const { ocrText = '', imageBase64 = '', mimeType = '', filename = '' } = input;
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const maxRetries = Number.isInteger(opts.maxRetries) ? opts.maxRetries : MAX_RETRIES;

  if (!ocrText.trim() && !imageBase64) {
    throw Object.assign(new Error('Provide OCR text and/or an invoice image'), {
      status: 400,
      publicMessage: 'Provide OCR text and/or an invoice image for extraction.',
    });
  }
  if (imageBase64 && imageBase64.length > MAX_IMAGE_CHARS) {
    throw Object.assign(new Error('Image payload too large'), {
      status: 413,
      publicMessage: 'Image is too large. Please upload a file under 6MB or a smaller scan.',
    });
  }

  const messages = buildMessages({ ocrText, imageBase64, mimeType, filename });
  const started = Date.now();
  let lastErr = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await postChatCompletions({ messages, timeoutMs });
      const rawText = getModelText(response);
      const parsed = extractJsonObject(rawText);
      return {
        data: parsed,
        usage: response?.usage || null,
        latencyMs: Date.now() - started,
        attempts: attempt + 1,
      };
    } catch (err) {
      lastErr = err;
      safeLogError(`extractInvoice attempt ${attempt + 1}`, err, {
        hasImage: Boolean(imageBase64),
        imageBase64Length: imageBase64 ? imageBase64.length : 0,
        ocrLength: ocrText ? ocrText.length : 0,
      });
      if (attempt < maxRetries && isRetryable(err)) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      break;
    }
  }

  const finalErr = lastErr instanceof Error ? lastErr : new Error('AI extraction failed');
  if (!finalErr.publicMessage) {
    finalErr.publicMessage = 'AI extraction failed. Please retry or edit fields manually.';
  }
  if (!finalErr.status) finalErr.status = 502;
  throw finalErr;
}

export const __internal = {
  NVIDIA_MODEL,
  NVIDIA_BASE_URL,
  buildMessages,
  isRetryable,
};
