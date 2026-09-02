import { describe, it, expect } from "vitest"
import {
  SK_ACADEMIC_RUBRIC_V1,
  RUBRIC_CRITERIA_MAP,
  NO_FINDINGS_SYNTHESIS,
  mapRubricCriterionToDisplay,
  getApplicableCriteriaForThesisType,
} from "@/lib/ai/rubric-engine"
import { THESIS_CRITERIA, type ReviewLanguage } from "@/lib/ai/thesis-rubric"

describe("Task 10: Rubric Unification and Findings-to-Sections Bridge", () => {
  const validDisplayCriterionIds = new Set(THESIS_CRITERIA.map((c) => c.id))

  it("maps all 12 criteria in SK_ACADEMIC_RUBRIC_V1 to valid display criteria", () => {
    for (const criterion of SK_ACADEMIC_RUBRIC_V1.criteria) {
      const mappedId = RUBRIC_CRITERIA_MAP[criterion.id]
      expect(mappedId, `Criterion '${criterion.id}' should be mapped in RUBRIC_CRITERIA_MAP`).toBeDefined()
      expect(
        validDisplayCriterionIds.has(mappedId),
        `Mapped criterion '${mappedId}' for '${criterion.id}' must be a valid display criterion`
      ).toBe(true)
    }
  })

  it("maps formal_language to language_quality", () => {
    expect(mapRubricCriterionToDisplay("formal_language")).toBe("language_quality")
  })

  it("falls back to input ID when mapping an unknown criterion", () => {
    expect(mapRubricCriterionToDisplay("custom_unknown_criterion")).toBe("custom_unknown_criterion")
  })

  it("provides non-empty localized fallback synthesis texts for all supported languages", () => {
    const languages: ReviewLanguage[] = ["sk", "cs", "en"]
    for (const lang of languages) {
      const text = NO_FINDINGS_SYNTHESIS[lang]
      expect(text).toBeDefined()
      expect(text.length).toBeGreaterThan(20)
      expect(text).not.toContain("undefined")
      expect(text).not.toContain("null")
    }
  })

  it("properly attributes findings to criteria and uses synthesis text when no findings exist", () => {
    const activeCriteria = THESIS_CRITERIA.filter((c) => c.id !== "defense_questions")
    const mockFindings = [
      {
        criterionId: "methodology_rigor",
        category: "methodology",
        title: "Absence of ablation study",
        explanation: "The model components were not tested individually.",
        recommendation: "Conduct ablation experiments.",
      },
      {
        criterionKey: "citations_quality",
        category: "literature",
        title: "Outdated references",
        explanation: "Over 60% of citations predate 2018.",
        recommendation: "Incorporate recent 2024-2026 literature.",
      },
      {
        category: "statistics",
        title: "P-value interpretation",
        explanation: "Multiple hypothesis testing corrections were omitted.",
        recommendation: "Apply Bonferroni or FDR corrections.",
      },
    ]

    const professionalResult = {
      anchoredFindings: mockFindings,
      summary: "Global summary that should NOT leak into empty criteria sections.",
      grade: "B",
      derivedScore: 82,
    }

    const lang: ReviewLanguage = "sk"

    const sections = activeCriteria.map((c) => {
      const matchingFindings = professionalResult.anchoredFindings.filter((f: any) => {
        if (f.criterionId && (RUBRIC_CRITERIA_MAP[f.criterionId] === c.id || f.criterionId === c.id)) return true
        if (f.criterionKey && (RUBRIC_CRITERIA_MAP[f.criterionKey] === c.id || f.criterionKey === c.id)) return true

        if (c.id === "methodology") return f.category === "methodology" || f.category === "statistics"
        if (c.id === "results") return f.category === "results" || f.category === "reproducibility"
        if (c.id === "citations_bibliography") return f.category === "literature"
        if (c.id === "goal_definition") return f.category === "problem" || f.category === "theory"
        if (c.id === "originality") return f.category === "impact"
        if (c.id === "formal_structure" || c.id === "language_quality") return f.category === "formal"
        return false
      })

      const text = matchingFindings.length > 0
        ? matchingFindings.map((f: any) => `• ${f.title}: ${f.explanation}`).join("\n\n")
        : (NO_FINDINGS_SYNTHESIS[lang] || NO_FINDINGS_SYNTHESIS.sk)

      return {
        id: c.id,
        sectionId: c.id,
        criterionId: c.id,
        text,
        rating: professionalResult.grade || "B",
        numericScore: professionalResult.derivedScore ?? 75,
        suggestions: matchingFindings.map((f: any) => f.recommendation).filter(Boolean),
      }
    })

    // Methodology should match methodology_rigor and statistics
    const methSection = sections.find((s) => s.id === "methodology")
    expect(methSection).toBeDefined()
    expect(methSection!.text).toContain("Absence of ablation study")
    expect(methSection!.text).toContain("P-value interpretation")
    expect(methSection!.suggestions).toContain("Conduct ablation experiments.")
    expect(methSection!.suggestions).toContain("Apply Bonferroni or FDR corrections.")

    // Citations should match citations_quality
    const citeSection = sections.find((s) => s.id === "citations_bibliography")
    expect(citeSection).toBeDefined()
    expect(citeSection!.text).toContain("Outdated references")

    // Empty section (e.g. originality or formal_structure) must NOT contain global summary
    const origSection = sections.find((s) => s.id === "originality")
    expect(origSection).toBeDefined()
    expect(origSection!.text).toBe(NO_FINDINGS_SYNTHESIS.sk)
    expect(origSection!.text).not.toContain("Global summary")
  })

  it("drives applicable criteria correctly across detailed thesis types", () => {
    const empiricalApplicable = getApplicableCriteriaForThesisType("empirical_quantitative", SK_ACADEMIC_RUBRIC_V1)
      .filter((item) => item.applicability !== "not_applicable")
    const empiricalLegacyIds = new Set(
      empiricalApplicable.map((item) => RUBRIC_CRITERIA_MAP[item.criterion.key] || item.criterion.key)
    )
    expect(empiricalLegacyIds.has("methodology")).toBe(true)
    expect(empiricalLegacyIds.has("goal_definition")).toBe(true)

    const theoreticalApplicable = getApplicableCriteriaForThesisType("theoretical", SK_ACADEMIC_RUBRIC_V1)
    const analyticalExecution = theoreticalApplicable.find((item) => item.criterion.key === "analytical_execution")
    expect(analyticalExecution?.applicability).toBe("partially_applicable")
  })
})
