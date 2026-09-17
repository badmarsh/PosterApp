import { describe, it, expect } from "vitest"
import { composeFullReviewNarrative, getEligibleFindings } from "@/lib/ai/review-composer"
import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"

describe("Human-Controlled Review Composer", () => {
  const sampleReview: ThesisReviewRecord = {
    id: "rev-comp-1",
    studentName: "Lucia Novotná",
    thesisTitle: "Spracovanie medicínskych obrazov",
    thesisType: "master",
    reviewerRole: "opponent",
    reviewerName: "prof. MUDr. Ján Breza, DrSc.",
    institution: "Lekárska fakulta UK",
    department: "Rádiologická klinika",
    grade: "B",
    suggestedGrade: "B",
    finalGrade: "A",
    recommendation: "Prácu odporúčam na obhajobu.",
    suggestedRecommendation: "Prácu odporúčam na obhajobu.",
    finalRecommendation: "Prácu odporúčam na obhajobu s vyznamenaním.",
    summary: "Diplomová práca sa venuje segmentácii MRI snímok pomocou U-Net architektúry.",
    strengths: ["Veľký klinický dataset", "Vysoké Dice skóre 0.91"],
    findings: [
      {
        id: "f-1",
        category: "methodology",
        title: "Chýbajúci popis krížovej validácie",
        explanation: "V kapitole 4.2 nie je uvedený počet foldov.",
        recommendation: "Doplniť 5-fold cross-validation protokol.",
        severity: "major",
        confidence: 0.9,
        evidence: [{ quote: "trénovanie prebehlo na rozdelenej množine", verified: true, state: "verified-exact" }],
        status: "accepted",
        reviewerNotes: "Dôležitá pripomienka, overené na strane 45.",
        includeInExport: true,
        createdBy: "ai",
      },
      {
        id: "f-2",
        category: "formal",
        title: "Drobné preklepy v latinských názvoch",
        explanation: "Chyby v taxonómii anatomických štruktúr.",
        recommendation: "Opraviť názvy.",
        severity: "minor",
        confidence: 0.8,
        evidence: [],
        status: "rejected",
        includeInExport: false,
        createdBy: "ai",
      },
      {
        id: "f-3",
        category: "statistics",
        title: "Dôverná poznámka o štatistike",
        explanation: "Možné podozrenie na overfitting.",
        recommendation: "Skontrolovať testovaciu vzorku.",
        severity: "major",
        confidence: 0.85,
        evidence: [],
        status: "accepted",
        audience: "private",
        includeInExport: true,
        createdBy: "reviewer",
      },
    ],
    reportingStandard: "consort",
    reportingGuidelineChecks: [
      { item: "Randomization sequence", category: "Trial Design", status: "missing", notes: "Chýba popis generovania sekvencie" },
    ],
    defenseQuestions: ["Ako bol kalibrovaný MRI prístroj?"],
    citationIssues: [],
    confidentialComments: "Študentka pracovala mimoriadne iniciatívne.",
    confirmedAt: new Date("2026-08-30T10:00:00Z").toISOString(),
    status: "final",
    language: "sk",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [],
  }

  it("filters out rejected findings and findings with includeInExport: false", () => {
    const eligible = getEligibleFindings(sampleReview.findings, "author")
    expect(eligible.map((f) => f.id)).toEqual(["f-1"])
  })

  it("strictly hides private/confidential findings and notes from author audience", () => {
    const authorView = composeFullReviewNarrative(sampleReview, "author", "sk")

    expect(authorView.plainText).not.toContain("Študentka pracovala mimoriadne iniciatívne.")
    expect(authorView.plainText).not.toContain("Dôverná poznámka o štatistike")
    expect(authorView.sections.find((s) => s.id === "confidential")).toBeUndefined()
  })

  it("always emits exactly the canonical 14 thesis sections", () => {
    const authorView = composeFullReviewNarrative(sampleReview, "author", "sk")
    const editorView = composeFullReviewNarrative(sampleReview, "editor", "sk")

    expect(authorView.sections).toHaveLength(14)
    expect(editorView.sections).toHaveLength(14)
    expect(authorView.sections.map((section) => section.title)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^1\./), expect.stringMatching(/^14\./)]),
    )
  })

  it("includes confidential comments and private findings for editor/committee audience", () => {
    const editorView = composeFullReviewNarrative(sampleReview, "editor", "sk")

    expect(editorView.plainText).toContain("Študentka pracovala mimoriadne iniciatívne.")
    expect(editorView.plainText).toContain("Dôverná poznámka o štatistike")
    expect(editorView.sections.find((s) => s.id === "confidential")).toBeDefined()
  })

  it("prioritizes reviewer notes over raw AI explanation", () => {
    const res = composeFullReviewNarrative(sampleReview, "author", "sk")
    expect(res.plainText).toContain("Dôležitá pripomienka, overené na strane 45.")
  })

  it("reflects confirmed final decisions with timestamp", () => {
    const res = composeFullReviewNarrative(sampleReview, "author", "sk")
    expect(res.metadata.grade).toBe("A")
    expect(res.metadata.isConfirmed).toBe(true)
    expect(res.plainText).toContain("Navrhovaná známka / ECTS: A")
    expect(res.plainText).toContain("explicitne potvrdené recenzentom")
  })

  it("does not invent positive thesis judgments when evidence is absent", () => {
    const emptyDraft = {
      ...sampleReview,
      confirmedAt: null,
      findings: [],
      strengths: [],
      summary: null,
      grade: null,
      suggestedGrade: null,
      finalGrade: null,
      proposedGradeRange: null,
    } as ThesisReviewRecord
    const result = composeFullReviewNarrative(emptyDraft, "author", "sk")

    expect(result.plainText).toContain("Vyžaduje sa posúdenie recenzentom")
    expect(result.plainText).not.toContain("Ciele práce boli formulované zrozumiteľne")
    expect(result.plainText).not.toContain("Zvolené metódy a postup riešenia zodpovedajú")
    expect(result.plainText).not.toContain("Práca spĺňa formálne")
  })

  it("uses scientific peer-review terminology and omits ECTS for papers", () => {
    const paper = {
      ...sampleReview,
      reviewKind: "paper",
      reviewerRole: "reviewer",
      recommendation: "major_revisions",
      suggestedRecommendation: "major_revisions",
      finalRecommendation: null,
      grade: "A",
      suggestedGrade: "A",
      finalGrade: "A",
      confirmedAt: null,
      confidentialComments: null,
    } as ThesisReviewRecord
    const result = composeFullReviewNarrative(paper, "author", "en")

    expect(result.metadata.grade).toBeNull()
    expect(result.markdownText).toContain("Scientific Paper Peer Review")
    expect(result.plainText).toContain("Major Concerns")
    expect(result.plainText).toContain("Questions for the Authors")
    expect(result.plainText).not.toMatch(/ECTS|Defense Questions|Thesis Overview/)
  })
})
