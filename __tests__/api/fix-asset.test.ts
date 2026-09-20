import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }))
vi.mock("@prisma/client", () => ({ Prisma: { DbNull: Symbol("DbNull") } }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: { findUnique: vi.fn(), update: vi.fn() },
    output: { update: vi.fn() },
    card: { findUnique: vi.fn(), update: vi.fn() },
    asset: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/rate-limit", () => ({ rateLimitAsync: vi.fn(async () => ({ allowed: true, retryAfterMs: 0 })) }))
vi.mock("fs/promises", () => ({
  readdir: vi.fn(),
  access: vi.fn(),
}))

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import * as fs from "fs/promises"
import { POST } from "@/app/api/workspaces/[id]/fix-asset/route"
import { NextRequest } from "next/server"

const mockAuth = vi.mocked(auth)
const p = vi.mocked(prisma)
const mockFs = vi.mocked(fs)
const params = Promise.resolve({ id: "ws_test_123" })

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/workspaces/ws_test_123/fix-asset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/workspaces/[id]/fix-asset", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockAuth as any).mockResolvedValue({ userId: "user_test" })
    ;(p.workspace.findUnique as any).mockResolvedValue({
      id: "ws_test_123",
      userId: "user_test",
      revision: 1,
      members: [],
      outputs: [
        {
          id: "out_1",
          isActive: true,
          cards: [
            {
              id: "card_arch",
              title: "Model Architecture",
              figures: [
                {
                  id: "fig_1",
                  url: "/api/workspaces/ws_test_123/assets/fig_arch_paper.png",
                  caption: "Figure 1: The Transformer model architecture.",
                },
              ],
            },
          ],
        },
      ],
    })
    ;(p.card.findUnique as any).mockResolvedValue({
      id: "card_arch",
      figures: [
        {
          id: "fig_1",
          url: "/api/workspaces/ws_test_123/assets/fig_arch_paper.png",
          caption: "Figure 1: The Transformer model architecture.",
        },
      ],
    })
    ;(p.asset.findMany as any).mockResolvedValue([])
    ;(p.card.update as any).mockResolvedValue({})
    ;(p.workspace.update as any).mockResolvedValue({})
  })

  it("reconnects a broken figure to a matching asset in the workspace", async () => {
    ;(mockFs.readdir as any).mockResolvedValue(["fig_transformer_arch.png", "benchmark_table.png"])

    const res = await POST(
      makeReq({
        type: "figure",
        cardId: "card_arch",
        figureIndex: 0,
        currentUrl: "/api/workspaces/ws_test_123/assets/fig_arch_paper.png",
        caption: "Figure 1: The Transformer model architecture.",
      }),
      { params }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.fixedUrl).toBe("/api/workspaces/ws_test_123/assets/fig_transformer_arch.png")
    expect(p.card.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "card_arch" },
        data: expect.objectContaining({
          figures: expect.arrayContaining([
            expect.objectContaining({
              url: "/api/workspaces/ws_test_123/assets/fig_transformer_arch.png",
            }),
          ]),
        }),
      })
    )
  })

  it("returns 404 when no image files exist in workspace assets", async () => {
    ;(mockFs.readdir as any).mockResolvedValue([])

    const res = await POST(
      makeReq({
        type: "figure",
        cardId: "card_arch",
        figureIndex: 0,
      }),
      { params }
    )

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.ok).toBe(false)
  })

  it("fixes a missing logo by matching available logos", async () => {
    ;(mockFs.readdir as any).mockImplementation(async (dir: string) => {
      if (dir.includes("logos")) return ["uk_logo.png", "cern_logo.png"]
      return []
    })

    const res = await POST(
      makeReq({
        type: "logo",
      }),
      { params }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.fixedUrl).toContain("logo")
    expect(p.output.update).toHaveBeenCalled()
  })
})

