# SECURITY

## Threat model (pragmatic, free-tier)

Untrusted inputs: uploaded files, OCR text, model JSON, URL params, form fields.
Must-protect: NVIDIA key, other users' invoices, session integrity, safe error surface.

## Controls

| Area | Control |
|------|---------|
| Credentials | `NVIDIA_API_KEY` server-only (Vercel env). No `VITE_` prefix, no `src/` import (grep-able invariant). Anon key is public by design. |
| Auth | Supabase Auth email/password (8+ chars, validated client-side in `authValidate.js` + server-side by Supabase), persisted sessions with auto-refresh, `ProtectedRoute` gates all app routes, password reset via emailed link. |
| Authorization | RLS on all tables: `auth.uid() = user_id` (children via parent). `api/lib/authorization.js` mirrors the rule for UI/tests. Cross-user access returns “not found / denied”, never another user's data. |
| File validation | MIME allow-list (`pdf/png/jpeg`) + extension check + 10MB client limit + empty-file rejection; server re-validates `/api/process` payloads (OCR ≤60k chars, image ≤~6MB, MIME allow-list, filename ≤255). |
| Injection | All DB access via Supabase parameterized client; no string-built SQL except the admin-run `schema.sql`. Filenames sanitized (`[^a-zA-Z0-9._-]→_`). CSV export quotes cells. |
| API abuse | Per-IP sliding-window rate limits (`/api/process` 20/min, `/api/duplicates-check` 60/min), body-size caps, `readJsonBody` rejects malformed/oversized JSON. |
| Model output | Never trusted: `extractJsonObject` repair + `validateExtraction` normalization; unknown → `null`/`""`, never invented. |
| Logging | Key/base64 never logged; errors log stage + status + lengths. `processing_runs.error_message` stores safe text (2k cap). |
| Error surface | `toPublicError()` — safe messages only; 401/403 auth failures get generic “check configuration” text, never key state beyond the `aiConfigured` boolean on `/api/health`. |
| CORS | `setCors()` with `FRONTEND_ORIGIN` override (default `*` for Hobby preview URLs; set it to your domain in production). |
| Storage | Private bucket, per-user path scoping, previews via `download()` blobs (no public URLs). |
| XSS | React escaping throughout; OCR/model text rendered as text (the AI JSON box uses `<pre>` text, not HTML). |

## Residual risks / hardening backlog

- In-memory rate limiting is per serverless instance — adequate for Hobby scale; move to
  Redis/Upstash for multi-instance strictness.
- No virus scanning of uploads (free-tier gap); the 10MB + type allow-list + private bucket
  reduce but don't eliminate malicious-file risk. Don't open uploads outside the app preview.
- `FRONTEND_ORIGIN=*` default is permissive; lock it to the production domain post-deploy.
- Consider Supabase email-confirmation enforcement + MFA for sensitive tenants.

## Verification

- `npm test` covers auth input rules, file/date validation, JSON repair, schema validation,
  totals, duplicates, ownership helpers + RLS presence in `schema.sql`, and safe-error mapping.
- Manual checklist: register → upload EXE (rejected) → upload 11MB file (rejected) →
  log in as user B and open user A's invoice URL (denied) → remove `NVIDIA_API_KEY` and
  upload (OCR-only save + flag) → inspect Network tab (no `NVIDIA_API_KEY` in any request).
