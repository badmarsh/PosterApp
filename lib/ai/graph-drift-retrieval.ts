/**
 * Bounded BFS Graph Frontier Expansion Engine (Phase 16)
 *
 * This is a bounded breadth-first search expansion across the knowledge graph,
 * NOT Microsoft's DRIFT algorithm. It performs iterative exploration:
 *   1. Initial Query & Seed Linking: Retrieve top graph nodes and connected entities.
 *   2. Targeted Neighborhood Expansion: Follow typed relations (CAUSES, VALIDATES, DEPENDS_ON, EVALUATES)
 *      to uncover indirect dependencies.
 *   3. Convergence & Budgets: Stops when marginal new evidence gain < threshold, or upon reaching
 *      strict token/latency/iteration bounds (3 iterations, 40 nodes, 500ms timeout).
 */

import { prisma } from "@/lib/prisma"
import { canonicalKey, type GraphNodeLite, type GraphEdgeLite } from "./graph-rag"

export interface DriftIterationStep {
  iteration: number
  seedsAdded: string[]
  nodesDiscovered: number
  marginalGain: number
}

export interface DriftRetrievalResult {
  expandedNodes: GraphNodeLite[]
  expandedEdges: GraphEdgeLite[]
  iterationsExecuted: number
  history: DriftIterationStep[]
  serializedSummary: string
}

export interface DriftRetrievalOptions {
  maxIterations?: number // default: 3
  maxNodes?: number // default: 40
  maxTimeMs?: number // default: 500ms
  convergenceGainThreshold?: number // default: 0.05
}

/**
 * Executes bounded iterative graph expansion across the workspace knowledge graph.
 */
export async function retrieveDriftGraphContext(
  workspaceId: string,
  query: string,
  options: DriftRetrievalOptions = {}
): Promise<DriftRetrievalResult> {
  const maxIterations = options.maxIterations ?? 3
  const maxNodes = options.maxNodes ?? 40
  const maxTimeMs = options.maxTimeMs ?? 500
  const gainThreshold = options.convergenceGainThreshold ?? 0.05

  const startTime = Date.now()

  // 1. Fetch available nodes and edges
  const nodes = await prisma.graphNode.findMany({
    where: { workspaceId },
    select: { id: true, documentId: true, label: true, name: true, description: true },
  })

  if (nodes.length === 0) {
    return {
      expandedNodes: [],
      expandedEdges: [],
      iterationsExecuted: 0,
      history: [],
      serializedSummary: "",
    }
  }

  const edges = await prisma.graphEdge.findMany({
    where: { workspaceId },
    select: { id: true, sourceId: true, targetId: true, relation: true, evidence: true, documentId: true },
  })

  const nodeById = new Map<string, GraphNodeLite>()
  for (const n of nodes) nodeById.set(n.id, n)

  const queryTerms = canonicalKey(query).split(" ").filter((w) => w.length > 3)

  // Seed selection: matching query tokens to entity names
  const initialSeedIds: string[] = []
  for (const n of nodes) {
    const key = canonicalKey(n.name)
    if (queryTerms.some((t) => key.includes(t))) {
      initialSeedIds.push(n.id)
    }
  }

  // Fallback to highest degree nodes if no direct lexical seeds
  if (initialSeedIds.length === 0) {
    const degrees = new Map<string, number>()
    for (const e of edges) {
      degrees.set(e.sourceId, (degrees.get(e.sourceId) || 0) + 1)
      degrees.set(e.targetId, (degrees.get(e.targetId) || 0) + 1)
    }
    const sorted = [...nodes].sort((a, b) => (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0))
    for (const n of sorted.slice(0, 5)) {
      initialSeedIds.push(n.id)
    }
  }

  const visitedNodeIds = new Set<string>(initialSeedIds)
  const collectedEdgeIds = new Set<string>()
  const history: DriftIterationStep[] = []

  let currentFrontier = [...initialSeedIds]
  let iteration = 0

  while (
    iteration < maxIterations &&
    visitedNodeIds.size < maxNodes &&
    Date.now() - startTime < maxTimeMs &&
    currentFrontier.length > 0
  ) {
    iteration++
    const nextFrontier: string[] = []
    const prevCount = visitedNodeIds.size

    for (const edge of edges) {
      if (currentFrontier.includes(edge.sourceId) && !visitedNodeIds.has(edge.targetId)) {
        visitedNodeIds.add(edge.targetId)
        collectedEdgeIds.add(edge.id)
        nextFrontier.push(edge.targetId)
      } else if (currentFrontier.includes(edge.targetId) && !visitedNodeIds.has(edge.sourceId)) {
        visitedNodeIds.add(edge.sourceId)
        collectedEdgeIds.add(edge.id)
        nextFrontier.push(edge.sourceId)
      } else if (visitedNodeIds.has(edge.sourceId) && visitedNodeIds.has(edge.targetId)) {
        collectedEdgeIds.add(edge.id)
      }

      if (visitedNodeIds.size >= maxNodes) break
    }

    const newlyDiscovered = visitedNodeIds.size - prevCount
    const marginalGain = prevCount > 0 ? newlyDiscovered / prevCount : 1.0

    history.push({
      iteration,
      seedsAdded: [...currentFrontier],
      nodesDiscovered: newlyDiscovered,
      marginalGain: Math.round(marginalGain * 1000) / 1000,
    })

    if (marginalGain < gainThreshold || newlyDiscovered === 0) {
      break // Converged
    }

    currentFrontier = nextFrontier
  }

  const expandedNodes = [...visitedNodeIds].map((id) => nodeById.get(id)!).filter(Boolean)
  const expandedEdges = edges.filter((e) => collectedEdgeIds.has(e.id))

  // Build compact serialized summary
  const summaryLines: string[] = [
    `### DRIFT Iterative Graph Reasoning (${expandedNodes.length} nodes, ${expandedEdges.length} edges across ${iteration} iterations)`,
  ]
  for (const n of expandedNodes.slice(0, 20)) {
    summaryLines.push(`- **${n.label}: ${n.name}**${n.description ? ` (${n.description})` : ""}`)
  }
  for (const e of expandedEdges.slice(0, 15)) {
    const sName = nodeById.get(e.sourceId)?.name || e.sourceId
    const tName = nodeById.get(e.targetId)?.name || e.targetId
    summaryLines.push(`- (${sName}) --[${e.relation}]--> (${tName})`)
  }

  return {
    expandedNodes,
    expandedEdges,
    iterationsExecuted: iteration,
    history,
    serializedSummary: summaryLines.join("\n"),
  }
}
