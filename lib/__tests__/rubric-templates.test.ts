import { describe, it, expect } from "vitest"
import {
  FACULTY_RUBRIC_TEMPLATES,
  validateRubricWeights,
  normalizeRubricWeights,
  getFacultyRubricTemplate,
} from "@/lib/ai/rubric-templates"

describe("Faculty Rubric Template Library & Weight Engine", () => {
  it("all built-in faculty templates sum up to exactly 100%", () => {
    for (const template of FACULTY_RUBRIC_TEMPLATES) {
      const result = validateRubricWeights(template.criteria)
      expect(result.isValid).toBe(true)
      expect(result.totalWeight).toBe(100)
    }
  })

  it("detects underweighted and overweighted criteria arrays", () => {
    const underweighted = [{ weight: 20 }, { weight: 30 }, { weight: 10 }]
    const underRes = validateRubricWeights(underweighted)
    expect(underRes.isValid).toBe(false)
    expect(underRes.totalWeight).toBe(60)
    expect(underRes.difference).toBe(40)

    const overweighted = [{ weight: 50 }, { weight: 40 }, { weight: 30 }]
    const overRes = validateRubricWeights(overweighted)
    expect(overRes.isValid).toBe(false)
    expect(overRes.totalWeight).toBe(120)
    expect(overRes.difference).toBe(-20)
  })

  it("normalizes arbitrary non-100 weights to sum to exactly 100", () => {
    const raw = [
      { id: "c1", weight: 33 },
      { id: "c2", weight: 33 },
      { id: "c3", weight: 33 },
    ]
    const normalized = normalizeRubricWeights(raw)
    const val = validateRubricWeights(normalized)
    expect(val.isValid).toBe(true)
    expect(val.totalWeight).toBe(100)
  })

  it("returns appropriate template by ID or default", () => {
    const fiit = getFacultyRubricTemplate("stu_fiit_informatics")
    expect(fiit.discipline).toBe("informatics")
    expect(fiit.faculty).toContain("informatiky")

    const fallback = getFacultyRubricTemplate("non_existent_id")
    expect(fallback.id).toBe("uk_prirodovedecka_stem")
  })
})
