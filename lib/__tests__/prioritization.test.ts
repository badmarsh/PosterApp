import { describe, it, expect } from "vitest"
import { calculateFindingPriority, sortFindingsByPriority } from "@/lib/ai/review-engine"
import type { ReviewFinding } from "@/lib/ai/review-types"

describe("Deterministic Prioritization Engine", () => {
  const baseFinding: ReviewFinding = {
    id: "f-base",
    category: "methodology",
    title: "Base Finding",
    explanation: "Explanation",
    recommendation: "Fix this",
    severity: "major",
    confidence: 0.9,
    evidence: [{ quote: "some quote", verified: true, state: "verified-exact" }],
    status: "unreviewed",
    includeInExport: true,
    createdBy: "ai",
  }

  it("assigns Rank 1 to unresolved critical findings", () => {
    const critical: ReviewFinding = { ...baseFinding, id: "f-crit", severity: "critical" }
    const res = calculateFindingPriority(critical, 0, "sk")
    expect(res.rank).toBe(1)
    expect(res.score).toBe(100)
    expect(res.reason).toContain("Kritická")
  })

  it("assigns Rank 2 to unresolved major findings", () => {
    const major: ReviewFinding = { ...baseFinding, id: "f-maj", severity: "major" }
    const res = calculateFindingPriority(major, 0, "sk")
    expect(res.rank).toBe(2)
    expect(res.score).toBe(80)
  })

  it("assigns Rank 3 to stale evidence findings", () => {
    const stale: ReviewFinding = {
      ...baseFinding,
      id: "f-stale",
      severity: "minor",
      evidenceState: "stale",
      evidence: [{ quote: "old quote", state: "stale" }],
    }
    const res = calculateFindingPriority(stale, 0, "sk")
    expect(res.rank).toBe(3)
    expect(res.score).toBe(70)
  })

  it("assigns Rank 5 to unverified evidence findings", () => {
    const unverified: ReviewFinding = {
      ...baseFinding,
      id: "f-unver",
      severity: "minor",
      evidenceState: "unverified",
      evidence: [{ quote: "missing quote", state: "unverified", verified: false }],
    }
    const res = calculateFindingPriority(unverified, 0, "sk")
    expect(res.rank).toBe(5)
    expect(res.score).toBe(60)
  })

  it("assigns Rank 10 to accepted/rejected/resolved findings", () => {
    const resolved: ReviewFinding = { ...baseFinding, id: "f-res", status: "accepted" }
    const res = calculateFindingPriority(resolved, 0, "sk")
    expect(res.rank).toBe(10)
    expect(res.score).toBe(10)
  })

  it("sorts multiple findings strictly by deterministic priority tuple with stable ID tie-break", () => {
    const fCritical: ReviewFinding = { ...baseFinding, id: "f-crit", severity: "critical" }
    const fMajor1: ReviewFinding = { ...baseFinding, id: "f-maj-b", severity: "major" }
    const fMajor2: ReviewFinding = { ...baseFinding, id: "f-maj-a", severity: "major" }
    const fResolved: ReviewFinding = { ...baseFinding, id: "f-res", severity: "critical", status: "accepted" }

    const sorted = sortFindingsByPriority([fResolved, fMajor1, fCritical, fMajor2], "sk")

    expect(sorted.map((f) => f.id)).toEqual(["f-crit", "f-maj-a", "f-maj-b", "f-res"])
  })
})
