/**
 * GraphRAG v2 — Query-Aware Knowledge Graph Retrieval
 *
 * Complements the vector pipeline (vector-rag.ts) with structured, multi-hop
 * entity retrieval over the GraphNode / GraphEdge tables populated during
 * ingestion by graph-extractor.ts.
 *
 * Pipeline (query time):
 *  1. Entity linking       — score graph nodes against the query using
 *                            normalized token overlap, acronym/substring
 *                            signals, and (optionally) local embeddings.
 *  2. Subgraph expansion   — BFS up to `maxHops` from seed nodes, bounded by
 *                            `maxNodes`.
 *  3. Serialization        — deterministic, char-budget-capped text with
 *                            per-document provenance tags for auditable
 *                            evidence.
 *
 * Cross-document synthesis: nodes and edges are workspace-scoped, so entities
 * shared across multiple ingested documents merge into one graph; retrieval is
 * therefore workspace-wide and every fact carries a `[doc: …]` provenance tag.
 *
 * @module graph-rag
 */

import { prisma } from "@/lib/prisma"
import { generateLocalEmbedding } from "./local-embeddings"

// ---------------------------------------------------------------------------
// Entity canonicalization
// ---------------------------------------------------------------------------

/**
 * Normalizes an entity name to a canonical *lookup key*: diacritics folded,
 * lowercased, non-alphanumerics collapsed to single spaces.
 * " YOLOv8 " / "yolov8" / "yolov8." → "yolov8".
 */
export function canonicalKey(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Canonical *display* form of an entity name: trimmed, whitespace collapsed,
 * trailing punctuation stripped. Preserves inner casing ("YOLOv8", "COCO").
 */
export function canonicalEntityName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!]+$/, "")
}

const PLACEHOLDER_NAMES = new Set([
  "unnamed entity",
  "unnamed",
  "unknown",
  "none",
  "entity",
  "concept",
  "node",
  "n a",
])

/**
 * True when the extracted entity is a useless placeholder (empty, generic
 * fallback from schema validation, or just a restatement of its own label).
 */
export function isPlaceholderEntity(name: string, label: string): boolean {
  const key = canonicalKey(name)
  if (!key) return true
  if (PLACEHOLDER_NAMES.has(key)) return true
  if (key === canonicalKey(label)) return true
  return false
}

/** Normalizes an LLM-provided relation type to a stable uppercase form. */
export function canonicalRelation(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_").slice(0, 40) || "RELATED_TO"
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNodeLite {
  id: string
  documentId: string
  label: string
  name: string
  description: string | null
}

export interface GraphEdgeLite {
  id: string
  sourceId: string
  targetId: string
  relation: string
  evidence: string | null
  documentId: string | null
}

export interface GraphSubgraph {
  nodes: GraphNodeLite[]
  edges: GraphEdgeLite[]
  seedNodeIds: string[]
  matched: Array<{ nodeId: string; name: string; score: number }>
  /** Budget-capped text ready for prompt injection. */
  serialized: string
  /** True when serialization hit the char budget and dropped content. */
  truncated: boolean
}

// ---------------------------------------------------------------------------
// Stage 1 — Entity linking
// ---------------------------------------------------------------------------

function tokensOf(text: string): string[] {
  return canonicalKey(text).split(" ").filter((t) => t.length > 1)
}

/**
 * Scores how well a graph node matches the query. Pure lexical — no API cost.
 * Signals: exact token hits in the node name (strong), substring containment
 * for long tokens, verbatim multi-word name containment (strongest),
 * label hits (weak), and description hits (very weak).
 */
export function scoreNodeMatch(
  query: string,
  node: Pick<GraphNodeLite, "name" | "label" | "description" | "documentId">,
  preferredDocumentId?: string
): number {
  const queryTokens = tokensOf(query)
  if (queryTokens.length === 0) return 0

  const nameKey = canonicalKey(node.name)
  const nameTokens = new Set(nameKey.split(" "))
  const labelTokens = new Set(canonicalKey(node.label).split(" "))
  const queryKey = canonicalKey(query)

  let score = 0
  for (const qt of queryTokens) {
    if (nameTokens.has(qt)) score += 1.0
    else if (qt.length >= 4 && (nameKey.includes(qt) || (nameKey.length >= 4 && qt.includes(nameKey)))) score += 0.5
    if (labelTokens.has(qt)) score += 0.3
  }
  if (nameKey.length >= 3 && queryKey.includes(nameKey)) score += 1.5

  if (node.description) {
    const descKey = canonicalKey(node.description)
    let hits = 0
    for (const qt of queryTokens) if (descKey.includes(qt)) hits++
    score += Math.min(hits * 0.1, 0.5)
  }

  // Prefer entities extracted from the document under review
  if (preferredDocumentId && node.documentId === preferredDocumentId && score > 0) {
    score += 0.5
  }
  return score
}

/**
 * Ranks nodes against the query and returns the strongest matches as seeds.
 * Falls back to local-embedding cosine similarity when lexical linking is too
 * weak (common for paraphrased queries). Embeddings go through the shared LRU
 * cache, so repeated review generations cost no extra WASM inference.
 */
export async function linkQueryEntities(
  query: string,
  nodes: GraphNodeLite[],
  opts: { maxSeeds?: number; minScore?: number; preferredDocumentId?: string; useEmbeddingFallback?: boolean } = {}
): Promise<Array<{ nodeId: string; name: string; score: number }>> {
  const maxSeeds = opts.maxSeeds ?? 8
  const minScore = opts.minScore ?? 1.0

  const scored = nodes
    .map((n) => ({ nodeId: n.id, name: n.name, score: scoreNodeMatch(query, n, opts.preferredDocumentId) }))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSeeds)

  if (scored.length >= 2 || nodes.length === 0 || opts.useEmbeddingFallback === false) {
    return scored
  }

  // Embedding fallback for weak lexical overlap
  try {
    const [queryEmb] = await Promise.all([generateLocalEmbedding(query)])
    const nameEmbPair = await Promise.all(
      nodes.slice(0, 500).map(async (n) => ({
        node: n,
        emb: await generateLocalEmbedding(n.name),
      }))
    )
    const cosine = (a: number[], b: number[]) => {
      let dot = 0
      for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
      return dot // both vectors are L2-normalized
    }
    const EMBED_MIN_SIM = 0.45
    const embMatches = nameEmbPair
      .map(({ node, emb }) => ({ nodeId: node.id, name: node.name, score: cosine(queryEmb, emb) }))
      .filter((m) => m.score >= EMBED_MIN_SIM)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSeeds - scored.length)

    const seen = new Set(scored.map((m) => m.nodeId))
    for (const m of embMatches) if (!seen.has(m.nodeId)) scored.push(m)
  } catch {
    // Embedding model unavailable — lexical results are sufficient
  }
  return scored
}

// ---------------------------------------------------------------------------
// Stage 2 — k-hop subgraph expansion
// ---------------------------------------------------------------------------

/**
 * BFS from seed nodes over the undirected view of the edge list, bounded by
 * `maxHops` and `maxNodes`. Returns the selected nodes and the edges whose
 * both endpoints were selected (proximity-ordered by BFS discovery).
 */
export function expandSubgraph(
  nodes: GraphNodeLite[],
  edges: GraphEdgeLite[],
  seedIds: string[],
  opts: { maxHops?: number; maxNodes?: number } = {}
): { nodes: GraphNodeLite[]; edges: GraphEdgeLite[] } {
  const maxHops = opts.maxHops ?? 2
  const maxNodes = opts.maxNodes ?? 40

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const adjacency = new Map<string, Array<{ other: string; edge: GraphEdgeLite }>>()
  for (const e of edges) {
    if (!adjacency.has(e.sourceId)) adjacency.set(e.sourceId, [])
    if (!adjacency.has(e.targetId)) adjacency.set(e.targetId, [])
    adjacency.get(e.sourceId)!.push({ other: e.targetId, edge: e })
    adjacency.get(e.targetId)!.push({ other: e.sourceId, edge: e })
  }

  const selected = new Set(seedIds.filter((id) => nodeById.has(id)))
  const selectedEdges: GraphEdgeLite[] = []
  const edgeSeen = new Set<string>()

  let frontier = [...selected]
  for (let hop = 0; hop < maxHops && selected.size < maxNodes && frontier.length > 0; hop++) {
    const next: string[] = []
    for (const id of frontier) {
      if (selected.size >= maxNodes) break
      for (const { other, edge } of adjacency.get(id) ?? []) {
        if (!edgeSeen.has(edge.id)) {
          edgeSeen.add(edge.id)
          selectedEdges.push(edge)
        }
        if (!selected.has(other) && selected.size < maxNodes) {
          selected.add(other)
          next.push(other)
        }
      }
    }
    frontier = next
  }

  return {
    nodes: [...selected].map((id) => nodeById.get(id)!),
    edges: selectedEdges.filter((e) => selected.has(e.sourceId) && selected.has(e.targetId)),
  }
}

// ---------------------------------------------------------------------------
// Stage 3 — Budget-capped serialization
// ---------------------------------------------------------------------------

/**
 * Serializes a subgraph into deterministic, prompt-ready text grouped by node
 * label, followed by relationship lines with trimmed evidence quotes and
 * `[doc: <name>]` provenance tags. Hard-capped at `charBudget`.
 */
export function serializeGraphContext(
  subgraph: { nodes: GraphNodeLite[]; edges: GraphEdgeLite[] },
  docNameById: Record<string, string> = {},
  opts: { charBudget?: number; maxEvidenceChars?: number } = {}
): { text: string; truncated: boolean } {
  const charBudget = opts.charBudget ?? 4000
  const maxEvidenceChars = opts.maxEvidenceChars ?? 160

  const lines: string[] = []
  let len = 0
  let truncated = false

  const push = (s: string): boolean => {
    if (len + s.length + 1 > charBudget) {
      truncated = true
      return false
    }
    lines.push(s)
    len += s.length + 1
    return true
  }

  const docTag = (documentId: string | null): string => {
    const name = documentId ? docNameById[documentId] : undefined
    return name ? ` [doc: ${name}]` : ""
  }

  if (!push("### GraphRAG Knowledge Graph (query-relevant subgraph)")) {
    return { text: "", truncated: true }
  }

  // Nodes grouped by label (stable order: first appearance)
  const byLabel = new Map<string, GraphNodeLite[]>()
  for (const n of subgraph.nodes) {
    const label = n.label || "Concept"
    if (!byLabel.has(label)) byLabel.set(label, [])
    byLabel.get(label)!.push(n)
  }
  for (const [label, group] of byLabel) {
    if (!push(`**${label}:**`)) break
    for (const n of group) {
      const desc = n.description ? ` — ${n.description}` : ""
      if (!push(`- ${n.name}${desc}${docTag(n.documentId)}`)) break
    }
    if (truncated) break
  }

  if (!truncated) {
    push("**Relationships:**")
    const nodeIds = new Set(subgraph.nodes.map((n) => n.id))
    for (const e of subgraph.edges) {
      const s = subgraph.nodes.find((n) => n.id === e.sourceId)
      const t = subgraph.nodes.find((n) => n.id === e.targetId)
      if (!s || !t || !nodeIds.has(e.sourceId) || !nodeIds.has(e.targetId)) continue
      const evidence = e.evidence
        ? ` — "${e.evidence.slice(0, maxEvidenceChars)}${e.evidence.length > maxEvidenceChars ? "…" : ""}"`
        : ""
      if (!push(`- ${s.name} [${e.relation}] ${t.name}${evidence}${docTag(e.documentId)}`)) break
    }
  }

  return { text: lines.join("\n"), truncated }
}

// ---------------------------------------------------------------------------
// High-level entrypoint
// ---------------------------------------------------------------------------

const SMALL_GRAPH_THRESHOLD = 120

/**
 * Query-aware GraphRAG retrieval over the workspace knowledge graph.
 *
 * 1. Loads active-document nodes + workspace edges (2 cheap queries).
 * 2. Links the query to seed entities (lexical, embedding fallback).
 * 3. Expands a bounded k-hop neighborhood.
 * 4. Serializes with a hard char budget and doc provenance.
 *
 * Fallbacks: with no query matches, a small graph (< SMALL_GRAPH_THRESHOLD
 * nodes) is returned whole (budget-capped); a large unmatched graph yields
 * `null` so callers can skip the graph block entirely.
 */
export async function retrieveGraphContext(
  workspaceId: string,
  query: string,
  opts: {
    charBudget?: number
    maxHops?: number
    maxNodes?: number
    maxSeeds?: number
    /** Reviewed document — matched nodes from it get a seed-score bonus. */
    documentId?: string
    useEmbeddingFallback?: boolean
  } = {}
): Promise<GraphSubgraph | null> {
  const charBudget = opts.charBudget ?? 4000

  // Only entities of still-active documents participate
  const ingestFiles = await prisma.ingestFile.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
  })
  const activeIds = ingestFiles.map((f) => f.id)
  if (activeIds.length === 0) return null

  const docNameById: Record<string, string> = {}
  for (const f of ingestFiles) docNameById[f.id] = f.name

  const nodes = await prisma.graphNode.findMany({
    where: { workspaceId, documentId: { in: activeIds } },
    select: { id: true, documentId: true, label: true, name: true, description: true },
  })
  if (nodes.length === 0) return null

  const edges = await prisma.graphEdge.findMany({
    where: { workspaceId },
    select: { id: true, sourceId: true, targetId: true, relation: true, evidence: true, documentId: true },
  })
  const nodeIds = new Set(nodes.map((n) => n.id))
  const validEdges: GraphEdgeLite[] = edges.filter(
    (e): e is GraphEdgeLite => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId)
  )

  const nodeSeeds = await linkQueryEntities(query, nodes, {
    maxSeeds: opts.maxSeeds,
    preferredDocumentId: opts.documentId,
    useEmbeddingFallback: opts.useEmbeddingFallback,
  })

  let seedIds: string[]
  let matched: GraphSubgraph["matched"]
  if (nodeSeeds.length > 0) {
    seedIds = nodeSeeds.map((m) => m.nodeId)
    matched = nodeSeeds
  } else if (nodes.length <= SMALL_GRAPH_THRESHOLD) {
    // Small workspace graph — inject it whole (still budget-capped)
    seedIds = nodes.map((n) => n.id)
    matched = []
  } else {
    return null
  }

  const subgraph = expandSubgraph(nodes, validEdges, seedIds, {
    maxHops: opts.maxHops,
    maxNodes: opts.maxNodes,
  })
  if (subgraph.nodes.length === 0) return null

  const { text, truncated } = serializeGraphContext(subgraph, docNameById, { charBudget })
  if (!text) return null

  return {
    nodes: subgraph.nodes,
    edges: subgraph.edges,
    seedNodeIds: seedIds,
    matched,
    serialized: text,
    truncated,
  }
}
