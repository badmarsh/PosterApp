import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    card: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import {
  isAllowedAgentIngestionUrl,
  isSafeAgentAssetFilename,
  resolveAgentRagDocumentIds,
} from "@/lib/agent-restrictions"

describe("agent restriction boundaries", () => {
  beforeEach(() => vi.clearAllMocks())

  it("does not query or restrict documents for an unrestricted key", async () => {
    await expect(resolveAgentRagDocumentIds("ws-1", [])).resolves.toBeNull()
    expect(mockPrisma.card.findMany).not.toHaveBeenCalled()
  })

  it("maps only in-workspace restricted cards to their source document IDs", async () => {
    mockPrisma.card.findMany.mockResolvedValue([
      { sourceIds: ["doc-a", "doc-b"] },
      { sourceIds: ["doc-b", "doc-c"] },
    ])

    await expect(resolveAgentRagDocumentIds("ws-1", ["card-a", "card-b"])).resolves.toEqual([
      "doc-a",
      "doc-b",
      "doc-c",
    ])
    expect(mockPrisma.card.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["card-a", "card-b"] },
        output: { workspaceId: "ws-1" },
      },
      select: { sourceIds: true },
    })
  })

  it("returns an empty source set instead of authorizing all RAG documents", async () => {
    mockPrisma.card.findMany.mockResolvedValue([{ sourceIds: null }])
    await expect(resolveAgentRagDocumentIds("ws-1", ["card-without-sources"])).resolves.toEqual([])
  })

  it("rejects path traversal and accepts a single safe filename component", () => {
    expect(isSafeAgentAssetFilename("figure-1.png")).toBe(true)
    expect(isSafeAgentAssetFilename("../outside.txt")).toBe(false)
    expect(isSafeAgentAssetFilename("nested/figure.png")).toBe(false)
    expect(isSafeAgentAssetFilename("nested\\figure.png")).toBe(false)
  })

  it("uses exact or subdomain academic host matching for ingestion", () => {
    expect(isAllowedAgentIngestionUrl("https://arxiv.org/abs/1234.5678")).toBe(true)
    expect(isAllowedAgentIngestionUrl("https://export.arxiv.org/api/query")).toBe(true)
    expect(isAllowedAgentIngestionUrl("https://evil-arxiv.org/paper")).toBe(false)
    expect(isAllowedAgentIngestionUrl("https://paper.edu.example/paper")).toBe(false)
    expect(isAllowedAgentIngestionUrl("http://arxiv.org/abs/1234.5678")).toBe(false)
  })
})
