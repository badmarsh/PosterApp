import { describe, it, expect } from "vitest"
import {
  deserializeThesisReview,
  serializeThesisReviewUpdate,
  safeJsonParse,
  safeJsonParseWithDiagnostics,
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

  it("safeJsonParseWithDiagnostics records corrupted fields and warning messages", () => {
    const diag = { corruptedFields: [] as string[], parseWarnings: [] as string[] }
    const result = safeJsonParseWithDiagnostics("{ broken json", [], "findings", diag)
    expect(result).toEqual([])
    expect(diag.corruptedFields).toContain("findings")
    expect(diag.parseWarnings[0]).toContain("Failed to parse findings")
  })

  it("normalizes findings with invalid enums, missing IDs, audience and dirty data", () => {
    const raw = [
      {
        category: "invalid_cat",
        severity: "ultra_high",
        status: "random_status",
        title: "Test finding",
        confidence: 2.5,
        audience: "editor",
        evidence: [{ quote: "some quote", verified: true, state: "verified" }],
      },
    ]

    const normalized = normalizeFindings(raw)
    expect(normalized).toHaveLength(1)
    expect(normalized[0].category).toBe("methodology") // fallback
    expect(normalized[0].severity).toBe("minor") // fallback
    expect(normalized[0].status).toBe("unreviewed") // fallback
    expect(normalized[0].audience).toBe("editor")
    expect(normalized[0].confidence).toBe(1) // clamped to max 1.0
    expect(normalized[0].id).toBeTruthy()
    expect(normalized[0].evidence[0].verified).toBe(true)
    expect(normalized[0].evidence[0].state).toBe("verified")
    expect(normalized[0].evidenceState).toBe("verified")
  })

  it("deserializes a complete new record with schemaVersion, diagnostics and Unicode diacritics", () => {
    const dbRecord = {
      id: "rev-123",
      workspaceId: "ws-abc",
      studentName: "Ľubomír Šťastný",
      thesisTitle: "Neurónové siete s dôrazom na diakritiku (ô, ä, č, š, ž, ť, ď)",
      thesisType: "master",
      reviewerRole: "opponent",
      reviewerName: "doc. Peter Kováč, CSc.",
      institution: "Slovenská technická univerzita",
      department: "FIIT",
      grade: "A",
      recommendation: "Prácu odporúčam na obhajobu.",
      sections: JSON.stringify([{ id: "s1", criterionId: "c1", text: "Text s diakritikou: čučoriedka", rating: "A", numericScore: 95 }]),
      defenseQuestions: JSON.stringify(["Aký vplyv má normalizácia na diakritiku?"]),
      citationIssues: JSON.stringify([]),
      reviewKind: "thesis",
      targetVenue: "STU",
      summary: "Zhrnutie diplomovej práce s detailným hodnotením.",
      strengths: JSON.stringify(["Silná experimentálna časť", "Vynikajúci prehľad literatúry"]),
      findings: JSON.stringify([
        {
          id: "f1",
          category: "methodology",
          title: "Chýbajúci matematický vzorec",
          explanation: "V rovnici 3.1 chýba normalizačný člen.",
          recommendation: "Doplniť rovnicu.",
          severity: "major",
          confidence: 0.9,
          evidence: [{ quote: "vzorec nebol uvedený v úplnom znení", verified: true }],
          status: "accepted",
          createdBy: "ai",
        },
      ]),
      reportingStandard: "none",
      reportingGuidelineChecks: JSON.stringify([]),
      confidentialComments: "Dôverné poznámky pre komisiu.",
      status: "draft",
      language: "sk",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const deserialized = deserializeThesisReview(dbRecord)
    expect(deserialized.id).toBe("rev-123")
    expect(deserialized.studentName).toBe("Ľubomír Šťastný")
    expect(deserialized.thesisTitle).toContain("ô, ä, č, š")
    expect(deserialized.schemaVersion).toBe(REVIEW_SCHEMA_VERSION)
    expect(deserialized.diagnostics.corruptedFields).toEqual([])
    expect(deserialized.sections).toHaveLength(1)
    expect(deserialized.findings).toHaveLength(1)
    expect(deserialized.findings[0].id).toBe("f1")
    expect(deserialized.findings[0].status).toBe("accepted")
    expect(deserialized.strengths).toEqual(["Silná experimentálna časť", "Vynikajúci prehľad literatúry"])
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

  it("deserializes a record with completely corrupted JSON strings and populates diagnostics without throwing", () => {
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

    // Diagnostics should capture all 5 broken fields
    expect(deserialized.diagnostics.corruptedFields).toContain("sections")
    expect(deserialized.diagnostics.corruptedFields).toContain("findings")
    expect(deserialized.diagnostics.corruptedFields).toContain("reportingGuidelineChecks")
    expect(deserialized.diagnostics.corruptedFields).toContain("strengths")
    expect(deserialized.diagnostics.corruptedFields).toContain("defenseQuestions")
    expect(deserialized.diagnostics.parseWarnings.length).toBe(5)
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

  it("verifies migration idempotency: round-trip deserialize -> serialize -> deserialize preserves data", () => {
    const originalRecord = {
      id: "idempotent-1",
      workspaceId: "ws-idem",
      studentName: "Katarína Novotná",
      thesisTitle: "Analýza stability systémov",
      thesisType: "master",
      reviewerRole: "opponent",
      grade: "A",
      recommendation: "Odporúčam",
      sections: JSON.stringify([{ id: "s1", criterionId: "c1", text: "Text", rating: "A", numericScore: 90 }]),
      defenseQuestions: JSON.stringify(["Otázka 1"]),
      citationIssues: JSON.stringify([]),
      reviewKind: "thesis",
      findings: JSON.stringify([
        {
          id: "f1",
          category: "methodology",
          title: "Title 1",
          explanation: "Explanation 1",
          recommendation: "Rec 1",
          severity: "major",
          confidence: 0.9,
          evidence: [{ quote: "Quote 1", verified: true }],
          status: "accepted",
          createdBy: "ai",
        },
      ]),
      reportingStandard: "none",
      reportingGuidelineChecks: JSON.stringify([]),
      status: "draft",
      language: "sk",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const deserialized1 = deserializeThesisReview(originalRecord)
    const updatePayload = serializeThesisReviewUpdate(deserialized1)
    const deserialized2 = deserializeThesisReview({
      ...originalRecord,
      ...updatePayload,
    })

    expect(deserialized2.studentName).toBe(deserialized1.studentName)
    expect(deserialized2.findings).toHaveLength(deserialized1.findings.length)
    expect(deserialized2.findings[0].title).toBe(deserialized1.findings[0].title)
    expect(deserialized2.sections).toHaveLength(deserialized1.sections.length)
  })

  it("rejects oversized payload exceeding MAX_SERIALIZED_PAYLOAD_BYTES", () => {
    const hugeString = "a".repeat(6 * 1024 * 1024)
    expect(() => {
      serializeThesisReviewUpdate({ sections: hugeString })
    }).toThrow("Payload size limit exceeded")
  })
})
