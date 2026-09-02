import { describe, it, expect } from "vitest"
import { reconcileGrade, checkContributionCoverage } from "@/lib/ai/review-engine"
import type { ReviewFinding } from "@/lib/ai/review-types"

// ---------------------------------------------------------------------------
// reconcileGrade (Task 2)
// ---------------------------------------------------------------------------

describe("reconcileGrade", () => {
  it("downgrades a too-lenient self-report (A vs derivedScore 60 -> D)", () => {
    const result = reconcileGrade("A", 60, "D")
    expect(result.grade).toBe("D")
    expect(result.note).toMatch(/self-reported grade/)
    expect(result.note).toMatch(/Downgraded/)
  })

  it("keeps a harsher self-report unchanged (D vs derivedScore 95 -> stays D) with harsh outlier warning", () => {
    const result = reconcileGrade("D", 95, "A")
    expect(result.grade).toBe("D")
    expect(result.harshOutlierDivergence).toBe(true)
    expect(result.note).toContain("[Warning]")
  })

  it("falls back to derivedGrade when self-report is undefined", () => {
    const result = reconcileGrade(undefined, 80, "B")
    expect(result.grade).toBe("B")
    expect(result.note).toBeUndefined()
  })

  it("falls back to derivedGrade for unknown self-report grades", () => {
    const result = reconcileGrade("X+", 70, "C")
    expect(result.grade).toBe("C")
  })

  it("keeps self-report within threshold (B vs derivedScore 80 -> keeps B)", () => {
    const result = reconcileGrade("B", 80, "B")
    expect(result.grade).toBe("B")
    expect(result.note).toBeUndefined()
  })

  it("downgrades to FX when LLM reports B but derivedScore is catastrophic (10)", () => {
    const result = reconcileGrade("B", 10, "FX")
    expect(result.grade).toBe("FX")
    expect(result.note).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// checkContributionCoverage (Task 3)
// ---------------------------------------------------------------------------

const makeFinding = (overrides: Partial<ReviewFinding> = {}): ReviewFinding => ({
  id: "f-1",
  criterionId: "methodology",
  criterionKey: "methodology",
  title: "Test",
  findingType: "weakness",
  epistemicStatus: "REVIEWER_JUDGMENT",
  explanation: "Explanation",
  recommendation: "Recommendation",
  severity: "minor",
  category: "methodology",
  confidence: 0.8,
  evidence: [],
  evidenceState: "unverified",
  status: "unreviewed",
  decisionStatus: "open",
  includeInExport: true,
  createdBy: "ai",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe("checkContributionCoverage", () => {
  it("returns null for thesisType master regardless of findings", () => {
    expect(checkContributionCoverage([], "master", "en")).toBeNull()
    expect(checkContributionCoverage([makeFinding()], "master", "en")).toBeNull()
  })

  it("returns null for thesisType bachelor", () => {
    expect(checkContributionCoverage([], "bachelor", "sk")).toBeNull()
  })

  it("returns null for PhD when a finding has category results", () => {
    expect(checkContributionCoverage([makeFinding({ category: "results" })], "phd", "en")).toBeNull()
  })

  it("returns null for PhD when a finding mentions originality in title", () => {
    expect(checkContributionCoverage([makeFinding({ title: "Weak originality claim" })], "phd", "en")).toBeNull()
  })

  it("returns null for PhD when a finding mentions contribution in explanation", () => {
    expect(checkContributionCoverage([makeFinding({ explanation: "Scientific contribution unclear." })], "phd", "en")).toBeNull()
  })

  it("returns null for PhD when a finding mentions novelty", () => {
    expect(checkContributionCoverage([makeFinding({ title: "Missing novelty" })], "phd", "en")).toBeNull()
  })

  it("returns a major severity finding for PhD with empty findings array", () => {
    const guard = checkContributionCoverage([], "phd", "en")
    expect(guard).not.toBeNull()
    expect(guard!.severity).toBe("major")
    expect(guard!.criterionId).toBe("originality")
    expect(guard!.id).toBe("contribution-coverage-check")
    expect(guard!.epistemicStatus).toBe("REQUIRES_HUMAN_VERIFICATION")
  })

  it("returns Slovak text for sk language", () => {
    const guard = checkContributionCoverage([], "phd", "sk")
    expect(guard).not.toBeNull()
    expect(guard!.title).toMatch(/pr\u00ednos/)
  })

  it("returns Czech text for cs language", () => {
    const guard = checkContributionCoverage([], "phd", "cs")
    expect(guard).not.toBeNull()
    expect(guard!.title).toMatch(/p\u0159\u00ednosu/)
  })

  it("returns major finding for PhD with only formal/unrelated findings", () => {
    const findings = [makeFinding({ category: "formal", title: "Missing page numbers" })]
    const guard = checkContributionCoverage(findings, "phd", "en")
    expect(guard).not.toBeNull()
    expect(guard!.severity).toBe("major")
  })
})
