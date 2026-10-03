import { describe, it, expect } from "vitest"
import {
  stableEvidenceAnchor,
  verifyEvidenceQuote,
  verifyEvidenceByChunkId,
  validateAndCalibrateFindings,
} from "@/lib/ai/evidence-validator"
import { anchorEvidenceQuotes } from "@/lib/ai/review-engine"
import type { ThesisRAGContext } from "@/lib/ai/thesis-context"
import type { ReviewFinding } from "@/lib/ai/review-types"

describe("stable RAG evidence anchors", () => {
  it("is deterministic, opaque, and independent of retrieval order", () => {
    const first = stableEvidenceAnchor("chunk/database-id:123")
    expect(first).toBe(stableEvidenceAnchor("chunk/database-id:123"))
    expect(first).not.toBe(stableEvidenceAnchor("chunk/database-id:124"))
    expect(first).toMatch(/^c-[a-f0-9]{16}$/)
    expect(first).not.toContain("database-id")
  })
})

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

  it("strips synthetic page labels only when physical page bounds are unavailable", () => {
    const raw = "[Page 42] Trénovanie a meranie relaxačného času T1 prebehlo pri teplote 15 mK"
    const noBounds = verifyEvidenceQuote({ quote: raw, page: 42 }, raw)
    expect(noBounds.verified).toBe(true)
    expect(noBounds.quote).not.toContain("[Page 42]")
    expect(noBounds.page).toBeUndefined()

    const withBounds = verifyEvidenceQuote(
      { quote: raw, page: 42 },
      raw,
      [{ heading: "Method", content: raw, pageStart: 40, pageEnd: 42 }],
    )
    expect(withBounds.verified).toBe(true)
    expect(withBounds.quote).toBe(raw)
    expect(withBounds.page).toBe(42)
  })

  it("keeps an explicit page only when it falls within the matched physical range", () => {
    const quote = "Trénovanie a meranie relaxačného času T1 prebehlo pri teplote 15 mK"
    const sections = [{ heading: "Method", content: quote, pageStart: 10, pageEnd: 12 }]
    expect(verifyEvidenceQuote({ quote, page: 11 }, quote, sections).page).toBe(11)
    expect(verifyEvidenceQuote({ quote, page: 99 }, quote, sections).page).toBeUndefined()
  })

  it("does not treat blank or short chunk-anchored quotes as evidence", () => {
    const chunkMap = new Map([["chunk-1", { id: "chunk-1", content: "A sufficiently long source passage that contains a valid citation." }]])
    const blank = verifyEvidenceByChunkId({ chunkId: "chunk-1", quote: "" }, chunkMap)!
    const short = verifyEvidenceByChunkId({ chunkId: "chunk-1", quote: "citation" }, chunkMap)!
    expect(blank.verified).toBe(false)
    expect(blank.state).toBe("unverified")
    expect(short.verified).toBe(false)
    expect(short.state).toBe("unverified")
  })

  it("marks a retrieved 60-character-prefix match approximate with confidence 0.45", () => {
    const fullQuote = "A sufficiently long source statement with exactly enough content to test the approximate citation threshold safely."
    const prefix = fullQuote.slice(0, 60)
    const chunkMap = new Map([["chunk-approx", { id: "chunk-approx", content: `${prefix} and then diverges.` }]])
    const result = verifyEvidenceByChunkId({ chunkId: "chunk-approx", quote: fullQuote }, chunkMap)!
    expect(result.state).toBe("approximate")
    expect(result.verified).toBe(false)
    expect(result.confidence).toBe(0.45)
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
    expect(validated[1].decisionStatus).toBe("needs_human_review")
    expect(validated[1].includeInExport).toBe(false)
  })

  it("withholds unsupported missing-content claims until human approval", () => {
    const finding: ReviewFinding = {
      id: "f-missing",
      category: "methodology",
      title: "Missing controls",
      findingType: "missing_evidence",
      explanation: "The manuscript does not provide a control group.",
      recommendation: "Add controls.",
      includeInExport: true,
      severity: "major",
      confidence: 0.9,
      epistemicStatus: "MISSING_EVIDENCE",
      evidence: [],
      status: "unreviewed",
      decisionStatus: "open",
      createdBy: "ai",
    }

    const [validated] = validateAndCalibrateFindings([finding], sourceText).validatedFindings
    expect(validated.includeInExport).toBe(false)
    expect(validated.decisionStatus).toBe("needs_human_review")
    expect(validated.confidence).toBeLessThanOrEqual(0.4)
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
