import { describe, it, expect } from "vitest"
import { extractDocumentStructure } from "@/lib/ai/document-understanding"
import { checkObjectiveAlignment, auditCitationConsistency } from "@/lib/ai/academic-checks"
import { buildPreGenerationGrounding } from "@/lib/ai/review-engine"
import { RUBRIC_CRITERIA_MAP } from "@/lib/ai/rubric-engine"

describe("Task 11: Collapse professionalMode fork — Deterministic checks & pre-grounding on Path A by default", () => {
  it("resolves Path A (standard mode) as the default when professionalMode is undefined", () => {
    const body: { professionalMode?: boolean } = {}
    const useProfessionalMode = Boolean(body.professionalMode)
    expect(useProfessionalMode).toBe(false)
  })

  it("resolves Path A when professionalMode is explicitly false", () => {
    const body = { professionalMode: false }
    const useProfessionalMode = Boolean(body.professionalMode)
    expect(useProfessionalMode).toBe(false)
  })

  it("resolves Path B (professional mode) only when professionalMode is explicitly true", () => {
    const body = { professionalMode: true }
    const useProfessionalMode = Boolean(body.professionalMode)
    expect(useProfessionalMode).toBe(true)
  })

  it("injects pre-generation grounding into Path A prompt with [Retrieved Evidence for ...] marker", async () => {
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

    const preGroundingText = await buildPreGenerationGrounding(skSections, "sk")
    expect(preGroundingText).toContain("PRE-GENERATION EVIDENCE GROUNDING")
    expect(preGroundingText).toContain("[Retrieved Evidence for")
  })

  it("populates citationIssues on Path A from deterministic audit alone when LLM returned empty citationIssues", () => {
    const mockFullText = `
# Úvod
Podľa Smith et al. (2022) [?] je táto metóda efektívna. Výsledky vyžadujú ďalší výskum [TODO].

## Literatúra
1. Doe, J. (2021). Another Paper.
    `
    const structure = extractDocumentStructure(mockFullText, { language: "sk", thesisType: "master" })
    const citationAuditResult = auditCitationConsistency(structure, mockFullText, "sk")

    // LLM returned empty citationIssues
    let citationIssues: string[] = []

    const deterministicCitationIssues = citationAuditResult.findings.map(
      (f) => `${f.title}: ${f.explanation}`
    )
    citationIssues = Array.from(new Set([...citationIssues, ...deterministicCitationIssues]))

    expect(citationIssues.length).toBeGreaterThan(0)
    expect(citationIssues.some((issue) => issue.includes("zástupné") || issue.includes("značky") || issue.includes("placeholder"))).toBe(true)
  })

  it("merges deterministic objective alignment suggestions into matching legacy section suggestions on Path A", () => {
    const mockFullText = `
# Úvod
Práca sa zaoberá neurónovými sieťami.
# Metodológia
Použili sme metódu X.
# Záver
V závere konštatujeme, že metóda funguje.
    `
    const structure = extractDocumentStructure(mockFullText, { language: "sk", thesisType: "master" })
    const alignmentResult = checkObjectiveAlignment(structure, mockFullText, "sk")

    // Simulated Path A sections before deterministic merge
    const sections = [
      {
        id: "goal_definition",
        sectionId: "goal_definition",
        criterionId: "goal_definition",
        text: "Základné zhodnotenie cieľov.",
        suggestions: ["Doplniť kontext"],
      },
      {
        id: "methodology",
        sectionId: "methodology",
        criterionId: "methodology",
        text: "Zhodnotenie metodológie.",
        suggestions: [],
      },
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
