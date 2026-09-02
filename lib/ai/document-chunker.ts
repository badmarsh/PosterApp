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
import { generateLocalEmbedding } from "@/lib/ai/local-embeddings"
import { extractAndStoreGraphEntities } from "./graph-extractor"
import { classifySectionKind, type SectionKind } from "@/lib/ai/thesis-context"
import { resolveChunkSize } from "./chunking-config"

export type { SectionKind }

// ---------------------------------------------------------------------------
// GraphRAG extraction guards
// ---------------------------------------------------------------------------

const GRAPH_RAG_ENABLED = process.env.GRAPH_RAG_ENABLED !== "false"
/** Chunks shorter than this rarely yield meaningful academic entities. */
const GRAPH_EXTRACTION_MIN_CHARS = 400
/** Hard cap per document — bounds LLM extraction cost on 200k+ char PhD dissertations. */
const GRAPH_EXTRACTION_MAX_CHUNKS_PER_DOC = 60
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

/**
 * Splits text that exceeds maxChars into overlapping subchunks while respecting
 * natural sentence (.!?) and paragraph boundaries where possible.
 */
function splitIntoSubchunks(
  text: string,
  maxChars: number,
  overlapChars: number
): string[] {
  if (text.length <= maxChars) return [text]

  // First try splitting into logical paragraphs or sentences
  const sentencePattern = /[^.!?\n]+(?:[.!?\n]+(?:\s+|$)|$)/g
  const rawSentences = text.match(sentencePattern) || [text]
  const sentences = rawSentences.map((s) => s.trim()).filter((s) => s.length > 0)

  // Fallback for single giant token / unbroken block without punctuation
  if (sentences.length <= 1) {
    const subchunks: string[] = []
    let pos = 0
    while (pos < text.length) {
      const slice = text.slice(pos, pos + maxChars)
      subchunks.push(slice)
      pos += Math.max(1, maxChars - overlapChars)
      if (pos >= text.length) break
    }
    return subchunks
  }

  const subchunks: string[] = []
  let currentBuffer: string[] = []
  let currentLen = 0

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (currentBuffer.length > 0) {
        subchunks.push(currentBuffer.join(" "))
        currentBuffer = []
        currentLen = 0
      }
      let pos = 0
      while (pos < sentence.length) {
        subchunks.push(sentence.slice(pos, pos + maxChars))
        pos += Math.max(1, maxChars - overlapChars)
      }
      continue
    }

    if (currentLen + sentence.length + 1 > maxChars && currentBuffer.length > 0) {
      subchunks.push(currentBuffer.join(" "))

      // Calculate overlap sentences from the end of currentBuffer
      const overlapBuffer: string[] = []
      let overlapLen = 0
      for (let i = currentBuffer.length - 1; i >= 0; i--) {
        const prevSentence = currentBuffer[i]
        if (overlapLen + prevSentence.length + 1 <= overlapChars) {
          overlapBuffer.unshift(prevSentence)
          overlapLen += prevSentence.length + 1
        } else {
          break
        }
      }

      currentBuffer = [...overlapBuffer, sentence]
      currentLen = currentBuffer.reduce((acc, s) => acc + s.length + 1, 0)
    } else {
      currentBuffer.push(sentence)
      currentLen += sentence.length + 1
    }
  }

  if (currentBuffer.length > 0) {
    subchunks.push(currentBuffer.join(" "))
  }

  return subchunks
}

/** Split markdown text into semantic chunks based on heading hierarchy. */
export function chunkMarkdown(
  rawMarkdown: string,
  documentId: string,
  opts: {
    maxChunkChars?: number   // target max characters per chunk (default 2000)
    minChunkChars?: number   // skip chunks smaller than this (default 1)
    overlap?: number         // overlap between consecutive chunks in chars (default 200)
  } = {}
): Omit<DocumentChunkInput, "workspaceId">[] {
  const maxChunkChars = opts.maxChunkChars ?? 2000
  const minChunkChars = opts.minChunkChars ?? 1
  const overlap = opts.overlap ?? 200
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
    let extracted = 0
    for (const candidate of candidates) {
      try {
        const res = await extractAndStoreGraphEntities(workspaceId, documentId, candidate.content)
        if (res && (res.nodes > 0 || res.edges > 0)) extracted++
      } catch (err) {
        console.error("[GraphRAG] Background extraction failed:", err)
      }
    }
    if (extracted > 0) {
      console.log(`[GraphRAG] Extracted entities from ${extracted}/${candidates.length} chunks (doc ${documentId})`)
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

  // Delete old chunks for this document (re-ingest is idempotent)
  await prisma.documentChunk.deleteMany({ where: { workspaceId, documentId } })

  const rawChunks = chunkMarkdown(markdown, documentId, opts)

  let chunksCreated = 0
  let skipped = 0
  const graphCandidates: Array<{ sectionKind: string; content: string }> = []

  // Process in batches to avoid memory pressure
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

          // Store as pgvector: '[0.1,0.2,...]'
          const embeddingStr = `[${embedding.join(",")}]`

          await prisma.$executeRaw`
            INSERT INTO "DocumentChunk" (id, "workspaceId", "documentId", heading, content, tokens, embedding, "createdAt")
            VALUES (
              gen_random_uuid(),
              ${workspaceId},
              ${documentId},
              ${chunk.heading},
              ${chunk.content},
              ${chunk.tokens},
              ${embeddingStr}::vector,
              NOW()
            )
          `
          chunksCreated++

          // Collect GraphRAG candidates — extraction runs detached after the
          // embedding loop so it never delays the ingestion return path.
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
