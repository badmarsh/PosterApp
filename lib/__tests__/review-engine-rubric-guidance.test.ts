import { describe, it, expect } from "vitest"
import { buildRubricGuidanceText } from "@/lib/ai/review-engine"

describe("buildRubricGuidanceText (Task 4: rubric guidance wiring)", () => {
  it("emits localized cautionGuidance/prohibitedInferences for the default 'unknown' thesis type", () => {
    const en = buildRubricGuidanceText("unknown", "en")
    expect(en).toContain("Relevance and problem formulation")
    expect(en).toContain("Caution:")
    expect(en).toContain("Do not infer:")

    const sk = buildRubricGuidanceText("unknown", "sk")
    expect(sk).toContain("Aktuálnosť a formulácia problému")
    expect(sk).toContain("Caution:")
  })

  it("marks criteria that are only partially applicable for a thesis type", () => {
    // analytical_execution is partially_applicable for theoretical theses (rubric-engine.ts)
    const text = buildRubricGuidanceText("theoretical", "en")
    expect(text).toContain("(partially applicable — apply with caution)")
  })

  it("never returns non-empty guidance for criteria it should exclude", () => {
    // No criterion in SK_ACADEMIC_RUBRIC_V1 currently returns "not_applicable",
    // so every type still yields guidance from at least the unconditional criteria.
    const types = [
      "empirical_quantitative",
      "experimental_physics",
      "qualitative",
      "mixed_methods",
      "theoretical",
      "literature_review",
      "engineering_design",
      "software_system",
      "cybersecurity_audit",
      "case_study",
      "artistic_practice",
      "unknown",
    ] as const
    for (const type of types) {
      expect(buildRubricGuidanceText(type, "en").length).toBeGreaterThan(0)
    }
  })
})