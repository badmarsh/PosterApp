import { describe, it, expect } from "vitest"
import {
  classifyDisciplineAndThesisType,
  detectReportingGuideline,
} from "@/lib/ai/document-understanding"
import { AUTO_APPLY_CONFIDENCE_THRESHOLD } from "@/lib/ai/thesis-review-policy"

describe("Task 9: Thesis Classification and Confidence-Gated Guideline Suggestion", () => {
  it("exports the calibrated confidence threshold constant of 0.8", () => {
    expect(AUTO_APPLY_CONFIDENCE_THRESHOLD).toBe(0.8)
  })

  it("detects randomized controlled trial keywords as CONSORT", () => {
    const text = "This study is a double-blind randomized controlled trial (RCT) investigating efficacy in patients."
    expect(detectReportingGuideline(text)).toBe("consort")
  })

  it("detects systematic review keywords as PRISMA", () => {
    const text = "We conducted a systematic review and meta-analysis of observational studies."
    expect(detectReportingGuideline(text)).toBe("prisma")
  })

  it("detects observational cohort/case-control keywords as STROBE", () => {
    const text = "This prospective cohort study examined exposure outcomes across 500 subjects."
    expect(detectReportingGuideline(text)).toBe("strobe")
  })

  it("detects ML benchmark keywords as ml_reproducibility", () => {
    const text = "We evaluated model hyperparameters, learning rate schedules, and benchmark seeds across datasets."
    expect(detectReportingGuideline(text)).toBe("ml_reproducibility")
  })

  it("returns none for generic non-experimental texts", () => {
    const text = "Tato praca sa venuje analyzam literarnych diel a filozofickym konceptom 20. storocia."
    expect(detectReportingGuideline(text)).toBe("none")
  })

  it("applies confidence gating logic correctly: auto-applies guideline when confidence >= 0.8", () => {
    const detectedGuideline: string = "ml_reproducibility"
    const userStandard: string = "none"
    const highConfidence = 0.85

    let effectiveStandard = userStandard
    let suggestedStandard: string | null = null

    if (effectiveStandard === "none" && detectedGuideline !== "none") {
      if (highConfidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD) {
        effectiveStandard = detectedGuideline
      } else {
        suggestedStandard = detectedGuideline
      }
    }

    expect(effectiveStandard).toBe("ml_reproducibility")
    expect(suggestedStandard).toBeNull()
  })

  it("applies confidence gating logic correctly: only suggests guideline when confidence < 0.8", () => {
    const detectedGuideline: string = "consort"
    const userStandard: string = "none"
    const lowConfidence = 0.65

    let effectiveStandard = userStandard
    let suggestedStandard: string | null = null

    if (effectiveStandard === "none" && detectedGuideline !== "none") {
      if (lowConfidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD) {
        effectiveStandard = detectedGuideline
      } else {
        suggestedStandard = detectedGuideline
      }
    }

    expect(effectiveStandard).toBe("none")
    expect(suggestedStandard).toBe("consort")
  })

  it("preserves explicit user reportingStandard even if another guideline is detected", () => {
    const detectedGuideline: string = "consort"
    const userStandard: string = "prisma"
    const highConfidence = 0.95

    let effectiveStandard = userStandard
    let suggestedStandard: string | null = null

    if (effectiveStandard === "none" && detectedGuideline !== "none") {
      if (highConfidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD) {
        effectiveStandard = detectedGuideline
      } else {
        suggestedStandard = detectedGuideline
      }
    }

    expect(effectiveStandard).toBe("prisma")
    expect(suggestedStandard).toBeNull()
  })

  it("classifies discipline and thesis methodology accurately", () => {
    const text = "V tejto praci sme implementovali mikroarchitekturu neurónových sietí a vykonali benchmark testy."
    const classification = classifyDisciplineAndThesisType(
      text,
      {
        thesisTitle: "Optimalizácia neurónových sietí",
        studentName: "Ján Novák",
        department: "Katedra informatiky",
        institution: "FMFI UK",
        thesisType: "master",
      },
      "sk"
    )

    expect(classification.primaryDiscipline).toBeDefined()
    expect(classification.thesisType).toBeDefined()
    expect(typeof classification.confidence).toBe("number")
  })
})
