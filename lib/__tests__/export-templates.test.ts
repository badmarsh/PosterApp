import { describe, it, expect } from "vitest"
import { generateAis2ProtocolText, generateCsvGradeRoster } from "@/lib/export/export-templates"
import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"

describe("Multi-Format Export Engine", () => {
  const sampleReview: ThesisReviewRecord = {
    id: "rev-test-1",
    studentName: "Ján Novák",
    thesisTitle: "Neurónové siete pre fyzikálne simulácie",
    thesisType: "master",
    reviewerRole: "opponent",
    reviewerName: "doc. Ing. Elena Horváthová, PhD.",
    grade: "A",
    finalGrade: "A",
    recommendation: "Prácu odporúčam na obhajobu.",
    finalRecommendation: "Prácu odporúčam na obhajobu.",
    sections: [
      {
        id: "s1",
        criterionId: "methodology",
        text: "Metodologický postup bol zvolený vhodne s dostatočnou rigoróznosťou.",
        rating: "A",
        numericScore: 92,
      },
    ],
    defenseQuestions: ["Ako ovplyvnila voľba batch size stabilitu trénovania?"],
    citationIssues: [],
    status: "final",
    language: "sk",
    createdAt: "2026-08-30T10:00:00Z",
    updatedAt: "2026-08-30T12:00:00Z",
  }

  it("generates structured AIS2 protocol plain text", () => {
    const ais2 = generateAis2ProtocolText(sampleReview)
    expect(ais2).toContain("AKADEMICKÝ INFORMAČNÝ SYSTÉM (AIS2)")
    expect(ais2).toContain("Ján Novák")
    expect(ais2).toContain("Neurónové siete pre fyzikálne simulácie")
    expect(ais2).toContain("Navrhnutá známka:    A")
    expect(ais2).toContain("[METHODOLOGY]")
    expect(ais2).toContain("OTÁZKY NA OBHAJOBU:")
    expect(ais2).toContain("Ako ovplyvnila voľba batch size")
  })

  it("generates valid CSV grade roster with escaping", () => {
    const csv = generateCsvGradeRoster([sampleReview])
    const lines = csv.split("\n")
    expect(lines[0]).toBe('"ID","Student","Thesis Title","Type","Role","Reviewer","Grade","Recommendation","Status","Date"')
    expect(lines[1]).toContain('"rev-test-1"')
    expect(lines[1]).toContain('"Ján Novák"')
    expect(lines[1]).toContain('"A"')
  })
})
