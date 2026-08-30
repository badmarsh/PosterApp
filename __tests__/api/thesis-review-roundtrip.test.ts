import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, PUT } from "@/app/api/workspaces/[id]/thesis-review/[reviewId]/route"
import { formatReviewToMarkdown, formatReviewToPlainText } from "@/lib/export/review-formatters"
import { generateThesisReviewDocx } from "@/lib/docx/generator-review"
import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"

// Mock auth
vi.mock("@/lib/auth", () => ({
  requireWorkspaceEditor: vi.fn().mockResolvedValue({ id: "user_test", role: "editor" }),
  requireWorkspaceMember: vi.fn().mockResolvedValue({ id: "user_test", role: "viewer" }),
}))

// Mock in-memory DB for pure roundtrip verification without network dependencies
const inMemoryDB: Record<string, any> = {}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    thesisReview: {
      findFirst: vi.fn().mockImplementation(async ({ where }: { where: { id: string; workspaceId: string } }) => {
        const key = `${where.workspaceId}:${where.id}`
        return inMemoryDB[key] || null
      }),
      updateMany: vi.fn().mockImplementation(async ({ where, data }: { where: { id: string; workspaceId: string }; data: any }) => {
        const key = `${where.workspaceId}:${where.id}`
        if (!inMemoryDB[key]) return { count: 0 }
        inMemoryDB[key] = { ...inMemoryDB[key], ...data, updatedAt: new Date() }
        return { count: 1 }
      }),
    },
  },
}))

describe("P0.1 Database Round-Trip & Decision Support Pipeline", () => {
  const wsId = "ws-roundtrip-test"
  const revId = "rev-roundtrip-1"

  beforeEach(() => {
    // Seed initial review in memory DB
    inMemoryDB[`${wsId}:${revId}`] = {
      id: revId,
      workspaceId: wsId,
      studentName: "Miroslav Štefánik",
      thesisTitle: "Neurónové reprezentácie v robotike",
      thesisType: "master",
      reviewerRole: "opponent",
      reviewerName: "doc. RNDr. Peter Kováč, PhD.",
      institution: "Univerzita Komenského",
      department: "Katedra informatiky",
      grade: "B",
      suggestedGrade: "B",
      finalGrade: null,
      recommendation: "Prácu odporúčam na obhajobu.",
      suggestedRecommendation: "Prácu odporúčam na obhajobu.",
      finalRecommendation: null,
      sections: JSON.stringify([
        { id: "methodology", name: "Metodológia", score: 85, weight: 25, feedback: "Kvalitná." },
      ]),
      defenseQuestions: JSON.stringify(["Aká bola výpočtová zložitosť?"]),
      citationIssues: JSON.stringify([]),
      reviewKind: "thesis",
      targetVenue: "Katedrová komisia",
      summary: "Práca navrhuje nový model pre autonómnu navigáciu.",
      strengths: JSON.stringify(["Rozsiahle experimenty", "Presné merania"]),
      findings: JSON.stringify([
        {
          id: "f-1",
          category: "methodology",
          title: "Chýbajúci popis predtrénovania",
          explanation: "Nie je uvedené, aké datasety boli použité.",
          recommendation: "Doplniť kapitolu 3.2.",
          severity: "major",
          status: "unreviewed",
          createdBy: "ai",
          includeInExport: true,
          evidence: [{ quote: "model bol natrénovaný od nuly", verified: true, state: "verified-exact" }],
        },
      ]),
      reportingStandard: "none",
      reportingGuidelineChecks: JSON.stringify([]),
      confidentialComments: "Študent preukázal mimoriadnu samostatnosť.",
      confirmedAt: null,
      status: "draft",
      language: "sk",
      createdAt: new Date("2026-08-30T08:00:00Z"),
      updatedAt: new Date("2026-08-30T08:00:00Z"),
    }
  })

  it("completes full lifecycle: read -> update finding -> confirm decision -> reload -> export", async () => {
    // 1. Initial GET
    const req1 = new NextRequest(`http://localhost:3333/api/workspaces/${wsId}/thesis-review/${revId}`)
    const res1 = await GET(req1, { params: Promise.resolve({ id: wsId, reviewId: revId }) })
    expect(res1.status).toBe(200)
    const data1 = await res1.json()

    expect(data1.studentName).toBe("Miroslav Štefánik")
    expect(data1.suggestedGrade).toBe("B")
    expect(data1.finalGrade).toBeNull()
    expect(data1.findings).toHaveLength(1)
    expect(data1.findings[0].status).toBe("unreviewed")
    expect(data1.confidentialComments).toBe("Študent preukázal mimoriadnu samostatnosť.")

    // 2. PUT: Reviewer triages finding to "accepted" and overrides grade to "A"
    const updatedFindings = [
      {
        ...data1.findings[0],
        status: "accepted",
        reviewerNotes: "Overené v kapitole 3.",
      },
    ]

    const updatePayload = {
      findings: updatedFindings,
      suggestedGrade: "B",
      finalGrade: "A",
      suggestedRecommendation: "Prácu odporúčam na obhajobu.",
      finalRecommendation: "Prácu jednoznačne odporúčam na obhajobu s pochvalou.",
      confirmedAt: new Date().toISOString(),
      confidentialComments: "Vynikajúca práca.",
    }

    const req2 = new NextRequest(`http://localhost:3333/api/workspaces/${wsId}/thesis-review/${revId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload),
    })
    const res2 = await PUT(req2, { params: Promise.resolve({ id: wsId, reviewId: revId }) })
    expect(res2.status).toBe(200)

    // 3. Second GET (Reload from Database)
    const req3 = new NextRequest(`http://localhost:3333/api/workspaces/${wsId}/thesis-review/${revId}`)
    const res3 = await GET(req3, { params: Promise.resolve({ id: wsId, reviewId: revId }) })
    expect(res3.status).toBe(200)
    const data3 = await res3.json()

    // Verify all decision & triage fields survived round-trip without loss
    expect(data3.suggestedGrade).toBe("B")
    expect(data3.finalGrade).toBe("A")
    expect(data3.suggestedRecommendation).toBe("Prácu odporúčam na obhajobu.")
    expect(data3.finalRecommendation).toBe("Prácu jednoznačne odporúčam na obhajobu s pochvalou.")
    expect(data3.confirmedAt).toBeTruthy()
    expect(data3.findings[0].status).toBe("accepted")
    expect(data3.findings[0].reviewerNotes).toBe("Overené v kapitole 3.")
    expect(data3.confidentialComments).toBe("Vynikajúca práca.")

    // 4. Export verification with reloaded record
    const md = formatReviewToMarkdown(data3 as ThesisReviewRecord)
    expect(md).toContain("Miroslav Štefánik")
    expect(md).toContain("Chýbajúci popis predtrénovania")
    expect(md).toContain("A") // Final grade reflected

    const txt = formatReviewToPlainText(data3 as ThesisReviewRecord)
    expect(txt).toContain("Miroslav Štefánik")
    expect(txt).toContain("[METHODOLOGY]")

    const docxBlob = await generateThesisReviewDocx(data3 as ThesisReviewRecord)
    expect(docxBlob).toBeTruthy()
    expect(docxBlob.size).toBeGreaterThan(1000)
  })
})
