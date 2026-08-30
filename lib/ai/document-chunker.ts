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

import { classifySectionKind, normalizeHeading, type SectionKind } from "@/lib/ai/thesis-context"
import { prisma } from "@/lib/prisma"
import { generateLocalEmbedding } from "@/lib/ai/local-embeddings"

export interface DocumentChunkInput {
  workspaceId: string
  documentId: string   // matches the fileId from ingestion (IngestFile.id)
  heading: string | null
  sectionKind: SectionKind
  content: string
  tokens: number
}

/** Split markdown text into semantic chunks based on heading hierarchy. */
export function chunkMarkdown(
  markdown: string,
  documentId: string,
  opts: {
    maxChunkChars?: number   // target max characters per chunk (default 2000)
    minChunkChars?: number   // skip chunks smaller than this (default 100)
    overlap?: number         // overlap between consecutive chunks in chars (default 200)
  } = {}
): Omit<DocumentChunkInput, "workspaceId">[] {
  const maxChunkChars = opts.maxChunkChars ?? 2000
  const minChunkChars = opts.minChunkChars ?? 100
  const overlap = opts.overlap ?? 200

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

  const addChunk = (heading: string | null, text: string) => {
    const trimmed = text.trim()
    if (trimmed.length < minChunkChars) return

    const sectionKind = heading ? classifySectionKind(heading, trimmed) : "unknown"

    // If the chunk is too large, split it into overlapping subchunks
    if (trimmed.length <= maxChunkChars) {
      chunks.push({
        documentId,
        heading,
        sectionKind,
        content: trimmed,
        tokens: Math.ceil(trimmed.length / 4), // approx 4 chars/token
      })
    } else {
      let pos = 0
      let subIdx = 0
      while (pos < trimmed.length) {
        const slice = trimmed.slice(pos, pos + maxChunkChars)
        chunks.push({
          documentId,
          heading: heading ? `${heading} [${++subIdx}]` : null,
          sectionKind,
          content: slice,
          tokens: Math.ceil(slice.length / 4),
        })
        pos += maxChunkChars - overlap
        if (pos + minChunkChars >= trimmed.length) break
      }
    }
  }

  if (splits.length === 0) {
    // No headings found — treat entire doc as one chunk stream
    addChunk(null, markdown)
    return chunks
  }

  // Add text before the first heading
  const preamble = markdown.slice(0, splits[0].startIdx)
  addChunk("Preamble", preamble)

  for (let i = 0; i < splits.length; i++) {
    const { heading, startIdx } = splits[i]
    const endIdx = i + 1 < splits.length ? splits[i + 1].startIdx : markdown.length
    const sectionText = markdown.slice(startIdx, endIdx)
    // Remove the heading line itself from content
    const contentOnly = sectionText.replace(/^#{1,4}\s+.+\n?/, "").trim()
    addChunk(heading, contentOnly)
  }

  return chunks
}

/**
 * Ingest a MinerU-parsed Markdown file into DocumentChunk table with embeddings.
 * Called after successful MinerU parse in the ingestion pipeline.
 *
 * Uses concurrency control to avoid OOM on large dissertations.
 */
export async function ingestDocumentChunks(
  workspaceId: string,
  documentId: string,
  markdown: string,
  opts: { maxChunkChars?: number; concurrency?: number } = {}
): Promise<{ chunksCreated: number; skipped: number }> {
  const concurrency = opts.concurrency ?? 3

  // Delete old chunks for this document (re-ingest is idempotent)
  await prisma.documentChunk.deleteMany({ where: { workspaceId, documentId } })

  const rawChunks = chunkMarkdown(markdown, documentId, opts)

  let chunksCreated = 0
  let skipped = 0

  // Process in batches to avoid memory pressure
  for (let i = 0; i < rawChunks.length; i += concurrency) {
    const batch = rawChunks.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async (chunk) => {
        try {
          const embedding = await generateLocalEmbedding(
            // Prepend heading for better retrieval quality
            chunk.heading
              ? `${chunk.heading}: ${chunk.content}`
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
        } catch (err) {
          console.error(`[VectorRAG] Failed to embed chunk "${chunk.heading}":`, err)
          skipped++
        }
      })
    )
  }

  // Create HNSW index after first ingest (CREATE INDEX IF NOT EXISTS is safe)
  try {
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS document_chunk_embedding_hnsw
      ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `
  } catch {
    // Index may already exist, ignore
  }

  return { chunksCreated, skipped }
}
