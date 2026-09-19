import { describe, it, expect } from "vitest"
import { adjudicateFindings } from "../review-adjudicator"
import type { ReviewFinding } from "../review-types"

const makeFinding = (overrides: Partial<ReviewFinding>): ReviewFinding => ({
  id: "f-1",
  criterionKey: "methodology",
  criterionId: "methodology",
  title: "Test finding",
  findingType: "weakness",
  epistemicStatus: "REVIEWER_JUDGMENT",
  explanation: "Explanation",
  recommendation: "Fix it",
  severity: "major",
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

describe("Review Adjudicator", () => {
  it("downgrades critical finding that lacks evidence backing", () => {
    const findings = [
      makeFinding({
        id: "f-crit-no-ev",
        severity: "critical",
        evidence: [],
        evidenceState: "unverified",
      }),
    ]

    const report = adjudicateFindings({ primaryFindings: findings })
    expect(report.downgradedCount).toBe(1)
    expect(report.results[0].action).toBe("DOWNGRADE")
    expect(report.results[0].adjudicatedSeverity).toBe("major")
    expect(report.results[0].justification).toContain("lacks direct evidence anchor")
  })

  it("protects verified exact findings against arbitrary short critic downgrades", () => {
    const findings = [
      makeFinding({
        id: "f-exact",
        severity: "major",
        evidence: [{ exactQuote: "Exact citation from thesis", quote: "Exact citation from thesis", page: 12 }],
        evidenceState: "verified-exact",
      }),
    ]
    const objections = [
      {
        findingIdOrIndex: "f-exact",
        action: "downgrade" as const,
        suggestedSeverity: "minor" as const,
        reason: "Too harsh.",
      },
    ]

    const report = adjudicateFindings({ primaryFindings: findings, criticObjections: objections })
    expect(report.acceptedCount).toBe(1)
    expect(report.results[0].action).toBe("ACCEPT")
    expect(report.results[0].adjudicatedSeverity).toBe("major")
    expect(report.results[0].justification).toContain("Critic downgrade rejected")
  })

  it("escalates finding severity when numerical table contradiction is verified", () => {
    const findings = [
      makeFinding({
        id: "f-num",
        severity: "minor",
        explanation: "The accuracy reported in the text does not match the experiments.",
      }),
    ]
    const numericalDiscrepancies = [
      {
        parameter: "accuracy",
        inlineClaim: { value: 98.2, snippet: "accuracy = 98.2%" },
        tableOrEquationEvidence: { value: 88.1, snippet: "accuracy = 88.1%" },
        relativeDiscrepancy: 0.1,
        severity: "critical" as const,
        explanation: "10.1% accuracy discrepancy between abstract and table 4.",
      },
    ]

    const report = adjudicateFindings({
      primaryFindings: findings,
      numericalDiscrepancies,
    })
    expect(report.upgradedCount).toBe(1)
    expect(report.results[0].adjudicatedSeverity).toBe("major")
  })
})
