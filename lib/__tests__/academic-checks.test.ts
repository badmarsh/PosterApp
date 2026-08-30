import { describe, it, expect } from "vitest"
import {
  checkObjectiveAlignment,
  auditCitationConsistency,
  generateCalibratedDefenseQuestions,
} from "@/lib/ai/academic-checks"
import { extractDocumentStructure } from "@/lib/ai/document-understanding"

describe("Academic Quality Checks & Verification Engine", () => {
  const sampleMarkdown = `
# Optimalizácia neurónových sietí

## Úvod
Cieľom tejto práce je navrhnúť novú metódu pruning váh pre hlboké konvolučné siete.
Výskumná otázka: Je možné znížiť počet parametrov o 50% bez straty presnosti?

## Metodológia
Použili sme štruktúrovaný magnitude-based pruning na modeli ResNet-50.
Trénovanie prebehlo na datasete ImageNet.

## Výsledky
Presnosť modelu po pruningu 50% parametrov klesla len o 0.2% na validácii.
Výsledky potvrdzujú stanovenú výskumnú hypotézu.

## Záver
Všetky stanovené ciele boli splnené.

## Literatúra
1. He, K., et al. (2016). Deep residual learning for image recognition. CVPR.
2. Frankle, J., & Carbin, M. (2018). The lottery ticket hypothesis. ICLR.
3. Han, S., et al. (2015). Deep compression. arXiv.
`

  it("checks objective alignment from problem definition to conclusions", () => {
    const structure = extractDocumentStructure(sampleMarkdown)
    const alignment = checkObjectiveAlignment(structure, sampleMarkdown, "sk")

    expect(alignment.goalsFound.length).toBeGreaterThan(0)
    expect(alignment.goalsFound[0]).toContain("pruning")
    expect(alignment.researchQuestionsFound.length).toBeGreaterThan(0)
    expect(alignment.isFullyAligned).toBe(true)
    expect(alignment.unaddressedObjectives.length).toBe(0)
  })

  it("audits citation consistency and catches missing or broken references", () => {
    const markdownWithPlaceholders = `
Použili sme metódu z práce [?] a taktiež vzťah (cit. chyba).
Ďalej podľa [TODO] sme upravili váhy.
`
    const structure = extractDocumentStructure(markdownWithPlaceholders)
    const audit = auditCitationConsistency(structure, markdownWithPlaceholders, "sk")

    expect(audit.potentialIssues.length).toBeGreaterThanOrEqual(1)
    expect(audit.isCitationIntegrityOk).toBe(false)
  })

  it("generates 5-12 calibrated defense questions prioritized by severity", () => {
    const questions = generateCalibratedDefenseQuestions(sampleMarkdown, [], "master", "sk")

    expect(questions.length).toBeGreaterThanOrEqual(5)
    expect(questions.length).toBeLessThanOrEqual(12)

    const highPriority = questions.filter((q) => q.priority === "high")
    expect(highPriority.length).toBeGreaterThan(0)

    for (const q of questions) {
      expect(q.id).toBeDefined()
      expect(q.question.length).toBeGreaterThan(10)
      expect(q.motivation.length).toBeGreaterThan(5)
    }
  })
})
