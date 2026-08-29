import { describe, it, expect, beforeEach, vi } from "vitest"
import { rateLimit, rateLimitAsync } from "../rate-limit"

describe("rateLimit", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("allows requests under the limit", () => {
    const key = `test-user-${Date.now()}`
    const r1 = rateLimit(key, 3, 1000)
    expect(r1.allowed).toBe(true)
    expect(r1.retryAfterMs).toBe(0)

    const r2 = rateLimit(key, 3, 1000)
    expect(r2.allowed).toBe(true)

    const r3 = rateLimit(key, 3, 1000)
    expect(r3.allowed).toBe(true)
  })

  it("blocks requests over the limit and returns retryAfterMs", () => {
    const key = `test-blocked-${Date.now()}`
    rateLimit(key, 2, 1000)
    rateLimit(key, 2, 1000)

    const blocked = rateLimit(key, 2, 1000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(1000)
  })

  it("rateLimitAsync falls back to memory when Upstash is not configured", async () => {
    const key = `test-async-${Date.now()}`
    const result = await rateLimitAsync(key, 5, 2000)
    expect(result.allowed).toBe(true)
    expect(result.retryAfterMs).toBe(0)
  })
})
