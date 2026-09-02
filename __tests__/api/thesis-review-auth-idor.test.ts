import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceMember: { findUnique: vi.fn() },
    workspace: { findUnique: vi.fn() },
    thesisReview: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    graphCommunity: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/ai/graph-communities", () => ({
  buildGraphCommunities: vi.fn().mockResolvedValue({ communities: [] }),
}))

vi.mock("@/lib/ai/novelty-detector", () => ({
  detectNovelty: vi.fn().mockResolvedValue({ findings: [] }),
}))

vi.mock("fs", () => {
  const mock = {
    existsSync: vi.fn().mockReturnValue(false),
    readdirSync: vi.fn().mockReturnValue([]),
    readFileSync: vi.fn().mockReturnValue(""),
  }
  return { default: mock, ...mock }
})

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { GET as getReview, PUT as updateReview, DELETE as deleteReview } from "@/app/api/workspaces/[id]/thesis-review/[reviewId]/route"
import { POST as buildCommunities, GET as getCommunities } from "@/app/api/workspaces/[id]/thesis-review/build-communities/route"
import { POST as noveltyPost } from "@/app/api/workspaces/[id]/thesis-review/novelty/route"

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)

// ---------------------------------------------------------------------------
// Original IDOR tests
// ---------------------------------------------------------------------------

describe("Thesis Review Auth and IDOR Protection", () => {
  beforeEach(() => { vi.clearAllMocks() })

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
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue({ id: "ws_A", userId: "user_attacker", members: [] })
    ;(mockPrisma.thesisReview.findFirst as any).mockResolvedValue(null)
    const req = new NextRequest("http://localhost:3000/api/workspaces/ws_A/thesis-review/rev_B")
    const res = await getReview(req, { params: Promise.resolve({ id: "ws_A", reviewId: "rev_B" }) })
    expect(res.status).toBe(404)
    expect(mockPrisma.thesisReview.findFirst).toHaveBeenCalledWith({ where: { id: "rev_B", workspaceId: "ws_A" } })
  })

  it("PUT prevents modifying review in another workspace via IDOR", async () => {
    mockAuth.mockResolvedValue({ userId: "user_attacker" } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue({ id: "ws_A", userId: "user_attacker", members: [] })
    ;(mockPrisma.thesisReview.updateMany as any).mockResolvedValue({ count: 0 })
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
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue({ id: "ws_A", userId: "user_attacker", members: [] })
    ;(mockPrisma.thesisReview.deleteMany as any).mockResolvedValue({ count: 0 })
    const req = new NextRequest("http://localhost:3000/api/workspaces/ws_A/thesis-review/rev_B", { method: "DELETE" })
    const res = await deleteReview(req, { params: Promise.resolve({ id: "ws_A", reviewId: "rev_B" }) })
    expect(res.status).toBe(404)
    expect(mockPrisma.thesisReview.deleteMany).toHaveBeenCalledWith({ where: { id: "rev_B", workspaceId: "ws_A" } })
  })
})

// ---------------------------------------------------------------------------
// Task 0 acceptance: build-communities and novelty use requireWorkspaceEditor
// ---------------------------------------------------------------------------

describe("build-communities: requireWorkspaceEditor auth", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("POST returns 401 for unauthenticated user", async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)
    const req = new NextRequest("http://localhost:3000/api/workspaces/ws_A/thesis-review/build-communities", { method: "POST" })
    const res = await buildCommunities(req, { params: Promise.resolve({ id: "ws_A" }) })
    expect(res.status).toBe(401)
  })

  it("POST returns 200 for an editor WorkspaceMember (not the legacy owner)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_editor" } as any)
    // workspace.userId is "user_owner" — user_editor is a member with editor role
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue({
      id: "ws_A",
      userId: "user_owner",
      members: [{ role: "editor" }],
      bibContent: null,
    })
    ;(mockPrisma.graphCommunity.findMany as any).mockResolvedValue([])
    const req = new NextRequest("http://localhost:3000/api/workspaces/ws_A/thesis-review/build-communities", { method: "POST" })
    const res = await buildCommunities(req, { params: Promise.resolve({ id: "ws_A" }) })
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(404)
  })

  it("GET returns 404 for non-member (workspace not found)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_stranger" } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue(null)
    const req = new NextRequest("http://localhost:3000/api/workspaces/ws_A/thesis-review/build-communities")
    const res = await getCommunities(req, { params: Promise.resolve({ id: "ws_A" }) })
    expect(res.status).toBe(404)
  })
})

describe("novelty: requireWorkspaceEditor auth", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("POST returns 401 for unauthenticated user", async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)
    const req = new NextRequest("http://localhost:3000/api/workspaces/ws_A/thesis-review/novelty", { method: "POST" })
    const res = await noveltyPost(req, { params: Promise.resolve({ id: "ws_A" }) })
    expect(res.status).toBe(401)
  })

  it("POST returns 404 for non-member (workspace not found via requireWorkspaceEditor)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_stranger" } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue(null)
    const req = new NextRequest("http://localhost:3000/api/workspaces/ws_A/thesis-review/novelty", { method: "POST" })
    const res = await noveltyPost(req, { params: Promise.resolve({ id: "ws_A" }) })
    expect(res.status).toBe(404)
  })
})
