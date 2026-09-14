import { findDuplicates } from './lib/duplicateCheck.js';
import { checkRateLimit } from './lib/rateLimit.js';
import { setCors } from './lib/cors.js';
import { getClientIp, readJsonBody, sendJson, toPublicError } from './lib/requestUtils.js';

/**
 * POST /api/duplicates-check
 * Body: { candidate: {supplier, invoice_number, invoice_date, total}, existing: [...], currentId? }
 * Stateless helper so the UI can warn (never auto-delete).
 */
export default async function handler(req, res) {
  if (setCors(req, res, 'POST,OPTIONS')) return;
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const rl = checkRateLimit({ key: `dup:${getClientIp(req)}`, limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return sendJson(res, 429, { ok: false, error: 'Too many requests. Please slow down.' });
  }

  try {
    const body = await readJsonBody(req);
    const candidate = body && typeof body.candidate === 'object' ? body.candidate : null;
    const existing = Array.isArray(body.existing) ? body.existing.slice(0, 500) : [];
    if (!candidate) {
      return sendJson(res, 400, { ok: false, error: 'candidate is required' });
    }
    const result = findDuplicates(candidate, existing, body.currentId || null);
    return sendJson(res, 200, { ok: true, ...result });
  } catch (err) {
    console.error('[api/duplicates-check] failed:', err && err.message ? err.message : err);
    const pub = toPublicError(err);
    return sendJson(res, pub.status, { ok: false, error: pub.message });
  }
}
