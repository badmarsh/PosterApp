import { describe, expect, it } from "vitest"
import { buildBudgetedReviewContext, MAX_REVIEW_CONTEXT_CHARS } from "../context-budget"

describe("buildBudgetedReviewContext", () => {
  it("enforces the hard 60,000-character ceiling even when the caller requests more", () => {
    const result = buildBudgetedReviewContext(
      [
        { key: "manuscript", label: "Routed manuscript excerpts", content: "A substantial manuscript sentence.\n\n".repeat(2_000), weight: 0.7 },
        { key: "retrieved", label: "Retrieved evidence", content: "Evidence passage with a measured result.\n".repeat(1_000), weight: 0.3 },
      ],
      MAX_REVIEW_CONTEXT_CHARS * 2,
    )

    expect(result.contextText.length).toBeLessThanOrEqual(MAX_REVIEW_CONTEXT_CHARS)
    expect(result.selectedChars).toBe(result.contextText.length)
    expect(result.truncated).toBe(true)
  })

  it("counts labels and separators inside a smaller requested budget", () => {
    const result = buildBudgetedReviewContext(
      [
        { key: "one", label: "Source one", content: "First evidence passage. ".repeat(20), weight: 1 },
        { key: "two", label: "Source two", content: "Second evidence passage. ".repeat(20), weight: 1 },
      ],
      100,
    )

    expect(result.contextText.length).toBeLessThanOrEqual(100)
    expect(result.selectedChars).toBe(result.contextText.length)
    expect(result.contextText).toContain("[Source one]")
    expect(result.contextText).toContain("[Source two]")
  })

  it("redistributes unused capacity from a short source to longer evidence", () => {
    const result = buildBudgetedReviewContext(
      [
        { key: "short", label: "Short", content: "Brief.", weight: 1 },
        { key: "long", label: "Long", content: "Long evidence sentence. ".repeat(100), weight: 1 },
      ],
      120,
    )

    expect(result.selectedBySource.short).toBe("Brief.".length)
    expect(result.selectedBySource.long).toBeGreaterThan(30)
    expect(result.selectedChars).toBeLessThanOrEqual(120)
  })
})
