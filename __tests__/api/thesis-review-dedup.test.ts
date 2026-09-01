import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET as getReviews, normalizeDefenseQuestions } from "@/app/api/workspaces/[id]/thesis-review/route"
import { GET as getSingleReview, PUT as updateReview } from "@/app/api/workspaces/[id]/thesis-review/[reviewId]/route"

// Mock auth
vi.mock("@/lib/auth", () => ({
  requireWorkspaceEditor: vi.fn().mockResolvedValue({ id: "user_test", role: "editor", userId: "user_test" }),
  requireWorkspaceMember: vi.fn().mockResolvedValue({ id: "user_test", role: "viewer", userId: "user_test" }),
}))

// Mock rate limit
vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}))

// In-memory mock database
const inMemoryDB: Record<string, any[]> = {}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    thesisReview: {
      findMany: vi.fn().mockImplementation(async ({ where, select }: { where: { workspaceId: string }; select?: any }) => {
        const list = inMemoryDB[where.workspaceId] || []
        if (!select) return list
        return list.map((item) => {
          const selected: Record<string, any> = {}
          for (const key of Object.keys(select)) {
            if (select[key]) selected[key] = item[key]
          }
          return selected
        })
      }),
      findFirst: vi.fn().mockImplementation(async ({ where }: { where: { id: string; workspaceId: string } }) => {
        const list = inMemoryDB[where.workspaceId] || []
        return list.find((item) => item.id === where.id) || null
      }),
      create: vi.fn().mockImplementation(async ({ data }: { data: any }) => {
        const newItem = {
          id: data.id || `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ...data,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        }
        if (!inMemoryDB[data.workspaceId]) {
          inMemoryDB[data.workspaceId] = []
        }
        inMemoryDB[data.workspaceId].push(newItem)
        return newItem
      }),
      updateMany: vi.fn().mockImplementation(async ({ where, data }: { where: { id: string; workspaceId: string }; data: any }) => {
        const list = inMemoryDB[where.workspaceId] || []
        const idx = list.findIndex((item) => item.id === where.id)
        if (idx === -1) return { count: 0 }
        list[idx] = { ...list[idx], ...data, updatedAt: new Date() }
        return { count: 1 }
      }),
      deleteMany: vi.fn().mockImplementation(async ({ where }: { where: { id: string; workspaceId: string } }) => {
        const list = inMemoryDB[where.workspaceId] || []
        const initialLength = list.length
        inMemoryDB[where.workspaceId] = list.filter((item) => item.id !== where.id)
        return { count: initialLength - inMemoryDB[where.workspaceId].length }
      }),
    },
  },
}))

describe("Thesis Review Deduplication & Distinguishing Metadata Regression Tests", () => {
  const wsId = "ws-dedup-test"

  beforeEach(() => {
    inMemoryDB[wsId] = []
  })

  it("normalizes calibrated defense questions for both response and persistence", () => {
    expect(normalizeDefenseQuestions([
      { question: "How were the results validated?" },
      "Which limitation has the largest impact?",
    ])).toEqual([
      "How were the results validated?",
      "Which limitation has the largest impact?",
    ])
  })

  it("ensures GET returns all distinguishing metadata fields to tell reviews apart", async () => {
    // Seed two reviews for the same student/thesis but with different roles, versions, and timestamps
    inMemoryDB[wsId] = [
      {
        id: "rev-opponent-1",
        workspaceId: wsId,
        studentName: "Bc. Maroš Bednár",
        thesisTitle: "Systém na správu grantov",
        thesisType: "master",
        reviewerRole: "opponent",
        reviewerName: "Ing. Richard Marko, PhD.",
        institution: "STU FIIT",
        department: "ÚPIAI",
        grade: "B",
        suggestedGrade: "B",
        finalGrade: null,
        recommendation: "Odporúčam na obhajobu.",
        reviewKind: "thesis",
        targetVenue: "Štátnicová komisia",
        reportingStandard: "none",
        status: "draft",
        confirmedAt: null,
        language: "sk",
        createdAt: new Date("2026-08-30T10:15:00Z"),
        updatedAt: new Date("2026-08-30T10:15:00Z"),
      },
      {
        id: "rev-supervisor-2",
        workspaceId: wsId,
        studentName: "Bc. Maroš Bednár",
        thesisTitle: "Systém na správu grantov",
        thesisType: "master",
        reviewerRole: "supervisor",
        reviewerName: "doc. Ing. Peter Novák, PhD.",
        institution: "STU FIIT",
        department: "ÚPIAI",
        grade: "A",
        suggestedGrade: "B",
        finalGrade: "A",
        recommendation: "Jednoznačne odporúčam na obhajobu s pochvalou.",
        reviewKind: "thesis",
        targetVenue: "Štátnicová komisia",
        reportingStandard: "none",
        status: "final",
        confirmedAt: new Date("2026-08-30T14:45:00Z"),
        language: "sk",
        createdAt: new Date("2026-08-30T14:30:00Z"),
        updatedAt: new Date("2026-08-30T14:45:00Z"),
      },
    ]

    const req = new NextRequest(`http://localhost:3333/api/workspaces/${wsId}/thesis-review`)
    const res = await getReviews(req, { params: Promise.resolve({ id: wsId }) })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.reviews).toHaveLength(2)

    // Check first review (Opponent draft)
    const rev1 = data.reviews.find((r: any) => r.id === "rev-opponent-1")
    expect(rev1).toBeDefined()
    expect(rev1.reviewerRole).toBe("opponent")
    expect(rev1.status).toBe("draft")
    expect(rev1.reviewKind).toBe("thesis")
    expect(rev1.createdAt).toBeDefined()
    expect(rev1.confirmedAt).toBeNull()

    // Check second review (Supervisor final with confirmed decision)
    const rev2 = data.reviews.find((r: any) => r.id === "rev-supervisor-2")
    expect(rev2).toBeDefined()
    expect(rev2.reviewerRole).toBe("supervisor")
    expect(rev2.status).toBe("final")
    expect(rev2.finalGrade).toBe("A")
    expect(rev2.confirmedAt).toBeTruthy()
    expect(rev2.createdAt).toBeDefined()

    // Verify timestamps and roles cleanly distinguish the two records
    expect(rev1.reviewerRole).not.toBe(rev2.reviewerRole)
    expect(rev1.createdAt).not.toBe(rev2.createdAt)
    expect(rev1.status).not.toBe(rev2.status)
  })

  it("updates existing review via PUT without creating a duplicate record", async () => {
    // Seed 1 initial review
    inMemoryDB[wsId] = [
      {
        id: "rev-orig-1",
        workspaceId: wsId,
        studentName: "Miroslav Štefánik",
        thesisTitle: "Robotické systémy",
        thesisType: "master",
        reviewerRole: "opponent",
        grade: "B",
        status: "draft",
        language: "sk",
        createdAt: new Date("2026-08-30T09:00:00Z"),
        updatedAt: new Date("2026-08-30T09:00:00Z"),
      },
    ]

    expect(inMemoryDB[wsId]).toHaveLength(1)

    // Send PUT update
    const putReq = new NextRequest(`http://localhost:3333/api/workspaces/${wsId}/thesis-review/rev-orig-1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grade: "A",
        finalGrade: "A",
        status: "final",
        confirmedAt: new Date().toISOString(),
      }),
    })

    const putRes = await updateReview(putReq, { params: Promise.resolve({ id: wsId, reviewId: "rev-orig-1" }) })
    expect(putRes.status).toBe(200)

    // Verify in-memory DB still contains exactly 1 record
    expect(inMemoryDB[wsId]).toHaveLength(1)
    expect(inMemoryDB[wsId][0].id).toBe("rev-orig-1")
    expect(inMemoryDB[wsId][0].finalGrade).toBe("A")
    expect(inMemoryDB[wsId][0].status).toBe("final")
  })
})
