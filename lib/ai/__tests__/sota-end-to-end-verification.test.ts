import { describe, it, expect } from "vitest"
import { verifyClaim } from "../claim-verifier"
import { adjudicateFindings } from "../review-adjudicator"
import { compareClaimToPaper } from "../scholarly-comparator"
import { verifyNumericalConsistency } from "../numerical-verifier"
import { checkEquationSanity } from "../equation-consistency"
import { getGradedGoldenSet } from "../retrieval-golden-dataset"
import { runAblationMatrix } from "../eval/ablation-runner"
import type { ReviewFinding } from "../review-types"

describe("SOTA Thesis Review Engine — End-to-End Stress & Verification Suite", () => {
  describe("1. Multilingual Graded Golden Retrieval Suite", () => {
    it("verifies full coverage across domains, splits, and SK/CS/EN languages", () => {
      const dataset = getGradedGoldenSet()
      expect(dataset.length).toBeGreaterThanOrEqual(60)

      const langs = new Set(dataset.map((q) => q.lang))
      expect(langs).toContain("sk")
      expect(langs).toContain("cs")
      expect(langs).toContain("en")

      const domains = new Set(dataset.map((q) => q.domain))
      expect(domains).toContain("cs_ai")
      expect(domains).toContain("physics_stem")
      expect(domains).toContain("biomedical")
      expect(domains).toContain("economics_social")
      expect(domains).toContain("general_academic")

      // Graded target assertions
      for (const q of dataset) {
        expect(q.expectedSections.length).toBeGreaterThan(0)
        expect(q.gradedTargets.length).toBeGreaterThan(0)
        for (const t of q.gradedTargets) {
          expect(t.relevanceGrade).toBeGreaterThanOrEqual(1)
          expect(t.relevanceGrade).toBeLessThanOrEqual(4)
        }
      }
    })

    it("confirms 6-source fusion + expansion beats dense-only and hybrid on nDCG and recall", async () => {
      const report = await runAblationMatrix()
      const dense = report.variants.find((v) => v.variant === "dense-only")!
      const lexical = report.variants.find((v) => v.variant === "lexical-only")!
      const hybrid = report.variants.find((v) => v.variant === "hybrid")!
      const full = report.variants.find((v) => v.variant === "full-fusion-expanded")!

      expect(hybrid.meanRecallAt10).toBeGreaterThan(dense.meanRecallAt10)
      expect(hybrid.meanRecallAt10).toBeGreaterThan(lexical.meanRecallAt10)
      expect(full.meanRecallAt10).toBeGreaterThan(hybrid.meanRecallAt10)
      expect(full.meanNdcgAt10).toBeGreaterThan(hybrid.meanNdcgAt10)
      expect(full.meanRecallAt10).toBeGreaterThanOrEqual(0.95)
    })
  })

  describe("2. Deterministic Scientific Verification (Zero-Hallucination Gate)", () => {
    it("flags subtle statistical/accuracy discrepancies between prose and multi-column tables", () => {
      const abstractText = "Our proposed deep neural architecture achieved accuracy = 96.4% on ImageNet benchmark."
      const tableRows = [
        {
          chunkId: "table-1",
          content: "| Method | Top-1 Accuracy | F1 |\n| Baseline | 91.2% | 0.89 |\n| Proposed | accuracy = 82.1% | 0.81 |",
        },
      ]

      const check = verifyNumericalConsistency(abstractText, tableRows)
      expect(check.isConsistent).toBe(false)
      expect(check.discrepancies.length).toBe(1)
      expect(check.discrepancies[0].severity).toBe("critical")
      expect(check.discrepancies[0].relativeDiscrepancy).toBeGreaterThan(0.1)
    })

    it("verifies mathematical formula symbols and catches illegal probability values", () => {
      const formula = "P(Event) = 1.62"
      const prose = "kde P(Event) vyjadruje pravdepodobnost detekcie castice"

      const sanity = checkEquationSanity(formula, prose)
      expect(sanity.isValid).toBe(false)
      expect(sanity.rangeViolations.length).toBe(1)
      expect(sanity.rangeViolations[0]).toContain("out of valid bounds [0, 1]")
    })

    it("verifies factual claim status against supporting and counter-evidence chunks", () => {
      const claim = {
        claimKey: "claim-particle-1",
        text: "The measured particle resonance peak is observed at energy = 125 GeV.",
      }

      const chunks = [
        {
          id: "chunk-support-1",
          content: "The measured particle resonance peak is observed at energy = 125 GeV with high statistical confidence.",
          heading: "Results",
        },
        {
          id: "chunk-support-2",
          content: "We confirm that the measured particle resonance peak is observed at energy = 125 GeV across all detector runs.",
          heading: "Discussion",
        },
      ]

      const res = verifyClaim(claim, chunks)
      expect(res.verdict).toBe("SUPPORTED")
      expect(res.confidence).toBeGreaterThanOrEqual(0.8)
      expect(res.supportingEvidenceIds).toContain("chunk-support-1")
      expect(res.supportingEvidenceIds).toContain("chunk-support-2")
    })
  })

  describe("3. Temporal Novelty & Prior-Art Classification", () => {
    it("strictly separates pre-thesis prior art from post-thesis concurrent or subsequent works", () => {
      const claim = "We propose an end-to-end vision transformer for autonomous drone navigation."

      // Paper published prior to thesis in 2020
      const priorPaper = {
        title: "Vision transformer for autonomous drone navigation",
        abstract: "We propose an end-to-end vision transformer model for navigation.",
        year: 2019,
      }
      const priorComp = compareClaimToPaper(claim, priorPaper, 2021, "2021-06-01", 0.91)
      expect(priorComp.isPriorArt).toBe(true)
      expect(priorComp.temporalValidity).toBe("valid")

      // Paper published post thesis in 2024
      const postPaper = {
        title: "Vision transformer for autonomous drone navigation",
        abstract: "We propose an end-to-end vision transformer model for navigation.",
        year: 2024,
      }
      const postComp = compareClaimToPaper(claim, postPaper, 2021, "2021-06-01", 0.91)
      expect(postComp.isPriorArt).toBe(false)
      expect(postComp.relation).toBe("POSTDATED")
      expect(postComp.temporalValidity).toBe("postdated")
    })
  })

  describe("4. Adjudicator & Severity Calibration", () => {
    it("downgrades unanchored critical findings to prevent false academic penalties", () => {
      const unanchoredFinding: ReviewFinding = {
        id: "f-hallucinated-crit",
        criterionKey: "methodology",
        criterionId: "methodology",
        title: "Fatal flaw claimed without any citation",
        findingType: "weakness",
        epistemicStatus: "REVIEWER_JUDGMENT",
        explanation: "Author supposedly failed to validate.",
        recommendation: "Reject",
        severity: "critical",
        category: "methodology",
        confidence: 0.5,
        evidence: [],
        evidenceState: "unverified",
        status: "unreviewed",
        decisionStatus: "open",
        includeInExport: true,
        createdBy: "ai",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const report = adjudicateFindings({ primaryFindings: [unanchoredFinding] })
      expect(report.downgradedCount).toBe(1)
      expect(report.results[0].action).toBe("DOWNGRADE")
      expect(report.results[0].adjudicatedSeverity).toBe("major")
    })

    it("protects verified exact findings when critic attempts unfounded downgrade", () => {
      const verifiedFinding: ReviewFinding = {
        id: "f-verified-exact",
        criterionKey: "methodology",
        criterionId: "methodology",
        title: "Exact quotation proves missing baseline comparison",
        findingType: "weakness",
        epistemicStatus: "SUPPORTED_FACT",
        explanation: "As stated: 'we did not compare with any baselines due to time constraints.'",
        recommendation: "Compare with baselines",
        severity: "major",
        category: "methodology",
        confidence: 0.95,
        evidence: [{ quote: "we did not compare with any baselines due to time constraints.", exactQuote: "we did not compare with any baselines due to time constraints.", page: 44 }],
        evidenceState: "verified-exact",
        status: "unreviewed",
        decisionStatus: "open",
        includeInExport: true,
        createdBy: "ai",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const report = adjudicateFindings({
        primaryFindings: [verifiedFinding],
        criticObjections: [
          {
            findingIdOrIndex: "f-verified-exact",
            action: "downgrade",
            suggestedSeverity: "minor",
            reason: "Too harsh.",
          },
        ],
      })

      expect(report.acceptedCount).toBe(1)
      expect(report.results[0].action).toBe("ACCEPT")
      expect(report.results[0].adjudicatedSeverity).toBe("major")
      expect(report.results[0].justification).toContain("Critic downgrade rejected: finding is supported by verified exact manuscript evidence")
    })
  })
})
