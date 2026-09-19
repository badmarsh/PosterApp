import { describe, it, expect } from "vitest"
import { getThesisReviewStore } from "@/components/thesis-review/use-thesis-review-store"
import type { ReviewFinding } from "@/lib/ai/review-types"
import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"

describe("Thesis Review Workspace Performance Optimizations", () => {
  const dummyFindings: ReviewFinding[] = [
    {
      id: "f-1",
      title: "Critical safety issue",
      explanation: "Safety gap",
      recommendation: "Implement safety check",
      confidence: 0.95,
      createdBy: "ai",
      severity: "critical",
      status: "unreviewed",
      category: "methodology",
      includeInExport: true,
      evidence: [{ quote: "Quote 1", verified: true, state: "verified-exact" }],
      evidenceState: "verified-exact",
    },
    {
      id: "f-2",
      title: "Missing baseline model comparison",
      explanation: "No comparison",
      recommendation: "Add baseline model",
      confidence: 0.9,
      createdBy: "ai",
      severity: "major",
      status: "unreviewed",
      category: "reproducibility",
      includeInExport: true,
      evidence: [{ quote: "Quote 2", verified: false, state: "unverified" }],
      evidenceState: "unverified",
    },
    {
      id: "f-3",
      title: "Typo in abstract",
      explanation: "Small typo",
      recommendation: "Correct spelling",
      confidence: 0.99,
      createdBy: "ai",
      severity: "minor",
      status: "accepted",
      category: "formal",
      includeInExport: true,
      evidence: [{ quote: "Quote 3", verified: true, state: "verified" }],
      evidenceState: "verified",
    },
    {
      id: "f-4",
      title: "Ambiguous notation in equation",
      explanation: "Notation ambiguity",
      recommendation: "Define variables clearly",
      confidence: 0.85,
      createdBy: "reviewer",
      severity: "suggestion",
      status: "rejected",
      category: "statistics",
      includeInExport: false,
      evidence: [{ quote: "Quote 4", verified: true, state: "ambiguous" }],
      evidenceState: "ambiguous",
    },
  ]

  describe("1. Single-Pass Queue Stats Counters", () => {
    it("computes all 7 tab counters accurately in a single O(N) pass", () => {
      let major = 0
      let unreviewed = 0
      let missingEvidence = 0
      let reporting = 0
      let exp = 0
      let resolved = 0
      let blockers = 0

      for (const f of dummyFindings) {
        const isMajor = f.severity === "critical" || f.severity === "major"
        const isUnreviewed = f.status === "unreviewed"
        if (isMajor) major++
        if (isUnreviewed) {
          unreviewed++
          if (isMajor) blockers++
        }
        if (
          f.evidenceState === "unverified" ||
          f.evidenceState === "stale" ||
          f.evidenceState === "ambiguous" ||
          !f.evidence?.every((e) => e.verified)
        ) {
          missingEvidence++
        }
        if (f.category === "reproducibility" || f.category === "statistics") reporting++
        if (f.includeInExport !== false && f.status !== "rejected") exp++
        if (f.status === "accepted" || f.status === "resolved" || f.status === "rejected") resolved++
      }

      // f-1 (critical) and f-2 (major)
      expect(major).toBe(2)
      // f-1 (unreviewed) and f-2 (unreviewed)
      expect(unreviewed).toBe(2)
      // f-2 (unverified) and f-4 (ambiguous)
      expect(missingEvidence).toBe(2)
      // f-2 (reproducibility) and f-4 (statistics)
      expect(reporting).toBe(2)
      // f-1, f-2, f-3 (not rejected)
      expect(exp).toBe(3)
      // f-3 (accepted) and f-4 (rejected)
      expect(resolved).toBe(2)
      // f-1 and f-2 are unreviewed major/critical
      expect(blockers).toBe(2)
    })
  })

  describe("2. Immer Structural Sharing for FindingCard memo bailout", () => {
    it("preserves object references for unmodified findings when accepting a single finding", () => {
      const store = getThesisReviewStore("ws_perf_test:out_1")

      const mockReview: ThesisReviewRecord = {
        id: "rev-perf-1",
        studentName: "Ján Novák",
        thesisTitle: "Performance optimization of large documents",
        thesisType: "master",
        reviewerRole: "opponent",
        status: "draft",
        language: "sk",
        sections: [],
        defenseQuestions: [],
        citationIssues: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        findings: [...dummyFindings],
      }

      store.getState().setActiveReview(mockReview)

      const initialFindings = store.getState().activeReview?.findings ?? []
      expect(initialFindings).toHaveLength(4)

      // Accept finding f-2
      store.getState().acceptFinding("f-2")

      const updatedFindings = store.getState().activeReview?.findings ?? []
      expect(updatedFindings).toHaveLength(4)

      // The modified finding has changed status and reference
      expect(updatedFindings[1].id).toBe("f-2")
      expect(updatedFindings[1].status).toBe("accepted")
      expect(Object.is(updatedFindings[1], initialFindings[1])).toBe(false)

      // CRITICAL FOR REACT.MEMO: Unmodified findings MUST have identical references
      expect(Object.is(updatedFindings[0], initialFindings[0])).toBe(true)
      expect(Object.is(updatedFindings[2], initialFindings[2])).toBe(true)
      expect(Object.is(updatedFindings[3], initialFindings[3])).toBe(true)
    })

    it("preserves object references for unmodified findings when editing a single finding", () => {
      const store = getThesisReviewStore("ws_perf_test:out_1")

      const initialFindings = store.getState().activeReview?.findings ?? []

      // Edit finding f-1
      store.getState().editFinding("f-1", { reviewerNotes: "Verified with supervisor" })

      const updatedFindings = store.getState().activeReview?.findings ?? []

      expect(updatedFindings[0].id).toBe("f-1")
      expect(updatedFindings[0].reviewerNotes).toBe("Verified with supervisor")
      expect(Object.is(updatedFindings[0], initialFindings[0])).toBe(false)

      // All other findings retained exact object identity
      expect(Object.is(updatedFindings[1], initialFindings[1])).toBe(true)
      expect(Object.is(updatedFindings[2], initialFindings[2])).toBe(true)
      expect(Object.is(updatedFindings[3], initialFindings[3])).toBe(true)
    })
  })
})
