# InvoiceFlow AI

AI-powered invoice processing SaaS: upload invoices (PDF/PNG/JPG), extract structured data with
multimodal AI + browser OCR, review with human-in-the-loop approval, search history, and export CSV/JSON.

## 1. What the project does

- **Register / log in** with Supabase Auth (session persistence, password reset).
- **Upload invoices** via drag-and-drop or file picker (up to 10 files per batch, 10MB each).
- **Automatic processing pipeline**: original stored in Supabase Storage → browser OCR
  (Tesseract.js, PDF.js page rendering, optional OpenCV.js preprocessing) → server-side NVIDIA
  Nemotron multimodal extraction → server-side JSON validation, confidence scoring, validation flags,
  duplicate warnings → saved to Supabase.
- **Review interface**: file preview, editable fields, confidence bar, validation warnings,
  raw OCR text, AI extraction JSON, approve / reject / reprocess / delete.
- **Dashboard**: totals, status breakdown, average confidence, total value, charts (Recharts).
- **Search**: supplier, invoice number, date range, status, amount range.
- **Exports**: CSV and JSON (exports are logged as invoice events).
- **Demo mode**: six synthetic, fictional invoices covering clean, duplicate, low-OCR-quality,
  disputed-total, and unreadable cases. No real company data anywhere.

## 2. Architecture

```
Browser (React + Vite + Tailwind)
 ├── Supabase Auth (register/login/logout/reset, persisted session)
 ├── Supabase PostgreSQL via RLS (own invoices only)
 ├── Supabase Storage (private `invoices` bucket, per-user folders)
 ├── OCR in-browser: PDF.js → OpenCV.js preprocess → Tesseract.js
 └── fetch /api/* ──► Vercel serverless (Node)
                       ├── POST /api/process (NVIDIA Nemotron + validation)
                       ├── POST /api/duplicates-check
                       └── GET  /api/health
```

Details: [ARCHITECTURE.md](ARCHITECTURE.md), [AI_PIPELINE.md](AI_PIPELINE.md), [OCR_PIPELINE.md](OCR_PIPELINE.md).

## 3. Technology stack

| Layer    | Choice (all free-tier) |
|----------|------------------------|
| Frontend | React 18, JavaScript only (`.js`/`.jsx`), Vite 5, Tailwind CSS 3, React Router 6, Recharts, Axios-ready `fetch` wrapper |
| API      | JavaScript Vercel serverless functions (`api/*.js`) |
| DB/Auth/Storage | Supabase Free (PostgreSQL + Auth + Storage) |
| AI       | NVIDIA Nemotron 3 Nano Omni 30B A3B Reasoning (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`) via OpenAI-compatible `https://integrate.api.nvidia.com/v1` |
| OCR      | Tesseract.js, PDF.js (`pdfjs-dist`), OpenCV.js via CDN (optional enhancement) |
| Tests    | Vitest |

No TypeScript, no AWS/Bedrock/Textract/Lambda/S3/API Gateway, no paid AI/DB/hosting.

## 4. Supabase setup

1. Create a free project at https://supabase.com → copy **Project URL** and **anon public key**.
2. **Authentication → Providers → Email**: enabled. (Confirm-email behavior is configurable; the app handles both.)
3. **SQL Editor → New query**: paste the full contents of [supabase/schema.sql](supabase/schema.sql) and run.
   This creates `invoices`, `invoice_line_items`, `processing_runs`, `invoice_events`, indexes,
   `updated_at` trigger, and Row Level Security policies (users access only their own rows).
4. **Storage → New bucket**: name `invoices`, **Private**, file size limit 10MB,
   allowed MIME types `application/pdf,image/png,image/jpeg,image/webp`.
5. **Storage → Policies**: add the three storage policies from the comment block at the bottom of
   `supabase/schema.sql` (insert/select/delete scoped to `invoices/<user_id>/…`).

Full reference: [DATABASE.md](DATABASE.md).

## 5. NVIDIA API setup

1. Create a free account at https://build.nvidia.com and generate an API key.
2. **Local dev**: add `NVIDIA_API_KEY=…` to `.env` (server-side only — never `VITE_` prefixed).
3. **Vercel**: Project → Settings → Environment Variables → add `NVIDIA_API_KEY`
   (all environments). Redeploy after adding.
4. Health check: `GET /api/health` reports `aiConfigured: true` when the key is present.
5. If the key is missing, uploads still work: OCR text is saved and the invoice is flagged
   `AI_EXTRACTION_UNCERTAIN` for manual entry — the UI explains what happened.

Details: [AI_PIPELINE.md](AI_PIPELINE.md), [API.md](API.md).

## 6. Environment variables

```bash
cp .env.example .env
```

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | browser + build | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser + build | Supabase anon key (public by design; RLS enforces access) |
| `NVIDIA_API_KEY` | server only (Vercel env / local `.env`) | NVIDIA API key. **Never** prefix with `VITE_`, never import in `src/`. |

Only `VITE_` variables are exposed to the browser (Vite behavior). `api/` functions read
`process.env.NVIDIA_API_KEY` at runtime.

## 7. Local development

Prerequisites: Node 18+.

```bash
npm install
cp .env.example .env   # fill in values
npm run dev            # http://localhost:5173
```

Notes:
- `/api/*` routes only run on Vercel (or `vercel dev` with the Vercel CLI). Against plain
  `vite dev`, AI processing calls will fail gracefully and the app saves OCR-only results.
  Install the Vercel CLI and run `vercel dev` for full end-to-end local AI processing.
- `npm test` runs the Vitest suite (no network, no credentials needed).

## 8. Database setup

Run [supabase/schema.sql](supabase/schema.sql) once per Supabase project (see §4).
To reset during development, drop the four tables and re-run the file.
See [DATABASE.md](DATABASE.md) for column reference and query patterns.

## 9. Supabase Storage setup

Bucket `invoices` (private) + the three storage policies in `schema.sql`.
App layout: `invoices/<user_id>/<invoice_id>/<sanitized_filename>`.
Previews use short-lived `download()` blobs — no public URLs. See [DATABASE.md](DATABASE.md).

## 10. Deployment to Vercel

1. Push this repo to GitHub.
2. https://vercel.com → **Add New Project** → import the repo (framework auto-detected: Vite).
3. Build command `npm run build`, output directory `dist` (already set in `vercel.json`).
4. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `NVIDIA_API_KEY`.
5. Deploy. Frontend + `api/*.js` functions deploy together on Vercel Hobby (free).
6. Verify: open `/api/health`, register an account, upload a test invoice.

Full guide: [DEPLOYMENT.md](DEPLOYMENT.md).

## 11. Demo mode

Open **Demo** in the nav: six fictional invoices with varied quality/status.
**“Load demo invoices into my account”** inserts them as your own rows (plus line items,
processing runs, and events) so search, review, approve/reject, and exports all work end-to-end.
Nothing is shared between users.

## 12. Testing

```bash
npm test          # run once
npm run test:watch
```

Suites in `tests/`: authentication input validation, file validation, JSON parsing of model
output, AI response validation, duplicate detection, total calculations, authorization/RLS,
API error handling (safe messages, payload limits, rate limiting, retries).

## Project layout

```
api/
  health.js | process.js | duplicates-check.js
  services/nvidiaAI.js        # centralized NVIDIA service (server-only)
  lib/invoiceSchema.js | duplicateCheck.js | authorization.js
  lib/rateLimit.js | cors.js | requestUtils.js
src/
  main.jsx App.jsx index.css
  lib/supabaseClient.js lib/api.js
  context/AuthContext.jsx
  components/ pages/ utils/
supabase/schema.sql
tests/
*.md docs
```

Security model: [SECURITY.md](SECURITY.md). API reference: [API.md](API.md).
Dev workflow: [DEVELOPMENT.md](DEVELOPMENT.md).
