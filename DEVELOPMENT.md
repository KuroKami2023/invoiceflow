# DEVELOPMENT

## Setup

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, NVIDIA_API_KEY
npm run dev            # Vite on http://localhost:5173
```

For end-to-end local AI calls, use the Vercel CLI (`npm i -g vercel && vercel dev`),
which serves `api/*.js` with `.env` loaded. Plain `vite dev` serves only the SPA —
`/api/*` fails gracefully (OCR-only saves) by design.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | production build → `dist/` |
| `npm run preview` | serve the production build locally |
| `npm test` / `npm run test:watch` | Vitest suites (no network/credentials) |

## Conventions

- **JavaScript only**: `.js` / `.jsx`. No TypeScript, no `tsconfig.json`, no type syntax.
- **Never touch the key**: `NVIDIA_API_KEY` appears only in `api/services/nvidiaAI.js`
  (via `process.env`) and docs. `grep -r NVIDIA_API_KEY src/` must return nothing.
- **Validation parity**: changing `api/lib/invoiceSchema.js` → mirror in
  `src/utils/validation.js` (and vice versa); same for `duplicateCheck.js` ↔ `duplicate.js`.
- **Server never trusts the model**: new extraction fields must flow through
  `validateExtraction()` + a test in `tests/aiValidation.test.js`.
- **Styles**: Tailwind utilities + the shared `.card/.btn-*/.input/.label/.mono-box`
  classes in `src/index.css`.

## Testing

```bash
npm test
```

Suites: `validation`, `jsonParsing`, `aiValidation`, `totals`, `duplicate`, `auth`,
`authorization`, `apiErrorHandling`. All pure functions — fast, hermetic. When fixing a bug,
add the failing case to the relevant suite first.

## Useful paths

- AI service: `api/services/nvidiaAI.js`
- Extraction contract: `api/lib/invoiceSchema.js`
- OCR entry: `src/utils/ocr.js` (`processFileForOcr`)
- Upload orchestration: `src/pages/Upload.jsx`
- Review screen: `src/pages/InvoiceDetail.jsx`
- Schema: `supabase/schema.sql`

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `AI service is not configured` | `NVIDIA_API_KEY` missing where `api/` runs (Vercel env or `vercel dev`) |
| Login works locally, fails in prod | Supabase Site URL / redirect URLs not set to the Vercel domain |
| Uploads fail with storage error | `invoices` bucket missing or storage policies not applied |
| `/api/*` 404 on localhost | expected under `vite dev`; use `vercel dev` |
| OCR never finishes on huge scans | >10MB files are rejected; gigapixel images are downscaled — check the page console |
| Tests fail on imports | run from repo root with `npm test` (Vitest resolves ESM `.js` directly) |
