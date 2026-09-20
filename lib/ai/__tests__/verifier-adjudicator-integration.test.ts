/**
 * Integration tests for the verifier → adjudicator pipeline.
 *
 * These tests verify that:
 * 1. A finding with a numerical discrepancy is escalated by the adjudicator
 * 2. A finding with a CONTRADICTED claim verdict is escalated to critical
 * 3. The adjudicator receives and processes numerical discrepancies
 * 4. The equation checker detects undefined symbols and range violations
 */

import { describe, it, expect } from "vitest"
import { adjudicateFindings } from "../review-adjudicator"
import { verifyNumericalConsistency, extractNumericalData } from "../numerical-verifier"
import { checkEquationSanity, extractSymbolsFromFormula } from "../equation-consistency"
import { verifyClaim } from "../claim-verifier"
import type { ReviewFinding } from "../review-types"

function makeFinding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    id: "test-finding-1",
    criterionKey: "methodology",
    criterionId: "methodology_rigor",
    title: "Test Finding",
    findingType: "weakness",
    epistemicStatus: "REVIEWER_JUDGMENT",
    explanation: "Test explanation",
    recommendation: "Fix this",
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
  }
}

describe("Verifier → Adjudicator Integration", () => {
  describe("Numerical discrepancy escalation", () => {
    it("escalates a finding when a critical numerical discrepancy is detected", () => {
      const finding = makeFinding({
        id: "num-finding-1",
        explanation: "The model achieved accuracy = 0.95 on the benchmark dataset",
        severity: "minor",
      })

      const discrepancies = [{
        parameter: "accuracy",
        inlineClaim: { value: 0.95, snippet: "accuracy = 0.95", unit: undefined },
        tableOrEquationEvidence: { value: 0.85, snippet: "accuracy = 0.85", unit: undefined },
        relativeDiscrepancy: 0.105,
        severity: "critical" as const,
        explanation: "Manuscript text claims accuracy = 0.95 but backing table reports 0.85",
      }]

      const report = adjudicateFindings({
        primaryFindings: [finding],
        numericalDiscrepancies: discrepancies,
      })

      expect(report.results.length).toBe(1)
      const result = report.results[0]
      // Minor finding with critical numerical discrepancy should be escalated
      expect(result.action).toBe("UPGRADE")
      expect(result.adjudicatedSeverity).toBe("major")
      expect(result.justification).toContain("numerical")
      expect(result.justification).toContain("discrepancy")
    })

    it("does not escalate when no relevant numerical discrepancy exists", () => {
      const finding = makeFinding({
        id: "num-finding-2",
        explanation: "The literature review is incomplete",
        severity: "minor",
      })

      const discrepancies = [{
        parameter: "accuracy",
        inlineClaim: { value: 0.95, snippet: "accuracy = 0.95" },
        tableOrEquationEvidence: { value: 0.85, snippet: "accuracy = 0.85" },
        relativeDiscrepancy: 0.105,
        severity: "critical" as const,
        explanation: "Discrepancy in accuracy",
      }]

      const report = adjudicateFindings({
        primaryFindings: [finding],
        numericalDiscrepancies: discrepancies,
      })

      expect(report.results.length).toBe(1)
      const result = report.results[0]
      // Finding doesn't mention "accuracy" — no escalation
      expect(result.action).toBe("ACCEPT")
      expect(result.adjudicatedSeverity).toBe("minor")
    })
  })

  describe("Numerical verifier extraction", () => {
    it("extracts p-values from text", () => {
      const data = extractNumericalData("The results were significant (p < 0.05)")
      expect(data.length).toBeGreaterThanOrEqual(1)
      const pValue = data.find((d) => d.parameter === "p-value")
      expect(pValue).toBeDefined()
      expect(pValue!.value).toBe(0.05)
    })

    it("extracts accuracy from text", () => {
      const data = extractNumericalData("Our model achieved accuracy = 0.942 on the test set")
      expect(data.length).toBeGreaterThanOrEqual(1)
      const acc = data.find((d) => d.parameter === "accuracy")
      expect(acc).toBeDefined()
      expect(acc!.value).toBeCloseTo(0.942, 2)
    })

    it("detects numerical discrepancy between inline and table values", () => {
      const result = verifyNumericalConsistency(
        "The model achieved accuracy = 0.95 on the benchmark",
        [{ content: "| Model | Accuracy |\n| Ours | accuracy = 0.85 |" }]
      )
      expect(result.discrepancies.length).toBe(1)
      expect(result.discrepancies[0].severity).toBe("critical")
      expect(result.isConsistent).toBe(false)
    })

    it("returns no discrepancy when values match", () => {
      const result = verifyNumericalConsistency(
        "The model achieved accuracy = 0.95 on the benchmark",
        [{ content: "| Model | Accuracy |\n| Ours | accuracy = 0.95 |" }]
      )
      expect(result.discrepancies.length).toBe(0)
      expect(result.isConsistent).toBe(true)
    })
  })

  describe("Equation consistency checker", () => {
    it("extracts symbols from formula", () => {
      const symbols = extractSymbolsFromFormula("E = mc^2")
      expect(symbols).toContain("E")
      expect(symbols).toContain("m")
      expect(symbols).toContain("c")
    })

    it("detects undefined symbols", () => {
      const result = checkEquationSanity(
        "P(A|B) = x * y",
        "The conditional probability is computed as shown above."
      )
      // x and y should be flagged as undefined in prose
      expect(result.undefinedSymbols.length).toBeGreaterThan(0)
    })

    it("detects out-of-range probability values", () => {
      const result = checkEquationSanity(
        "P(event) = 1.5",
        "The probability of the event occurring."
      )
      expect(result.rangeViolations.length).toBe(1)
      expect(result.rangeViolations[0]).toContain("out of valid bounds")
      expect(result.isValid).toBe(false)
    })
  })

  describe("Claim verifier", () => {
    it("verifies SUPPORTED claims", () => {
      const result = verifyClaim(
        { claimKey: "c-1", text: "Accuracy reaches 94.2% on standard benchmark" },
        [{ id: "ch-1", content: "Experimental accuracy reaches 94.2% on standard benchmark." }]
      )
      expect(result.verdict).toBe("SUPPORTED")
      expect(result.supportingEvidenceIds.length).toBeGreaterThan(0)
    })

    it("verifies UNSUPPORTED claims", () => {
      const result = verifyClaim(
        { claimKey: "c-2", text: "Superconductivity is observed at room temperature" },
        [{ id: "ch-2", content: "We discuss medieval history." }]
      )
      expect(result.verdict).toBe("UNSUPPORTED")
    })

    it("detects CONTRADICTED claims via numerical discrepancy", () => {
      const result = verifyClaim(
        { claimKey: "c-3", text: "Our model achieved accuracy = 98.2% on the benchmark dataset" },
        [{ id: "ch-3", content: "Our model achieved accuracy = 98.2% on the benchmark dataset" }],
        { tables: [{ chunkId: "tab-1", content: "| Model | Accuracy |\n| Ours | accuracy = 88.1% |" }] }
      )
      expect(result.verdict).toBe("CONTRADICTED")
      expect(result.numericalDiscrepancies.length).toBeGreaterThan(0)
    })
  })
})