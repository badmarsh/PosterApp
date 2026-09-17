import { describe, it, expect } from "vitest"
import { credibilityAssessment } from "@/lib/services/search-quality"

describe("credibilityAssessment", () => {
  it("flags retracted papers with score 0 regardless of other signals", () => {
    const a = credibilityAssessment({
      isRetracted: true,
      citationCount: 900,
      openAccessPdfUrl: "https://example.org/x.pdf",
      venue: "Nature",
      year: 2025,
    })
    expect(a.level).toBe("retracted")
    expect(a.score).toBe(0)
    expect(a.isRetracted).toBe(true)
    expect(a.reasons[0]).toContain("retracted")
  })

  it("rates a highly cited, recent, OA paper as high", () => {
    const a = credibilityAssessment(
      {
        citationCount: 500,
        influentialCitationCount: 20,
        openAccessPdfUrl: "https://example.org/x.pdf",
        venue: "NeurIPS",
        year: 2025,
      },
      2026,
    )
    expect(a.level).toBe("high")
    expect(a.score).toBeGreaterThanOrEqual(75)
    expect(a.reasons.some((r) => r.includes("highly cited"))).toBe(true)
    expect(a.reasons.some((r) => r.includes("last two years"))).toBe(true)
  })

  it("rates a bare preprint with no metadata as low", () => {
    const a = credibilityAssessment({}, 2026)
    expect(a.level).toBe("low")
    expect(a.score).toBeLessThan(50)
    expect(a.reasons).toContain("limited metadata — verify before citing")
  })

  it("treats moderately cited venue papers as medium", () => {
    const a = credibilityAssessment(
      { citationCount: 30, venue: "Journal of HCI", year: 2020 },
      2026,
    )
    expect(a.level).toBe("medium")
  })

  it("clamps to 0–100 and notes very old work", () => {
    const a = credibilityAssessment({ citationCount: 9999, venue: "X", year: 1970 }, 2026)
    expect(a.score).toBeLessThanOrEqual(100)
    expect(a.reasons.some((r) => r.includes("years old"))).toBe(true)
  })
})
