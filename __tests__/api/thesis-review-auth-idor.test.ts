import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceMember: {
      findUnique: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    thesisReview: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { GET as getReview, PUT as updateReview, DELETE as deleteReview } from "@/app/api/workspaces/[id]/thesis-review/[reviewId]/route"

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)

describe("Thesis Review Auth and IDOR Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("GET returns 401 for unauthenticated user", async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)

    const req = new NextRequest("http://localhost:3000/api/workspaces/ws_A/thesis-review/rev_1")
    const res = await getReview(req, { params: Promise.resolve({ id: "ws_A", reviewId: "rev_1" }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe("UNAUTHENTICATED")
  })

  it("GET returns 404 when requesting review ID from another workspace (Cross-Workspace IDOR Defense)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_attacker" } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue({
      id: "ws_A",
      userId: "user_attacker",
      members: [],
    })

    // Attacker queries ws_A for rev_B (which belongs to ws_B)
    ;(mockPrisma.thesisReview.findFirst as any).mockResolvedValue(null) // scoped lookup fails

    const req = new NextRequest("http://localhost:3000/api/workspaces/ws_A/thesis-review/rev_B")
    const res = await getReview(req, { params: Promise.resolve({ id: "ws_A", reviewId: "rev_B" }) })

    expect(res.status).toBe(404)
    expect(mockPrisma.thesisReview.findFirst).toHaveBeenCalledWith({
      where: { id: "rev_B", workspaceId: "ws_A" },
    })
  })

  it("PUT prevents modifying review in another workspace via IDOR", async () => {
    mockAuth.mockResolvedValue({ userId: "user_attacker" } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue({
      id: "ws_A",
      userId: "user_attacker",
      members: [],
    })

    ;(mockPrisma.thesisReview.updateMany as any).mockResolvedValue({ count: 0 }) // 0 rows updated

    const req = new NextRequest("http://localhost:3000/api/workspaces/ws_A/thesis-review/rev_B", {
      method: "PUT",
      body: JSON.stringify({ studentName: "Tampered Name" }),
    })
    const res = await updateReview(req, { params: Promise.resolve({ id: "ws_A", reviewId: "rev_B" }) })

    expect(res.status).toBe(404)
    expect(mockPrisma.thesisReview.updateMany).toHaveBeenCalledWith({
      where: { id: "rev_B", workspaceId: "ws_A" },
      data: expect.objectContaining({ studentName: "Tampered Name" }),
    })
  })

  it("DELETE prevents deleting review from another workspace", async () => {
    mockAuth.mockResolvedValue({ userId: "user_attacker" } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue({
      id: "ws_A",
      userId: "user_attacker",
      members: [],
    })

    ;(mockPrisma.thesisReview.deleteMany as any).mockResolvedValue({ count: 0 })

    const req = new NextRequest("http://localhost:3000/api/workspaces/ws_A/thesis-review/rev_B", { method: "DELETE" })
    const res = await deleteReview(req, { params: Promise.resolve({ id: "ws_A", reviewId: "rev_B" }) })

    expect(res.status).toBe(404)
    expect(mockPrisma.thesisReview.deleteMany).toHaveBeenCalledWith({
      where: { id: "rev_B", workspaceId: "ws_A" },
    })
  })
})
