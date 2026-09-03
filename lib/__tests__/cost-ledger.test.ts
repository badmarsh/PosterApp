import { describe, it, expect, beforeEach } from "vitest"
import {
  estimateCallCostUsd,
  recordAiSpend,
  getAiBudgetStatus,
  checkAiBudget,
  resetAiCostLedger,
} from "@/lib/ai/cost-ledger"

describe("cost ledger — pricing", () => {
  it("prices known models per 1M tokens", () => {
    // gemini-3.7-flash: $0.3 / 1M prompt, $1.2 / 1M completion
    const cost = estimateCallCostUsd("gemini-3.7-flash", 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(1.5, 2)
  })

  it("returns 0 for unknown models", () => {
    expect(estimateCallCostUsd("mystery-model-x", 10_000, 5_000)).toBe(0)
  })

  it("handles null token counts", () => {
    expect(estimateCallCostUsd("gemini-3-flash", null, null)).toBe(0)
  })
})

describe("cost ledger — per-workspace daily budget", () => {
  beforeEach(() => resetAiCostLedger())

  it("accumulates spend per workspace and reports utilization", () => {
    recordAiSpend("ws-1", "gemini-3.7-flash", { promptTokens: 1_000_000, completionTokens: 1_000_000 })
    const status = getAiBudgetStatus("ws-1")
    expect(status.spentUsd).toBeCloseTo(1.5, 2)
    expect(status.calls).toBe(1)
    expect(status.utilization).toBeGreaterThan(0)
  })

  it("isolates workspaces", () => {
    recordAiSpend("ws-a", "gemini-3-pro", { promptTokens: 5_000_000, completionTokens: 0 })
    const b = getAiBudgetStatus("ws-b")
    expect(b.spentUsd).toBe(0)
  })

  it("soft stop blocks non-essential calls but allows essential ones", () => {
    // Burn through the default $2 budget.
    recordAiSpend("ws-budget", "gemini-3-pro", { promptTokens: 5_000_000, completionTokens: 1_000_000 })
    const optional = checkAiBudget("ws-budget", { essential: false })
    expect(optional.proceed).toBe(false)
    expect(optional.status.overBudget).toBe(true)

    const essential = checkAiBudget("ws-budget", { essential: true })
    expect(essential.proceed).toBe(true)
  })

  it("does not trip the soft stop under normal usage", () => {
    recordAiSpend("ws-ok", "gemini-3.7-flash", { promptTokens: 100_000, completionTokens: 50_000 })
    expect(checkAiBudget("ws-ok").proceed).toBe(true)
  })
})
