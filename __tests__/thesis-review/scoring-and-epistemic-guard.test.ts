import { describe, it, expect } from "vitest"
import { computeScoreFromFindings, MAX_FORMAL_DEDUCTION } from "@/lib/ai/review-engine"
import { validateAndCalibrateFindings } from "@/lib/ai/evidence-validator"
import { getThesisCriterionQueryExpansion } from "@/lib/ai/vector-rag"
import type { ReviewFinding } from "@/lib/ai/review-types"

const makeFinding = (overrides: Partial<ReviewFinding> = {}): ReviewFinding => ({
  id: "f-test-1",
  criterionId: "methodology",
  criterionKey: "methodology",
  title: "Test finding",
  findingType: "weakness",
  epistemicStatus: "REVIEWER_JUDGMENT",
  explanation: "Detailed explanation",
  recommendation: "Fix this issue",
  severity: "minor",
  category: "methodology",
  confidence: 0.85,
  evidence: [],
  evidenceState: "unverified",
  status: "unreviewed",
  decisionStatus: "open",
  includeInExport: true,
  createdBy: "ai",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe("computeScoreFromFindings Calibration & Safety Guards", () => {
  it("returns 100 for 0 findings", () => {
    expect(computeScoreFromFindings([])).toBe(100)
  })

  it("does not deduct points for findingType 'strength' or 'question'", () => {
    const findings: ReviewFinding[] = [
      makeFinding({ id: "1", findingType: "strength", severity: "major" }),
      makeFinding({ id: "2", findingType: "question", severity: "critical" }),
    ]
    expect(computeScoreFromFindings(findings)).toBe(100)
  })

  it("does not deduct points for severity 'suggestion'", () => {
    const findings: ReviewFinding[] = [
      makeFinding({ id: "1", severity: "suggestion", recommendation: "Consider testing with larger batch size" }),
      makeFinding({ id: "2", severity: "suggestion", recommendation: "Future work could expand this" }),
    ]
    expect(computeScoreFromFindings(findings)).toBe(100)
  })

  it("does not deduct points for praise even if mislabeled as weakness", () => {
    const findings: ReviewFinding[] = [
      makeFinding({
        id: "1",
        title: "Validácia výsledkov porovnaním s experimentom CMS",
        findingType: "weakness",
        severity: "suggestion",
        explanation: "Autor úspešne validuje svoje výsledky porovnaním s nezávislým experimentom CMS.",
        recommendation: "Žiadne, postup je správny.",
      }),
      makeFinding({
        id: "2",
        title: "Metodologická dôslednosť pri validácii výsledkov",
        findingType: "weakness",
        severity: "minor",
        explanation: "Autor preukazuje vysokú mieru metodologickej dôslednosti.",
        recommendation: "Pokračovať v tomto prístupe.",
      }),
    ]
    expect(computeScoreFromFindings(findings)).toBe(100)
  })

  it("deducts correctly for real substantive weaknesses", () => {
    const findings: ReviewFinding[] = [
      makeFinding({ id: "1", severity: "major", category: "methodology" }), // -8
      makeFinding({ id: "2", severity: "minor", category: "results" }),     // -2
    ]
    expect(computeScoreFromFindings(findings)).toBe(90)
  })

  it("caps formal/formatting/OCR deductions at MAX_FORMAL_DEDUCTION (8 points)", () => {
    // 3 formal issues that would previously subtract 20 + 20 + 8 = 48 points!
    const findings: ReviewFinding[] = [
      makeFinding({
        id: "1",
        category: "formal",
        criterionId: "structure_coherence",
        title: "Inkonzistencia v identifikácii autora práce",
        severity: "critical",
      }),
      makeFinding({
        id: "2",
        category: "formal",
        criterionId: "citations_quality",
        title: "Nekonzistentná a chybná formátovacia úprava zoznamu literatúry",
        severity: "critical",
      }),
      makeFinding({
        id: "3",
        category: "formal",
        criterionId: "structure_coherence",
        title: "Gramatické a typografické nedostatky (kódovanie znakov)",
        severity: "major",
      }),
    ]
    // Max formal deduction is capped at 8 points -> 100 - 8 = 92
    expect(computeScoreFromFindings(findings)).toBe(100 - MAX_FORMAL_DEDUCTION)
  })

  it("correctly evaluates the CERN PhD thesis simulation (previously 39.5 FX, now calibrated B ~84)", () => {
    const cernThesisFindings: ReviewFinding[] = [
      // 3 formal / OCR issues (previously -48 pts)
      makeFinding({ id: "f-1", criterionId: "structure_coherence", category: "formal", severity: "critical", title: "Inkonzistencia v identifikácii autora práce" }),
      makeFinding({ id: "f-2", criterionId: "citations_quality", category: "formal", severity: "critical", title: "Nekonzistentná a chybná formátovacia úprava zoznamu literatúry" }),
      makeFinding({ id: "f-3", criterionId: "structure_coherence", category: "formal", severity: "major", title: "Gramatické a typografické nedostatky (kódovanie znakov)" }),

      // 4 minor substantive methodological observations (-2 pts each = -8 pts)
      makeFinding({ id: "f-4", criterionId: "methodology_rigor", category: "methodology", severity: "minor", title: "Arbitrárne rozhodnutie pri výbere referenčnej vzorky" }),
      makeFinding({ id: "f-5", criterionId: "analytical_execution", category: "methodology", severity: "minor", title: "Metodologické zdôvodnenie výberu referenčnej vzorky" }),
      makeFinding({ id: "f-6", criterionId: "limitations_future_work", category: "results", severity: "minor", title: "Teoretické predpoklady ako limity práce" }),
      makeFinding({ id: "f-7", criterionId: "limitations_future_work", category: "results", severity: "minor", title: "Obmedzenia fitovacích modelov" }),

      // Praise / positive suggestions (previously -4.5 pts, now 0 pts)
      makeFinding({ id: "f-8", findingType: "strength", severity: "suggestion", title: "Validácia výsledkov porovnaním s experimentom CMS", recommendation: "Žiadne, postup je správny." }),
      makeFinding({ id: "f-9", findingType: "strength", severity: "suggestion", title: "Metodologická dôslednosť pri validácii výsledkov", recommendation: "Pokračovať v tomto prístupe." }),
      makeFinding({ id: "f-10", findingType: "strength", severity: "suggestion", title: "Detailná prezentácia výsledkov", recommendation: "None" }),
      makeFinding({ id: "f-11", findingType: "strength", severity: "suggestion", title: "Dôkladná analýza systematických neistôt", recommendation: "Žiadne" }),
      makeFinding({ id: "f-12", severity: "suggestion", title: "Kritická analýza fitovacích modelov", recommendation: "Pokračovať v tomto" }),
      makeFinding({ id: "f-13", severity: "suggestion", title: "Prítomnosť teoretických konceptov", recommendation: "Žiadne" }),
      makeFinding({ id: "f-14", severity: "suggestion", title: "Štruktúrovaný postup analýzy dát", recommendation: "None" }),
      makeFinding({ id: "f-15", severity: "suggestion", title: "Transparentnosť metodológie a spracovania dát", recommendation: "None" }),
      makeFinding({ id: "f-16", severity: "suggestion", title: "Komparácia výsledkov s inými experimentmi", recommendation: "Žiadne" }),
    ]

    // Formal capped at 8 + Substantive 4 * 2 = 8 -> 100 - 16 = 84 (ECTS Grade B)
    const score = computeScoreFromFindings(cernThesisFindings)
    expect(score).toBe(84)
  })
})

describe("Epistemic Gating on Absence Claims", () => {
  it("marks quotes attached to absence claims as context-only and gates the finding for human review", () => {
    const sourceText = "First we fit R2(Q) for the entire sample. Then we investigate the dependence of the fit parameters on multiplicity."
    const uncalibratedFindings: ReviewFinding[] = [
      makeFinding({
        id: "abs-1",
        criterionId: "objectives_clarity",
        title: "Chýbajúca explicitná formulácia cieľov a výskumných otázok",
        epistemicStatus: "MISSING_EVIDENCE",
        severity: "major",
        explanation: "V poskytnutých úryvkoch textu chýba jasne definovaný hlavný cieľ práce.",
        evidence: [
          {
            sectionHeading: "Results of fits",
            quote: "First we fit R2(Q) for the entire sample. Then we investigate the dependence of the fit parameters on multiplicity.",
          },
        ],
      }),
    ]

    const result = validateAndCalibrateFindings(uncalibratedFindings, sourceText)
    const calibrated = result.validatedFindings[0]

    // Quote must NOT be verified as proof of absence
    expect(calibrated.evidence[0].verified).toBe(false)
    expect(calibrated.evidence[0].state).toBe("context-only")

    // Finding must be gated
    expect(calibrated.decisionStatus).toBe("needs_human_review")
    expect(calibrated.includeInExport).toBe(false)
    expect(calibrated.confidence).toBeLessThanOrEqual(0.4)

    // And it has 0 impact on score
    expect(computeScoreFromFindings([calibrated])).toBe(100)
  })
})

describe("Cross-lingual Query Expansion in vector-rag", () => {
  it("includes both Slovak and English keywords for Slovak review queries", () => {
    const expansion = getThesisCriterionQueryExpansion("objectives_clarity", "sk")
    expect(expansion).toContain("formulácia cieľov")
    expect(expansion).toContain("hypotézy")
    expect(expansion).toContain("formulation of goals")
    expect(expansion).toContain("research questions")
  })
})
