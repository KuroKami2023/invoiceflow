# DEPLOYMENT (Vercel Hobby + Supabase Free + NVIDIA free endpoint)

## 0. Prerequisites

- GitHub account, Vercel account (Hobby), Supabase account (Free), NVIDIA build account (free).
- This repo pushed to GitHub. JavaScript only — no build secrets beyond `.env`.

## 1. Supabase (5 min)

1. https://supabase.com → New project (Free) → note **Project URL** + **anon public key**
   (Project Settings → API).
2. Authentication → Providers → confirm **Email** is enabled.
3. SQL Editor → New query → paste `supabase/schema.sql` → Run (creates 4 tables, indexes,
   trigger, RLS policies).
4. Storage → New bucket → name `invoices`, **Private**, 10MB limit, allowed MIME
   `application/pdf,image/png,image/jpeg,image/webp`.
5. Storage → Policies → add the three commented policies from the bottom of `schema.sql`
   (insert/select/delete where first path folder = `auth.uid()`).

## 2. NVIDIA key (2 min)

https://build.nvidia.com → profile → API keys → create key. Copy it (you won't see it again).

## 3. Vercel (5 min)

1. https://vercel.com → Add New → Project → import the GitHub repo.
2. Framework preset: **Vite**. Build command `npm run build`, output `dist`
   (pre-set in `vercel.json` — confirm, don't override).
3. Environment Variables (all environments: Production, Preview, Development):
   - `VITE_SUPABASE_URL` = Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Supabase anon key
   - `NVIDIA_API_KEY` = NVIDIA key (**no** `VITE_` prefix)
4. Deploy. `api/*.js` deploy as serverless functions automatically; `vercel.json` rewrites
   non-API routes to `index.html` for React Router.

## 4. Verify production

1. `https://<app>.vercel.app/api/health` → `{"ok":true,"aiConfigured":true,…}`.
2. Register → confirm session persists on refresh → reset-password email arrives.
3. Demo → load demo data → approve one, reject one → search + CSV/JSON export.
4. Upload a real invoice → `needs_review` → fields + flags look right.
5. DevTools → Network → confirm no request/response contains `NVIDIA_API_KEY`.

## 5. Custom domain + hardening (optional)

- Vercel → Settings → Domains → add domain (free SSL).
- Set `FRONTEND_ORIGIN=https://<domain>` in Vercel env and redeploy (tightens CORS).
- Supabase → Authentication → URL Configuration → set Site URL to the domain.

## 6. Rollback / redeploy

Every push to the connected branch redeploys with preview URLs. Roll back via
Vercel → Deployments → ⋯ → Promote to Production. No migrations to unwind (schema is
applied manually in Supabase; keep `schema.sql` backward-compatible).

## 7. Costs

Vercel Hobby $0, Supabase Free $0, NVIDIA free endpoint $0 — within free-tier quotas
for portfolio/demo workloads. If NVIDIA free quota exhausts, the app degrades to
OCR + manual entry instead of erroring out.
