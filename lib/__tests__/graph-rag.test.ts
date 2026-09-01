import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  canonicalKey,
  canonicalEntityName,
  canonicalRelation,
  isPlaceholderEntity,
  scoreNodeMatch,
  linkQueryEntities,
  expandSubgraph,
  serializeGraphContext,
  retrieveGraphContext,
  type GraphNodeLite,
  type GraphEdgeLite,
} from "@/lib/ai/graph-rag"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ingestFile: { findMany: vi.fn() },
    graphNode: { findMany: vi.fn() },
    graphEdge: { findMany: vi.fn() },
  },
}))

import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as unknown as {
  ingestFile: { findMany: ReturnType<typeof vi.fn> }
  graphNode: { findMany: ReturnType<typeof vi.fn> }
  graphEdge: { findMany: ReturnType<typeof vi.fn> }
}

// ---------------------------------------------------------------------------
// Canonicalization
// ---------------------------------------------------------------------------

describe("canonicalKey", () => {
  it("folds case, diacritics and punctuation", () => {
    expect(canonicalKey("  YOLOv8 ")).toBe("yolov8")
    expect(canonicalKey("Metodológia!")).toBe("metodologia")
    expect(canonicalKey("Šťastný-život")).toBe("stastny zivot")
    expect(canonicalKey("COCO  dataset")).toBe("coco dataset")
  })

  it("collapses multiple separators into single spaces", () => {
    expect(canonicalKey("a---b___c  d")).toBe("a b c d")
  })
})

describe("canonicalEntityName", () => {
  it("trims, collapses whitespace and strips trailing punctuation", () => {
    expect(canonicalEntityName("  COCO   dataset.. ")).toBe("COCO dataset")
    expect(canonicalEntityName("YOLOv8;")).toBe("YOLOv8")
  })

  it("preserves inner casing of technical names", () => {
    expect(canonicalEntityName("mAP@0.5")).toBe("mAP@0.5")
  })
})

describe("isPlaceholderEntity", () => {
  it("rejects generic placeholders and label restatements", () => {
    expect(isPlaceholderEntity("Unnamed Entity", "Concept")).toBe(true)
    expect(isPlaceholderEntity("Unknown", "Dataset")).toBe(true)
    expect(isPlaceholderEntity("", "Metric")).toBe(true)
    expect(isPlaceholderEntity("Methodology", "Methodology")).toBe(true)
    expect(isPlaceholderEntity("methodology", "Methodology")).toBe(true)
  })

  it("accepts real entity names", () => {
    expect(isPlaceholderEntity("YOLOv8", "Methodology")).toBe(false)
    expect(isPlaceholderEntity("COCO dataset", "Dataset")).toBe(false)
  })
})

describe("canonicalRelation", () => {
  it("uppercases and underscores multi-word relations", () => {
    expect(canonicalRelation("evaluated on")).toBe("EVALUATED_ON")
    expect(canonicalRelation("Uses")).toBe("USES")
    expect(canonicalRelation("  ")).toBe("RELATED_TO")
  })
})

// ---------------------------------------------------------------------------
// Entity linking
// ---------------------------------------------------------------------------

const sampleNodes: GraphNodeLite[] = [
  { id: "n1", documentId: "doc1", label: "Methodology", name: "YOLOv8", description: "object detector" },
  { id: "n2", documentId: "doc1", label: "Dataset", name: "COCO dataset", description: null },
  { id: "n3", documentId: "doc2", label: "Metric", name: "mAP", description: "mean Average Precision" },
]

describe("scoreNodeMatch", () => {
  it("scores exact token hits in the node name", () => {
    expect(scoreNodeMatch("YOLOv8 methodology", sampleNodes[0])).toBeGreaterThanOrEqual(1)
  })

  it("scores verbatim multi-word containment strongest", () => {
    const direct = scoreNodeMatch("evaluation on COCO dataset", sampleNodes[1])
    expect(direct).toBeGreaterThanOrEqual(2.5) // token hit + containment bonus
  })

  it("adds preferred-document bonus for reviewed document", () => {
    const withBonus = scoreNodeMatch("YOLOv8", sampleNodes[0], "doc1")
    const withoutBonus = scoreNodeMatch("YOLOv8", sampleNodes[0], "doc2")
    expect(withBonus).toBeCloseTo(withoutBonus + 0.5, 5)
  })

  it("returns 0 for unrelated queries", () => {
    expect(scoreNodeMatch("quantum chromodynamics", sampleNodes[0])).toBe(0)
  })
})

describe("linkQueryEntities", () => {
  it("filters by minScore and sorts by score descending", async () => {
    const matches = await linkQueryEntities("YOLOv8 evaluation on COCO dataset", sampleNodes, {
      useEmbeddingFallback: false,
    })
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[matches.length - 1].score)
    const names = matches.map((m) => m.name)
    expect(names).toContain("YOLOv8")
    expect(names).toContain("COCO dataset")
    expect(names).not.toContain("mAP")
  })

  it("respects maxSeeds", async () => {
    const many: GraphNodeLite[] = Array.from({ length: 20 }, (_, i) => ({
      id: `x${i}`,
      documentId: "doc1",
      label: "Concept",
      name: `topic ${i}`,
      description: null,
    }))
    const query = Array.from({ length: 20 }, (_, i) => `topic ${i}`).join(" ")
    const matches = await linkQueryEntities(query, many, { useEmbeddingFallback: false, maxSeeds: 5 })
    expect(matches.length).toBeLessThanOrEqual(5)
  })
})

// ---------------------------------------------------------------------------
// Subgraph expansion
// ---------------------------------------------------------------------------

function chainGraph(): { nodes: GraphNodeLite[]; edges: GraphEdgeLite[] } {
  const node = (id: string): GraphNodeLite => ({ id, documentId: "doc1", label: "Concept", name: `n-${id}`, description: null })
  const edge = (id: string, sourceId: string, targetId: string): GraphEdgeLite => ({
    id,
    sourceId,
    targetId,
    relation: "RELATED_TO",
    evidence: null,
    documentId: "doc1",
  })
  return {
    nodes: [node("a"), node("b"), node("c"), node("d")],
    edges: [edge("e1", "a", "b"), edge("e2", "b", "c"), edge("e3", "c", "d")],
  }
}

describe("expandSubgraph", () => {
  it("expands exactly maxHops from seeds", () => {
    const { nodes, edges } = chainGraph()
    const oneHop = expandSubgraph(nodes, edges, ["a"], { maxHops: 1 })
    expect(oneHop.nodes.map((n) => n.id).sort()).toEqual(["a", "b"])
    expect(oneHop.edges.map((e) => e.id)).toEqual(["e1"])

    const twoHops = expandSubgraph(nodes, edges, ["a"], { maxHops: 2 })
    expect(twoHops.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"])
    expect(twoHops.edges.map((e) => e.id).sort()).toEqual(["e1", "e2"])
  })

  it("caps the subgraph at maxNodes", () => {
    const nodes: GraphNodeLite[] = [{ id: "hub", documentId: "doc1", label: "Concept", name: "hub", description: null }]
    const edges: GraphEdgeLite[] = []
    for (let i = 0; i < 10; i++) {
      nodes.push({ id: `leaf${i}`, documentId: "doc1", label: "Concept", name: `leaf${i}`, description: null })
      edges.push({ id: `le${i}`, sourceId: "hub", targetId: `leaf${i}`, relation: "USES", evidence: null, documentId: "doc1" })
    }
    const sub = expandSubgraph(nodes, edges, ["hub"], { maxHops: 1, maxNodes: 4 })
    expect(sub.nodes.length).toBe(4)
    // Only edges with both endpoints selected survive
    expect(sub.edges.length).toBe(3)
  })

  it("ignores unknown seed ids", () => {
    const { nodes, edges } = chainGraph()
    const sub = expandSubgraph(nodes, edges, ["zzz"], { maxHops: 2 })
    expect(sub.nodes).toEqual([])
    expect(sub.edges).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

describe("serializeGraphContext", () => {
  it("groups nodes by label and appends provenance tags", () => {
    const subgraph = {
      nodes: sampleNodes,
      edges: [
        { id: "e1", sourceId: "n1", targetId: "n2", relation: "EVALUATED_ON", evidence: "evaluated on COCO", documentId: "doc1" },
      ],
    }
    const { text, truncated } = serializeGraphContext(subgraph, { doc1: "thesis.pdf", doc2: "related.pdf" })
    expect(truncated).toBe(false)
    expect(text).toContain("**Methodology:**")
    expect(text).toContain("**Dataset:**")
    expect(text).toContain("- YOLOv8 — object detector [doc: thesis.pdf]")
    expect(text).toContain("YOLOv8 [EVALUATED_ON] COCO dataset")
    expect(text).toContain('"evaluated on COCO" [doc: thesis.pdf]')
  })

  it("hard-caps output at charBudget and reports truncation", () => {
    const manyNodes: GraphNodeLite[] = Array.from({ length: 50 }, (_, i) => ({
      id: `n${i}`,
      documentId: "doc1",
      label: "Concept",
      name: `entity number ${i} with a fairly long descriptive name`,
      description: "some description ".repeat(4),
    }))
    const { text, truncated } = serializeGraphContext({ nodes: manyNodes, edges: [] }, {}, { charBudget: 200 })
    expect(truncated).toBe(true)
    expect(text.length).toBeLessThanOrEqual(200)
  })

  it("trims over-long evidence quotes", () => {
    const subgraph = {
      nodes: [sampleNodes[0], sampleNodes[1]],
      edges: [
        { id: "e1", sourceId: "n1", targetId: "n2", relation: "EVALUATED_ON", evidence: "x".repeat(300), documentId: null },
      ],
    }
    const { text } = serializeGraphContext(subgraph, {}, { maxEvidenceChars: 100 })
    expect(text).toContain("…")
    expect(text).not.toContain("x".repeat(200))
  })
})

// ---------------------------------------------------------------------------
// retrieveGraphContext — prisma-mocked integration
// ---------------------------------------------------------------------------

describe("retrieveGraphContext", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.ingestFile.findMany.mockResolvedValue([
      { id: "doc1", name: "thesis.pdf" },
      { id: "doc2", name: "related-paper.pdf" },
    ])
    mockPrisma.graphNode.findMany.mockResolvedValue(sampleNodes)
    mockPrisma.graphEdge.findMany.mockResolvedValue([
      { id: "e1", sourceId: "n1", targetId: "n2", relation: "EVALUATED_ON", evidence: "evaluated on COCO", documentId: "doc1" },
      { id: "e2", sourceId: "n2", targetId: "n3", relation: "MEASURES", evidence: null, documentId: "doc2" },
      // Dangling edge — target node not in the active set, must be dropped
      { id: "e3", sourceId: "n1", targetId: "gone", relation: "USES", evidence: null, documentId: "doc1" },
    ])
  })

  it("links query entities, expands 1-hop neighborhood and serializes with provenance", async () => {
    const sub = await retrieveGraphContext("ws1", "YOLOv8 evaluation on COCO dataset", {
      useEmbeddingFallback: false,
      charBudget: 2000,
    })
    expect(sub).not.toBeNull()
    const nodeIds = sub!.nodes.map((n) => n.id)
    expect(nodeIds).toContain("n1")
    expect(nodeIds).toContain("n2")
    // 1-hop neighbor of n2 via e2
    expect(nodeIds).toContain("n3")
    // Dangling edge excluded
    expect(sub!.edges.map((e) => e.id)).not.toContain("e3")
    expect(sub!.serialized).toContain("[EVALUATED_ON]")
    expect(sub!.serialized).toContain("[doc: thesis.pdf]")
    expect(sub!.matched.length).toBeGreaterThan(0)
  })

  it("falls back to the whole graph when nothing matches but the graph is small", async () => {
    const sub = await retrieveGraphContext("ws1", "zzz qqq unrelated", {
      useEmbeddingFallback: false,
    })
    expect(sub).not.toBeNull()
    expect(sub!.nodes.length).toBe(sampleNodes.length)
    expect(sub!.matched).toEqual([])
  })

  it("returns null when the workspace has no active documents", async () => {
    mockPrisma.ingestFile.findMany.mockResolvedValue([])
    const sub = await retrieveGraphContext("ws1", "YOLOv8", { useEmbeddingFallback: false })
    expect(sub).toBeNull()
  })

  it("returns null when nodes exist but the graph is large and unmatched", async () => {
    const many: GraphNodeLite[] = Array.from({ length: 150 }, (_, i) => ({
      id: `n${i}`,
      documentId: "doc1",
      label: "Concept",
      name: `deep quantum resonance ${i}`,
      description: null,
    }))
    mockPrisma.graphNode.findMany.mockResolvedValue(many)
    mockPrisma.graphEdge.findMany.mockResolvedValue([])
    const sub = await retrieveGraphContext("ws1", "zzz qqq unrelated", {
      useEmbeddingFallback: false,
    })
    expect(sub).toBeNull()
  })
})
