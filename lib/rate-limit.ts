/**
 * Rate Limiter for API endpoints and AI spend protection.
 * Supports in-memory storage for local dev and Upstash Redis REST API when configured.
 */

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

const MAX_STORE_SIZE = 10000
const store = new Map<string, { count: number; resetAt: number }>()

let warnedProdInMemory = false

function checkProdWarning() {
  if (
    !warnedProdInMemory &&
    process.env.NODE_ENV === "production" &&
    !process.env.UPSTASH_REDIS_REST_URL &&
    !process.env.KV_REST_API_URL
  ) {
    warnedProdInMemory = true
    console.warn(
      "[rate-limit] WARNING: Running in production with in-memory rate limiting. Configure UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN for distributed rate limiting."
    )
  }
}

function pruneStore(now: number) {
  for (const [key, record] of store.entries()) {
    if (now > record.resetAt) {
      store.delete(key)
    }
  }
}

/**
 * Synchronous in-memory rate limit check.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  checkProdWarning()
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

/**
 * Async rate limiter with Upstash Redis REST support when configured,
 * falling back to in-memory rate limiting.
 */
export async function rateLimitAsync(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const upstashUrl =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const upstashToken =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

  if (!upstashUrl || !upstashToken) {
    return rateLimit(key, limit, windowMs)
  }

  try {
    const windowSec = Math.ceil(windowMs / 1000)
    // Upstash REST Pipeline: INCR key, EXPIRE key windowSec NX, PTTL key
    const pipelineUrl = `${upstashUrl.replace(/\/$/, "")}/pipeline`
    const res = await fetch(pipelineUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", `ratelimit:${key}`],
        ["EXPIRE", `ratelimit:${key}`, windowSec, "NX"],
        ["PTTL", `ratelimit:${key}`],
      ]),
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) {
      if (process.env.RATE_LIMIT_FAIL_MODE === "closed") {
        console.error(`[rate-limit] Upstash HTTP error ${res.status} (fail-closed)`)
        return { allowed: false, retryAfterMs: windowMs }
      }
      console.warn(`[rate-limit] Upstash HTTP error ${res.status}, falling back to memory`)
      return rateLimit(key, limit, windowMs)
    }

    const data = await res.json()
    const count = Number(data[0]?.result) || 1
    const pttl = Number(data[2]?.result) || windowMs
    const retryAfterMs = Math.max(0, pttl)

    if (count > limit) {
      return { allowed: false, retryAfterMs }
    }

    return { allowed: true, retryAfterMs: 0 }
  } catch (err) {
    if (process.env.RATE_LIMIT_FAIL_MODE === "closed") {
      console.error("[rate-limit] Upstash error (fail-closed):", err)
      return { allowed: false, retryAfterMs: windowMs }
    }
    console.warn("[rate-limit] Upstash error, falling back to memory:", err)
    return rateLimit(key, limit, windowMs)
  }
}
