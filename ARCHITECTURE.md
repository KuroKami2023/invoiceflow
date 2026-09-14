# ARCHITECTURE

## System overview

InvoiceFlow AI is a full-stack JavaScript SaaS on three free-tier platforms:

- **Vercel Hobby** — hosts the Vite SPA (`dist/`) and Node serverless functions (`api/`).
- **Supabase Free** — PostgreSQL (data), Auth (users), Storage (original files).
- **NVIDIA free API endpoint** — Nemotron 3 Nano Omni 30B A3B Reasoning for extraction.

```
┌──────────────────────────── Browser ────────────────────────────┐
│ React SPA (Vite + Tailwind + Router + Recharts)                  │
│  pages: Dashboard Upload Invoices InvoiceDetail Demo Login/...   │
│  utils: ocr.js imagePreprocess.js validation.js duplicate.js    │
│         export.js demoData.js format.js authValidate.js          │
│  lib: supabaseClient.js (anon key + RLS) · api.js (/api client)  │
└───────┬──────────────────────────────┬──────────────────────────┘
        │ Supabase JS client           │ fetch /api/*
        ▼                              ▼
┌────────────── Supabase ──────────────┐  ┌────── Vercel serverless ──────┐
│ Auth (email, sessions)               │  │ POST /api/process             │
│ PostgreSQL + RLS (own rows only)     │  │ POST /api/duplicates-check    │
│ Storage bucket `invoices` (private)  │  │ GET  /api/health              │
└──────────────────────────────────────┘  │ services/nvidiaAI.js ──► NVIDIA│
                                          └───────────────────────────────┘
```

## Request flows

### Upload → process (happy path)

1. `Upload.jsx` validates type/size (client) and creates an `invoices` row (`status=processing`).
2. Original file → `storage.from('invoices').upload(<uid>/<invoiceId>/<file>)`, `file_path` saved.
3. `processFileForOcr()` (see OCR_PIPELINE.md): PDF.js render or image load → optional
   OpenCV.js denoise/threshold → Tesseract.js OCR → compact JPEG base64 for the model.
4. `POST /api/process { ocrText, imageBase64, mimeType, filename, ocrConfidence }`.
5. Server: rate limit → input validation → `extractInvoice()` (NVIDIA, timeout 60s, ≤3 attempts,
   exponential backoff on 429/5xx/timeout) → `validateExtraction()` (normalize, flags, confidence).
6. Client merges `POSSIBLE_DUPLICATE` (local `findDuplicates` vs. loaded history), persists the
   extraction + line items, writes `processing_runs` (succeeded) + `invoice_events` (processed).
7. Row flips to `needs_review`; Upload list links to `/invoices/:id`.

### AI-unavailable degradation

If `/api/process` fails (no key, rate limit, outage), the invoice is still saved with OCR text,
empty extraction fields, and `AI_EXTRACTION_UNCERTAIN`, plus a failed `processing_runs` row.
The user can type values manually or hit **Reprocess** later. Nothing is lost.

### Review → decision

`InvoiceDetail.jsx` loads invoice + lines + events + sibling invoices (duplicate context) +
private file preview (Storage `download()` → object URL, never a public link). Edits validate
dates/numbers client-side, then update the row, replace line items, and log events.
Approve/reject are status updates + events. Delete removes the row (cascades) and the file.

### Search / export

`Invoices.jsx` filters client-side over ≤500 rows (supplier/number substring, status, date range,
amount range) and exports CSV/JSON, logging an `exported` event per row.

## Key design decisions

- **Stateless API, RLS writes from the client.** Functions never touch the DB, so no
  `service_role` key exists anywhere. Ownership is enforced by RLS; `api/lib/authorization.js`
  mirrors the rule for UI gating and tests.
- **One AI service module.** All model access goes through `api/services/nvidiaAI.js`
  (prompt, timeout, retry, JSON repair, key-redacted logging). No other file calls NVIDIA.
- **Validation in two places, server authoritative.** `src/utils/validation.js` previews;
  `api/lib/invoiceSchema.js` decides what is persisted. Same flag vocabulary.
- **Sequential batch processing.** Uploads process one file at a time to stay inside free-tier
  memory/rate limits and keep progress UI truthful.
- **Warning-only duplicates.** Score = supplier + number + date/total; matches surface as
  `POSSIBLE_DUPLICATE` banners. Nothing is auto-deleted.
- **JavaScript only.** No TypeScript, no build-time type layer; correctness comes from
  server-side schema validation + Vitest suites.

## File map

| Path | Role |
|------|------|
| `api/services/nvidiaAI.js` | NVIDIA client, prompt, retry, JSON repair |
| `api/lib/invoiceSchema.js` | canonical extraction shape, flags, confidence |
| `api/lib/duplicateCheck.js` | duplicate scoring |
| `api/lib/{rateLimit,cors,requestUtils,authorization}.js` | cross-cutting API concerns |
| `api/{health,process,duplicates-check}.js` | HTTP endpoints |
| `src/utils/ocr.js`, `imagePreprocess.js` | browser OCR pipeline |
| `src/pages/*` | Dashboard, Upload, Invoices, InvoiceDetail, Demo, auth |
| `supabase/schema.sql` | tables, indexes, RLS, storage policy templates |
| `tests/` | 8 Vitest suites |
