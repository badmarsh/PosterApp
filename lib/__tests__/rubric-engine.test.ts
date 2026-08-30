import { describe, it, expect } from "vitest"
import {
  SK_ACADEMIC_RUBRIC_V1,
  getApplicableCriteriaForThesisType,
  calculateGradeRange,
} from "@/lib/ai/rubric-engine"

describe("Academic Rubric Engine (sk-academic-v1)", () => {
  it("contains all required academic evaluation criteria with weights summing to 100", () => {
    expect(SK_ACADEMIC_RUBRIC_V1.criteria).toHaveLength(12)

    const requiredKeys = [
      "problem_relevance",
      "objectives_clarity",
      "theoretical_background",
      "methodology_rigor",
      "analytical_execution",
      "results_validity",
      "discussion_relation",
      "originality_contribution",
      "structure_coherence",
      "citations_quality",
      "ethics_transparency",
      "limitations_future_work",
    ]

    for (const key of requiredKeys) {
      const criterion = SK_ACADEMIC_RUBRIC_V1.criteria.find((c) => c.key === key)
      expect(criterion, `Missing criterion ${key}`).toBeDefined()
      expect(criterion?.weight).toBeGreaterThan(0)
      expect(criterion?.cautionGuidance.sk.length).toBeGreaterThan(0)
      expect(criterion?.prohibitedInferences.sk.length).toBeGreaterThan(0)
    }

    const totalWeight = SK_ACADEMIC_RUBRIC_V1.criteria.reduce((sum, c) => sum + c.weight, 0)
    expect(totalWeight).toBe(100)
  })

  it("calibrates criterion applicability across diverse thesis types", () => {
    const theoreticalCriteria = getApplicableCriteriaForThesisType("theoretical", SK_ACADEMIC_RUBRIC_V1)
    const analyticalCrit = theoreticalCriteria.find((c) => c.criterion.key === "analytical_execution")
    expect(analyticalCrit?.applicability).toBe("partially_applicable")

    const expPhysicsCriteria = getApplicableCriteriaForThesisType("experimental_physics", SK_ACADEMIC_RUBRIC_V1)
    const expPhysicsData = expPhysicsCriteria.find((c) => c.criterion.key === "analytical_execution")
    expect(expPhysicsData?.applicability).toBe("applicable")
  })

  it("calculates calibrated ECTS grade ranges from numeric scores", () => {
    const gradeA = calculateGradeRange(96)
    expect(gradeA.grade).toBe("A")
    expect(gradeA.range).toBe("A")

    const gradeAB = calculateGradeRange(92)
    expect(gradeAB.grade).toBe("A")
    expect(gradeAB.range).toBe("B – A")

    const gradeB = calculateGradeRange(85)
    expect(gradeB.grade).toBe("B")

    const gradeC = calculateGradeRange(75)
    expect(gradeC.grade).toBe("C")

    const gradeD = calculateGradeRange(65)
    expect(gradeD.grade).toBe("D")

    const gradeE = calculateGradeRange(55)
    expect(gradeE.grade).toBe("E")

    const gradeFx = calculateGradeRange(42)
    expect(gradeFx.grade).toBe("FX")
    expect(gradeFx.range).toBe("FX")
  })
})
