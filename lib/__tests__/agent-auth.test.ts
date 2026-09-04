import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentApiKey: {
      findUnique: vi.fn(),
      update: vi.fn().mockReturnValue(Promise.resolve({})),
    },
    workspace: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { hashToken } from "@/lib/token-hash"
import {
  verifyAgentKey,
  requireAgentWorkspaceAccess,
  requireScope,
  requireScopes,
  AgentAuthError,
  AgentContext,
} from "@/lib/agent-auth"

const mockPrisma = vi.mocked(prisma)

describe("lib/token-hash", () => {
  it("computes deterministic SHA-256 hex digest", () => {
    const raw = "pa_live_test_key_12345"
    const hash1 = hashToken(raw)
    const hash2 = hashToken(raw)
    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^[a-f0-9]{64}$/)
    expect(hashToken("a")).not.toBe(hashToken("b"))
  })
})

describe("lib/agent-auth - verifyAgentKey", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("throws 401 if no Authorization or X-API-Key header is provided", async () => {
    const req = new Request("https://example.com/api/agent/mcp")
    await expect(verifyAgentKey(req)).rejects.toThrow(AgentAuthError)
    await expect(verifyAgentKey(req)).rejects.toMatchObject({ status: 401 })
  })

  it("authenticates via Authorization: Bearer <key>", async () => {
    const rawKey = "pa_bearer_test_key"
    const expectedHash = hashToken(rawKey)

    ;(mockPrisma.agentApiKey.findUnique as any).mockResolvedValueOnce({
      id: "key-1",
      tokenHash: expectedHash,
      userId: "user-1",
      scopes: ["workspace:read"],
      workspaceId: "ws-1",
      restrictCardIds: ["c1", "c2"],
      expiresAt: null,
      revokedAt: null,
    })

    const req = new Request("https://example.com/api/agent/mcp", {
      headers: { Authorization: `Bearer ${rawKey}` },
    })

    const ctx = await verifyAgentKey(req)
    expect(ctx).toEqual({
      apiKeyId: "key-1",
      userId: "user-1",
      scopes: ["workspace:read"],
      workspaceId: "ws-1",
      restrictCardIds: ["c1", "c2"],
    })
    expect(mockPrisma.agentApiKey.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: expectedHash },
    })
  })

  it("authenticates via direct Authorization: <key> without Bearer prefix (§18.2)", async () => {
    const rawKey = "pa_direct_test_key"
    const expectedHash = hashToken(rawKey)

    ;(mockPrisma.agentApiKey.findUnique as any).mockResolvedValueOnce({
      id: "key-2",
      tokenHash: expectedHash,
      userId: "user-2",
      scopes: ["*"],
      workspaceId: null,
      restrictCardIds: [],
      expiresAt: null,
      revokedAt: null,
    })

    const req = new Request("https://example.com/api/agent/mcp", {
      headers: { Authorization: rawKey },
    })

    const ctx = await verifyAgentKey(req)
    expect(ctx.userId).toBe("user-2")
    expect(ctx.workspaceId).toBeNull()
  })

  it("authenticates via X-API-Key header (§18.2)", async () => {
    const rawKey = "pa_header_test_key"
    const expectedHash = hashToken(rawKey)

    ;(mockPrisma.agentApiKey.findUnique as any).mockResolvedValueOnce({
      id: "key-3",
      tokenHash: expectedHash,
      userId: "user-3",
      scopes: ["workspace:read", "changes:read"],
      workspaceId: "ws-xyz",
      restrictCardIds: [],
      expiresAt: null,
      revokedAt: null,
    })

    const req = new Request("https://example.com/api/agent/mcp", {
      headers: { "X-API-Key": rawKey },
    })

    const ctx = await verifyAgentKey(req)
    expect(ctx.userId).toBe("user-3")
    expect(ctx.workspaceId).toBe("ws-xyz")
  })

  it("rejects invalid key with 401", async () => {
    ;(mockPrisma.agentApiKey.findUnique as any).mockResolvedValueOnce(null)

    const req = new Request("https://example.com/api/agent/mcp", {
      headers: { Authorization: "Bearer pa_unknown" },
    })

    await expect(verifyAgentKey(req)).rejects.toMatchObject({
      status: 401,
      message: "Invalid API key",
    })
  })

  it("rejects revoked key with 403", async () => {
    const rawKey = "pa_revoked"
    ;(mockPrisma.agentApiKey.findUnique as any).mockResolvedValueOnce({
      id: "key-revoked",
      tokenHash: hashToken(rawKey),
      userId: "user-1",
      scopes: ["workspace:read"],
      revokedAt: new Date(),
    })

    const req = new Request("https://example.com/api/agent/mcp", {
      headers: { Authorization: `Bearer ${rawKey}` },
    })

    await expect(verifyAgentKey(req)).rejects.toMatchObject({
      status: 403,
      message: "API key revoked",
    })
  })

  it("rejects expired key with 403", async () => {
    const rawKey = "pa_expired"
    ;(mockPrisma.agentApiKey.findUnique as any).mockResolvedValueOnce({
      id: "key-expired",
      tokenHash: hashToken(rawKey),
      userId: "user-1",
      scopes: ["workspace:read"],
      revokedAt: null,
      expiresAt: new Date(Date.now() - 10_000),
    })

    const req = new Request("https://example.com/api/agent/mcp", {
      headers: { Authorization: `Bearer ${rawKey}` },
    })

    await expect(verifyAgentKey(req)).rejects.toMatchObject({
      status: 403,
      message: "API key expired",
    })
  })
})

describe("lib/agent-auth - requireAgentWorkspaceAccess scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseCtx: AgentContext = {
    apiKeyId: "key-scoped",
    userId: "user-owner",
    scopes: ["workspace:read", "workspace:write"],
    workspaceId: "ws-target",
    restrictCardIds: [],
  }

  it("allows access when key is scoped to target workspace and user is owner", async () => {
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
      id: "ws-target",
      userId: "user-owner",
      members: [],
    })

    const ws = await requireAgentWorkspaceAccess(baseCtx, "ws-target", true)
    expect(ws.id).toBe("ws-target")
  })

  it("FORBIDS access (403) when key is scoped to a different workspace", async () => {
    // Attempting to access ws-other with a key scoped to ws-target
    await expect(
      requireAgentWorkspaceAccess(baseCtx, "ws-other")
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("API key is restricted to workspace ws-target"),
    })

    // Should NOT query workspace table if key boundary check fails
    expect(mockPrisma.workspace.findUnique).not.toHaveBeenCalled()
  })

  it("allows access across any workspace when key is unscoped (workspaceId = null)", async () => {
    const unscopedCtx: AgentContext = {
      ...baseCtx,
      workspaceId: null,
    }

    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
      id: "ws-other",
      userId: "user-owner",
      members: [],
    })

    const ws = await requireAgentWorkspaceAccess(unscopedCtx, "ws-other")
    expect(ws.id).toBe("ws-other")
  })

  it("rejects access (403) when user is neither owner nor member of workspace", async () => {
    const unscopedCtx: AgentContext = {
      ...baseCtx,
      workspaceId: null,
      userId: "user-stranger",
    }

    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
      id: "ws-secret",
      userId: "user-different",
      members: [],
    })

    await expect(
      requireAgentWorkspaceAccess(unscopedCtx, "ws-secret")
    ).rejects.toMatchObject({
      status: 403,
      message: "Access denied to workspace",
    })
  })
})

describe("lib/agent-auth - scope checks", () => {
  const ctx: AgentContext = {
    apiKeyId: "key-1",
    userId: "user-1",
    scopes: ["workspace:read", "bibliography:read"],
    workspaceId: null,
    restrictCardIds: [],
  }

  it("passes when required scope is present", () => {
    expect(() => requireScope(ctx, "workspace:read")).not.toThrow()
  })

  it("throws 403 when required scope is missing", () => {
    expect(() => requireScope(ctx, "workspace:write")).toThrow(AgentAuthError)
  })

  it("supports wildcard * scope", () => {
    const wildcardCtx: AgentContext = { ...ctx, scopes: ["*"] }
    expect(() => requireScope(wildcardCtx, "workspace:write")).not.toThrow()
    expect(() => requireScopes(wildcardCtx, ["compile:run", "review:run"])).not.toThrow()
  })
})
