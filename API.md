# API REFERENCE

Base URL: same origin as the app (`/api/*` on Vercel). All responses are JSON with `{ ok }`.

## GET /api/health

No auth. Liveness + configuration probe (never leaks the key).

Response `200`:
```json
{
  "ok": true,
  "service": "invoiceflow-ai",
  "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "aiConfigured": true,
  "timestamp": "2026-09-09T00:00:00.000Z"
}
```

## POST /api/process

Runs server-side NVIDIA extraction + validation. Rate limited: 20 req/min per IP
(`X-RateLimit-Remaining` header). Max body ~14MB.

Request:
```json
{
  "ocrText": "ACME ... Total $524.88",
  "imageBase64": "<raw base64, no data: prefix>",
  "mimeType": "image/jpeg",
  "filename": "invoice-1042.jpg",
  "ocrConfidence": 87
}
```

- At least one of `ocrText` / `imageBase64` is required.
- `ocrText` ≤ 60,000 chars; `imageBase64` ≤ 8,000,000 chars (~6MB).
- Image MIME allow-list: `image/png`, `image/jpeg`, `image/webp`.

Success `200`:
```json
{
  "ok": true,
  "extraction": {
    "supplier": "Acme Office Supply Co.",
    "invoice_number": "ACM-2026-1042",
    "invoice_date": "2026-08-14",
    "due_date": "2026-09-13",
    "currency": "USD",
    "subtotal": 486,
    "tax": 38.88,
    "tax_rate": 8,
    "total": 524.88,
    "purchase_order": "PO-7781",
    "payment_terms": "Net 30",
    "line_items": [
      { "description": "Ergonomic office chair", "quantity": 2, "unit_price": 189, "tax": 30.24, "total": 378 }
    ],
    "confidence": 94,
    "validation_flags": []
  },
  "meta": { "durationMs": 8123, "aiLatencyMs": 7901, "attempts": 1 }
}
```

Field contract: strings are `""` when unknown; numbers/dates are `null` when unknown
(`invoice_date` uses `""` per spec); `line_items` defaults to `[]`; `confidence` is 0–100.
`validation_flags` ⊆ `MISSING_INVOICE_NUMBER, MISSING_SUPPLIER, MISSING_DATE, LOW_CONFIDENCE,
TOTAL_MISMATCH, INVALID_DATE, POSSIBLE_DUPLICATE, MISSING_TOTAL, OCR_UNCERTAIN, AI_EXTRACTION_UNCERTAIN`.

Errors (safe messages, no internals):
| Status | Meaning |
|--------|---------|
| 400 | bad input (empty payload, bad MIME, malformed JSON) |
| 405 | wrong method |
| 413 | OCR text or image too large |
| 429 | rate limited |
| 500 | `NVIDIA_API_KEY` missing / AI misconfigured |
| 502 | NVIDIA call failed after retries |

## POST /api/duplicates-check

Stateless duplicate scoring. Rate limited: 60 req/min per IP.

Request:
```json
{
  "candidate": { "supplier": "Acme", "invoice_number": "ACM-1", "invoice_date": "2026-08-14", "total": 100 },
  "existing": [{ "id": "…", "supplier": "Acme Inc", "invoice_number": "ACM-1", "invoice_date": "2026-08-14", "total": 100 }],
  "currentId": null
}
```
(`existing` capped at 500 entries.)

Response `200`:
```json
{
  "ok": true,
  "isPossibleDuplicate": true,
  "matches": [{ "invoice": { "id": "…" }, "score": 4, "reasons": ["same supplier", "same invoice number", "same invoice date", "same total"] }]
}
```

Rule: `isDuplicate = supplierMatch && numberMatch && score >= 3`, where score counts
supplier / number / date / total matches (supplier names normalized: lowercased, punctuation
and legal suffixes stripped; totals compared within 0.02).

## Client data access (Supabase, RLS-enforced)

The SPA talks to Supabase directly with the anon key:

- `invoices` — select/insert/update/delete own rows; statuses
  `uploaded|processing|needs_review|approved|rejected`.
- `invoice_line_items` — CRUD scoped to owned parent invoices.
- `invoice_processing_runs` — insert/select (`ai_extraction|ocr_only|reprocess|demo` × `started|succeeded|failed`).
- `invoice_events` — insert/select (`created|processed|approved|rejected|updated|reprocessed|exported|deleted`).
- Storage `invoices` bucket — upload/download/delete at `<uid>/<invoiceId>/<file>`.

See DATABASE.md for columns and policies.
