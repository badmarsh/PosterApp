/**
 * GET /api/workspaces/[id]/thesis-review/rag-stats
 *
 * Returns pgvector RAG diagnostics for the workspace:
 *  - Total indexed chunks & documents
 *  - Average token count per chunk
 *  - Whether the HNSW index exists
 *  - Per-document breakdown (documentId → chunkCount, lastIngestedAt)
 *  - Optional: live hybrid search preview (query param ?q=...)
 *
 * POST /api/workspaces/[id]/thesis-review/rag-stats
 * Body: { query: string }  →  runs hybrid search and returns top-5 chunks
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { retrieveForCriterion } from "@/lib/ai/vector-rag"
import { getEmbeddingCacheStats } from "@/lib/ai/local-embeddings"

// ---------------------------------------------------------------------------
// GET — index diagnostics
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  try {
    await requireWorkspaceEditor(workspaceId)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 1. Fetch active IngestFiles for this workspace
  const ingestFiles = await prisma.ingestFile.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
  })
  const activeDocIds = ingestFiles.map((f) => f.id)

  // 2. Asynchronously cleanup any orphaned chunks or graph nodes for deleted files
  if (activeDocIds.length > 0) {
    await prisma.documentChunk.deleteMany({
      where: {
        workspaceId,
        documentId: { notIn: activeDocIds },
      },
    }).catch(() => {})

    await prisma.graphNode.deleteMany({
      where: {
        workspaceId,
        documentId: { notIn: activeDocIds },
      },
    }).catch(() => {})
  } else {
    await prisma.documentChunk.deleteMany({ where: { workspaceId } }).catch(() => {})
    await prisma.graphNode.deleteMany({ where: { workspaceId } }).catch(() => {})
  }

  // 3. Aggregate stats per document (strictly for active files)
  const rows = activeDocIds.length > 0 ? await prisma.$queryRaw<
    Array<{
      documentId: string
      chunkCount: bigint
      avgTokens: number
      lastCreated: Date
      embeddedCount: bigint
    }>
  >`
    SELECT
      "documentId",
      COUNT(*)                                            AS "chunkCount",
      ROUND(AVG(tokens))::int                             AS "avgTokens",
      MAX("createdAt")                                    AS "lastCreated",
      COUNT(*) FILTER (WHERE embedding IS NOT NULL)       AS "embeddedCount"
    FROM "DocumentChunk"
    WHERE "workspaceId" = ${workspaceId}
      AND "documentId" IN (${Prisma.join(activeDocIds)})
    GROUP BY "documentId"
    ORDER BY MAX("createdAt") DESC
  ` : []

  const totalChunks = rows.reduce((s, r) => s + Number(r.chunkCount), 0)
  const totalEmbedded = rows.reduce((s, r) => s + Number(r.embeddedCount), 0)
  // Weighted by each document's chunk count. Averaging the per-document
  // averages directly (as before) skews the result toward documents with
  // fewer chunks whenever chunk counts differ significantly across documents
  // — e.g. one 5-chunk doc averaging 1000 tok/chunk and one 500-chunk doc
  // averaging 100 tok/chunk would previously report ~550 instead of ~109.
  const avgTokens =
    totalChunks > 0
      ? Math.round(rows.reduce((s, r) => s + r.avgTokens * Number(r.chunkCount), 0) / totalChunks)
      : 0

  // Check if HNSW index exists
  const indexCheck = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'DocumentChunk'
      AND indexname = 'document_chunk_embedding_hnsw'
  `
  const hnswReady = indexCheck.length > 0

  // GraphRAG knowledge graph statistics (active documents only)
  const graphNodeWhere = activeDocIds.length > 0
    ? { workspaceId, documentId: { in: activeDocIds } }
    : { workspaceId }
  const [graphNodeCount, graphEdgeCount, graphLabelGroups, graphDocs] = await Promise.all([
    prisma.graphNode.count({ where: graphNodeWhere }),
    prisma.graphEdge.count({
      where: activeDocIds.length > 0
        ? { workspaceId, source: { documentId: { in: activeDocIds } } }
        : { workspaceId },
    }),
    prisma.graphNode.groupBy({ by: ["label"], where: graphNodeWhere, _count: { _all: true } }),
    prisma.graphNode.findMany({
      where: graphNodeWhere,
      select: { documentId: true },
      distinct: ["documentId"],
    }),
  ])
  const graphStats = {
    nodeCount: graphNodeCount,
    edgeCount: graphEdgeCount,
    documentsCovered: graphDocs.length,
    topLabels: graphLabelGroups
      .map((g) => ({ label: g.label, count: g._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  }

  // Resolve IngestFile names and detected topics for display
  const docIds = rows.map((r) => r.documentId)
  const nameById: Record<string, string> = {}
  for (const f of ingestFiles) nameById[f.id] = f.name

  // Detect document topic / title from DocumentChunk headings or source markdown
  const topicById: Record<string, string> = {}
  if (docIds.length > 0) {
    try {
      const docTopics = await prisma.$queryRaw<Array<{ documentId: string; heading: string }>>`
        SELECT DISTINCT ON ("documentId") "documentId", "heading"
        FROM "DocumentChunk"
        WHERE "workspaceId" = ${workspaceId}
          AND "heading" IS NOT NULL
          AND LENGTH(TRIM("heading")) > 4
        ORDER BY "documentId", "createdAt" ASC
      `
      for (const dt of docTopics) {
        if (dt.heading && dt.heading.trim().length > 3) {
          topicById[dt.documentId] = dt.heading.trim()
        }
      }
    } catch {}

    // Fallback: check sources/<docId>.md
    for (const docId of docIds) {
      if (!topicById[docId]) {
        try {
          const srcPath = path.join(process.cwd(), "workspaces", workspaceId, "sources", `${docId}.md`)
          if (fs.existsSync(srcPath)) {
            const raw = fs.readFileSync(srcPath, "utf-8").slice(0, 4000)
            const match = raw.match(/^#\s+(.+)$/m) || raw.match(/^[A-ZÁ-Ž0-9\s]{6,80}$/m)
            if (match) {
              const cand = (match[1] || match[0]).trim()
              if (cand.length > 4 && !/^zaverecna\s+prace?$/i.test(cand)) {
                topicById[docId] = cand
              }
            }
          }
        } catch {}
      }
    }
  }

  const documents = rows.map((r) => ({
    documentId: r.documentId,
    name: nameById[r.documentId] ?? r.documentId,
    detectedTopic: topicById[r.documentId] ?? null,
    chunkCount: Number(r.chunkCount),
    embeddedCount: Number(r.embeddedCount),
    avgTokens: r.avgTokens,
    lastIngestedAt: r.lastCreated,
  }))

  return NextResponse.json({
    workspaceId,
    totalChunks,
    totalEmbedded,
    totalDocuments: rows.length,
    avgTokensPerChunk: avgTokens,
    hnswIndexReady: hnswReady,
    embeddingModel: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    embeddingDimensions: 384,
    embeddingCacheStats: getEmbeddingCacheStats(),
    graphStats,
    documents,
  })
}

// ---------------------------------------------------------------------------
// POST — live hybrid search preview
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(
    `${userId}:${workspaceId}:rag-search`,
    20,
    60_000
  )
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limited — try again in ${Math.ceil(retryAfterMs / 1000)}s` },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const query = typeof body.query === "string" ? body.query.trim() : ""

  if (!query || query.length < 3) {
    return NextResponse.json({ error: "query too short" }, { status: 400 })
  }
  if (query.length > 500) {
    return NextResponse.json({ error: "query too long" }, { status: 400 })
  }

  const { chunks } = await retrieveForCriterion(workspaceId, query, {
    topK: 5,
    lambda: 0.7,
    useHyDE: true,
    compress: false, // don't compress in preview so user sees full chunk
  })

  const results = chunks.map((c) => ({
    id: c.id,
    heading: c.heading,
    snippet: c.content.slice(0, 300),
    similarity: Math.round((c.relevanceScore ?? 0) * 1000) / 1000,
    tokens: c.tokens ?? null,
  }))

  return NextResponse.json({ query, results })
}
