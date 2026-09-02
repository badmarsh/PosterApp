import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth and prisma
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workspaceMember: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

// Mock mock-data so the route's dynamic import only creates one workspace
vi.mock("@/lib/mock-data", () => ({
  sampleProjects: [
    {
      id: "demo_user_b",
      name: "Sample Project",
      authors: "",
      venue: "",
      activeOutputId: "out_1",
      outputs: [
        {
          id: "out_1",
          outputType: "poster",
          templateId: "atlas",
          title: "Sample Project",
          themeColor: null,
          cards: [],
        },
      ],
    },
  ],
}))

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { GET as getWorkspaces } from "@/app/api/workspaces/route"
import { requireWorkspaceAccess, requireWorkspaceEditor, requireWorkspaceOwner } from "@/lib/auth"

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)

describe("Multi-tenant Workspace Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not grant User B ownership or membership to User A's workspaces when User B has 0 workspaces", async () => {
    // User B is authenticated and has no workspaces
    ;(mockAuth as any).mockResolvedValue({ userId: "user_B" })
    ;(mockPrisma.workspace.findMany as any).mockResolvedValueOnce([])
    ;(mockPrisma.workspace.create as any).mockResolvedValueOnce({
      id: "demo_user_b",
      name: "Sample Project",
      userId: "user_B",
      authors: "",
      venue: "",
      outputs: [
        {
          id: "out_1",
          outputType: "poster",
          templateId: "atlas",
          title: "Sample Project",
          isActive: true,
        },
      ],
    })

    const res = await getWorkspaces()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveLength(1)
    expect(json[0].id).toBe("demo_user_b")

    // Crucially: workspaceMember.upsert must NEVER have been called to attach user_B to existing workspaces
    expect(mockPrisma.workspaceMember.upsert).not.toHaveBeenCalled()
    expect(mockPrisma.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_B",
        }),
      })
    )
  })

  it("denies access when User B attempts to access User A's workspace directly", async () => {
    ;(mockAuth as any).mockResolvedValue({ userId: "user_B" })
    // Workspace belongs to User A, and User B is not in members
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
      id: "ws-user-a",
      userId: "user_A",
      members: [],
    })

    await expect(requireWorkspaceAccess("ws-user-a")).rejects.toSatisfy((res: Response) => {
      expect(res.status).toBe(404) // Safe 404 (IDOR protection prevents leaking existence)
      return true
    })
  })

  it("denies editor access to a viewer role", async () => {
    ;(mockAuth as any).mockResolvedValue({ userId: "user_B" })
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
      id: "ws-shared",
      userId: "user_A",
      members: [{ role: "viewer" }],
    })

    await expect(requireWorkspaceEditor("ws-shared")).rejects.toSatisfy((res: Response) => {
      expect(res.status).toBe(403)
      return true
    })
  })

  it("denies owner access to an editor role", async () => {
    ;(mockAuth as any).mockResolvedValue({ userId: "user_B" })
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
      id: "ws-shared",
      userId: "user_A",
      members: [{ role: "editor" }],
    })

    await expect(requireWorkspaceOwner("ws-shared")).rejects.toSatisfy((res: Response) => {
      expect(res.status).toBe(403)
      return true
    })
  })

  it("grants owner access when user is the workspace owner", async () => {
    ;(mockAuth as any).mockResolvedValue({ userId: "user_A" })
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
      id: "ws-user-a",
      userId: "user_A",
      members: [],
    })

    const access = await requireWorkspaceOwner("ws-user-a")
    expect(access.userId).toBe("user_A")
    expect(access.role).toBe("owner")
  })
})
