import { extractInvoice } from './services/nvidiaAI.js';
import { validateExtraction } from './lib/invoiceSchema.js';
import { checkRateLimit } from './lib/rateLimit.js';
import { setCors } from './lib/cors.js';
import {
  getClientIp,
  readJsonBody,
  sendJson,
  toPublicError,
  validateProcessInput,
} from './lib/requestUtils.js';

/**
 * POST /api/process
 * Body: { ocrText, imageBase64?, mimeType?, filename?, ocrConfidence? }
 * Server-only NVIDIA call → validated canonical extraction JSON.
 */
export default async function handler(req, res) {
  if (setCors(req, res, 'POST,OPTIONS')) return;
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const rl = checkRateLimit({ key: `process:${getClientIp(req)}`, limit: 20, windowMs: 60_000 });
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  if (!rl.allowed) {
    return sendJson(res, 429, { ok: false, error: 'Too many requests. Please slow down.' });
  }

  const started = Date.now();
  try {
    const body = await readJsonBody(req);
    const input = validateProcessInput(body);

    const aiResult = await extractInvoice(
      {
        ocrText: input.ocrText,
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
        filename: input.filename,
      },
      { timeoutMs: 60000, maxRetries: 2 },
    );

    const { cleaned } = validateExtraction(aiResult.data, {
      ocrUncertain:
        typeof input.ocrConfidence === 'number'
          ? input.ocrConfidence < 60
          : Boolean(input.ocrText) && input.ocrText.length < 40 && !input.imageBase64,
    });

    return sendJson(res, 200, {
      ok: true,
      extraction: cleaned,
      meta: {
        durationMs: Date.now() - started,
        aiLatencyMs: aiResult.latencyMs,
        attempts: aiResult.attempts,
      },
    });
  } catch (err) {
    console.error('[api/process] request failed:', err && err.message ? err.message : err);
    const pub = toPublicError(err);
    return sendJson(res, pub.status, { ok: false, error: pub.message });
  }
}
