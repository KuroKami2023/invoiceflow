/** Minimal in-memory sliding-window rate limiter for serverless functions. */

const buckets = new Map();

function prune(now) {
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit({ key, limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now();
  if (buckets.size > 2000) prune(now);
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}
