import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentApiKey: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
  },
}))

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { POST, GET } from "@/app/api/agent-keys/route"
import { DELETE } from "@/app/api/agent-keys/[id]/route"
import { hashToken } from "@/lib/token-hash"

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)

describe("API /api/agent-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: null })

    const req = new NextRequest("https://example.com/api/agent-keys", {
      method: "POST",
      body: JSON.stringify({ name: "Test", scopes: ["workspace:read"] }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("mints a new key starting with pa_, stores tokenHash (never raw key), and returns raw key once", async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: "user-123" })
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
      id: "ws-abc",
      userId: "user-123",
      members: [],
    })

    let capturedCreateData: any = null
    ;(mockPrisma.agentApiKey.create as any).mockImplementationOnce(async ({ data }: any) => {
      capturedCreateData = data
      return {
        id: "key-cuid-1",
        ...data,
        createdAt: new Date(),
      }
    })

    const req = new NextRequest("https://example.com/api/agent-keys", {
      method: "POST",
      body: JSON.stringify({
        name: "DeerFlow Agent",
        scopes: ["workspace:read", "bibliography:read"],
        workspaceId: "ws-abc",
        expiresInDays: 30,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)

    const json = await res.json()
    expect(json.key).toMatch(/^pa_[A-Za-z0-9_-]{40,}$/)
    expect(json.name).toBe("DeerFlow Agent")
    expect(json.workspaceId).toBe("ws-abc")

    // Database verification: capturedCreateData MUST NOT contain json.key
    expect(capturedCreateData).not.toHaveProperty("key")
    expect(capturedCreateData.tokenHash).toBe(hashToken(json.key))
    expect(capturedCreateData.userId).toBe("user-123")
    expect(capturedCreateData.workspaceId).toBe("ws-abc")
  })

  it("enforces rate limit: 6th request within 1 hour returns 429", async () => {
    ;(mockAuth as any).mockResolvedValue({ userId: "spammer-user" })

    const req = new NextRequest("https://example.com/api/agent-keys", {
      method: "POST",
      body: JSON.stringify({ name: "Rate Limit Test", scopes: ["workspace:read"] }),
    })

    // Mock rateLimitAsync returning allowed: false
    vi.spyOn(await import("@/lib/rate-limit"), "rateLimitAsync").mockResolvedValueOnce({
      allowed: false,
      retryAfterMs: 3600000,
    })

    const res = await POST(req)
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBeTruthy()

    const json = await res.json()
    expect(json.error).toMatch(/Rate limit exceeded/)
  })

  it("returns 403 if target workspace does not belong to user", async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: "user-attacker" })
    vi.spyOn(await import("@/lib/rate-limit"), "rateLimitAsync").mockResolvedValueOnce({
      allowed: true,
      retryAfterMs: 0,
    })

    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
      id: "ws-victim",
      userId: "user-victim",
      members: [], // attacker is not a member
    })

    const req = new NextRequest("https://example.com/api/agent-keys", {
      method: "POST",
      body: JSON.stringify({
        name: "Intruder Key",
        scopes: ["workspace:read"],
        workspaceId: "ws-victim",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain("Access denied")
  })

  it("GET lists keys without exposing raw keys or tokenHash", async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: "user-123" })
    ;(mockPrisma.agentApiKey.findMany as any).mockResolvedValueOnce([
      {
        id: "key-1",
        name: "My Key",
        scopes: ["workspace:read"],
        workspaceId: "ws-1",
        workspace: { id: "ws-1", name: "Poster 1" },
        restrictCardIds: [],
        createdAt: new Date(),
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: null,
      },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].key).toBeUndefined()
    expect(json[0].tokenHash).toBeUndefined()
    expect(json[0].workspaceId).toBe("ws-1")
  })

  it("DELETE revokes an existing key", async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: "user-123" })
    ;(mockPrisma.agentApiKey.findFirst as any).mockResolvedValueOnce({
      id: "key-to-revoke",
      userId: "user-123",
    })
    ;(mockPrisma.agentApiKey.update as any).mockResolvedValueOnce({
      id: "key-to-revoke",
      revokedAt: new Date(),
    })

    const req = new NextRequest("https://example.com/api/agent-keys/key-to-revoke", {
      method: "DELETE",
    })

    const res = await DELETE(req, { params: Promise.resolve({ id: "key-to-revoke" }) })
    expect(res.status).toBe(200)
    expect(mockPrisma.agentApiKey.update).toHaveBeenCalledWith({
      where: { id: "key-to-revoke" },
      data: { revokedAt: expect.any(Date) },
    })
  })
})
