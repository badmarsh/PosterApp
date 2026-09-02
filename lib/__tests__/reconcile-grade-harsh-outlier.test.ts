import { describe, it, expect } from "vitest"
import {
  reconcileGrade,
  HARSH_OUTLIER_THRESHOLD,
  GRADE_DIVERGENCE_THRESHOLD,
} from "@/lib/ai/review-composer"

describe("Task 14: reconcileGrade Harsh-Outlier Flag and Divergence Detection", () => {
  it("exports calibrated thresholds", () => {
    expect(HARSH_OUTLIER_THRESHOLD).toBe(20)
    expect(GRADE_DIVERGENCE_THRESHOLD).toBe(15)
  })

  it("keeps the existing leniency correction separate from the harsh-outlier flag", () => {
    // Self-reported A (95), derived score 60 (D) -> delta = 35
    const result = reconcileGrade("A", 60, "D")

    expect(result.grade).toBe("D")
    expect(result.harshOutlierDivergence).toBe(false)
    expect(result.divergenceDelta).toBe(35)
    expect(result.divergenceWarning).toBeUndefined()
    expect(result.note).toContain("was more lenient")
  })

  it("flags harsh outlier divergence when harsh self-reported grade is below derived score by >= 20 points", () => {
    // Self-reported FX (20), derived score 85 (B) -> delta = 65
    const result = reconcileGrade("FX", 85, "B")

    // Keeps conservative self-report but attaches warning
    expect(result.grade).toBe("FX")
    expect(result.harshOutlierDivergence).toBe(true)
    expect(result.divergenceDelta).toBe(65)
    expect(result.divergenceWarning).toBeDefined()
    expect(result.divergenceWarning).toContain("harsh miscalibration outlier")
    expect(result.note).toContain("[Warning]")
  })

  it("does NOT set harshOutlierDivergence for normal agreement (delta < 20)", () => {
    // Self-reported B (85), derived score 82 (B) -> delta = 3
    const result = reconcileGrade("B", 82, "B")

    expect(result.grade).toBe("B")
    expect(result.harshOutlierDivergence).toBe(false)
    expect(result.divergenceDelta).toBe(3)
    expect(result.divergenceWarning).toBeUndefined()
    expect(result.note).toBeUndefined()
  })

  it("downgrades lenient grade for moderate divergence in (15, 20) without harsh outlier flag", () => {
    // Self-reported B (85), derived score 68 (D) -> delta = 17
    const result = reconcileGrade("B", 68, "D")

    expect(result.grade).toBe("D")
    expect(result.harshOutlierDivergence).toBe(false)
    expect(result.divergenceDelta).toBe(17)
    expect(result.divergenceWarning).toBeUndefined()
    expect(result.note).toContain("was more lenient")
    expect(result.note).not.toContain("[Warning]")
  })

  it("handles missing or invalid selfReportedGrade gracefully", () => {
    const result = reconcileGrade(undefined, 75, "C")
    expect(result.grade).toBe("C")
    expect(result.harshOutlierDivergence).toBeUndefined()
  })
})
