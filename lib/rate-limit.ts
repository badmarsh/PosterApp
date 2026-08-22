/**
 * @remarks In-memory rate limiter — state is lost on server restart. Sufficient for single-user local dev. Replace with Redis or Upstash for multi-user production.
 */
export function rateLimit(ip: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  let record = store.get(ip)

  if (!record) {
    record = { count: 1, resetAt: now + windowMs }
    store.set(ip, record)
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

const store = new Map<string, { count: number; resetAt: number }>()
