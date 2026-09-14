# AI PIPELINE

Model: **`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`** (multimodal, reasoning),
called OpenAI-compatibly at **`https://integrate.api.nvidia.com/v1/chat/completions`**.
All calls happen in `api/services/nvidiaAI.js` — the **only** file that touches NVIDIA.
The key lives in server-only `NVIDIA_API_KEY` and is never imported, logged, or bundled
into frontend code.

## Call shape

```js
POST {BASE_URL}/chat/completions
Authorization: Bearer <NVIDIA_API_KEY>
{
  "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "messages": [
    { "role": "system", "content": "<extraction system prompt>" },
    { "role": "user", "content": [
      { "type": "text", "text": "Filename: …\n\nOCR text …\n\nReturn ONLY the JSON …" },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,…" } }
    ]}
  ],
  "temperature": 0.1,
  "max_tokens": 2048
}
```

- OCR text truncated to 12,000 chars in the prompt; image path used when OCR is thin/absent.
- Low temperature (0.1) for deterministic extraction.
- The system prompt mandates **ONLY valid JSON** in the canonical shape and
  **never inventing values** (`null` for unknown numbers/dates, `""` for unknown strings,
  `[]` for unknown lines, ISO dates, numeric amounts without symbols).

## Reliability

| Concern | Handling |
|---------|----------|
| Timeout | `AbortController`, 60s default per attempt |
| Retries | up to 3 attempts, exponential backoff (1.2s × 2ⁿ), only for 429 / 5xx / timeouts / network resets |
| Malformed JSON | `extractJsonObject()`: strip ``` fences → full parse → brace-scan slice → trailing-comma repair; else a clear error |
| Empty model output | falls back to `reasoning_content`, then errors |
| Oversized payloads | rejected before the call (OCR ≤ 60k chars, image ≤ ~6MB base64) |
| Missing key | immediate safe 500 (“AI service is not configured…”) |
| Logging | `console.error` with stage, status, lengths only — key and base64 never logged |
| Client errors | `toPublicError()` maps everything to safe messages (no stack, no key, no prompt leak) |

## Server-side validation (`api/lib/invoiceSchema.js`)

`validateExtraction()` normalizes without throwing:

1. Coerce: numbers from strings (`$1,299.00` → `1299`), currency uppercased/trimmed to 3 chars,
   dates kept only if real calendar dates (`isValidDate`), line items capped at 200 and cleaned.
2. Flags: `MISSING_*` for absent supplier/number/date/total, `INVALID_DATE` for bad dates,
   `TOTAL_MISMATCH` when line-sum or `subtotal+tax` disagrees with `total` beyond 0.02–0.05
   (only when all lines are computable, to avoid false positives), `OCR_UNCERTAIN` /
   `POSSIBLE_DUPLICATE` from request context, model-supplied flags preserved if allow-listed.
3. Confidence: accept 0–1 or 0–100 scales → clamp 0–100; start at 70 + `AI_EXTRACTION_UNCERTAIN`
   when the model gives none; subtract 10–20 per issue class; add `LOW_CONFIDENCE` below 60.

The client mirror (`src/utils/validation.js`) previews flags instantly, but the server copy
is authoritative for persistence.

## Confidence semantics

0–100 integer: model's self-score adjusted for verifiable problems (missing fields,
arithmetic mismatch, poor OCR). Dashboard averages it; the review UI color-codes it
(≥85 green, ≥60 amber, else red). Treat <60 as “verify every field.”

## Graceful degradation

If the model is unreachable, the upload flow still persists the invoice with OCR text and
`AI_EXTRACTION_UNCERTAIN`, so users can type values manually and **Reprocess** later
(`processing_type=reprocess`, logged in `processing_runs`).
