import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentApiKey: {
      findUnique: vi.fn(),
      update: vi.fn().mockReturnValue(Promise.resolve({})),
    },
    workspace: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    card: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    asset: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    thesisReview: {
      findFirst: vi.fn(),
    },
    workspaceSnapshot: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    agentPendingChange: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    agentToolCallLog: {
      create: vi.fn().mockReturnValue(Promise.resolve({})),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { POST, OPTIONS } from "@/app/api/agent/mcp/route"
import { GET as getManifest } from "@/app/api/agent/manifest/route"
import { hashToken } from "@/lib/token-hash"
import { AGENT_TOOLS } from "@/lib/agent-tools/registry"

const mockPrisma = vi.mocked(prisma)

describe("MCP Endpoint /api/agent/mcp", () => {
  const rawKey = "pa_live_mcp_test_key_abc123"
  const hashed = hashToken(rawKey)

  const activeApiKey = {
    id: "key-1",
    tokenHash: hashed,
    userId: "user-1",
    scopes: ["*"],
    workspaceId: null,
    restrictCardIds: [],
    revokedAt: null,
    expiresAt: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockPrisma.agentApiKey.findUnique as any).mockResolvedValue(activeApiKey)
  })

  it("OPTIONS returns 200 with CORS headers", async () => {
    const res = await OPTIONS()
    expect(res.status).toBe(200)
    expect(res.headers.get("Allow")).toContain("POST")
  })

  it("POST returns 401 when unauthenticated", async () => {
    ;(mockPrisma.agentApiKey.findUnique as any).mockResolvedValue(null)
    const req = new NextRequest("https://example.com/api/agent/mcp", {
      method: "POST",
      headers: { Authorization: "Bearer pa_bad_key" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("tools/list returns all 22 registered tools matching wireName format", async () => {
    const req = new NextRequest("https://example.com/api/agent/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rawKey}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "msg-1",
        method: "tools/list",
        params: {},
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const text = await res.text()
    // SSE stream contains the data: JSON payload
    expect(text).toContain("data: ")
    const dataLine = text
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6)
    expect(dataLine).toBeTruthy()

    const parsed = JSON.parse(dataLine!)
    expect(parsed.result.tools).toHaveLength(AGENT_TOOLS.length)
    expect(parsed.result.tools.length).toBe(22)

    for (const tool of parsed.result.tools) {
      expect(tool.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/)
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeTruthy()
    }
  })

  it("tools/call executes read tool posterapp_workspaces_list and returns ok envelope", async () => {
    ;(mockPrisma.workspace.findMany as any).mockResolvedValueOnce([
      {
        id: "ws-1",
        name: "Test Workspace",
        authors: "Author A",
        venue: "Venue X",
        revision: 1,
        outputs: [{ id: "out-1", title: "Poster", isActive: true, _count: { cards: 3 } }],
        _count: { assets: 2, ingestFiles: 1, snapshots: 0 },
      },
    ])

    const req = new NextRequest("https://example.com/api/agent/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rawKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "msg-2",
        method: "tools/call",
        params: {
          name: "posterapp_workspaces_list",
          arguments: {},
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const text = await res.text()
    const dataLine = text
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6)
    const parsed = JSON.parse(dataLine!)

    expect(parsed.result.isError).toBe(false)
    const envelope = JSON.parse(parsed.result.content[0].text)
    expect(envelope.ok).toBe(true)
    expect(envelope.data).toHaveLength(1)
    expect(envelope.data[0].id).toBe("ws-1")
    expect(envelope.meta.tool).toBe("posterapp.workspaces.list")
  })

  it("tools/call executes write tool posterapp_cards_update by enqueueing AgentPendingChange", async () => {
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
      id: "ws-1",
      userId: "user-1",
      members: [],
    })
    ;(mockPrisma.card.findUnique as any).mockResolvedValueOnce({
      id: "card-1",
      title: "Old Title",
      content: "Old Content",
    })
    ;(mockPrisma.agentPendingChange.create as any).mockResolvedValueOnce({
      id: "change-123",
      workspaceId: "ws-1",
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    })

    const req = new NextRequest("https://example.com/api/agent/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rawKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "msg-3",
        method: "tools/call",
        params: {
          name: "posterapp_cards_update",
          arguments: {
            workspaceId: "ws-1",
            cardId: "card-1",
            title: "New Title Proposed by Agent",
            content: "Updated experimental claim content",
            rationale: "Aligning card with benchmark outputs",
          },
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const text = await res.text()
    const dataLine = text
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6)
    const parsed = JSON.parse(dataLine!)
    expect(parsed.result.isError).toBe(false)

    const envelope = JSON.parse(parsed.result.content[0].text)
    expect(envelope.ok).toBe(true)
    expect(envelope.data.status).toBe("pending")
    expect(envelope.data.changeId).toBe("change-123")

    // Verify AgentPendingChange was created in Prisma
    expect(mockPrisma.agentPendingChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws-1",
        toolName: "posterapp.cards.update",
        targetType: "card",
        targetId: "card-1",
        status: "pending",
      }),
    })
  })

  it("tools/call returns RATE_LIMITED error envelope when rate limit is exceeded", async () => {
    vi.spyOn(await import("@/lib/rate-limit"), "rateLimitAsync")
      .mockResolvedValueOnce({ allowed: true, retryAfterMs: 0 }) // transport level
      .mockResolvedValueOnce({ allowed: false, retryAfterMs: 5000 }) // tool execution level

    const req = new NextRequest("https://example.com/api/agent/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rawKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "msg-4",
        method: "tools/call",
        params: {
          name: "posterapp_workspaces_list",
          arguments: {},
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const text = await res.text()
    const dataLine = text
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6)
    const parsed = JSON.parse(dataLine!)

    expect(parsed.result.isError).toBe(true)
    const envelope = JSON.parse(parsed.result.content[0].text)
    expect(envelope.ok).toBe(false)
    expect(envelope.error.code).toBe("RATE_LIMITED")
    expect(envelope.error.retryable).toBe(true)
  })

  it("tools/call returns TOOL_NOT_FOUND error envelope when unknown tool is requested", async () => {
    const req = new NextRequest("https://example.com/api/agent/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rawKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "msg-5",
        method: "tools/call",
        params: {
          name: "posterapp_unknown_nonexistent_tool",
          arguments: {},
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const text = await res.text()
    const dataLine = text
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6)
    const parsed = JSON.parse(dataLine!)

    expect(parsed.result.isError).toBe(true)
    const envelope = JSON.parse(parsed.result.content[0].text)
    expect(envelope.ok).toBe(false)
    expect(envelope.error.code).toBe("TOOL_NOT_FOUND")
  })
})

describe("Derived Manifest /api/agent/manifest", () => {
  it("GET returns all tools derived from registry", async () => {
    const res = await getManifest()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.toolsCount).toBe(22)
    expect(json.tools).toHaveLength(22)
    expect(json.tools[0]).toHaveProperty("wireName")
    expect(json.tools[0]).toHaveProperty("inputSchema")
  })
})
