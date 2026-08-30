import { describe, it, expect, vi, beforeEach } from "vitest"
import { rerankChunks } from "@/lib/ai/vector-rag"

// ---------------------------------------------------------------------------
// rerankChunks — pure heuristic scoring (no DB, no embeddings)
// ---------------------------------------------------------------------------

const makeChunk = (
  id: string,
  content: string,
  heading: string | null = null,
  similarity = 0.5
) => ({ id, content, heading, similarity })

describe("rerankChunks — keyword boosting", () => {
  it("boosts chunks that contain query terms in content", async () => {
    const chunks = [
      makeChunk("c1", "Táto práca skúma detekciu anomálií pomocou transformerov.", null, 0.5),
      makeChunk("c2", "Úvod do základných pojmov strojového učenia.", null, 0.5),
    ]
    const reranked = await rerankChunks("detekcia anomálií transformery", chunks)
    const c1 = reranked.find((c) => c.id === "c1")!
    const c2 = reranked.find((c) => c.id === "c2")!
    // c1 has keyword matches → should rank higher
    expect(c1.relevanceScore).toBeGreaterThan(c2.relevanceScore)
  })

  it("gives extra boost when query term appears in heading", async () => {
    const chunks = [
      makeChunk("withHeading", "Generic content about the topic.", "Metodika a experimentálny návrh", 0.5),
      makeChunk("noHeading", "Metodika content here without heading boost.", null, 0.5),
    ]
    const reranked = await rerankChunks("metodika", chunks)
    const headed = reranked.find((c) => c.id === "withHeading")!
    const unheaded = reranked.find((c) => c.id === "noHeading")!
    // Heading boost (0.15) > content-only boost (0.05)
    expect(headed.relevanceScore).toBeGreaterThan(unheaded.relevanceScore)
  })

  it("ignores short query tokens (length ≤ 3)", async () => {
    const chunks = [
      makeChunk("c1", "The quick brown fox.", null, 0.5),
      makeChunk("c2", "Lazy dog runs.", null, 0.5),
    ]
    // "the", "of", "in" are all ≤ 3 chars → no boost applied
    const reranked = await rerankChunks("the of in", chunks)
    const c1 = reranked.find((c) => c.id === "c1")!
    const c2 = reranked.find((c) => c.id === "c2")!
    // Without any boosts, scores should be equal (base similarity)
    expect(c1.relevanceScore).toBeCloseTo(c2.relevanceScore, 5)
  })
})

describe("rerankChunks — length penalty", () => {
  it("applies penalty to very short chunks (< 100 chars)", async () => {
    const shortChunk = makeChunk("short", "Too short.", null, 0.6)
    const normalChunk = makeChunk("normal", "A".repeat(500), null, 0.6)
    const reranked = await rerankChunks("query text here test", [shortChunk, normalChunk])
    const s = reranked.find((c) => c.id === "short")!
    const n = reranked.find((c) => c.id === "normal")!
    expect(s.relevanceScore).toBeLessThan(n.relevanceScore)
  })

  it("applies slight penalty to very long chunks (> 4000 chars)", async () => {
    const longChunk = makeChunk("long", "X".repeat(4500), null, 0.6)
    const normalChunk = makeChunk("normal", "X".repeat(800), null, 0.6)
    const reranked = await rerankChunks("some query terms here test", [longChunk, normalChunk])
    const l = reranked.find((c) => c.id === "long")!
    const n = reranked.find((c) => c.id === "normal")!
    expect(l.relevanceScore).toBeLessThan(n.relevanceScore)
  })

  it("does not penalise medium-length chunks (100-4000 chars)", async () => {
    const chunk = makeChunk("medium", "A".repeat(1500), null, 0.7)
    const reranked = await rerankChunks("unique query", [chunk])
    expect(reranked[0].relevanceScore).toBeCloseTo(0.7, 5)
  })
})

describe("rerankChunks — output ordering and truncation", () => {
  it("returns at most 10 results", async () => {
    const chunks = Array.from({ length: 20 }, (_, i) =>
      makeChunk(`c${i}`, `Content about topic number ${i} and more words`, null, Math.random())
    )
    const reranked = await rerankChunks("topic content words", chunks)
    expect(reranked.length).toBeLessThanOrEqual(10)
  })

  it("returns results sorted by relevanceScore descending", async () => {
    const chunks = [
      makeChunk("low", "Irrelevant content.", null, 0.1),
      makeChunk("mid", "Somewhat related content here.", null, 0.5),
      makeChunk("high", "Very relevant content about the query topic.", null, 0.9),
    ]
    const reranked = await rerankChunks("relevant topic query", chunks)
    for (let i = 0; i < reranked.length - 1; i++) {
      expect(reranked[i].relevanceScore).toBeGreaterThanOrEqual(reranked[i + 1].relevanceScore)
    }
  })

  it("adds relevanceScore field to each result", async () => {
    const chunks = [makeChunk("c1", "Some content about research methodology.", null, 0.5)]
    const reranked = await rerankChunks("research methodology", chunks)
    expect(reranked[0]).toHaveProperty("relevanceScore")
    expect(typeof reranked[0].relevanceScore).toBe("number")
  })
})

describe("rerankChunks — null heading handling", () => {
  it("handles null headings without crashing", async () => {
    const chunks = [
      makeChunk("c1", "Content without any heading assigned.", null, 0.5),
    ]
    await expect(rerankChunks("heading content query", chunks)).resolves.toBeDefined()
  })

  it("handles empty heading string without crashing", async () => {
    const chunks = [
      { id: "c1", content: "Content with empty heading.", heading: "", similarity: 0.5 },
    ]
    await expect(rerankChunks("content query", chunks)).resolves.toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// searchHybrid — integration with mocked Prisma + local embeddings
// ---------------------------------------------------------------------------

describe("searchHybrid — mocked DB integration", () => {
  const MOCK_CHUNKS = [
    {
      id: "chunk-1",
      heading: "Metodika a experimentálny návrh",
      content: "Navrhujeme vlastnú architektúru ResNet-Transformer. Používame PyTorch.",
      tokens: 18,
      similarity: 0.92,
    },
    {
      id: "chunk-2",
      heading: "Výsledky experimentov",
      content: "Model dosiahol F1-skóre 92.4% na testovacej množine.",
      tokens: 12,
      similarity: 0.87,
    },
    {
      id: "chunk-3",
      heading: "Záver a prínosy",
      content: "Práca úspešne splnila všetky ciele výskumu.",
      tokens: 9,
      similarity: 0.71,
    },
  ]

  beforeEach(() => {
    vi.resetModules()
  })

  it("returns chunks with id, heading, content, tokens, similarity fields", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        $queryRaw: vi.fn().mockResolvedValue(MOCK_CHUNKS),
      },
    }))
    vi.doMock("@/lib/ai/local-embeddings", () => ({
      generateLocalEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
    }))

    const { searchHybrid } = await import("@/lib/ai/vector-rag")
    const results = await searchHybrid("ws-1", "experimentálna metodika", 10)

    expect(results).toHaveLength(3)
    expect(results[0]).toHaveProperty("id")
    expect(results[0]).toHaveProperty("heading")
    expect(results[0]).toHaveProperty("content")
    expect(results[0]).toHaveProperty("similarity")
  })

  it("prepends domain context to embedding query", async () => {
    const mockEmbed = vi.fn().mockResolvedValue(new Array(384).fill(0.0))
    vi.doMock("@/lib/ai/local-embeddings", () => ({
      generateLocalEmbedding: mockEmbed,
    }))
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        $queryRaw: vi.fn().mockResolvedValue([]),
      },
    }))

    const { searchHybrid } = await import("@/lib/ai/vector-rag")
    await searchHybrid("ws-1", "machine learning anomaly detection", 5, "Physics, STEM")

    expect(mockEmbed).toHaveBeenCalledWith(
      expect.stringContaining("Physics, STEM: machine learning anomaly detection")
    )
  })

  it("uses default domain context STEM, Fyzika when not specified", async () => {
    const mockEmbed = vi.fn().mockResolvedValue(new Array(384).fill(0.0))
    vi.doMock("@/lib/ai/local-embeddings", () => ({
      generateLocalEmbedding: mockEmbed,
    }))
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        $queryRaw: vi.fn().mockResolvedValue([]),
      },
    }))

    const { searchHybrid } = await import("@/lib/ai/vector-rag")
    await searchHybrid("ws-1", "magnetické pole")

    expect(mockEmbed).toHaveBeenCalledWith(
      expect.stringContaining("STEM, Fyzika: magnetické pole")
    )
  })

  it("returns empty array when workspace has no indexed chunks", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        $queryRaw: vi.fn().mockResolvedValue([]),
      },
    }))
    vi.doMock("@/lib/ai/local-embeddings", () => ({
      generateLocalEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.0)),
    }))

    const { searchHybrid } = await import("@/lib/ai/vector-rag")
    const results = await searchHybrid("ws-empty", "test query")
    expect(results).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Full pipeline: searchHybrid → rerankChunks
// ---------------------------------------------------------------------------

describe("Full pipeline: searchHybrid → rerankChunks", () => {
  it("end-to-end: top reranked result is the most relevant chunk", async () => {
    vi.resetModules()
    const physicsChunks = [
      {
        id: "phys-1",
        heading: "Kvantitatívna analýza magnetického poľa",
        content: "Magnetické pole bolo merané pomocou Hallových sond pri teplotách 4-300 K.",
        tokens: 18,
        similarity: 0.91,
      },
      {
        id: "phys-2",
        heading: "Úvod",
        content: "Táto práca sa zaoberá supravodivosťou pri nízkych teplotách.",
        tokens: 12,
        similarity: 0.65,
      },
      {
        id: "phys-3",
        heading: "Záver",
        content: "Práca úspešne splnila ciele a prínosy sú zrejmé.",
        tokens: 10,
        similarity: 0.42,
      },
    ]

    vi.doMock("@/lib/prisma", () => ({
      prisma: { $queryRaw: vi.fn().mockResolvedValue(physicsChunks) },
    }))
    vi.doMock("@/lib/ai/local-embeddings", () => ({
      generateLocalEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
    }))

    const { searchHybrid, rerankChunks: rerank } = await import("@/lib/ai/vector-rag")
    const raw = await searchHybrid("ws-phys", "magnetické pole Hallové sondy", 10)
    const reranked = await rerank("magnetické pole Hallové sondy", raw)

    // phys-1 has both highest similarity AND keyword matches in heading → should be first
    expect(reranked[0].id).toBe("phys-1")
  })
})

describe("resolveThesisDomainContext", () => {
  it("resolves computer science domain for IT/software keywords", async () => {
    const { resolveThesisDomainContext } = await import("@/lib/ai/vector-rag")
    const ctx = resolveThesisDomainContext({
      department: "FIIT - Ústav aplikovanej informatiky",
      thesisTitle: "Systém na strojové učenie a neurónové siete",
    })
    expect(ctx).toContain("Informatika")
    expect(ctx).toContain("AI")
  })

  it("resolves physics domain for physics keywords", async () => {
    const { resolveThesisDomainContext } = await import("@/lib/ai/vector-rag")
    const ctx = resolveThesisDomainContext({
      department: "Katedra experimentálnej fyziky",
      thesisTitle: "Kvantová optika a fotonika",
    })
    expect(ctx).toContain("Fyzika")
  })

  it("resolves engineering domain for mechanical/electrical keywords", async () => {
    const { resolveThesisDomainContext } = await import("@/lib/ai/vector-rag")
    const ctx = resolveThesisDomainContext({
      department: "Strojnícka fakulta",
      thesisTitle: "Návrh mechatronického pohonu",
    })
    expect(ctx).toContain("Inžinierstvo")
  })

  it("returns fallback domain for undefined metadata", async () => {
    const { resolveThesisDomainContext } = await import("@/lib/ai/vector-rag")
    expect(resolveThesisDomainContext(undefined)).toBe("STEM, Fyzika")
  })
})

describe("getThesisCriterionQueryExpansion", () => {
  it("provides rich query expansions for methodology", async () => {
    const { getThesisCriterionQueryExpansion } = await import("@/lib/ai/vector-rag")
    const exp = getThesisCriterionQueryExpansion("methodology", "sk")
    expect(exp).toContain("metodika")
    expect(exp).toContain("experimentálne")
    expect(exp).toContain("implementácia")
  })

  it("provides rich query expansions for literature", async () => {
    const { getThesisCriterionQueryExpansion } = await import("@/lib/ai/vector-rag")
    const exp = getThesisCriterionQueryExpansion("literature", "sk")
    expect(exp).toContain("literatúry")
    expect(exp).toContain("rešerš")
  })
})
