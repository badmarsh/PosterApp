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
import { requireWorkspaceEditor } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { searchHybrid, rerankChunks } from "@/lib/ai/vector-rag"

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

  // Aggregate stats per document
  const rows = await prisma.$queryRaw<
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
    GROUP BY "documentId"
    ORDER BY MAX("createdAt") DESC
  `

  const totalChunks = rows.reduce((s, r) => s + Number(r.chunkCount), 0)
  const totalEmbedded = rows.reduce((s, r) => s + Number(r.embeddedCount), 0)
  const avgTokens =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.avgTokens, 0) / rows.length)
      : 0

  // Check if HNSW index exists
  const indexCheck = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'DocumentChunk'
      AND indexname = 'document_chunk_embedding_hnsw'
  `
  const hnswReady = indexCheck.length > 0

  // Resolve IngestFile names for display
  const docIds = rows.map((r) => r.documentId)
  const ingestFiles =
    docIds.length > 0
      ? await prisma.ingestFile.findMany({
          where: { workspaceId, id: { in: docIds } },
          select: { id: true, name: true },
        })
      : []
  const nameById: Record<string, string> = {}
  for (const f of ingestFiles) nameById[f.id] = f.name

  const documents = rows.map((r) => ({
    documentId: r.documentId,
    name: nameById[r.documentId] ?? r.documentId,
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

  const authError = await requireWorkspaceEditor(req, workspaceId)
  if (authError) return authError

  const body = await req.json().catch(() => ({}))
  const query = typeof body.query === "string" ? body.query.trim() : ""

  if (!query || query.length < 3) {
    return NextResponse.json({ error: "query too short" }, { status: 400 })
  }
  if (query.length > 500) {
    return NextResponse.json({ error: "query too long" }, { status: 400 })
  }

  const raw = await searchHybrid(workspaceId, query, 10)
  const reranked = await rerankChunks(query, raw)

  const results = reranked.slice(0, 5).map((c) => ({
    id: c.id,
    heading: c.heading,
    snippet: c.content.slice(0, 300),
    similarity: Math.round((c.relevanceScore ?? 0) * 1000) / 1000,
    tokens: (c as any).tokens ?? null,
  }))

  return NextResponse.json({ query, results })
}
