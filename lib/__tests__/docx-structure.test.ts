import { describe, it, expect } from "vitest"
import JSZip from "jszip"
import { generateThesisReviewDocx } from "@/lib/docx/generator-review"
import { formatReviewToMarkdown, formatReviewToPlainText } from "@/lib/export/review-formatters"
import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"

describe("OpenXML DOCX Structure & Plain Text / Markdown Deep Verification", () => {
  const completeReview: ThesisReviewRecord = {
    id: "rev-docx-1",
    studentName: "Mária Červenáková",
    thesisTitle: "Pokročilá analýza medicínskych dát a hlboké neurónové siete",
    thesisType: "master",
    reviewerRole: "opponent",
    reviewerName: "doc. RNDr. Tomáš Krátky, PhD.",
    institution: "Univerzita Komenského v Bratislave",
    department: "Katedra aplikovanej informatiky",
    grade: "A",
    suggestedGrade: "B",
    finalGrade: "A",
    recommendation: "Prácu jednoznačne odporúčam na obhajobu.",
    suggestedRecommendation: "Prácu odporúčam na obhajobu.",
    finalRecommendation: "Prácu jednoznačne odporúčam na obhajobu s pochvalou.",
    summary: "Diplomová práca sa zaoberá klasifikáciou biomedicínskych obrazov.",
    strengths: [
      "Vynikajúca metodologická čistota",
      "Robustné experimentálne vyhodnotenie na troch nezávislých datasetoch",
    ],
    findings: [
      {
        id: "f-1",
        category: "methodology",
        title: "Metodologická pripomienka k augmentácii dát",
        explanation: "Pri geometrických transformáciách chýba kvantifikácia vplyvu na výslednú presnosť.",
        recommendation: "Doplniť ablačnú štúdiu v kapitole 4.",
        severity: "major",
        confidence: 0.95,
        evidence: [
          {
            quote: "rotácia obrazov bola vykonaná náhodne bez normalizácie",
            verified: true,
            state: "verified-exact",
          },
        ],
        status: "accepted",
        reviewerNotes: "Zásadný bod, ktorý je potrebné zodpovedať pri obhajobe.",
        includeInExport: true,
        createdBy: "ai",
      },
      {
        id: "f-2",
        category: "formal",
        title: "Drobné typografické nedostatky",
        explanation: "Chýbajúce nezlomiteľné medzery za jednopísmenovými predložkami.",
        recommendation: "Použiť LaTeX vlnku ~.",
        severity: "minor",
        confidence: 0.9,
        evidence: [],
        status: "accepted",
        includeInExport: true,
        createdBy: "reviewer",
      },
      {
        id: "f-3",
        category: "ethics",
        title: "Vynechaná interná poznámka",
        explanation: "Táto pripomienka bola zamietnutá.",
        recommendation: "",
        severity: "suggestion",
        confidence: 0.5,
        evidence: [],
        status: "rejected",
        includeInExport: false,
        createdBy: "ai",
      },
    ],
    reportingStandard: "ml_reproducibility",
    reportingGuidelineChecks: [
      {
        item: "Random seeds specification",
        category: "Reproducibility",
        status: "compliant",
        notes: "Uvedené v tabuľke 2.",
      },
      {
        item: "Open code repository",
        category: "Data & Artifacts",
        status: "partial",
        notes: "Odkaz na GitHub je nefunkčný.",
      },
    ],
    defenseQuestions: [
      "Aký bol vplyv zvoleného random seedu na stabilitu trénovania?",
      "Ako by sa model správal pri zmene distribúcie vstupných dát (domain shift)?",
    ],
    citationIssues: [],
    confidentialComments: "Dôverná poznámka pre komisiu: Študentka pracovala úplne samostatne.",
    confirmedAt: new Date("2026-08-30T10:00:00Z").toISOString(),
    status: "final",
    language: "sk",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [],
  }

  it("generates a valid OpenXML DOCX archive and verifies internal structure", async () => {
    const blob = await generateThesisReviewDocx(completeReview, { anonymizeReviewer: false })
    const arrayBuffer = await blob.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // 1. Verify mandatory OpenXML package parts
    expect(zip.file("[Content_Types].xml")).toBeDefined()
    expect(zip.file("_rels/.rels")).toBeDefined()
    expect(zip.file("word/document.xml")).toBeDefined()

    // 2. Read word/document.xml
    const docXml = await zip.file("word/document.xml")!.async("string")

    // 3. Verify content in OpenXML
    expect(docXml).toContain("Mária Červenáková")
    expect(docXml).toContain("Pokročilá analýza medicínskych dát")
    expect(docXml).toContain("Tomáš Krátky")
    expect(docXml).toContain("Metodologická pripomienka k augmentácii dát")
    expect(docXml).toContain("Zásadný bod, ktorý je potrebné zodpovedať pri obhajobe.")
    expect(docXml).toContain("Vynikajúca metodologická čistota")
    expect(docXml).toContain("Aký bol vplyv zvoleného random seedu")

    // 4. Verify rejected finding is excluded
    expect(docXml).not.toContain("Vynechaná interná poznámka")

    // 5. Verify confidential comments are not leaked into standard document
    expect(docXml).not.toContain("Dôverná poznámka pre komisiu")
  })

  it("correctly anonymizes reviewer when requested", async () => {
    const blobAnon = await generateThesisReviewDocx(completeReview, { anonymizeReviewer: true })
    const arrayBuffer = await blobAnon.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)
    const docXml = await zip.file("word/document.xml")!.async("string")

    expect(docXml).toContain("Anonymný recenzent")
    expect(docXml).not.toContain("Tomáš Krátky")
  })

  it("plain text and markdown formatters produce clean UTF-8 for editorial platforms", () => {
    const md = formatReviewToMarkdown(completeReview, { excludeRejected: true })
    const txt = formatReviewToPlainText(completeReview, { excludeRejected: true })

    // Check diacritics
    expect(md).toContain("Mária Červenáková")
    expect(md).toContain("Pokročilá analýza medicínskych dát")
    expect(md).toContain("Metodologická pripomienka k augmentácii dát")
    expect(md).not.toContain("Vynechaná interná poznámka")

    expect(txt).toContain("Mária Červenáková")
    expect(txt).toContain("[METHODOLOGY] Metodologická pripomienka k augmentácii dát")
    expect(txt).not.toContain("Vynechaná interná poznámka")
  })
})
