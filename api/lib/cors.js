/** CORS helper for Vercel serverless functions. */

const DEFAULT_ALLOW = 'GET,POST,OPTIONS';

export function setCors(req, res, methods = DEFAULT_ALLOW) {
  // Lock this down in production via VERCEL_PROJECT_PRODUCTION_URL or custom domain.
  const allowedOrigin = process.env.FRONTEND_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
