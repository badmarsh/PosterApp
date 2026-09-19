import { describe, it, expect, vi, beforeEach } from "vitest"
import { DELETE } from "@/app/api/workspaces/[id]/ingest-files/[fileId]/route"
import { prisma } from "@/lib/prisma"
import { requireWorkspaceEditor } from "@/lib/auth"
import fs from "fs"

vi.mock("@/lib/auth", () => ({
  requireWorkspaceEditor: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ingestFile: {
      deleteMany: vi.fn(),
    },
    documentChunk: {
      deleteMany: vi.fn(),
    },
    graphNode: {
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
  existsSync: vi.fn(),
  unlinkSync: vi.fn(),
}))

describe("DELETE /api/workspaces/[id]/ingest-files/[fileId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireWorkspaceEditor).mockResolvedValue({ userId: "user-1" } as any)
  })

  it("deletes IngestFile, DocumentChunks, GraphNodes and removes source markdown file on disk", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)

    const req = new Request("http://localhost/api/workspaces/ws-1/ingest-files/file-123", {
      method: "DELETE",
    })

    const response = await DELETE(req, {
      params: Promise.resolve({ id: "ws-1", fileId: "file-123" }),
    })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({ ok: true })

    // 1. Prisma IngestFile deleted
    expect(prisma.ingestFile.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "file-123",
        workspaceId: "ws-1",
      },
    })

    // 2. Cascade chunks & graph nodes deleted
    expect(prisma.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-1",
        documentId: "file-123",
      },
    })

    expect(prisma.graphNode.deleteMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-1",
        documentId: "file-123",
      },
    })

    // 3. Unlink source markdown file on disk
    expect(fs.unlinkSync).toHaveBeenCalledWith(
      expect.stringMatching(/[\\/]sources[\\/]file-123\.md$/)
    )
  })

  it("succeeds gracefully even if the file on disk does not exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const req = new Request("http://localhost/api/workspaces/ws-1/ingest-files/file-999", {
      method: "DELETE",
    })

    const response = await DELETE(req, {
      params: Promise.resolve({ id: "ws-1", fileId: "file-999" }),
    })

    expect(response.status).toBe(200)
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })
})
