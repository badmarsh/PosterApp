/**
 * Community Detection & LightRAG-style Community Summaries
 *
 * Implements Louvain-style modularity optimization over the GraphNode/GraphEdge
 * tables to group entities into semantic communities, then generates LLM narrative
 * summaries for each community. This resolves "context rot" — the failure of naive
 * vector RAG to reason across chapter boundaries in PhD-length dissertations.
 *
 * Algorithm: Simplified Louvain (greedy modularity, 3-pass convergence)
 *   Phase 1: Each node starts in its own community.
 *   Phase 2: Iteratively move each node to the neighbor community that maximises
 *            local modularity gain ΔQ. Repeat until stable.
 *   Phase 3 (optional): Compress communities into super-nodes; re-run.
 *
 * Storage: GraphCommunity table — one row per community, `memberNodeIds` JSON array.
 *
 * Usage at query time: community summaries act as "chapter-level" context blocks
 * that are prepended to the review LLM prompt alongside retrieved chunk passages.
 * This is the LightRAG / Fast-GraphRAG "global retrieval" pattern.
 */

import { prisma } from "@/lib/prisma"
import { generateAIResponse } from "./client"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeLite {
  id: string
  label: string
  name: string
  description: string | null
}

interface EdgeLite {
  sourceId: string
  targetId: string
  relation: string
}

interface Community {
  id: number
  nodeIds: Set<string>
}

// ---------------------------------------------------------------------------
// Louvain — Phase 1: Local community assignment
// ---------------------------------------------------------------------------

/**
 * Builds an adjacency list weighted by edge count (multi-edges → higher weight).
 */
function buildAdjacency(edges: EdgeLite[]): Map<string, Map<string, number>> {
  const adj = new Map<string, Map<string, number>>()
  for (const e of edges) {
    if (!adj.has(e.sourceId)) adj.set(e.sourceId, new Map())
    if (!adj.has(e.targetId)) adj.set(e.targetId, new Map())
    adj.get(e.sourceId)!.set(e.targetId, (adj.get(e.sourceId)!.get(e.targetId) || 0) + 1)
    adj.get(e.targetId)!.set(e.sourceId, (adj.get(e.targetId)!.get(e.sourceId) || 0) + 1)
  }
  return adj
}

/**
 * Computes total edge weight (2m) across the graph.
 */
function totalWeight(adj: Map<string, Map<string, number>>): number {
  let sum = 0
  for (const nbrs of adj.values()) for (const w of nbrs.values()) sum += w
  return sum / 2 // each edge counted twice
}

/**
 * Degree of node `id` (sum of edge weights).
 */
function degree(id: string, adj: Map<string, Map<string, number>>): number {
  return [...(adj.get(id)?.values() || [])].reduce((s, w) => s + w, 0)
}

/**
 * Modularity gain ΔQ when moving node `id` into community `community`.
 *
 * ΔQ = [k_i_in / m] - [k_i * Σ_tot / (2 * m^2)]
 *
 * where k_i_in = edges from id to community members,
 *       Σ_tot  = sum of degrees of community members,
 *       k_i    = degree of id,
 *       m      = total edge weight.
 */
function deltaQ(
  id: string,
  communityNodes: Set<string>,
  adj: Map<string, Map<string, number>>,
  degreesCache: Map<string, number>,
  m: number
): number {
  if (m === 0) return 0
  let kIn = 0
  const nbrs = adj.get(id) || new Map()
  for (const [nbr, w] of nbrs) {
    if (communityNodes.has(nbr)) kIn += w
  }
  let sigmaTot = 0
  for (const n of communityNodes) sigmaTot += degreesCache.get(n) || 0
  const ki = degreesCache.get(id) || 0
  return kIn / m - (ki * sigmaTot) / (2 * m * m)
}

/**
 * One Louvain pass: move nodes into neighbor communities if gain is positive.
 * Returns true if any move was made (not yet converged).
 */
function louvainPass(
  communityOf: Map<string, number>,
  communityNodes: Map<number, Set<string>>,
  adj: Map<string, Map<string, number>>,
  degreesCache: Map<string, number>,
  m: number
): boolean {
  let moved = false
  for (const [nodeId, curCom] of communityOf) {
    const nbrs = adj.get(nodeId) || new Map()
    const neighborComs = new Set<number>()
    for (const nbrId of nbrs.keys()) {
      const c = communityOf.get(nbrId)
      if (c !== undefined && c !== curCom) neighborComs.add(c)
    }
    if (neighborComs.size === 0) continue

    // Remove node from current community temporarily
    communityNodes.get(curCom)!.delete(nodeId)
    const curDelta = deltaQ(nodeId, communityNodes.get(curCom)!, adj, degreesCache, m)

    let bestCom = curCom
    let bestGain = curDelta

    for (const c of neighborComs) {
      const gain = deltaQ(nodeId, communityNodes.get(c)!, adj, degreesCache, m)
      if (gain > bestGain) {
        bestGain = gain
        bestCom = c
      }
    }

    if (bestCom !== curCom) {
      communityOf.set(nodeId, bestCom)
      communityNodes.get(bestCom)!.add(nodeId)
      moved = true
    } else {
      // Put it back
      communityNodes.get(curCom)!.add(nodeId)
    }
  }
  return moved
}

/**
 * Full Louvain community detection.
 * Returns a map from node ID → community index.
 */
export function detectCommunities(
  nodeIds: string[],
  edges: EdgeLite[],
  maxPasses = 10,
  minCommunitySize = 2
): Map<string, number> {
  if (nodeIds.length === 0) return new Map()

  const adj = buildAdjacency(edges)
  const m = totalWeight(adj)
  const degreesCache = new Map(nodeIds.map((id) => [id, degree(id, adj)]))

  // Initialize: each node is its own community
  const communityOf = new Map<string, number>(nodeIds.map((id, i) => [id, i]))
  const communityNodes = new Map<number, Set<string>>(nodeIds.map((id, i) => [i, new Set([id])]))

  // Louvain passes until convergence
  let passes = 0
  while (passes < maxPasses && louvainPass(communityOf, communityNodes, adj, degreesCache, m)) {
    passes++
  }

  // Merge tiny communities (< minCommunitySize) into nearest neighbor's community
  const finalCom = new Map<string, number>()
  let remapIdx = 0
  const comIdxRemap = new Map<number, number>()

  for (const [comId, members] of communityNodes) {
    if (members.size < minCommunitySize) continue
    if (!comIdxRemap.has(comId)) comIdxRemap.set(comId, remapIdx++)
    for (const nid of members) finalCom.set(nid, comIdxRemap.get(comId)!)
  }

  // Assign orphan nodes to community 0 (or their nearest neighbor's community)
  for (const nodeId of nodeIds) {
    if (!finalCom.has(nodeId)) {
      const nbrs = adj.get(nodeId) || new Map()
      let assigned = false
      for (const nbrId of nbrs.keys()) {
        if (finalCom.has(nbrId)) {
          finalCom.set(nodeId, finalCom.get(nbrId)!)
          assigned = true
          break
        }
      }
      if (!assigned) {
        // Isolated node — its own singleton community
        finalCom.set(nodeId, remapIdx++)
      }
    }
  }

  return finalCom
}

// ---------------------------------------------------------------------------
// LLM Summary Generation
// ---------------------------------------------------------------------------

const communitySummarySchema = z.object({
  label: z.string().describe("Short label for this community (3-6 words, e.g. 'Methodology & Experimental Design')"),
  summary: z.string().describe("2-4 sentence summary of what concepts this community represents and how they relate in the thesis"),
})

/**
 * Generates a human-readable label and narrative summary for a single community
 * by asking the LLM to describe the cluster of entities and their relationships.
 */
async function summarizeCommunity(
  nodes: NodeLite[],
  edges: EdgeLite[],
  nodeById: Map<string, NodeLite>
): Promise<{ label: string; summary: string }> {
  if (nodes.length === 0) return { label: "Unknown Community", summary: "" }

  const nodeIds = new Set(nodes.map((n) => n.id))
  const relevantEdges = edges.filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))

  const nodeText = nodes
    .slice(0, 20)
    .map((n) => `[${n.label}] ${n.name}${n.description ? ` — ${n.description}` : ""}`)
    .join("\n")

  const edgeText = relevantEdges
    .slice(0, 15)
    .map((e) => {
      const src = nodeById.get(e.sourceId)?.name || e.sourceId
      const tgt = nodeById.get(e.targetId)?.name || e.targetId
      return `${src} → [${e.relation}] → ${tgt}`
    })
    .join("\n")

  const result = await generateAIResponse("GraphCommunity-Summary", {
    model: process.env.AI_MODEL || "gemini-3-flash",
    systemPrompt:
      "You are an academic knowledge graph analyst. Given a cluster of related academic concepts extracted from a PhD thesis, produce a concise label and 2-4 sentence summary describing what this conceptual cluster represents. Be specific to the academic domain.",
    userPrompt: `Entities in this cluster:\n${nodeText}\n\nRelationships:\n${edgeText || "(none detected)"}`,
    schema: communitySummarySchema,
    temperature: 0.2,
  })

  return {
    label: result?.label || nodes.map((n) => n.name).slice(0, 3).join(" / "),
    summary: result?.summary || "",
  }
}

// ---------------------------------------------------------------------------
// Public: Build and store communities for a workspace
// ---------------------------------------------------------------------------

export interface BuildCommunitiesResult {
  communitiesBuilt: number
  nodesProcessed: number
  skipped: boolean
  reason?: string
}

/**
 * Detects communities in the workspace knowledge graph via Louvain,
 * generates LLM summaries, and stores them in the GraphCommunity table.
 * Clears any previous communities for the workspace before rebuilding.
 */
export async function buildGraphCommunities(workspaceId: string): Promise<BuildCommunitiesResult> {
  const nodes = await prisma.graphNode.findMany({
    where: { workspaceId },
    select: { id: true, label: true, name: true, description: true },
  })

  if (nodes.length < 4) {
    return { communitiesBuilt: 0, nodesProcessed: nodes.length, skipped: true, reason: "Too few nodes" }
  }

  const edges = await prisma.graphEdge.findMany({
    where: { workspaceId },
    select: { sourceId: true, targetId: true, relation: true },
  })

  const nodeIds = nodes.map((n) => n.id)
  const communityOf = detectCommunities(nodeIds, edges, 10, 2)
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  // Group nodes by community index
  const groups = new Map<number, NodeLite[]>()
  for (const node of nodes) {
    const comIdx = communityOf.get(node.id) ?? -1
    if (!groups.has(comIdx)) groups.set(comIdx, [])
    groups.get(comIdx)!.push(node)
  }

  // Delete existing communities
  await prisma.graphCommunity.deleteMany({ where: { workspaceId } })

  let communitiesBuilt = 0

  // Generate summary for each community (sequentially to avoid rate limits)
  for (const [, members] of groups) {
    if (members.length === 0) continue
    const { label, summary } = await summarizeCommunity(members, edges, nodeById)
    await prisma.graphCommunity.create({
      data: {
        workspaceId,
        label,
        summary,
        memberNodeIds: members.map((n) => n.id),
        nodeCount: members.length,
      },
    })
    communitiesBuilt++
  }

  return { communitiesBuilt, nodesProcessed: nodes.length, skipped: false }
}

// ---------------------------------------------------------------------------
// Public: Retrieve community summaries for a workspace (query-time)
// ---------------------------------------------------------------------------

/**
 * Returns community summaries serialized as a text block for prompt injection.
 * Used as "global context" alongside per-criterion vector chunk retrieval.
 *
 * This is the LightRAG global retrieval pattern: community summaries answer
 * high-level queries (e.g. "What methodology does this thesis use?") that
 * per-chunk retrieval would miss due to context fragmentation.
 */
export async function getCommunityContext(
  workspaceId: string,
  charBudget = 6000
): Promise<string> {
  const communities = await prisma.graphCommunity.findMany({
    where: { workspaceId },
    orderBy: { nodeCount: "desc" },
  })

  if (communities.length === 0) return ""

  const lines: string[] = ["### GraphRAG Community Summaries (Cross-Chapter Context)\n"]
  let len = lines[0].length

  for (const c of communities) {
    if (!c.summary) continue
    const block = `**${c.label}** (${c.nodeCount} concepts)\n${c.summary}\n`
    if (len + block.length > charBudget) break
    lines.push(block)
    len += block.length
  }

  return lines.length > 1 ? lines.join("\n") : ""
}
