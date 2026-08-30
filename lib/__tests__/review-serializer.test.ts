import { describe, it, expect } from "vitest"
import {
  deserializeThesisReview,
  serializeThesisReviewUpdate,
  safeJsonParse,
  normalizeFindings,
  normalizeGuidelineChecks,
  REVIEW_SCHEMA_VERSION,
} from "@/lib/ai/review-serializer"

describe("review-serializer", () => {
  it("safeJsonParse safely falls back on corrupted or non-string input without throwing", () => {
    expect(safeJsonParse("{ broken json", [1, 2])).toEqual([1, 2])
    expect(safeJsonParse(null, { default: true })).toEqual({ default: true })
    expect(safeJsonParse(undefined, "fallback")).toEqual("fallback")
    expect(safeJsonParse('{"valid": true}', {})).toEqual({ valid: true })
  })

  it("normalizes findings with invalid enums, missing IDs, and dirty data", () => {
    const raw = [
      {
        category: "invalid_cat",
        severity: "ultra_high",
        status: "random_status",
        title: "Test finding",
        confidence: 2.5,
        evidence: [{ quote: "some quote", verified: true }],
      },
    ]

    const normalized = normalizeFindings(raw)
    expect(normalized).toHaveLength(1)
    expect(normalized[0].category).toBe("methodology") // fallback
    expect(normalized[0].severity).toBe("minor") // fallback
    expect(normalized[0].status).toBe("unreviewed") // fallback
    expect(normalized[0].confidence).toBe(1) // clamped to max 1.0
    expect(normalized[0].id).toBeTruthy()
    expect(normalized[0].evidence[0].verified).toBe(true)
  })

  it("deserializes a complete new record with schemaVersion", () => {
    const dbRecord = {
      id: "rev-123",
      workspaceId: "ws-abc",
      studentName: "Ján Novák",
      thesisTitle: "Neurónové siete",
      thesisType: "master",
      reviewerRole: "opponent",
      reviewerName: "doc. Peter Kováč",
      institution: "STU",
      department: "FIIT",
      grade: "A",
      recommendation: "Odporúčam",
      sections: JSON.stringify([{ id: "s1", criterionId: "c1", text: "Text", rating: "A", numericScore: 95 }]),
      defenseQuestions: JSON.stringify(["Otázka 1"]),
      citationIssues: JSON.stringify([]),
      reviewKind: "thesis",
      targetVenue: "STU",
      summary: "Zhrnutie",
      strengths: JSON.stringify(["Silná stránka 1"]),
      findings: JSON.stringify([
        {
          id: "f1",
          category: "methodology",
          title: "Chýbajúci vzorec",
          explanation: "Vysvetlenie",
          recommendation: "Doplniť",
          severity: "major",
          confidence: 0.9,
          evidence: [{ quote: "vzorec nebol uvedený", verified: true }],
          status: "accepted",
          createdBy: "ai",
        },
      ]),
      reportingStandard: "none",
      reportingGuidelineChecks: JSON.stringify([]),
      confidentialComments: "Dôverné",
      status: "draft",
      language: "sk",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const deserialized = deserializeThesisReview(dbRecord)
    expect(deserialized.id).toBe("rev-123")
    expect(deserialized.schemaVersion).toBe(REVIEW_SCHEMA_VERSION)
    expect(deserialized.sections).toHaveLength(1)
    expect(deserialized.findings).toHaveLength(1)
    expect(deserialized.findings[0].id).toBe("f1")
    expect(deserialized.findings[0].status).toBe("accepted")
    expect(deserialized.strengths).toEqual(["Silná stránka 1"])
  })

  it("deserializes a legacy record with null/missing newer fields gracefully", () => {
    const legacyRecord = {
      id: "legacy-1",
      workspaceId: "ws-legacy",
      studentName: "Starý Autor",
      thesisTitle: "Stará Práca",
      thesisType: "bachelor",
      reviewerRole: "supervisor",
      sections: null,
      defenseQuestions: null,
      citationIssues: null,
      reviewKind: null,
      targetVenue: null,
      summary: null,
      strengths: null,
      findings: null,
      reportingStandard: null,
      reportingGuidelineChecks: null,
      confidentialComments: null,
      status: "draft",
      language: "sk",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const deserialized = deserializeThesisReview(legacyRecord)
    expect(deserialized.id).toBe("legacy-1")
    expect(deserialized.sections).toEqual([])
    expect(deserialized.defenseQuestions).toEqual([])
    expect(deserialized.findings).toEqual([])
    expect(deserialized.strengths).toEqual([])
    expect(deserialized.reportingGuidelineChecks).toEqual([])
    expect(deserialized.reviewKind).toBe("thesis")
    expect(deserialized.reportingStandard).toBe("none")
  })

  it("deserializes a record with completely corrupted JSON strings without throwing", () => {
    const corruptedRecord = {
      id: "corrupt-1",
      workspaceId: "ws-corrupt",
      studentName: "Test",
      thesisTitle: "Test",
      sections: "{ invalid json string",
      findings: "[ not closed array",
      reportingGuidelineChecks: "### markdown instead of json",
      strengths: "invalid strengths",
      defenseQuestions: "invalid questions",
      citationIssues: null,
      status: "draft",
      language: "sk",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const deserialized = deserializeThesisReview(corruptedRecord)
    expect(deserialized.sections).toEqual([])
    expect(deserialized.findings).toEqual([])
    expect(deserialized.reportingGuidelineChecks).toEqual([])
    expect(deserialized.strengths).toEqual([])
    expect(deserialized.defenseQuestions).toEqual([])
  })

  it("serializes update payload and enforces payload size limits", () => {
    const update = {
      studentName: "Nový Študent",
      findings: [
        {
          id: "f_new",
          category: "reproducibility",
          title: "Chýbajúci seed",
          explanation: "Seed nebol fixovaný",
          recommendation: "Nastaviť seed 42",
          severity: "minor",
          confidence: 0.95,
          evidence: [],
          status: "accepted",
          createdBy: "reviewer",
        },
      ],
    }

    const serialized = serializeThesisReviewUpdate(update)
    expect(serialized.studentName).toBe("Nový Študent")
    expect(typeof serialized.findings).toBe("string")
    const parsedFindings = JSON.parse(serialized.findings)
    expect(parsedFindings).toHaveLength(1)
    expect(parsedFindings[0].category).toBe("reproducibility")
  })

  it("rejects oversized payload exceeding MAX_SERIALIZED_PAYLOAD_BYTES", () => {
    const hugeString = "a".repeat(6 * 1024 * 1024)
    expect(() => {
      serializeThesisReviewUpdate({ sections: hugeString })
    }).toThrow("Payload size limit exceeded")
  })
})
