import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { rateLimit, rateLimitAsync } from "../../lib/rate-limit"

describe("Rate Limiter", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.useFakeTimers()
    process.env = { ...originalEnv }
    // Ensure memory store is clear between tests
    // A bit hacky since it's a module level const, we can advance timers to clear it
    vi.advanceTimersByTime(100_000)
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe("Memory Rate Limiter", () => {
    it("allows requests under the limit", () => {
      const res1 = rateLimit("test_mem_1", 2, 60000)
      expect(res1.allowed).toBe(true)
      const res2 = rateLimit("test_mem_1", 2, 60000)
      expect(res2.allowed).toBe(true)
    })

    it("blocks requests over the limit", () => {
      rateLimit("test_mem_2", 1, 60000)
      const res = rateLimit("test_mem_2", 1, 60000)
      expect(res.allowed).toBe(false)
      expect(res.retryAfterMs).toBeGreaterThan(0)
    })

    it("resets after the window", () => {
      rateLimit("test_mem_3", 1, 1000)
      vi.advanceTimersByTime(1001)
      const res = rateLimit("test_mem_3", 1, 1000)
      expect(res.allowed).toBe(true)
    })
  })

  describe("Async Rate Limiter (Upstash Fallback)", () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = "http://fake-upstash"
      process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"
    })

    it("falls back to memory (fail-open) on network error by default", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"))

      const res1 = await rateLimitAsync("test_async_1", 1, 60000)
      expect(res1.allowed).toBe(true) // Hits memory

      const res2 = await rateLimitAsync("test_async_1", 1, 60000)
      expect(res2.allowed).toBe(false) // Blocked by memory
    })

    it("falls back to memory (fail-open) on non-200 HTTP response by default", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      const res1 = await rateLimitAsync("test_async_2", 1, 60000)
      expect(res1.allowed).toBe(true) // Hits memory

      const res2 = await rateLimitAsync("test_async_2", 1, 60000)
      expect(res2.allowed).toBe(false) // Blocked by memory
    })

    it("blocks request (fail-closed) on network error when RATE_LIMIT_FAIL_MODE is closed", async () => {
      process.env.RATE_LIMIT_FAIL_MODE = "closed"
      global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"))

      const res = await rateLimitAsync("test_async_3", 1, 60000)
      expect(res.allowed).toBe(false)
      expect(res.retryAfterMs).toBe(60000)
    })

    it("blocks request (fail-closed) on non-200 HTTP response when RATE_LIMIT_FAIL_MODE is closed", async () => {
      process.env.RATE_LIMIT_FAIL_MODE = "closed"
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      const res = await rateLimitAsync("test_async_4", 1, 60000)
      expect(res.allowed).toBe(false)
      expect(res.retryAfterMs).toBe(60000)
    })
  })
})
