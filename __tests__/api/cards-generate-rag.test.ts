/**
 * RAG-powered card generation & layout height compliance (Objectives C & D).
 *
 * Route-level tests with the AI client and retrieval mocked:
 *  - the generation prompt embeds RAG evidence chunks (with chunk IDs) and the
 *    layout budget;
 *  - [ev:N] evidence markers are mapped to chunk IDs and stripped from bullets;
 *  - figure assets are suggested by text proximity to the retrieved chunks;
 *  - over-budget drafts trigger the automatic shrink pass and the response
 *    reports estimateHeight vs. the card's height budget with suggestions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireWorkspaceEditor: vi.fn(async () => ({ userId: "user_1", role: "owner" })),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 0 })),
  rateLimitAsync: vi.fn(async () => ({ allowed: true, retryAfterMs: 0 })),
}))

vi.mock("@/lib/ai/context", () => ({
  loadSourceContext: vi.fn(() => Promise.resolve("Fallback raw source prefix")),
}))

const RAG_CHUNKS = [
  {
    id: "chunk-a",
    heading: "Výsledky experimentov",
    kind: "prose",
    documentId: "doc-1",
    content: "Navrhovaný model dosiahol presnosť 94.2 % na testovacej množine a F1 skóre 0.91.",
  },
  {
    id: "chunk-b",
    heading: "3.2 Štatistická analýza",
    kind: "table",
    documentId: "doc-1",
    content: "| Model | Presnosť |\n|---|---|\n| Baseline | 0.81 |",
  },
]

vi.mock("@/lib/ai/card-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/card-context")>()
  return {
    ...actual,
    buildRagGroundedContext: vi.fn(async () => ({
      context: '--- Source excerpts retrieved for topic: "Výsledky" (2 passages) ---',
      fromRag: true,
      chunks: RAG_CHUNKS,
    })),
  }
})

const generateAIMock = vi.fn()
vi.mock("@/lib/ai/client", () => ({
  generateAIResponse: (...args: unknown[]) => generateAIMock(...(args as [string, Record<string, unknown>])),
}))

import { POST } from "@/app/api/workspaces/[id]/cards/[cardId]/generate/route"
import { buildRagGroundedContext } from "@/lib/ai/card-context"
import { NextRequest } from "next/server"

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/workspaces/ws-1/cards/card-1/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const makeParams = () => ({ params: Promise.resolve({ id: "ws-1", cardId: "card-1" }) })

describe("POST /cards/[cardId]/generate — RAG grounding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    generateAIMock.mockReset()
  })

  it("embeds RAG evidence + layout budget in the prompt and grounds bullets with citations", async () => {
    generateAIMock.mockResolvedValueOnce({
      title: "Výsledky",
      bullets: [
        "Navrhovaný model dosiahol presnosť 94.2 % [ev:1]",
        "Zlepšenie ovoľ baseline je štatisticky významné [ev:2]",
      ],
      assignedAssets: [{ slot: "figure1", assetId: "asset-fig-1" }],
    })

    const res = await POST(
      makeRequest({
        topic: "Výsledky",
        outputType: "poster",
        pattern: "bullets",
        templateId: "atlas",
        heightBudget: 600,
        characterLimit: 600,
        assets: [
          { id: "asset-fig-1", kind: "figure", caption: "Presnosť modelu na testovacej množine", filename: "fig1.png" },
        ],
      }),
      makeParams()
    )
    const json = await res.json()

    // Prompt contract: evidence chunk block with IDs + layout budget block.
    const prompt = generateAIMock.mock.calls[0][1].userPrompt as string
    expect(prompt).toContain("<RAG Evidence Chunks>")
    expect(prompt).toContain("chunkId=chunk-a")
    expect(prompt).toContain("chunkId=chunk-b")
    expect(prompt).toContain("EVIDENCE ANCHORING")
    expect(prompt).toContain("LAYOUT BUDGET")
    expect(prompt).toContain("600 height units")

    // Response contract: citation mapping with chunk IDs, markers stripped.
    expect(json.grounded).toBe(true)
    expect(json.ragChunkIds).toEqual(["chunk-a", "chunk-b"])
    expect(json.citations).toMatchObject([
      { bulletIndex: 0, chunkIds: ["chunk-a"], evidence: [{ chunkId: "chunk-a", anchor: "source-chunk-a" }] },
      { bulletIndex: 1, chunkIds: ["chunk-b"], evidence: [{ chunkId: "chunk-b", anchor: "source-chunk-b" }] },
    ])
    expect(json.bullets[0]).toBe("Navrhovaný model dosiahol presnosť 94.2 %")
    expect(json.bullets[1]).toBe("Zlepšenie ovoľ baseline je štatisticky významné")
    expect(JSON.stringify(json.bullets)).not.toContain("[ev:")

    // Text-proximity figure suggestion from the retrieved chunks.
    expect(Array.isArray(json.suggestedAssets)).toBe(true)
    expect(json.suggestedAssets[0]?.id).toBe("asset-fig-1")

    // Layout introspection: fits the 600u budget → no overflow.
    expect(json.layout.budget).toBe(600)
    expect(json.layout.overBudget).toBe(false)
    expect(json.overBudget).toBe(false)
  })

  it("routes evidence markers with unknown indices to no citation (no fabricated anchors)", async () => {
    generateAIMock.mockResolvedValueOnce({
      title: "T",
      bullets: ["Fakt o výsledkoch [ev:99]"],
      assignedAssets: [],
    })
    const res = await POST(makeRequest({ topic: "Výsledky", characterLimit: 300 }), makeParams())
    const json = await res.json()
    expect(json.citations).toEqual([])
    expect(json.bullets[0]).toBe("Fakt o výsledkoch")
  })

  it("degrades gracefully when retrieval is unavailable (fallback context, no citations)", async () => {
    ;(buildRagGroundedContext as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      context: "Fallback raw source prefix",
      fromRag: false,
      chunks: [],
    })
    generateAIMock.mockResolvedValueOnce({ title: "T", bullets: ["Niečo"], assignedAssets: [] })

    const res = await POST(makeRequest({ topic: "Výsledky", characterLimit: 300 }), makeParams())
    const json = await res.json()

    expect(json.grounded).toBe(false)
    expect(json.ragChunkIds).toEqual([])
    expect(json.citations).toEqual([])
    expect(json.suggestedAssets).toEqual([])
    // No evidence block in the prompt when retrieval produced nothing.
    const prompt = generateAIMock.mock.calls[0][1].userPrompt as string
    expect(prompt).not.toContain("<RAG Evidence Chunks>")
  })
})

describe("POST /cards/[cardId]/generate — layout height compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    generateAIMock.mockReset()
  })

  const OVER_BUDGET_BULLETS = Array.from({ length: 6 }, (_, i) =>
    `Bod číslo ${i}: ${"veľmi podrobný obsah s mnohými slovami a číslami 12.3 % ".repeat(3)}`
  )

  it("runs the shrink pass until the draft fits the height budget", async () => {
    // Draft 1: 6 long bullets → estimateHeight ≫ 150u.
    generateAIMock.mockResolvedValueOnce({ title: "Metodika", bullets: OVER_BUDGET_BULLETS, assignedAssets: [] })
    // Shrink: 2 short bullets → fits.
    generateAIMock.mockResolvedValueOnce({ title: "Metodika", bullets: ["Krátky bod s 94.2 % presnosťou.", "Druhý krátky bod."], assignedAssets: [] })

    const res = await POST(
      makeRequest({ topic: "Metodika", outputType: "poster", pattern: "bullets", heightBudget: 150, characterLimit: 800 }),
      makeParams()
    )
    const json = await res.json()

    expect(generateAIMock).toHaveBeenCalledTimes(2)
    expect(generateAIMock.mock.calls[1][0]).toBe("generate-card-shrink")
    // The shrink prompt states the effective character target.
    expect(generateAIMock.mock.calls[1][1].userPrompt).toContain("at most")

    expect(json.shrinkAttempted).toBe(true)
    expect(json.layout.budget).toBe(150)
    expect(json.layout.estimatedHeight).toBeLessThanOrEqual(150)
    expect(json.layout.overBudget).toBe(false)
    expect(json.overBudget).toBe(false)
  })

  it("reports layout overBudget + actionable suggestions when the shrink cannot fit", async () => {
    generateAIMock.mockResolvedValueOnce({ title: "Metodika", bullets: OVER_BUDGET_BULLETS, assignedAssets: [] })
    // Shrink makes it shorter but still over budget.
    generateAIMock.mockResolvedValueOnce({
      title: "Metodika",
      bullets: OVER_BUDGET_BULLETS.slice(0, 5),
      assignedAssets: [],
    })

    const res = await POST(
      makeRequest({ topic: "Metodika", outputType: "poster", pattern: "bullets", heightBudget: 150, characterLimit: 800 }),
      makeParams()
    )
    const json = await res.json()

    expect(json.shrinkAttempted).toBe(true)
    expect(json.layout.overBudget).toBe(true)
    expect(json.layout.estimatedHeight).toBeGreaterThan(150)
    expect(json.overBudget).toBe(true)
    expect(Array.isArray(json.layout.suggestions)).toBe(true)
    expect(json.layout.suggestions.length).toBeGreaterThan(0)
  })

  it("derives the budget from the template when no explicit heightBudget is sent", async () => {
    generateAIMock.mockResolvedValueOnce({ title: "T", bullets: ["x"], assignedAssets: [] })

    await POST(
      makeRequest({ topic: "Návrh", outputType: "poster", templateId: "betterposter", characterLimit: 300 }),
      makeParams()
    )
    const prompt = generateAIMock.mock.calls[0][1].userPrompt as string
    // betterposter column budget = 520 units (COLUMN_BUDGET_BY_TEMPLATE).
    expect(prompt).toContain("520 height units")
  })
})
