/**
 * @remarks In-memory rate limiter — state is lost on server restart. Sufficient for single-user local dev. 
 * IMPORTANT: Replace with a distributed store (e.g. Redis/Upstash) for production with multiple instances.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  let record = store.get(key)

  if (!record) {
    record = { count: 1, resetAt: now + windowMs }
    store.set(key, record)
    if (store.size > MAX_STORE_SIZE) pruneStore(now)
    return { allowed: true, retryAfterMs: 0 }
  }

  if (now > record.resetAt) {
    record.count = 1
    record.resetAt = now + windowMs
    return { allowed: true, retryAfterMs: 0 }
  }

  if (record.count >= limit) {
    return { allowed: false, retryAfterMs: record.resetAt - now }
  }

  record.count++
  return { allowed: true, retryAfterMs: 0 }
}

const MAX_STORE_SIZE = 10000;
const store = new Map<string, { count: number; resetAt: number }>();

function pruneStore(now: number) {
  for (const [key, record] of store.entries()) {
    if (now > record.resetAt) {
      store.delete(key);
    }
  }
}
