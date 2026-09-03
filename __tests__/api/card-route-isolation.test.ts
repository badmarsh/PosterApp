import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }))
vi.mock("@prisma/client", () => ({ Prisma: { DbNull: Symbol("DbNull") } }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: { findUnique: vi.fn(), update: vi.fn() },
    output: { findFirst: vi.fn() },
    card: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}))
vi.mock("@/lib/rate-limit", () => ({ rateLimitAsync: vi.fn(async () => ({ allowed: true, retryAfterMs: 0 })) }))

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { PUT, DELETE } from "@/app/api/workspaces/[id]/cards/[cardId]/route"

const mockAuth = vi.mocked(auth)
const p = vi.mocked(prisma)
const params = Promise.resolve({ id: "ws_A_00001", cardId: "card_new" })

const baseCard = { id: "card_new", order: 0, pattern: "bullets", outputId: "out_B" }

function putReq(body: unknown, revision?: number) {
  const url = `http://test/api/workspaces/ws_A_00001/cards/card_new${revision !== undefined ? `?revision=${revision}` : ""}`
  return new Request(url, { method: "PUT", body: JSON.stringify(body), headers: { "content-type": "application/json" } })
}

describe("card route: cross-workspace and revision guards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockAuth as any).mockResolvedValue({ userId: "user_A" })
    ;(p.workspace.findUnique as any).mockResolvedValue({ id: "ws_A_00001", userId: "user_A", revision: 7, members: [] })
    ;(p.workspace.update as any).mockResolvedValue({ revision: 8 })
    ;(p.card.findUnique as any).mockResolvedValue(null)
    ;(p.card.upsert as any).mockResolvedValue({})
    ;(p.card.delete as any).mockResolvedValue({})
  })

  it("rejects creating a card in an output that belongs to another workspace", async () => {
    ;(p.output.findFirst as any).mockResolvedValue(null) // out_B not in ws_A
    const res = await PUT(putReq(baseCard), { params })
    expect(res.status).toBe(404)
    expect(p.card.upsert).not.toHaveBeenCalled()
    expect(p.output.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "out_B", workspaceId: "ws_A_00001" } }))
  })

  it("creates a card when the output belongs to the workspace and bumps revision", async () => {
    ;(p.output.findFirst as any).mockResolvedValue({ id: "out_B" })
    const res = await PUT(putReq(baseCard), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, revision: 8 })
    expect(p.workspace.update).toHaveBeenCalledWith(expect.objectContaining({ data: { revision: { increment: 1 } } }))
  })

  it("returns 409 on stale revision", async () => {
    const res = await PUT(putReq(baseCard, 3), { params })
    expect(res.status).toBe(409)
    expect(p.card.upsert).not.toHaveBeenCalled()
  })

  it("does not reveal cards owned by another workspace on update", async () => {
    ;(p.card.findUnique as any).mockResolvedValue({ id: "card_new", outputId: "out_B", output: { workspaceId: "ws_B_00001" } })
    const res = await PUT(putReq(baseCard), { params })
    expect(res.status).toBe(404)
  })

  it("rejects invalid figure payloads (no z.any escape hatch)", async () => {
    ;(p.output.findFirst as any).mockResolvedValue({ id: "out_B" })
    const res = await PUT(putReq({ ...baseCard, figures: "not-an-array" }), { params })
    expect(res.status).toBe(400)
  })

  it("DELETE bumps revision and rejects foreign cards", async () => {
    ;(p.card.findUnique as any).mockResolvedValue({ id: "card_new", output: { workspaceId: "ws_B_00001" } })
    const res = await DELETE(new Request("http://test/x"), { params })
    expect(res.status).toBe(404)
    ;(p.card.findUnique as any).mockResolvedValue({ id: "card_new", output: { workspaceId: "ws_A_00001" } })
    const ok = await DELETE(new Request("http://test/x"), { params })
    expect(ok.status).toBe(200)
    expect(p.workspace.update).toHaveBeenCalled()
  })
})
