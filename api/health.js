import { setCors } from './lib/cors.js';
import { sendJson } from './lib/requestUtils.js';
import { __internal } from './services/nvidiaAI.js';

/** GET /api/health — no auth, no secrets. */
export default async function handler(req, res) {
  if (setCors(req, res, 'GET,OPTIONS')) return;
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }
  return sendJson(res, 200, {
    ok: true,
    service: 'invoiceflow-ai',
    model: __internal.NVIDIA_MODEL,
    aiConfigured: Boolean(process.env.NVIDIA_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
