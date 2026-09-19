/**
 * Hybrid retrieval — the evidence-first retrieval pipeline.
 *
 * This is the pipeline the review engine should be running. `vector-rag.ts` remains the
 * reference implementation of the *single-statement* hybrid search (dense + FTS fused inside one
 * SQL query) and is still used when the flag is off, when a caller needs exactly that shape, or
 * as the degradation path. What this module adds is the layer that was missing:
 *
 *   route      `query-router` decides the shape of retrieval from the question itself
 *   transform  query fan-out / HyDE, applied only when the route asks for it
 *   generate   independent candidate generators run in parallel, each with its own deadline
 *   fuse       weighted reciprocal-rank fusion across sources (`lib/ai/fusion`)
 *   rank       diversity selection, then a real cross-encoder — labelled honestly
 *   expand     child → parent / neighbour / related-element widening, under one budget
 *   assemble   a labelled evidence context, not an unlabelled top-k blob
 *
 * Everything the pipeline decided is returned in `trace`: which legs ran, how many candidates
 * each produced, which ones degraded, what fused them, what produced the final order, and how
 * long each step took. A review whose evidence cannot be explained is not reviewable.
 *
 * @module hybrid-retrieval
 */

import { prisma } from "@/lib/prisma"
import { embedTexts, modelHealth } from "./model-registry"
import { fuseCandidates, type FusionMethod, type FusedCandidate, type RetrievalSource } from "./fusion"
import { applyMMR, detectNoveltyDrift, rerankCandidates } from "./retrieval-ranking"
import { buildEvidenceContext, expandContext, selectCounterEvidence, type ContextChunk } from "./parent-context"
import { runCandidateGenerators, DEFAULT_CANDIDATE_LIMITS, type CandidatePool } from "./retrievers"
import type { RetrievalCandidate } from "./retrievers/types"
import { routeQuery, type RetrievalRoute } from "./query-router"
import {
  expandQuery,
  generateHypotheticalDocument,
  getThesisCriterionQueryExpansion,
  resolveCriterionFamily,
  resolveThesisDomainContext,
} from "./vector-rag"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const DEFAULT_TOP_K = 8
export const DEFAULT_MAX_CONTEXT_CHARS = 24_000
export const DEFAULT_FUSION_POOL = 200

/** Multi-source retrieval is the default; `RETRIEVAL_PIPELINE=legacy` restores the old path. */
export function isMultiSourceRetrievalEnabled(): boolean {
  const v = process.env.RETRIEVAL_PIPELINE
  if (v === undefined) return true
  return v !== "legacy" && v !== "vector-rag" && v !== "false" && v !== "0"
}

export interface AblationConfig {
  /** Legs to switch off. */
  disableSources?: RetrievalSource[]
  /** Run only these legs (mutually exclusive with disableSources in practice). */
  onlySources?: RetrievalSource[]
  /** Fusion variant to use. */
  fusionMethod?: FusionMethod
  /** Skip the cross-encoder and keep the fused order. */
  disableRerank?: boolean
  /** Skip parent/neighbour/element widening. */
  disableExpansion?: boolean
  /** Skip query fan-out and HyDE. */
  disableQueryTransform?: boolean
  /** MMR λ (1.0 = pure relevance). */
  lambda?: number
}

export interface RetrieveEvidenceOptions {
  workspaceId: string
  query: string
  criterionId?: string | null
  documentId?: string
  documentIds?: string[]
  topK?: number
  maxContextChars?: number
  useNeuralReranker?: boolean
  ablation?: AblationConfig
  lang?: "sk" | "cs" | "en"
  signal?: AbortSignal
}

/** One chunk in the final evidence set. */
export interface EvidenceChunk {
  id: string
  documentId: string
  heading: string | null
  content: string
  tokens: number
  kind: string
  chunkType: string
  sectionPath: string | null
  pageStart: number | null
  pageEnd: number | null
  parentChunkId: string | null
  /** Anthropic-style contextual prefix — carried through so downstream compression and
   *  prompt assembly see the same prefix the index was built with. */
  contextPrefix: string | null
  /** Fused score across sources. */
  score: number
  /** Reranker score, when a reranker ran. */
  rerankScore?: number
  /** Which generators proposed this chunk — the attribution that makes findings checkable. */
  sources: RetrievalSource[]
  /** Best per-source normalised score, for the trace. */
  perSourceScores: Record<string, number>
  /** Why this chunk is here. */
  role: ContextChunk["role"]
  /** Confidence of the graph edges that led here, if any. */
  graphConfidence?: number
}

export interface SourceTraceEntry {
  source: RetrievalSource
  candidates: number
  latencyMs: number
  enabled: boolean
  /** True when an ablation switched this leg off. */
  excludedByAblation?: boolean
  error?: string
  /** Id of the best candidate from this leg, and its fused rank (1-based) if it survived. */
  topCandidateId?: string
  fusedRank?: number
}

export interface RetrievalTrace {
  pipeline: "multi-source" | "legacy"
  route: {
    category: RetrievalRoute["category"]
    confidence: number
    profiles: string[]
    signals: Array<{ name: string; reason: string; category: string; weight: number }>
  }
  queryTransform: { applied: string[]; variants: string[] }
  fusion: { method: FusionMethod; weights: Record<string, number>; candidatesIn: number; candidatesOut: number }
  sources: SourceTraceEntry[]
  degraded: Array<{ source: RetrievalSource; error: string }>
  ranking: { scorer: "cross-encoder" | "lexical-heuristic" | "fusion-score"; usedNeuralReranker: boolean; mmrLambda: number; error?: string }
  noveltyDrift: { triggered: boolean; maxSimilarity: number | null }
  expansion: { parents: number; neighbors: number; related: number; totalChars: number }
  embeddingModel: { id: string; healthy: boolean; dimensions: number | null }
  timings: Record<string, number>
  totalLatencyMs: number
  /** Set when the pipeline fell back to the legacy single-statement search. */
  fallbackReason?: string
}

export interface EvidenceRetrieval {
  evidence: EvidenceChunk[]
  /** The rendered, labelled context block for the reviewer model. */
  context: string
  route: RetrievalRoute
  trace: RetrievalTrace
  /** Community-report text, when the global leg produced any. */
  globalContext: string[]
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Retrieves evidence for one criterion query.
 *
 * Never throws for a degraded leg: a missing graph, an unavailable reranker or an empty
 * bibliography each produce fewer candidates and an entry in `trace.degraded`. Retrieval failing
 * outright would silently become "no findings", which is the worst possible outcome for a review.
 */
export async function retrieveEvidence(opts: RetrieveEvidenceOptions): Promise<EvidenceRetrieval> {
  const startedAt = Date.now()
  const timings: Record<string, number> = {}
  const topK = Math.max(1, opts.topK ?? DEFAULT_TOP_K)
  const maxContextChars = opts.maxContextChars ?? DEFAULT_MAX_CONTEXT_CHARS
  const ablation = opts.ablation ?? {}

  // ---- 1. Route ----------------------------------------------------------
  let t0 = Date.now()
  const route = routeQuery(opts.query, { criterionId: opts.criterionId })
  timings.route = Date.now() - t0

  // ---- 2. Query transform ------------------------------------------------
  t0 = Date.now()
  const variants: string[] = []
  const appliedTransforms: string[] = []
  if (!ablation.disableQueryTransform && route.queryTransform.expand) {
    const expansion = opts.criterionId ? getThesisCriterionQueryExpansion(opts.criterionId, opts.lang ?? "sk") : ""
    for (const v of expandQuery(opts.query, expansion)) if (!variants.includes(v)) variants.push(v)
    appliedTransforms.push("expand")
  }
  if (variants.length === 0) variants.push(opts.query)

  if (!ablation.disableQueryTransform && route.queryTransform.hyde) {
    try {
      const domain = resolveThesisDomainContext()
      const hyde = await generateHypotheticalDocument(opts.query, domain, opts.lang ?? "sk")
      if (hyde && !variants.includes(hyde)) {
        variants.push(hyde)
        appliedTransforms.push("hyde")
      }
    } catch {
      // HyDE is an enhancement; a failure here must not cost the retrieval anything.
    }
  }
  timings.queryTransform = Date.now() - t0

  // ---- 3. Embed the variants --------------------------------------------
  t0 = Date.now()
  const queryEmbeddings: number[][] = []
  try {
    const embedded = await embedTexts(variants, "query")
    for (const e of embedded) if (e && e.length > 0) queryEmbeddings.push(e)
  } catch {
    // A leg without embeddings simply does not run; lexical/metadata/citation still do.
  }
  timings.embed = Date.now() - t0

  // ---- 4. Generate candidates -------------------------------------------
  t0 = Date.now()
  const only = ablation.onlySources
  const disabled = new Set(ablation.disableSources ?? [])
  const limitOverrides: Partial<Record<RetrievalSource, number>> = {}
  for (const s of route.sources) {
    limitOverrides[s.source] = Math.min(s.limit, DEFAULT_CANDIDATE_LIMITS[s.source] ?? s.limit)
  }
  const fusionWeights: Record<string, number> = {}
  for (const s of route.sources) fusionWeights[s.source] = s.weight

  const pool: CandidatePool = await runCandidateGenerators(
    {
      workspaceId: opts.workspaceId,
      query: opts.query,
      queryEmbeddings,
      limit: topK * 6,
      documentId: opts.documentId,
      documentIds: opts.documentIds,
      chunkTypes: route.structuralTypes.length > 0 ? undefined : undefined, // structural types are a *boost*, not a filter
      sectionPathPrefixes: route.preferredSections,
      signal: opts.signal,
    },
    {
      limits: limitOverrides,
      only: only ?? Array.from(new Set(route.sources.map((s) => s.source))),
      // Ablated legs are still reported, as `enabled: false`, so the trace shows the switch-off.
      excluded: Array.from(disabled),
    }
  )
  timings.generate = pool.latencyMs

  // Community pseudo-candidates are not chunks: pull them out before fusion.
  const communitySources = pool.rankedSources.filter((r) => r.source === "community")
  const chunkSources = pool.rankedSources.filter((r) => r.source !== "community")
  const globalContext = communitySources.flatMap((r) =>
    r.items
      .filter((i) => i.payload)
      .map((i) => (i.payload!.heading ? `— ${i.payload!.heading}: ${i.payload!.content}` : i.payload!.content))
  )

  // ---- 5. Fuse -----------------------------------------------------------
  t0 = Date.now()
  const fusionMethod: FusionMethod = ablation.fusionMethod ?? "weighted-rrf"
  const fused = fuseCandidates<RetrievalCandidate>(chunkSources, {
    method: fusionMethod,
    weights: fusionWeights,
    limit: DEFAULT_FUSION_POOL,
  })
  timings.fuse = Date.now() - t0

  // ---- 6. Diversity ------------------------------------------------------
  t0 = Date.now()
  const lambda = ablation.lambda ?? 0.8
  const poolSize = Math.min(topK * 4, fused.length)
  // Diversity runs on lexical Jaccard overlap (see `applyMMR`): the fused pool carries no
  // stored embeddings, and pretending otherwise would silently turn MMR into pure relevance.
  const pool_ = fused.slice(0, Math.max(poolSize * 2, poolSize)).filter((f) => f.payload)
  const lexicallyDiverse =
    lambda >= 1
      ? pool_.slice(0, poolSize)
      : applyMMR(
          pool_.map((f) => ({
            id: f.id,
            content: f.payload!.content,
            heading: f.payload!.heading,
            similarity: f.fusedScore,
          })),
          poolSize,
          lambda
        )
  const diverseById = new Map(pool_.map((f) => [f.id, f]))
  const orderedFused = lexicallyDiverse.map((c) => diverseById.get(c.id)).filter((f): f is FusedCandidate<RetrievalCandidate> => Boolean(f))
  timings.diversity = Date.now() - t0

  // ---- 7. Rerank ---------------------------------------------------------
  t0 = Date.now()
  const rerankPool = orderedFused.slice(0, Math.max(topK * 3, 12))
  const reranked = await rerankCandidates(
    opts.query,
    rerankPool.map((f) => ({ id: f.id, content: f.payload?.content ?? "", score: f.fusedScore, fused: f })),
    { limit: topK, useNeural: opts.useNeuralReranker !== false && !ablation.disableRerank, signal: opts.signal }
  )
  timings.rerank = Date.now() - t0

  const selectedCandidates: RetrievalCandidate[] = reranked.items.map((r) => r.fused.payload).filter((p): p is RetrievalCandidate => Boolean(p))
  const rerankScoreById = new Map(reranked.items.map((r) => [r.id, r.rerankScore]))

  // ---- 8. Expand to reading context --------------------------------------
  t0 = Date.now()
  const expansion = ablation.disableExpansion
    ? { retrieved: await toContextChunks(opts.workspaceId, selectedCandidates), parents: [], neighbors: [], related: [], totalChars: 0 }
    : await expandContext(opts.workspaceId, selectedCandidates, {
        expansionBudgetChars: maxContextChars,
        neighborWindow: route.expansion.neighborWindow,
        includeParents: route.expansion.includeParents,
        includeNeighbors: route.expansion.includeNeighbors,
        includeRelatedElements: route.expansion.includeRelatedElements,
        signal: opts.signal,
      })
  timings.expansion = Date.now() - t0

  // ---- 9. Assemble -------------------------------------------------------
  const sourcesById = new Map<string, RetrievalSource[]>()
  const perSourceById = new Map<string, Record<string, number>>()
  const graphConfById = new Map<string, number>()
  for (const f of fused) {
    sourcesById.set(f.id, f.sources.map((c) => c.source))
    perSourceById.set(
      f.id,
      Object.fromEntries(f.sources.map((c) => [c.source, Math.round(c.contribution * 1000) / 1000]))
    )
    const gc = f.payload?.meta?.graphConfidence
    if (typeof gc === "number") graphConfById.set(f.id, gc)
  }

  const toEvidenceChunk = (c: ContextChunk): EvidenceChunk => ({
    id: c.id,
    documentId: c.documentId,
    heading: c.heading,
    content: c.content,
    tokens: c.tokens,
    kind: c.kind,
    chunkType: c.chunkType,
    sectionPath: c.sectionPath,
    pageStart: c.pageStart,
    pageEnd: c.pageEnd,
    parentChunkId: c.parentChunkId,
    contextPrefix: c.contextPrefix ?? null,
    score: c.score ?? 0,
    rerankScore: rerankScoreById.get(c.id),
    sources: sourcesById.get(c.id) ?? [],
    perSourceScores: perSourceById.get(c.id) ?? {},
    role: c.role,
    graphConfidence: graphConfById.get(c.id),
  })

  const retrieved = expansion.retrieved.map(toEvidenceChunk)
  // Parents are the reading unit; retrieved children stay attached as the precise anchor.
  const parents = expansion.parents.map(toEvidenceChunk)
  const neighbors = expansion.neighbors.map(toEvidenceChunk)
  const related = expansion.related.map(toEvidenceChunk)
  const evidence = [...retrieved, ...parents, ...neighbors, ...related]

  const direct = expansion.retrieved
  let counter = selectCounterEvidence(expansion.retrieved, route.expectedCounterEvidence)

  // Active Counter-Evidence Retrieval (Phase 14):
  // When the criterion profile or query indicates a need for counter-evidence,
  // actively search for contradictory or limiting chunks beyond the passive pool.
  if (route.expectedCounterEvidence.length > 0 || route.structuralTypes.includes("citation")) {
    try {
      const { retrieveActiveCounterEvidence } = await import("./parent-context")
      const activeCounters = await retrieveActiveCounterEvidence(opts.workspaceId, opts.query, {
        documentId: opts.documentId,
        documentIds: opts.documentIds,
        limit: 4,
        patterns: route.expectedCounterEvidence,
      })
      if (activeCounters.length > 0) {
        const seenIds = new Set(counter.map((c) => c.id))
        for (const ac of activeCounters) {
          if (!seenIds.has(ac.id)) {
            counter.push(ac)
            seenIds.add(ac.id)
          }
        }
      }
    } catch {
      // Graceful fallback
    }
  }
  // Counter-evidence and citation blocks are ContextChunks (they carry the sibling links the
  // assembler renders), so they are selected from the expansion output, not from EvidenceChunk.
  const citationChunks = [...expansion.retrieved, ...expansion.neighbors, ...expansion.related].filter(
    (c) => c.chunkType === "citation"
  )

  const context = buildEvidenceContext({
    criterion: opts.criterionId ?? undefined,
    question: opts.query,
    expectedEvidence: route.expectedEvidence,
    direct,
    counter,
    graph: [],
    citation: citationChunks,
    numerical: [],
    priorArt: globalContext,
    uncertainties: route.expectedCounterEvidence,
    maxChars: maxContextChars,
  })

  // ---- Trace -------------------------------------------------------------
  const fusedRankById = new Map(fused.map((f, i) => [f.id, i + 1]))
  const sourceTrace: SourceTraceEntry[] = pool.results.map((r) => ({
    source: r.source,
    candidates: r.items.length,
    latencyMs: r.latencyMs,
    enabled: r.enabled,
    excludedByAblation: r.excludedByAblation,
    error: r.error,
    topCandidateId: r.items[0]?.id,
    fusedRank: r.items[0] ? fusedRankById.get(r.items[0].id) : undefined,
  }))

  const health = modelHealth
  const trace: RetrievalTrace = {
    pipeline: "multi-source",
    route: {
      category: route.category,
      confidence: Math.round(route.confidence * 100) / 100,
      profiles: route.profiles,
      signals: route.signals,
    },
    queryTransform: { applied: appliedTransforms, variants },
    fusion: {
      method: fusionMethod,
      weights: Object.fromEntries(Object.entries(fusionWeights).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      candidatesIn: pool.totalCandidates,
      candidatesOut: fused.length,
    },
    sources: sourceTrace,
    degraded: pool.degradedSources,
    ranking: {
      scorer: reranked.scorer,
      usedNeuralReranker: reranked.usedNeuralReranker,
      mmrLambda: lambda,
      error: reranked.error,
    },
    noveltyDrift: { triggered: false, maxSimilarity: null },
    expansion: {
      parents: expansion.parents.length,
      neighbors: expansion.neighbors.length,
      related: expansion.related.length,
      totalChars: expansion.totalChars,
    },
    embeddingModel: {
      id: health.embedding.model || "(not resolved)",
      healthy: health.embedding.lastError === null && health.embedding.fallbackCount === 0,
      dimensions: health.embedding.observedDimensions ?? health.embedding.declaredDimensions ?? null,
    },
    timings,
    totalLatencyMs: Date.now() - startedAt,
  }

  if (route.category === "novelty-prior-art" && queryEmbeddings.length > 0) {
    const drift = detectNoveltyDrift(
      queryEmbeddings,
      orderedFused.map((f) => ({ embedding: null }))
    )
    // Without stored embeddings on the fused pool the intra-corpus drift check cannot run;
    // report that honestly instead of asserting a novelty claim.
    trace.noveltyDrift = drift
  }

  return { evidence, context, route, trace, globalContext }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function toContextChunks(workspaceId: string, candidates: RetrievalCandidate[]): Promise<ContextChunk[]> {
  const { fetchContextChunksByIds } = await import("./parent-context")
  const fetched = await fetchContextChunksByIds(workspaceId, candidates.map((c) => c.id))
  return candidates.map((c) => {
    const chunk = fetched.get(c.id)
    if (chunk) return { ...chunk, role: "retrieved" as const, score: c.score }
    return {
      id: c.id,
      documentId: c.documentId,
      heading: c.heading,
      content: c.content,
      tokens: c.tokens,
      kind: c.kind,
      chunkType: c.chunkType,
      sectionPath: c.sectionPath,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      parentChunkId: c.parentChunkId,
      previousChunkId: c.previousChunkId,
      nextChunkId: c.nextChunkId,
      sourceElementIds: [],
      contextPrefix: c.contextPrefix ?? null,
      ordinal: 0,
      role: "retrieved" as const,
      score: c.score,
    }
  })
}

/**
 * Records one retrieval in the `RetrievalTrace` table.
 *
 * Best-effort: a failed INSERT must never fail a review, and the migration that creates the
 * table may not have been applied yet.
 */
export async function persistRetrievalTrace(
  workspaceId: string,
  input: {
    query: string
    criterionId?: string | null
    reviewId?: string | null
    trace: RetrievalTrace
    selectedEvidenceIds?: string[]
    graphNodeIds?: string[]
    communityIds?: string[]
    promptTokens?: number | null
  }
): Promise<string | null> {
  const t = input.trace
  try {
    await prisma.$executeRaw`
      INSERT INTO "RetrievalTrace" (
        id, "workspaceId", "reviewId", criterion, "queryCategory", query, route,
        "candidateCounts", ranking, "selectedEvidenceIds", "graphNodeIds", "communityIds",
        "promptTokens", "modelVersions", "stageLatencyMs", "totalLatencyMs", degraded, "createdAt"
      ) VALUES (
        ${cuid()}, ${workspaceId}, ${input.reviewId ?? null}, ${input.criterionId ?? null},
        ${t.route.category}, ${input.query},
        ${t.sources.filter((s) => s.enabled).map((s) => s.source).join("+")},
        ${JSON.stringify(Object.fromEntries(t.sources.map((s) => [s.source, s.candidates])))}::jsonb,
        ${JSON.stringify({ method: t.fusion.method, weights: t.fusion.weights, scorer: t.ranking.scorer, usedNeuralReranker: t.ranking.usedNeuralReranker, mmrLambda: t.ranking.mmrLambda })}::jsonb,
        ${input.selectedEvidenceIds ?? []}::text[],
        ${input.graphNodeIds ?? []}::text[],
        ${input.communityIds ?? []}::text[],
        ${input.promptTokens ?? null},
        ${JSON.stringify({ embeddingModel: t.embeddingModel.id, pipeline: t.pipeline })}::jsonb,
        ${JSON.stringify(t.timings)}::jsonb,
        ${t.totalLatencyMs},
        ${JSON.stringify(t.degraded)}::jsonb,
        NOW()
      )
    `
    return null
  } catch (err) {
    // A failed INSERT must never fail a review, and the table may not exist yet if the
    // migration has not been applied.
    console.warn("[hybrid-retrieval] could not persist retrieval trace:", err instanceof Error ? err.message : err)
    return err instanceof Error ? err.message : String(err)
  }
}

/** Local cuid-ish id so the trace INSERT does not depend on a generated Prisma default. */
function cuid(): string {
  return `rt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/** Exported for tests: the fusion weights the router produced for a route. */
export function routeWeights(route: RetrievalRoute): Record<string, number> {
  return Object.fromEntries(route.sources.map((s) => [s.source, s.weight]))
}

export { DEFAULT_CANDIDATE_LIMITS }
export type { FusedCandidate, RetrievalCandidate, ContextChunk, CandidatePool }
export { selectCounterEvidence }
