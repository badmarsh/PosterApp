import { describe, it, expect } from "vitest"
import { verifyEvidenceQuote, validateAndCalibrateFindings } from "@/lib/ai/evidence-validator"
import { anchorEvidenceQuotes } from "@/lib/ai/review-engine"
import type { ThesisRAGContext } from "@/lib/ai/thesis-context"
import type { ReviewFinding } from "@/lib/ai/review-types"

describe("Evidence Validator & Epistemic Calibration", () => {
  const sourceText = `
V tejto kapitole popisujeme experimentálnu kalibráciu supravodivého transmonu.
Trénovanie a meranie relaxačného času T1 prebehlo pri teplote 15 mK v riediacom kryostate.
Dosiahnuté Dice skóre segmentácie dosiahlo hodnotu 0.912 ± 0.005.
`

  it("verifies exact quotes present in source text", () => {
    const quote = "pri teplote 15 mK v riediacom kryostate"
    const verified = verifyEvidenceQuote(quote, sourceText)

    expect(verified.verified).toBe(true)
    expect(verified.state).toBe("verified-exact")
    expect(verified.startOffset).toBeGreaterThan(0)
    expect(verified.endOffset).toBeGreaterThan(verified.startOffset!)
  })

  it("verifies quotes with normalized whitespace differences", () => {
    const quote = "Trénovanie a meranie relaxačného času T1 prebehlo pri teplote 15 mK"
    const verified = verifyEvidenceQuote(quote, sourceText)

    expect(verified.verified).toBe(true)
    expect(verified.state === "verified-exact" || verified.state === "verified-normalized").toBe(true)
  })

  it("marks fabricated or absent quotes as unverified", () => {
    const quote = "Tento model dosiahol 99.9% úspešnosť na neexistujúcom datasete."
    const verified = verifyEvidenceQuote(quote, sourceText)

    expect(verified.verified).toBe(false)
    expect(verified.state).toBe("unverified")
  })

  it("strips synthetic or unverified page numbers", () => {
    const verified = verifyEvidenceQuote({ quote: "pri teplote 15 mK", page: 42, pageNumber: 42 }, sourceText)

    expect(verified.verified).toBe(true)
    // Synthetic page 42 is removed because markdown does not have authoritative PDF page coordinates
    expect(verified.pageNumber).toBeUndefined()
  })

  it("downgrades ungrounded findings from SUPPORTED_FACT to REQUIRES_HUMAN_VERIFICATION", () => {
    const rawFindings: ReviewFinding[] = [
      {
        id: "f-1",
        category: "methodology",
        title: "Doložené tvrdenie",
        explanation: "Výsledky sú podložené meraním.",
        recommendation: "Pokračovať",
        includeInExport: true,
        severity: "minor",
        confidence: 0.95,
        epistemicStatus: "SUPPORTED_FACT",
        evidence: [{ quote: "pri teplote 15 mK v riediacom kryostate" }],
        status: "unreviewed",
        createdBy: "ai",
      },
      {
        id: "f-2",
        category: "methodology",
        title: "Vymyslené tvrdenie",
        explanation: "Autor použil fiktívny urýchľovač.",
        recommendation: "Overiť citáciu",
        includeInExport: true,
        severity: "major",
        confidence: 0.95,
        epistemicStatus: "SUPPORTED_FACT",
        evidence: [{ quote: "neexistujúci citát v celom texte práce" }],
        status: "unreviewed",
        createdBy: "ai",
      },
    ]

    const result = validateAndCalibrateFindings(rawFindings, sourceText, "hash-123")
    const validated = result.validatedFindings

    expect(validated[0].epistemicStatus).toBe("SUPPORTED_FACT")
    expect(validated[0].evidence[0].verified).toBe(true)

    expect(validated[1].epistemicStatus).toBe("REQUIRES_HUMAN_VERIFICATION")
    expect(validated[1].evidence[0].verified).toBe(false)
    expect(validated[1].confidence).toBeLessThan(0.6)
  })
})

describe("Task 7 regression guard: anchorEvidenceQuotes ↔ verifyEvidenceQuote parity", () => {
  // Both entry points must classify evidence quotes identically. The review
  // engine's anchoring step used to maintain a private copy of the tier
  // cascade; these shared cases pin the behavior so a future threshold change
  // (e.g. the approximate-anchor length) cannot drift between them again.
  const sections = [
    {
      id: "p-1",
      sourceFile: "thesis.md",
      heading: "1. Úvod",
      normalizedHeading: "1. uvod",
      level: 1,
      startOffset: 0,
      content: "Metóda bola overená na kontrolnej vzorke s presnosťou 92.3%.",
      kind: "introduction" as const,
    },
    {
      id: "p-2",
      sourceFile: "thesis.md",
      heading: "2. Metóda",
      normalizedHeading: "2. metoda",
      level: 1,
      startOffset: 100,
      content: "Trénovanie modelu prebiehalo s dávkou 32 vzoriek na iteráciu.",
      kind: "methodology" as const,
    },
    {
      id: "p-3",
      sourceFile: "thesis.md",
      heading: "3. Výsledky",
      normalizedHeading: "3. vysledky",
      level: 1,
      startOffset: 200,
      content: "Trénovanie modelu prebiehalo s dávkou 32 vzoriek na iteráciu aj v druhej fáze.",
      kind: "results" as const,
    },
    {
      id: "p-4",
      sourceFile: "thesis.md",
      heading: "4. Diskusia",
      normalizedHeading: "4. diskusia",
      level: 1,
      startOffset: 300,
      content: "Model dosiahol výrazné zlepšenie oproti predchádzajúcim baseline modelom.",
      kind: "discussion" as const,
    },
  ]

  const anchorSourceText = sections.map((s) => s.content).join("\n")

  const rag: ThesisRAGContext = {
    fullText: anchorSourceText,
    sections,
    references: [],
    referencesTitles: [],
    totalChars: anchorSourceText.length,
    truncated: false,
    sourceFiles: ["thesis.md"],
  }

  const cases: Array<{ name: string; quote: string; expectedState: string; expectedVerified: boolean }> = [
    {
      name: "single exact match → verified-exact",
      quote: "overená na kontrolnej vzorke",
      expectedState: "verified-exact",
      expectedVerified: true,
    },
    {
      name: "whitespace differences → verified-normalized",
      quote: "Metóda  bola   overená na kontrolnej vzorke",
      expectedState: "verified-normalized",
      expectedVerified: true,
    },
    {
      name: "verbatim match in multiple sections → ambiguous",
      quote: "Trénovanie modelu prebiehalo s dávkou 32 vzoriek",
      expectedState: "ambiguous",
      expectedVerified: true,
    },
    {
      name: "normalized match in multiple sections → ambiguous",
      quote: "Trénovanie  modelu  prebiehalo s dávkou 32 vzoriek",
      expectedState: "ambiguous",
      expectedVerified: true,
    },
    {
      name: "long quote sharing ≥60-char prefix → approximate",
      quote: "Model dosiahol výrazné zlepšenie oproti predchádzajúcim baseline modelom na novom datasete",
      expectedState: "approximate",
      expectedVerified: false,
    },
    {
      name: "fabricated quote → unverified",
      quote: "Autor použil kvantový počítač s 10 000 qubitmi.",
      expectedState: "unverified",
      expectedVerified: false,
    },
    {
      name: "empty quote → unverified",
      quote: "",
      expectedState: "unverified",
      expectedVerified: false,
    },
  ]

  it.each(cases)("$name classifies identically in both implementations", ({ quote, expectedState, expectedVerified }) => {
    const anchored = anchorEvidenceQuotes([{ title: "Parity case", evidence: [{ quote, evidenceType: "quote" }] }], rag)
    const fromAnchor = anchored[0].evidence[0]
    const fromValidator = verifyEvidenceQuote(quote, anchorSourceText, sections)

    expect(fromAnchor.state).toBe(expectedState)
    expect(fromAnchor.verified).toBe(expectedVerified)
    expect(fromValidator.state).toBe(expectedState)
    expect(fromValidator.verified).toBe(expectedVerified)
  })
})
