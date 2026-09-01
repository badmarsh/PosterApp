import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST as exportHandler, GET as exportGetHandler } from "@/app/api/workspaces/[id]/thesis-review/[reviewId]/export/route"
import { POST as analysisPlanHandler } from "@/app/api/workspaces/[id]/thesis-review/analysis-plan/route"
import { prisma } from "@/lib/prisma"
import { requireWorkspaceEditor } from "@/lib/auth"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth", () => ({
  requireWorkspaceEditor: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    thesisReview: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ingestFile: {
      findMany: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
  },
}))

describe("Thesis Review Extended API & Export Pipeline", () => {
  const mockReview = {
    id: "rev-ext-101",
    workspaceId: "ws-test-1",
    studentName: "Jana Kováčová",
    thesisTitle: "Neurónové siete v bioinformatike",
    thesisType: "master",
    reviewerRole: "opponent",
    reviewerName: "doc. RNDr. Peter Novák, PhD.",
    institution: "FMFI UK",
    department: "Katedra informatiky",
    grade: "A",
    suggestedGrade: "A",
    finalGrade: "A",
    recommendation: "Prácu odporúčam na obhajobu.",
    suggestedRecommendation: "Prácu odporúčam na obhajobu.",
    finalRecommendation: "Prácu odporúčam na obhajobu.",
    sections: JSON.stringify([
      { id: "sec-1", criterionId: "theoretical_background", rating: "A", text: "Vynikajúci teoretický rozbor." },
    ]),
    defenseQuestions: JSON.stringify(["Ako bola vyhodnotená robustnosť modelu?"]),
    citationIssues: JSON.stringify([]),
    reviewKind: "thesis",
    targetVenue: "Bioinformatika",
    summary: "Diplomová práca sa zaoberá predikciou proteínových štruktúr.",
    strengths: JSON.stringify(["Robustná architektúra", "Nový dataset"]),
    findings: JSON.stringify([
      {
        id: "f-1",
        category: "methodology",
        title: "Dobre zvolená validačná schéma",
        explanation: "Použitá 10-fold validácia.",
        severity: "minor",
        confidence: 0.95,
        epistemicStatus: "SUPPORTED_FACT",
        evidence: [{ quote: "použitá 10-fold krížová validácia", verified: true, state: "verified-exact" }],
        status: "accepted",
        includeInExport: true,
        createdBy: "ai",
      },
    ]),
    sourceRevision: "a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef",
    rubricVersion: "sk-academic-v1",
    discipline: "Bioinformatika",
    proposedGradeRange: "A",
    confidence: 0.92,
    limitationsSummary: null,
    reportingStandard: "none",
    reportingGuidelineChecks: null,
    confidentialComments: "DÔVERNÁ POZNÁMKA PRE KOMISIU: Študentka pracovala mimoriadne samostatne.",
    status: "final",
    language: "sk",
    confirmedAt: new Date("2026-08-30T14:00:00Z").toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireWorkspaceEditor).mockResolvedValue({
      workspace: { id: "ws-test-1", name: "Test" } as any,
      userId: "user-123",
      role: "owner",
    })
  })

  it("exports clean markdown without confidential notes for author view", async () => {
    vi.mocked(prisma.thesisReview.findFirst).mockResolvedValue(mockReview as any)

    const req = new NextRequest("http://localhost:3333/api/workspaces/ws-test-1/thesis-review/rev-ext-101/export?format=md")
    const res = await exportGetHandler(req, { params: Promise.resolve({ id: "ws-test-1", reviewId: "rev-ext-101" }) })

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toContain("text/markdown")

    const text = await res.text()
    expect(text).toContain("Neurónové siete v bioinformatike")
    expect(text).toContain("Jana Kováčová")
    expect(text).toContain("Dobre zvolená validačná schéma")
    expect(text).not.toContain("DÔVERNÁ POZNÁMKA PRE KOMISIU")
  })

  it("includes confidential comments in markdown only when confidential=true is explicitly requested", async () => {
    vi.mocked(prisma.thesisReview.findFirst).mockResolvedValue(mockReview as any)

    const req = new NextRequest("http://localhost:3333/api/workspaces/ws-test-1/thesis-review/rev-ext-101/export?format=md&confidential=true")
    const res = await exportGetHandler(req, { params: Promise.resolve({ id: "ws-test-1", reviewId: "rev-ext-101" }) })

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain("DÔVERNÁ POZNÁMKA PRE KOMISIU")
  })

  it("exports valid DOCX binary stream", async () => {
    vi.mocked(prisma.thesisReview.findFirst).mockResolvedValue(mockReview as any)

    const req = new NextRequest("http://localhost:3333/api/workspaces/ws-test-1/thesis-review/rev-ext-101/export?format=docx")
    const res = await exportGetHandler(req, { params: Promise.resolve({ id: "ws-test-1", reviewId: "rev-ext-101" }) })

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document")

    const buffer = await res.arrayBuffer()
    expect(buffer.byteLength).toBeGreaterThan(1000)
  })

  it("exports valid LaTeX source code", async () => {
    vi.mocked(prisma.thesisReview.findFirst).mockResolvedValue(mockReview as any)

    const req = new NextRequest("http://localhost:3333/api/workspaces/ws-test-1/thesis-review/rev-ext-101/export?format=tex")
    const res = await exportGetHandler(req, { params: Promise.resolve({ id: "ws-test-1", reviewId: "rev-ext-101" }) })

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toContain("text/x-tex")

    const tex = await res.text()
    expect(tex).toContain("\\documentclass")
    expect(tex).toContain("Jana Kováčová")
  })

  it("handles analysis-plan generation with sourceFileId and custom metadata", async () => {
    const req = new NextRequest("http://localhost:3333/api/workspaces/ws-test-1/thesis-review/analysis-plan", {
      method: "POST",
      body: JSON.stringify({
        sourceFileId: "file_irradiation_proceedings.md",
        thesisMetadata: {
          studentName: "Jana Kováčová",
          thesisTitle: "Neurónové siete v bioinformatike",
          thesisType: "master",
          reviewerRole: "opponent",
          language: "sk",
          reviewKind: "thesis",
        },
      }),
    })

    const res = await analysisPlanHandler(req, { params: Promise.resolve({ id: "ws-test-1" }) })
    expect(res.status).toBe(200)
    const plan = await res.json()
    expect(plan).toHaveProperty("documentTitle")
    expect(plan).toHaveProperty("detectedType")
    expect(plan).toHaveProperty("canProceedToDeepReview")
  })
})

