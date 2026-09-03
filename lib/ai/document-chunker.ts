/**
 * Semantic document chunker for thesis review RAG pipeline.
 *
 * Parses MinerU Markdown output into structured, semantically meaningful chunks
 * suitable for pgvector storage and hybrid search. Preserves the heading hierarchy,
 * section kind classification, and equation/table metadata.
 *
 * Optimised for:
 *  - BSc/MSc: shorter docs, moderate context budgets
 *  - PhD dissertations: very long docs (150+ pages), large chunks to preserve argument flow
 *  - Journal articles: title/abstract/section structure
 */

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { generateLocalEmbedding } from "@/lib/ai/local-embeddings"
import { extractAndStoreGraphEntities } from "./graph-extractor"
import { classifySectionKind, type SectionKind } from "@/lib/ai/thesis-context"
import { resolveChunkSize, CHUNK_OVERLAP } from "./chunking-config"
import { splitIntoSubchunks } from "./text-splitter"

export type { SectionKind }

// ---------------------------------------------------------------------------
// GraphRAG extraction guards
// ---------------------------------------------------------------------------

/**
 * GraphRAG entity extraction is ON by default (set GRAPH_RAG_ENABLED=false to
 * disable). It runs in the background, batched (3 chunks per LLM call), with a
 * per-request timeout, a per-document cap and a per-workspace daily cap so cost
 * stays bounded while cross-chapter (community) context is always available.
 */
const GRAPH_RAG_ENABLED = process.env.GRAPH_RAG_ENABLED !== "false"
/** Chunks shorter than this rarely yield meaningful academic entities. */
const GRAPH_EXTRACTION_MIN_CHARS = 400
/** Hard cap per document — bounds LLM extraction cost on 200k+ char PhD dissertations. */
const GRAPH_EXTRACTION_MAX_CHUNKS_PER_DOC = Number(process.env.GRAPH_RAG_MAX_CHUNKS_PER_DOC) || 90
/** Several adjacent chunks are merged into one extraction call (fewer, richer calls). */
const GRAPH_EXTRACTION_BATCH_CHUNKS = 3
/** Daily cap of extraction calls per workspace (in-process counter). */
const GRAPH_EXTRACTION_DAILY_CAP_PER_WORKSPACE = Number(process.env.GRAPH_RAG_DAILY_CAP) || 400
const graphDailyCounter = new Map<string, { day: string; count: number }>()

function graphBudgetRemaining(workspaceId: string): number {
  const day = new Date().toISOString().slice(0, 10)
  const entry = graphDailyCounter.get(workspaceId)
  if (!entry || entry.day !== day) {
    graphDailyCounter.set(workspaceId, { day, count: 0 })
    return GRAPH_EXTRACTION_DAILY_CAP_PER_WORKSPACE
  }
  return Math.max(0, GRAPH_EXTRACTION_DAILY_CAP_PER_WORKSPACE - entry.count)
}

function graphBudgetConsume(workspaceId: string, n: number): void {
  const day = new Date().toISOString().slice(0, 10)
  const entry = graphDailyCounter.get(workspaceId)
  if (!entry || entry.day !== day) graphDailyCounter.set(workspaceId, { day, count: n })
  else entry.count += n
}
/** Section kinds prioritized for entity extraction (thesis evaluation focus). */
const GRAPH_EXTRACTION_PRIORITY_KINDS = new Set([
  "methodology",
  "results",
  "literature_review",
  "introduction",
  "conclusion",
])

export interface DocumentChunkInput {
  workspaceId: string
  documentId: string   // matches the fileId from ingestion (IngestFile.id)
  heading: string | null
  headingPath?: string | null
  sectionKind: SectionKind
  content: string
  tokens: number
}

/** Split markdown text into semantic chunks based on heading hierarchy. */
export function chunkMarkdown(
  rawMarkdown: string,
  documentId: string,
  opts: {
    maxChunkChars?: number   // target max characters per chunk (default 2000)
    minChunkChars?: number   // skip chunks smaller than this (default 1)
    overlap?: number         // overlap between consecutive chunks in chars (default CHUNK_OVERLAP)
  } = {}
): Omit<DocumentChunkInput, "workspaceId">[] {
  const maxChunkChars = opts.maxChunkChars ?? 2000
  const minChunkChars = opts.minChunkChars ?? 1
  const overlap = opts.overlap ?? CHUNK_OVERLAP
  const markdown = rawMarkdown.replace(/\r\n/g, "\n")

  // Split on all heading lines (# / ## / ### etc.)
  const headingRegex = /^(#{1,4})\s+(.+)$/gm
  const splits: Array<{ level: number; heading: string; startIdx: number }> = []

  let match
  while ((match = headingRegex.exec(markdown)) !== null) {
    splits.push({
      level: match[1].length,
      heading: match[2].trim(),
      startIdx: match.index,
    })
  }

  const chunks: Omit<DocumentChunkInput, "workspaceId">[] = []

  const addChunk = (heading: string | null, headingPath: string | null, text: string) => {
    const trimmed = text.trim()
    if (trimmed.length < minChunkChars) return

    const sectionKind = heading ? classifySectionKind(heading, trimmed) : "unknown"

    const subchunks = splitIntoSubchunks(trimmed, maxChunkChars, overlap)

    if (subchunks.length === 1) {
      chunks.push({
        documentId,
        heading,
        headingPath,
        sectionKind,
        content: subchunks[0],
        tokens: Math.ceil(subchunks[0].length / 4), // approx 4 chars/token
      })
    } else {
      subchunks.forEach((slice, idx) => {
        chunks.push({
          documentId,
          heading: heading ? `${heading} [${idx + 1}]` : null,
          headingPath: headingPath ? `${headingPath} [${idx + 1}]` : null,
          sectionKind,
          content: slice,
          tokens: Math.ceil(slice.length / 4),
        })
      })
    }
  }

  if (splits.length === 0) {
    // No headings found — treat entire doc as one chunk stream
    addChunk(null, null, markdown)
    return chunks
  }

  // Add text before the first heading
  const preamble = markdown.slice(0, splits[0].startIdx)
  addChunk("Preamble", "Preamble", preamble)

  const headingStack: Array<{ level: number; heading: string }> = []

  for (let i = 0; i < splits.length; i++) {
    const { level, heading, startIdx } = splits[i]
    const endIdx = i + 1 < splits.length ? splits[i + 1].startIdx : markdown.length
    const sectionText = markdown.slice(startIdx, endIdx)
    // Remove the heading line itself from content
    const contentOnly = sectionText.replace(/^#{1,4}\s+.+\n?/, "").trim()

    while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
      headingStack.pop()
    }
    headingStack.push({ level, heading })
    const headingPath = headingStack.map((h) => h.heading).join(" > ")

    addChunk(heading, headingPath, contentOnly)
  }

  return chunks
}

/**
 * Runs GraphRAG entity extraction sequentially in the background (detached —
 * not awaited by the caller). Sequential execution keeps LLM extraction cost
 * predictable and never delays vector embedding, which finishes first and
 * unblocks the ingestion response.
 */
function runGraphExtractionQueue(
  workspaceId: string,
  documentId: string,
  candidates: Array<{ sectionKind: string; content: string }>
): void {
  ;(async () => {
    // Merge adjacent chunks into batches → fewer, richer extraction calls.
    const batches: string[] = []
    for (let i = 0; i < candidates.length; i += GRAPH_EXTRACTION_BATCH_CHUNKS) {
      batches.push(candidates.slice(i, i + GRAPH_EXTRACTION_BATCH_CHUNKS).map((c) => c.content).join("\n\n"))
    }
    const allowed = Math.min(batches.length, graphBudgetRemaining(workspaceId))
    if (allowed < batches.length) {
      console.warn(`[GraphRAG] Daily extraction cap reached for workspace ${workspaceId}: running ${allowed}/${batches.length} batches`)
    }
    graphBudgetConsume(workspaceId, allowed)
    let extracted = 0
    for (const batch of batches.slice(0, allowed)) {
      try {
        const res = await extractAndStoreGraphEntities(workspaceId, documentId, batch)
        if (res && (res.nodes > 0 || res.edges > 0)) extracted++
      } catch (err) {
        console.error("[GraphRAG] Background extraction failed:", err)
      }
    }
    if (extracted > 0) {
      console.log(`[GraphRAG] Extracted entities from ${extracted}/${allowed} batches (doc ${documentId})`)
    }
  })().catch(() => {})
}

/**
 * Ingest a MinerU-parsed Markdown file into DocumentChunk table with embeddings.
 * Called after successful MinerU parse in the ingestion pipeline.
 *
 * Uses concurrency control to avoid OOM on large dissertations.
 * Returns `graphQueued` — number of chunks queued for background GraphRAG
 * entity extraction (runs detached; not part of the synchronous return path).
 *
 * @param opts.ingestFileId  Optional IngestFile.id to track vectorStatus in DB.
 *                           When provided, status is updated:
 *                           pending → indexing (on start), then ready/error (on finish).
 */
export async function ingestDocumentChunks(
  workspaceId: string,
  documentId: string,
  markdown: string,
  opts: { maxChunkChars?: number; concurrency?: number; ingestFileId?: string } = {}
): Promise<{ chunksCreated: number; skipped: number; graphQueued: number }> {
  const concurrency = opts.concurrency ?? 3

  // Mark indexing started (non-fatal if IngestFile row doesn't exist)
  if (opts.ingestFileId) {
    try {
      await prisma.ingestFile.updateMany({
        where: { id: opts.ingestFileId, workspaceId },
        data: { vectorStatus: "indexing" },
      })
    } catch { /* non-fatal */ }
  }

  const rawChunks = chunkMarkdown(markdown, documentId, opts)

  let chunksCreated = 0
  let skipped = 0
  const graphCandidates: Array<{ sectionKind: string; content: string }> = []
  const prepared: Array<{ heading: string | null; content: string; tokens: number; embeddingStr: string }> = []

  // Phase 1 — embed everything first (WASM, slow). The old chunks stay in
  // place meanwhile, so a review started during a reindex still retrieves
  // from the previous index instead of an empty one.
  for (let i = 0; i < rawChunks.length; i += concurrency) {
    const batch = rawChunks.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async (chunk) => {
        try {
          const contextHeading = chunk.headingPath || chunk.heading
          const embedding = await generateLocalEmbedding(
            // Prepend hierarchical heading path for rich contextual semantic embedding
            contextHeading
              ? `${contextHeading}: ${chunk.content}`
              : chunk.content
          )
          prepared.push({
            heading: chunk.heading,
            content: chunk.content,
            tokens: chunk.tokens,
            embeddingStr: `[${embedding.join(",")}]`,
          })
          if (GRAPH_RAG_ENABLED && chunk.content.length >= GRAPH_EXTRACTION_MIN_CHARS) {
            graphCandidates.push({ sectionKind: chunk.sectionKind, content: chunk.content })
          }
        } catch (err) {
          console.error(`[VectorRAG] Failed to embed chunk "${chunk.heading}":`, err)
          skipped++
        }
      })
    )
  }

  // Phase 2 — atomic swap: delete old chunks and insert the new ones in one
  // transaction (re-ingest is idempotent; readers see either old or new set).
  if (prepared.length > 0) {
    const INSERT_BATCH = 50
    await prisma.$transaction(async (tx) => {
      await tx.documentChunk.deleteMany({ where: { workspaceId, documentId } })
      for (let i = 0; i < prepared.length; i += INSERT_BATCH) {
        const slice = prepared.slice(i, i + INSERT_BATCH)
        const values = slice.map(
          (c) => Prisma.sql`(gen_random_uuid(), ${workspaceId}, ${documentId}, ${c.heading}, ${c.content}, ${c.tokens}, ${c.embeddingStr}::vector, NOW())`
        )
        await tx.$executeRaw`
          INSERT INTO "DocumentChunk" (id, "workspaceId", "documentId", heading, content, tokens, embedding, "createdAt")
          VALUES ${Prisma.join(values)}
        `
        chunksCreated += slice.length
      }
    }, { timeout: 120_000 })
  } else {
    // Nothing could be embedded — keep the previous index rather than wiping it.
    console.warn(`[VectorRAG] No chunks embedded for ${workspaceId}/${documentId}; previous index left untouched`)
  }

  // Detached GraphRAG extraction: priority section kinds first, capped per doc
  let graphQueued = 0
  if (GRAPH_RAG_ENABLED && graphCandidates.length > 0) {
    const prioritized = [
      ...graphCandidates.filter((c) => GRAPH_EXTRACTION_PRIORITY_KINDS.has(c.sectionKind)),
      ...graphCandidates.filter((c) => !GRAPH_EXTRACTION_PRIORITY_KINDS.has(c.sectionKind)),
    ].slice(0, GRAPH_EXTRACTION_MAX_CHUNKS_PER_DOC)
    graphQueued = prioritized.length
    runGraphExtractionQueue(workspaceId, documentId, prioritized)
  }

  // Mark indexing complete
  if (opts.ingestFileId) {
    try {
      await prisma.ingestFile.updateMany({
        where: { id: opts.ingestFileId, workspaceId },
        data: {
          vectorStatus: skipped > 0 && chunksCreated === 0 ? "error" : "ready",
          vectorChunks: chunksCreated,
          vectorIndexedAt: new Date(),
        },
      })
    } catch { /* non-fatal */ }
  }

  return { chunksCreated, skipped, graphQueued }
}
