import { describe, it, expect } from "vitest"
import { verifyEvidenceQuote, validateAndCalibrateFindings } from "@/lib/ai/evidence-validator"
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
