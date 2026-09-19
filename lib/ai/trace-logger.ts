/**
 * Research-Grade Retrieval & Reasoning Trace Logger (Phase 29)
 *
 * Persists an auditable, non-leaking trace for every review retrieval / reasoning call:
 *   - Query classification & routing decisions
 *   - Fusion weights, candidate contributions per source
 *   - Semantic MMR lambda, selected evidence IDs
 *   - Graph nodes and community paths traversed
 *   - Latency per pipeline stage
 *
 * Designed specifically so academic researchers can inspect:
 *   "Why did the system choose this evidence and reject alternative passages?"
 */

import { prisma } from "@/lib/prisma"

export interface RetrievalTraceInput {
  workspaceId: string
  reviewId?: string
  criterion?: string
  queryCategory?: string
  query: string
  route: string
  candidateCounts: Record<string, number>
  ranking: Array<{ id: string; fusedScore: number; source: string }>
  selectedEvidenceIds: string[]
  graphNodeIds?: string[]
  communityIds?: string[]
  promptTokens?: number
  modelVersions?: Record<string, string>
  stageLatencyMs: Record<string, number>
  totalLatencyMs: number
  degraded?: Record<string, unknown>
}

/**
 * Persists a scientific trace entry to the `RetrievalTrace` database table.
 */
export async function logRetrievalTrace(input: RetrievalTraceInput): Promise<string | null> {
  try {
    const trace = await prisma.retrievalTrace.create({
      data: {
        workspaceId: input.workspaceId,
        reviewId: input.reviewId ?? null,
        criterion: input.criterion ?? null,
        queryCategory: input.queryCategory ?? null,
        query: input.query.slice(0, 500),
        route: input.route,
        candidateCounts: input.candidateCounts,
        ranking: input.ranking.slice(0, 20),
        selectedEvidenceIds: input.selectedEvidenceIds,
        graphNodeIds: input.graphNodeIds ?? [],
        communityIds: input.communityIds ?? [],
        promptTokens: input.promptTokens ?? null,
        modelVersions: input.modelVersions ?? {},
        stageLatencyMs: input.stageLatencyMs,
        totalLatencyMs: input.totalLatencyMs,
        degraded: (input.degraded || {}) as any,
      },
      select: { id: true },
    })
    return trace.id
  } catch (err) {
    console.warn("[trace-logger] Failed to log retrieval trace:", err)
    return null
  }
}
