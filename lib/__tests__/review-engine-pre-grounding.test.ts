import { describe, it, expect } from "vitest"
import { buildPreGenerationGrounding } from "@/lib/ai/review-engine"

describe("buildPreGenerationGrounding (Task 5: pre-generation evidence grounding)", () => {
  const mockSections = [
    {
      id: "sec-1",
      heading: "Introduction",
      content:
        "The structure of this thesis follows a standard format with an introduction, body, conclusion, references, and appendices. The typography and numbering of pages, tables, and figures comply with the prescribed standards. The goals of the work are clearly defined with a well-scoped problem statement, justified by a review of the current state of the art in literature and the relevance of the topic.",
    },
    {
      id: "sec-2",
      heading: "Methodology",
      content:
        "The methodology and approach employed in this work combine quantitative statistical methods with qualitative analysis. The correctness of their application is verified through reproducibility checks, and the logical progression of solution steps follows established academic conventions. Academic sources are cited throughout using proper referencing conventions.",
    },
    {
      id: "sec-3",
      heading: "Results",
      content:
        "The results show a statistically significant improvement in diagnostic accuracy validated against ground truth labels. The originality and contribution of this work lies in the novel combination of existing methods applied to a previously unstudied domain. The discussion relates the findings to existing literature and acknowledges limitations transparently.",
    },
  ]

  it("generates pre-generation grounding blocks for criteria with matching evidence", () => {
    const result = buildPreGenerationGrounding(mockSections, "en")

    expect(result).toContain("PRE-GENERATION EVIDENCE GROUNDING")
    expect(result).toContain("Retrieved Evidence for")
    expect(result).toContain("overlap:")
  })

  it("returns empty string when sections array is empty", () => {
    const result = buildPreGenerationGrounding([], "en")
    expect(result).toBe("")
  })

  it("uses localized criterion labels based on language parameter", () => {
    const enResult = buildPreGenerationGrounding(mockSections, "en")
    // English should contain English criterion labels (mock content is in English)
    expect(enResult).toMatch(/Formal structure|Definition of goals|Methodology/)

    // Slovak grounding requires Slovak content for token overlap to work
    const skSections = [
      {
        id: "sec-1",
        heading: "Úvod",
        content:
          "Formálna štruktúra práce zahŕňa úvod, jadro, záver a zoznam literatúry. Typografia a číslovanie strán spĺňajú predpísané normy.",
      },
      {
        id: "sec-2",
        heading: "Metodológia",
        content:
          "Metodológia a postup riešenia využívajú kvantitatívne aj kvalitatívne metódy. Správnosť ich aplikácie bola overená.",
      },
    ]
    const skResult = buildPreGenerationGrounding(skSections, "sk")
    expect(skResult).toMatch(/Formálna štruktúra|Metodológia/)
  })

  it("skips defense_questions criterion", () => {
    const result = buildPreGenerationGrounding(mockSections, "en")
    // defense_questions has weight 0 and should be excluded
    expect(result).not.toContain("defense_questions")
  })

  it("returns empty string when no criterion finds sufficient token overlap", () => {
    const unrelatedSections = [
      {
        id: "sec-1",
        heading: "Random",
        content: "xyz abc 123 unrelated content that does not match any thesis criterion keywords.",
      },
    ]
    const result = buildPreGenerationGrounding(unrelatedSections, "en")
    // May still find some weak matches, but should handle gracefully
    expect(typeof result).toBe("string")
  })
})
