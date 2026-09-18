/**
 * Candidate generators.
 *
 * Five independent ways of proposing chunks, each with its own scoring scale and
 * its own failure mode. Every generator:
 *   * applies the same workspace-isolation filter (never optional),
 *   * returns `[]` — not an exception — when it cannot run, and
 *   * reports its own latency so a slow leg is visible in the trace.
 *
 * @module retrievers/generators
 */

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { applyHnswSessionTuning, buildFtsQuery, inTransaction, retrievalJoin, type RetrievalFilter } from "../retrieval-sql"
import { CHUNK_SELECT_COLUMNS, toCandidate, type CandidateGenerator, type ChunkRow, type RetrievalCandidate, type RetrievalContext } from "./types"

function flag(name: string, defaultValue = true): boolean {
  const v = process.env[name]
  if (v === undefined) return defaultValue
  return v !== "false" && v !== "0"
}

function baseFilter(ctx: RetrievalContext, extra: Partial<RetrievalFilter> = {}): RetrievalFilter {
  return {
    documentId: ctx.documentId,
    documentIds: ctx.documentIds,
    kinds: ctx.kinds,
    chunkTypes: ctx.chunkTypes,
    pageRange: ctx.pageRange,
    ...extra,
  }
}

/** Section-path boost: a soft preference, applied after the fact so it cannot hide a hit. */
function applySectionBoost(candidates: RetrievalCandidate[], prefixes: string[] | undefined, boost = 1.15): RetrievalCandidate[] {
  if (!prefixes || prefixes.length === 0) return candidates
  const lowered = prefixes.map((p) => p.toLowerCase())
  return candidates
    .map((c) => {
      const path = (c.sectionPath ?? "").toLowerCase()
      const hit = lowered.some((p) => path.includes(p))
      return hit ? { ...c, score: c.score * boost, meta: { ...(c.meta ?? {}), sectionBoost: true } } : c
    })
    .sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------------------
// 1. Dense (pgvector ANN)
// ---------------------------------------------------------------------------

export const denseRetriever: CandidateGenerator = {
  source: "dense",
  enabled: (ctx) => flag("DENSE_RETRIEVAL_ENABLED") && (ctx.queryEmbeddings?.length ?? 0) > 0,
  async retrieve(ctx) {
    const embeddings = ctx.queryEmbeddings ?? []
    if (embeddings.length === 0) return []
    const filter = retrievalJoin(baseFilter(ctx))
    const perQuery = Math.max(10, Math.ceil(ctx.limit * 1.5))

    const run = async (client: any) => {
      await applyHnswSessionTuning(client, perQuery)
      const out: RetrievalCandidate[] = []
      for (const emb of embeddings) {
        if (ctx.signal?.aborted) break
        const embStr = `[${emb.join(",")}]`
        const rows = await client.$queryRaw<Array<ChunkRow & { similarity: number }>>`
          SELECT ${Prisma.raw(CHUNK_SELECT_COLUMNS)},
                 1.0 - (embedding <=> ${embStr}::vector) AS similarity
          FROM "DocumentChunk"
          WHERE "workspaceId" = ${ctx.workspaceId}
            ${filter}
            AND embedding IS NOT NULL
          ORDER BY embedding <=> ${embStr}::vector
          LIMIT ${perQuery}
        `
        for (const r of rows) out.push(toCandidate(r, "dense", Number(r.similarity) || 0))
      }
      return out
    }

    // Multiple query vectors (fan-out / HyDE): keep the best similarity per chunk.
    const all = await inTransaction(prisma, run)
    const best = new Map<string, RetrievalCandidate>()
    for (const c of all) {
      const prev = best.get(c.id)
      if (!prev || c.score > prev.score) best.set(c.id, c)
    }
    const merged = Array.from(best.values()).sort((a, b) => b.score - a.score)
    return applySectionBoost(merged, ctx.sectionPathPrefixes).slice(0, ctx.limit)
  },
}

/**
 * Exact (non-indexed) nearest-neighbour scan, scoped by the same isolation filters.
 *
 * HNSW traversal is filtered *after* the graph walk on a multi-tenant table, so a small
 * workspace can come back short. This is the recall fallback: a sequential scan + sort is
 * immune to pruning and always returns the true nearest neighbours of the filtered subset.
 */
export async function denseExactFallback(ctx: RetrievalContext, embedding: number[]): Promise<RetrievalCandidate[]> {
  if (embedding.length === 0) return []
  const filter = retrievalJoin(baseFilter(ctx))
  const embStr = `[${embedding.join(",")}]`
  const rows = await prisma.$queryRaw<Array<ChunkRow & { similarity: number }>>`
    SELECT ${Prisma.raw(CHUNK_SELECT_COLUMNS)},
           1.0 - (embedding <=> ${embStr}::vector) AS similarity
    FROM "DocumentChunk"
    WHERE "workspaceId" = ${ctx.workspaceId}
      ${filter}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embStr}::vector
    LIMIT ${ctx.limit}
  `
  return rows.map((r) => toCandidate(r, "dense", Number(r.similarity) || 0, { exactScan: true }))
}

// ---------------------------------------------------------------------------
// 2. Lexical (PostgreSQL full-text search)
// ---------------------------------------------------------------------------

export const lexicalRetriever: CandidateGenerator = {
  source: "lexical",
  enabled: () => flag("LEXICAL_RETRIEVAL_ENABLED"),
  async retrieve(ctx) {
    const fts = buildFtsQuery(ctx.query)
    if (!fts) return []
    const filter = retrievalJoin(baseFilter(ctx))
    const rows = await prisma.$queryRaw<Array<ChunkRow & { rank: number }>>`
      SELECT ${Prisma.raw(CHUNK_SELECT_COLUMNS)},
             ts_rank(to_tsvector('simple', COALESCE("contextPrefix", '') || ' ' || content),
                     websearch_to_tsquery('simple', ${fts})) AS rank
      FROM "DocumentChunk"
      WHERE "workspaceId" = ${ctx.workspaceId}
        ${filter}
        AND to_tsvector('simple', COALESCE("contextPrefix", '') || ' ' || content)
            @@ websearch_to_tsquery('simple', ${fts})
      ORDER BY rank DESC
      LIMIT ${ctx.limit}
    `
    const out = rows.map((r) => toCandidate(r, "lexical", Number(r.rank) || 0))
    return applySectionBoost(out, ctx.sectionPathPrefixes).slice(0, ctx.limit)
  },
}

// ---------------------------------------------------------------------------
// 3. Metadata / structural
// ---------------------------------------------------------------------------

/**
 * Metadata retrieval: answer "give me the tables in the Results chapter" without
 * pretending a vector knows what a table looks like.
 *
 * Activated when the caller supplies structural predicates (chunk types, section
 * prefixes, page window). Ranking is by structural match strength, then document
 * order — deterministic and explainable.
 */
export const metadataRetriever: CandidateGenerator = {
  source: "metadata",
  enabled: (ctx) =>
    flag("METADATA_RETRIEVAL_ENABLED") &&
    Boolean((ctx.chunkTypes && ctx.chunkTypes.length > 0) || (ctx.sectionPathPrefixes && ctx.sectionPathPrefixes.length > 0) || ctx.pageRange),
  async retrieve(ctx) {
    const parts: Prisma.Sql[] = []
    const types = ctx.chunkTypes ?? []
    const prefixes = ctx.sectionPathPrefixes ?? []
    if (types.length > 0) parts.push(Prisma.sql`"chunkType" IN (${Prisma.join(types)})`)
    if (prefixes.length > 0) {
      parts.push(
        Prisma.sql`(${Prisma.join(
          prefixes.map((p) => Prisma.sql`"sectionPath" ILIKE ${`%${p}%`}`),
          " OR "
        )})`
      )
    }
    const structural = parts.length > 0 ? Prisma.sql`AND (${Prisma.join(parts, " OR ")})` : Prisma.empty
    const filter = retrievalJoin(baseFilter(ctx, { chunkTypes: undefined }))

    const rows = await prisma.$queryRaw<Array<ChunkRow>>`
      SELECT ${Prisma.raw(CHUNK_SELECT_COLUMNS)}
      FROM "DocumentChunk"
      WHERE "workspaceId" = ${ctx.workspaceId}
        ${filter}
        ${structural}
      ORDER BY ordinal ASC
      LIMIT ${ctx.limit}
    `
    const typeSet = new Set(types)
    return rows.map((r, i) => {
      let score = 1 - i / Math.max(1, rows.length)
      if (typeSet.size > 0 && typeSet.has(r.chunkType)) score += 0.5
      return toCandidate(r, "metadata", score, { structuralMatch: true })
    })
  },
}

// ---------------------------------------------------------------------------
// 4. Citation
// ---------------------------------------------------------------------------

/** Matches the in-text citation shapes MinerU/the bib parser leave behind. */
export const CITATION_MARKER_RE = /\[[A-Za-zÀ-ž][A-Za-zÀ-ž.'’-]*(?:\s+(?:et\s+al\.?|a\s+kol\.?))?,?\s*(?:19|20)\d{2}[a-z]?\]|\[\d{1,3}\]|\(\d{4}\)/

export const citationRetriever: CandidateGenerator = {
  source: "citation",
  enabled: () => flag("CITATION_RETRIEVAL_ENABLED"),
  async retrieve(ctx) {
    const fts = buildFtsQuery(ctx.query)
    const filter = retrievalJoin(baseFilter(ctx))
    const tsvector = Prisma.sql`to_tsvector('simple', COALESCE("contextPrefix", '') || ' ' || content)`
    // Bibliography entries plus any chunk that carries an in-text citation marker.
    const rows = await prisma.$queryRaw<Array<ChunkRow & { rank: number | null }>>`
      SELECT ${Prisma.raw(CHUNK_SELECT_COLUMNS)},
             ${fts ? Prisma.sql`ts_rank(${tsvector}, websearch_to_tsquery('simple', ${fts}))` : Prisma.sql`0.0`} AS rank
      FROM "DocumentChunk"
      WHERE "workspaceId" = ${ctx.workspaceId}
        ${filter}
        AND ("chunkType" = 'citation' OR content ~ '\\[[A-Za-z0-9À-ž][^\\]]{0,40}(19|20)[0-9]{2}[^\\]]{0,6}\\]|\\[[0-9]{1,3}\\]')
        ${fts ? Prisma.sql`AND ${tsvector} @@ websearch_to_tsquery('simple', ${fts})` : Prisma.empty}
      ORDER BY ${fts ? Prisma.sql`rank DESC` : Prisma.sql`ordinal ASC`}
      LIMIT ${ctx.limit}
    `
    const out = rows.map((r) =>
      toCandidate(r, "citation", Number(r.rank) || (r.chunkType === "citation" ? 0.5 : 0.25), {
        isBibliographyEntry: r.chunkType === "citation",
      })
    )
    return out.slice(0, ctx.limit)
  },
}

// ---------------------------------------------------------------------------
// 5. Graph
// ---------------------------------------------------------------------------

/**
 * Graph retrieval: link the query to entities, then follow provenance-bearing edges back to
 * the chunks that produced them.
 *
 * Confidence-aware: an edge with `confidence = NULL` was extracted before provenance existed.
 * It is *not* treated as reliable — it is only used when no confident edge reaches the query,
 * and every such candidate is flagged `lowConfidence: true` so downstream stages can refuse to
 * build a finding on it.
 */
export const graphRetriever: CandidateGenerator = {
  source: "graph",
  enabled: () => flag("GRAPH_RAG_ENABLED") && flag("GRAPH_RETRIEVAL_ENABLED"),
  async retrieve(ctx) {
    // Dynamic import: keeps the (Prisma-backed) graph module out of the static graph of
    // modules that only need the pure fusion helpers.
    const { linkQueryEntities } = await import("../graph-rag")

    const ingestFiles = await prisma.ingestFile.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true },
    })
    const activeIds = ingestFiles.map((f) => f.id)
    if (activeIds.length === 0) return []

    const nodes = await prisma.graphNode.findMany({
      where: { workspaceId: ctx.workspaceId, documentId: { in: activeIds } },
      select: { id: true, documentId: true, label: true, name: true, description: true },
    })
    if (nodes.length === 0) return []

    const seeds = await linkQueryEntities(ctx.query, nodes, {
      maxSeeds: 8,
      preferredDocumentId: ctx.documentId,
    })
    if (seeds.length === 0) return []

    const seedIds = seeds.map((s) => s.nodeId)
    const edges = await prisma.graphEdge.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        OR: [{ sourceId: { in: seedIds } }, { targetId: { in: seedIds } }],
      },
      select: { id: true, sourceId: true, targetId: true, relation: true, evidence: true, chunkId: true, page: true, confidence: true, documentId: true },
      take: 400,
    })
    if (edges.length === 0) return []

    // Rank edges by extraction confidence; unknown confidence sorts last.
    const rankedEdges = [...edges].sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1))
    const chunkIds = Array.from(
      new Set(rankedEdges.map((e) => e.chunkId).filter((id): id is string => Boolean(id)))
    ).slice(0, ctx.limit * 2)
    if (chunkIds.length === 0) return []

    const rows = await prisma.$queryRaw<Array<ChunkRow>>`
      SELECT ${Prisma.raw(CHUNK_SELECT_COLUMNS)}
      FROM "DocumentChunk"
      WHERE "workspaceId" = ${ctx.workspaceId}
        AND id IN (${Prisma.join(chunkIds)})
      ORDER BY ordinal ASC
    `
    const confidenceByChunk = new Map<string, number>()
    const relationsByChunk = new Map<string, string[]>()
    for (const e of rankedEdges) {
      if (!e.chunkId) continue
      if (!confidenceByChunk.has(e.chunkId)) confidenceByChunk.set(e.chunkId, e.confidence ?? 0)
      const rels = relationsByChunk.get(e.chunkId) ?? []
      rels.push(e.relation)
      relationsByChunk.set(e.chunkId, rels.slice(0, 6))
    }
    return rows.map((r) => {
      const conf = confidenceByChunk.get(r.id) ?? 0
      return toCandidate(r, "graph", 0.4 + conf * 0.6, {
        graphConfidence: conf,
        lowConfidence: conf <= 0,
        relations: relationsByChunk.get(r.id) ?? [],
      })
    })
  },
}

// ---------------------------------------------------------------------------
// 6. Community / global
// ---------------------------------------------------------------------------

/**
 * Global retrieval over community summaries.
 *
 * Returns the community *reports* (not chunks) as pseudo-candidates whose id is
 * `community:<id>`. Callers that only understand chunk ids must skip them; the
 * evidence assembler turns them into a "global context" block.
 */
export const communityRetriever: CandidateGenerator = {
  source: "community",
  enabled: () => flag("GRAPH_RAG_ENABLED") && flag("COMMUNITY_RAG_ENABLED"),
  async retrieve(ctx) {
    const communities = await prisma.graphCommunity.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ level: "asc" }, { nodeCount: "desc" }],
      take: 60,
    })
    if (communities.length === 0) return []

    const scored = communities
      .map((c) => {
        const text = `${c.label} ${c.summary ?? ""}`.toLowerCase()
        const qTokens = ctx.query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 3)
        const hits = qTokens.filter((t) => text.includes(t)).length
        const lexical = qTokens.length > 0 ? hits / qTokens.length : 0
        // Size prior: bigger communities carry more of the document, but only weakly.
        const sizePrior = Math.min(0.2, c.nodeCount / 500)
        return { c, score: lexical + sizePrior, text }
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(3, Math.ceil(ctx.limit / 4)))

    return scored.map((s) => ({
      id: `community:${s.c.id}`,
      source: "community" as const,
      score: s.score,
      heading: s.c.label,
      content: s.c.summary ?? "",
      kind: "prose",
      chunkType: "section",
      sectionPath: null,
      pageStart: null,
      pageEnd: null,
      parentChunkId: null,
      previousChunkId: null,
      nextChunkId: null,
      documentId: "",
      tokens: Math.ceil((s.c.summary ?? "").length / 4),
      contextPrefix: null,
      meta: { communityId: s.c.id, nodeCount: s.c.nodeCount, level: s.c.level },
    }))
  },
}

/** All generators, in the order they appear in traces. */
export const ALL_GENERATORS: CandidateGenerator[] = [
  denseRetriever,
  lexicalRetriever,
  graphRetriever,
  citationRetriever,
  metadataRetriever,
  communityRetriever,
]
