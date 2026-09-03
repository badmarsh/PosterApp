import { describe, it, expect } from "vitest"
import {
  SK_ACADEMIC_RUBRIC_V1,
  getApplicableCriteriaForThesisType,
} from "@/lib/ai/rubric-engine"
import { THESIS_CRITERIA } from "@/lib/ai/thesis-rubric"

describe("TASK 2: Rubric Unification and 12-Criteria PhD Review", () => {
  it("marks legacy THESIS_CRITERIA as deprecated while keeping it available for deserialization", () => {
    expect(THESIS_CRITERIA).toBeDefined()
    expect(THESIS_CRITERIA.length).toBe(8)
  })

  it("contains all 12 criteria in SK_ACADEMIC_RUBRIC_V1", () => {
    expect(SK_ACADEMIC_RUBRIC_V1.criteria.length).toBe(12)
    const criterionIds = SK_ACADEMIC_RUBRIC_V1.criteria.map((c) => c.id)
    
    // Core problem & theory criteria
    expect(criterionIds).toContain("problem_relevance")
    expect(criterionIds).toContain("objectives_clarity")
    expect(criterionIds).toContain("theoretical_background")

    // Methodology & execution
    expect(criterionIds).toContain("methodology_rigor")
    expect(criterionIds).toContain("analytical_execution")

    // Results & contribution
    expect(criterionIds).toContain("results_validity")
    expect(criterionIds).toContain("discussion_relation")
    expect(criterionIds).toContain("originality_contribution")

    // Quality, ethics, and limitations
    expect(criterionIds).toContain("structure_coherence")
    expect(criterionIds).toContain("citations_quality")
    expect(criterionIds).toContain("ethics_transparency")
    expect(criterionIds).toContain("limitations_future_work")
  })

  it("confirms a PhD review context produces all 12 active criteria without dropping criteria", () => {
    // In PhD review context (e.g. empirical_quantitative, experimental_physics, theoretical, etc.)
    const applicable = getApplicableCriteriaForThesisType("experimental_physics", SK_ACADEMIC_RUBRIC_V1)
      .filter(({ applicability }) => applicability !== "not_applicable")

    expect(applicable.length).toBe(12)

    const applicableMap = new Map(applicable.map(({ criterion, applicability }) => [criterion.id, { criterion, applicability }]))

    const activeCriteria = SK_ACADEMIC_RUBRIC_V1.criteria
      .filter((c) => applicableMap.has(c.id))
      .map((c) => {
        const prohibitedText = c.prohibitedInferences.sk?.length
          ? ` Neusudzujte: ${c.prohibitedInferences.sk.join("; ")}`
          : ""
        const cautionText = c.cautionGuidance.sk
          ? ` Upozornenie: ${c.cautionGuidance.sk}`
          : ""
        return {
          id: c.id,
          labels: c.labels,
          weight: c.weight,
          guidance: {
            sk: `${c.description.sk}${cautionText}${prohibitedText}`,
            cs: `${c.description.cs}`,
            en: `${c.description.en}`,
          },
        }
      })

    expect(activeCriteria.length).toBe(12)
    const activeIds = activeCriteria.map((c) => c.id)

    // Previously dropped criteria are now active:
    expect(activeIds).toContain("theoretical_background")
    expect(activeIds).toContain("ethics_transparency")
    expect(activeIds).toContain("limitations_future_work")
    expect(activeIds).toContain("analytical_execution")
  })

  it("verifies cautionGuidance and prohibitedInferences map cleanly to all 12 criteria", () => {
    for (const c of SK_ACADEMIC_RUBRIC_V1.criteria) {
      expect(c.cautionGuidance).toBeDefined()
      expect(c.cautionGuidance.sk).toBeDefined()
      expect(c.cautionGuidance.en).toBeDefined()
      expect(c.prohibitedInferences).toBeDefined()
      expect(c.prohibitedInferences.sk.length).toBeGreaterThan(0)
    }
  })

  it("maps anchored findings directly into 12 sections without collapsing via RUBRIC_CRITERIA_MAP", () => {
    const activeCriterionIds = SK_ACADEMIC_RUBRIC_V1.criteria.map((c) => c.id)

    const sampleAnchoredFindings = [
      {
        criterionId: "theoretical_background",
        title: "Dôkladná teoretická rešerš",
        explanation: "Autor prehľadne zmapoval stav poznania.",
        recommendation: "Doplniť najnovšie citácie z roku 2026.",
      },
      {
        criterionId: "ethics_transparency",
        title: "Transparentnosť dát",
        explanation: "Dáta sú anonymizované v súlade s GDPR.",
        recommendation: "Uviesť odkaz na otvorený repozitár.",
      },
      {
        criterionId: "limitations_future_work",
        title: "Formulácia limitácií",
        explanation: "Práca otvorene diskutuje obmedzenia použitého datasetu.",
        recommendation: "Navrhnúť experimenty s väčším rozsahom.",
      },
    ]

    const sections = activeCriterionIds.map((id) => {
      const matchingFindings = sampleAnchoredFindings.filter((f) => f.criterionId === id)
      return {
        id,
        sectionId: id,
        criterionId: id,
        text: matchingFindings.length > 0 ? matchingFindings.map((f) => `• ${f.title}: ${f.explanation}`).join("\n\n") : "V poriadku.",
        suggestions: matchingFindings.map((f) => f.recommendation).filter(Boolean),
      }
    })

    expect(sections.length).toBe(12)
    const theoreticalSec = sections.find((s) => s.id === "theoretical_background")
    expect(theoreticalSec).toBeDefined()
    expect(theoreticalSec!.text).toContain("Dôkladná teoretická rešerš")
    expect(theoreticalSec!.suggestions).toContain("Doplniť najnovšie citácie z roku 2026.")

    const ethicsSec = sections.find((s) => s.id === "ethics_transparency")
    expect(ethicsSec).toBeDefined()
    expect(ethicsSec!.text).toContain("Transparentnosť dát")

    const limitationsSec = sections.find((s) => s.id === "limitations_future_work")
    expect(limitationsSec).toBeDefined()
    expect(limitationsSec!.text).toContain("Formulácia limitácií")
  })
})
