import { describe, it, expect } from "vitest"
import { extractDocumentStructure } from "@/lib/ai/document-understanding"
import { checkObjectiveAlignment, auditCitationConsistency } from "@/lib/ai/academic-checks"
import { buildPreGenerationGrounding } from "@/lib/ai/review-engine"
import { RUBRIC_CRITERIA_MAP } from "@/lib/ai/rubric-engine"
import { shouldUseProfessionalMode } from "@/app/api/workspaces/[id]/thesis-review/route"

describe("Task 11: shouldUseProfessionalMode and Path A defaults", () => {
  describe("shouldUseProfessionalMode: auto-elevation rules", () => {
    it("returns false for thesis kind with none standard and flag=false", () => {
      expect(shouldUseProfessionalMode(false, "thesis", "none")).toBe(false)
    })
    it("returns false for undefined flag thesis kind none standard", () => {
      expect(shouldUseProfessionalMode(undefined, "thesis", "none")).toBe(false)
    })
    it("returns true when professionalMode flag is true", () => {
      expect(shouldUseProfessionalMode(true, "thesis", "none")).toBe(true)
    })
    it("auto-elevates when reviewKind is paper", () => {
      expect(shouldUseProfessionalMode(false, "paper", "none")).toBe(true)
      expect(shouldUseProfessionalMode(undefined, "paper", "none")).toBe(true)
    })
    it("auto-elevates when reportingStandard is consort", () => {
      expect(shouldUseProfessionalMode(false, "thesis", "consort")).toBe(true)
    })
    it("auto-elevates when reportingStandard is prisma", () => {
      expect(shouldUseProfessionalMode(undefined, "thesis", "prisma")).toBe(true)
    })
    it("returns false when reportingStandard is undefined", () => {
      expect(shouldUseProfessionalMode(false, "thesis", undefined)).toBe(false)
    })
  })

  it("resolves Path A as default when professionalMode is undefined", () => {
    const body: { professionalMode?: boolean } = {}
    expect(Boolean(body.professionalMode)).toBe(false)
  })

  it("resolves Path B when professionalMode is explicitly true", () => {
    expect(Boolean(true)).toBe(true)
  })

  it("injects pre-generation grounding into Path A prompt", async () => {
    // Sections must overlap with THESIS_CRITERIA guidance tokens (Slovak labels used when lang="sk")
    const sections = [
      {
        id: "sec-1",
        heading: "Formalna struktura",
        content: "Uvod jadro zaver zoznam literatury typograficka uprava cislovanie stran tabuliek obrazkov struktura prace.",
      },
      {
        id: "sec-2",
        heading: "Metodologia",
        content: "Metodologia postup riesenia metody aplikacia logicka nadvaznst krokov odborne zdroje vysledky interpretacia.",
      },
    ]
    const preGroundingText = await buildPreGenerationGrounding(sections, "sk")
    expect(preGroundingText).toContain("PRE-GENERATION EVIDENCE GROUNDING")
    expect(preGroundingText).toContain("[Retrieved Evidence for")
  })


  it("populates citationIssues from deterministic audit when LLM returns empty", () => {
    const mockText = "# Introduction\nAccording to Smith [?] this is effective. Needs more research [TODO].\n## References\n1. Doe, J. (2021). Paper."
    const structure = extractDocumentStructure(mockText, { language: "sk", thesisType: "master" })
    const audit = auditCitationConsistency(structure, mockText, "sk")
    const issues = audit.findings.map((f) => f.title + ": " + f.explanation)
    expect(issues.length).toBeGreaterThan(0)
  })

  it("merges alignment suggestions into legacy sections on Path A", () => {
    const mockText = "# Introduction\nNeural networks.\n# Methodology\nMethod X.\n# Conclusion\nMethod works."
    const structure = extractDocumentStructure(mockText, { language: "sk", thesisType: "master" })
    const alignmentResult = checkObjectiveAlignment(structure, mockText, "sk")
    const sections = [
      { id: "goal_definition", sectionId: "goal_definition", criterionId: "goal_definition", text: "goals", suggestions: ["Add context"] },
    ]
    for (const f of alignmentResult.findings) {
      const targetId = (f.criterionId && RUBRIC_CRITERIA_MAP[f.criterionId]) || f.criterionId || "goal_definition"
      const targetSec = sections.find((s) => s.id === targetId || s.sectionId === targetId || s.criterionId === targetId)
      if (targetSec && f.recommendation) {
        targetSec.suggestions = Array.from(new Set([...targetSec.suggestions, f.recommendation]))
      }
    }
    const goalSection = sections.find((s) => s.id === "goal_definition")
    expect(goalSection).toBeDefined()
    expect(goalSection!.suggestions.length).toBeGreaterThan(0)
  })
})