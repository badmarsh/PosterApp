import { describe, it, expect, beforeEach } from "vitest"
import {
  isCircuitOpen, reportCircuitFailure, reportCircuitSuccess, recordAiUsage, getAiUsageSummary, resetAiTelemetry,
  BREAKER_FAILURE_THRESHOLD, BREAKER_OPEN_MS,
} from "@/lib/ai/telemetry"

describe("AI circuit breaker", () => {
  beforeEach(() => resetAiTelemetry())

  it("opens after N failures within the window and half-opens after cooldown", () => {
    const key = "https://primary"
    const t0 = 1_000_000
    for (let i = 0; i < BREAKER_FAILURE_THRESHOLD; i++) reportCircuitFailure(key, t0 + i)
    expect(isCircuitOpen(key, t0 + 10)).toBe(true)
    expect(isCircuitOpen(key, t0 + BREAKER_FAILURE_THRESHOLD + BREAKER_OPEN_MS)).toBe(false) // half-open trial
    reportCircuitFailure(key, t0 + BREAKER_FAILURE_THRESHOLD + BREAKER_OPEN_MS + 1) // trial failed → open again
    expect(isCircuitOpen(key, t0 + BREAKER_FAILURE_THRESHOLD + BREAKER_OPEN_MS + 2)).toBe(true)
    reportCircuitSuccess(key)
    expect(isCircuitOpen(key)).toBe(false)
  })

  it("ledger aggregates tokens per operation", () => {
    recordAiUsage({ at: new Date().toISOString(), operation: "peer-review", model: "m", provider: "primary", apiUrl: "u", promptTokens: 100, completionTokens: 50, totalTokens: 150, durationMs: 10, ok: true })
    recordAiUsage({ at: new Date().toISOString(), operation: "peer-review", model: "m", provider: "primary", apiUrl: "u", promptTokens: null, completionTokens: null, totalTokens: null, durationMs: 5, ok: false, status: 503 })
    const s = getAiUsageSummary()
    expect(s.totalCalls).toBe(2)
    expect(s.totalFailures).toBe(1)
    expect(s.totalPromptTokens).toBe(100)
    expect(s.byOperation["peer-review"].totalTokens).toBe(150)
    expect(s.lastHour.calls).toBe(2)
  })
})
