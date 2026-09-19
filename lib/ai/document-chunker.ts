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
import { resolveChunkSize, CHUNK_OVERLAP, type ChunkKind } from "./chunking-config"
import { splitIntoSubchunks, splitIntoStructuralSegments, buildTableEmbeddingText, describeTableChunk } from "./text-splitter"
import { buildContextualPrefix, describeEquationChunk, type ContextLang } from "./chunk-context"
import {
  chunkDocument,
  isHierarchicalChunkerEnabled,
  CHUNKER_VERSION,
  PARSER_VERSION,
  type ChunkerOptions,
  type PageAnchor,
} from "./chunker-v2"
import { generateLocalEmbeddings, getEmbeddingModelId } from "@/lib/ai/local-embeddings"
import { assertVectorWidth, currentManifest, manifestKey, EMBEDDING_COLUMN_WIDTH_SQL } from "@/lib/ai/index-version"

export type { SectionKind }
export type { ChunkKind }

// ---------------------------------------------------------------------------
// Contextual Retrieval (Anthropic-style chunk enrichment)
// ---------------------------------------------------------------------------
// Moved to ./chunk-context.ts so the structure-aware chunker can reuse it without
// importing this Prisma-backed module. Re-exported here for every existing importer.
export { buildContextualPrefix, describeEquationChunk } from "./chunk-context"
export type { ChunkContextInput, ContextLang } from "./chunk-context"

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

/**
 * Column list of the `DocumentChunk` INSERT, in bind order.
 *
 * Exported as the single source of truth: the writer below and the tests that
 * capture the INSERT both read it, so adding a column can never silently
 * desynchronise the row template from the column list.
 *
 * `id` is position 0 but is NOT always a bound parameter — the legacy chunker
 * passes `gen_random_uuid()` there instead. `embedding` and `createdAt` are the
 * other two positions that receive expressions rather than plain values.
 */
export const DOCUMENT_CHUNK_INSERT_COLUMNS = [
  '"workspaceId"',
  '"documentId"',
  "heading",
  "content",
  "tokens",
  "embedding",
  '"createdAt"',
  "kind",
  '"contextPrefix"',
  '"chunkType"',
  "ordinal",
  '"pageStart"',
  '"pageEnd"',
  "chapter",
  "section",
  "subsection",
  '"sectionPath"',
  '"sourceElementIds"',
  '"parentChunkId"',
  '"previousChunkId"',
  '"nextChunkId"',
  '"characterCount"',
  "oversized",
  '"contentHash"',
  '"parserVersion"',
  '"chunkerVersion"',
  '"embeddingModelVersion"',
  // `id` keeps the bind position it had before the hierarchy columns were added, so
  // the row layout stays stable for callers (and tests) that index rows positionally.
  "id",
  // Representation-chain columns are appended AFTER `id` for the same reason: adding
  // them anywhere earlier would shift every bind position downstream of them.
  '"tokenEstimatorVersion"',
  '"embeddingDimensions"',
  '"indexVersion"',
] as const

/**
 * Bound parameters per row.
 *
 * `createdAt` is the only column written as a SQL expression (`NOW()`);
 * `embedding` is bound and cast (`$n::vector`). The chunker-v2 path binds a
 * deterministic `id` (+1 parameter); the legacy path passes `gen_random_uuid()`
 * (+0). Column positions before `id` are identical in both paths.
 */
export const DOCUMENT_CHUNK_INSERT_BIND_COUNT = DOCUMENT_CHUNK_INSERT_COLUMNS.length - 1

/** One chunk ready for insertion, with its rendered embedding. */
interface PreparedChunk {
  /** Deterministic chunk id (chunker v2) or null → `gen_random_uuid()` (legacy). */
  id: string | null
  heading: string | null
  content: string
  tokens: number
  kind: ChunkKind
  contextPrefix: string | null
  embeddingStr: string
  chunkType: string
  ordinal: number
  pageStart: number | null
  pageEnd: number | null
  chapter: string | null
  section: string | null
  subsection: string | null
  sectionPath: string | null
  sourceElementIds: string[]
  parentChunkId: string | null
  previousChunkId: string | null
  nextChunkId: string | null
  characterCount: number
  oversized: boolean
  contentHash: string | null
  parserVersion: string
  chunkerVersion: string
  embeddingModelVersion: string
  tokenEstimatorVersion: string
  embeddingDimensions: number
  indexVersion: string
}

/** Width of a rendered `[x,y,z]` pgvector literal. -1 when it cannot be parsed. */
function vectorWidthOf(embeddingStr: string): number {
  const inner = embeddingStr.trim().replace(/^\[/, "").replace(/\]$/, "")
  if (!inner) return -1
  return inner.split(",").length
}

/**
 * Reads the declared width of `DocumentChunk.embedding` (`atttypmod` on a `vector(n)` column).
 * Returns `null` when it cannot be determined — a missing answer must not block ingestion, only
 * a *contradicting* answer does.
 */
export async function readEmbeddingColumnWidth(): Promise<number | null> {
  try {
    const rows = (await prisma.$queryRawUnsafe(EMBEDDING_COLUMN_WIDTH_SQL)) as Array<{ dim: number }>
    const dim = rows?.[0]?.dim
    return typeof dim === "number" && dim > 0 ? dim : null
  } catch {
    return null
  }
}

export interface DocumentChunkInput {
  workspaceId: string
  documentId: string   // matches the fileId from ingestion (IngestFile.id)
  heading: string | null
  headingPath?: string | null
  sectionKind: SectionKind
  content: string
  tokens: number
  /** Structural chunk kind — table/equation/figure_caption blocks are never split. */
  kind: ChunkKind
  /**
   * Anthropic-style contextual prefix (document title, domain, section path,
   * section objective). Indexed for embedding + FTS but NEVER merged into
   * `content`, which stays verbatim for evidence quote validation.
   */
  contextPrefix?: string | null
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

  const pushStructured = (
    heading: string | null,
    headingPath: string | null,
    sectionKind: SectionKind,
    segmentText: string,
    kind: ChunkKind
  ) => {
    const trimmed = segmentText.trim()
    if (trimmed.length < minChunkChars) return

    // Structural blocks (tables / equations / captions) are atomic: they are
    // never split across subchunks even when oversized — splitting inside
    // $$…$$ destroys the equation and splitting a pipe table drops its header.
    const subchunks =
      kind === "prose" ? splitIntoSubchunks(trimmed, maxChunkChars, overlap) : [trimmed]

    if (subchunks.length === 1) {
      chunks.push({
        documentId,
        heading,
        headingPath,
        sectionKind,
        content: subchunks[0],
        tokens: Math.ceil(subchunks[0].length / 4), // approx 4 chars/token
        kind,
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
          // Prose subchunks stay prose; structural blocks never reach this branch.
          kind: "prose" as ChunkKind,
        })
      })
    }
  }

  const addChunk = (heading: string | null, headingPath: string | null, text: string) => {
    const trimmed = text.trim()
    if (trimmed.length < minChunkChars) return

    const sectionKind = heading ? classifySectionKind(heading, trimmed) : "unknown"

    // Structure-aware pass: tables, $$…$$ equations and figure captions are
    // emitted as their own chunk kinds; prose keeps the sentence-aware path.
    const segments = splitIntoStructuralSegments(trimmed)
    for (const segment of segments) {
      pushStructured(heading, headingPath, sectionKind, segment.text, segment.kind)
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
 * Every chunk is enriched with an Anthropic-style contextual prefix (document
 * title, research domain, hierarchical section path, section objective) that is
 * embedded and FTS-indexed, while `content` keeps the verbatim source text.
 *
 * Uses concurrency control to avoid OOM on large dissertations.
 * Returns `graphQueued` — number of chunks queued for background GraphRAG
 * entity extraction (runs detached; not part of the synchronous return path).
 *
 * @param opts.ingestFileId   Optional IngestFile.id to track vectorStatus in DB.
 *                            When provided, status is updated:
 *                            pending → indexing (on start), then ready/error (on finish).
 * @param opts.documentTitle  Human document title used in the contextual prefix.
 *                            Falls back to the IngestFile.name looked up in DB.
 * @param opts.domainContext  Research domain for the contextual prefix
 *                            (defaults to resolveThesisDomainContext's fallback).
 * @param opts.lang           Prefix language (default "sk").
 */
export async function ingestDocumentChunks(
  workspaceId: string,
  documentId: string,
  markdown: string,
  opts: {
    maxChunkChars?: number
    concurrency?: number
    ingestFileId?: string
    documentTitle?: string
    domainContext?: string
    lang?: ContextLang
    /** Page anchors from MinerU's middle_json. Absent → page columns stay NULL. */
    pageAnchors?: PageAnchor[] | null
    /** Chunker-v2 tuning (token budgets, parent emission). */
    chunker?: ChunkerOptions
    /**
     * Skip re-embedding chunks whose content hash is already stored with the same
     * chunker + embedding-model version. Off by default: the atomic full swap is
     * the proven path and is what a first ingest needs.
     */
    incremental?: boolean
  } = {}
): Promise<{ chunksCreated: number; skipped: number; graphQueued: number; reused: number }> {
  // Mark indexing started (non-fatal if IngestFile row doesn't exist)
  if (opts.ingestFileId) {
    try {
      await prisma.ingestFile.updateMany({
        where: { id: opts.ingestFileId, workspaceId },
        data: { vectorStatus: "indexing" },
      })
    } catch { /* non-fatal */ }
  }

  // Document title for the contextual prefix — explicit opt wins, otherwise a
  // single cheap DB lookup (non-fatal: chunking must work without it).
  let documentTitle = opts.documentTitle?.trim() || null
  if (!documentTitle && opts.ingestFileId) {
    try {
      const file = await prisma.ingestFile.findFirst({
        where: { id: opts.ingestFileId, workspaceId },
        select: { name: true },
      })
      documentTitle = file?.name ?? null
    } catch { /* non-fatal */ }
  }
  const domainContext = opts.domainContext?.trim() || "Akademický výskum, STEM a aplikované vedy"
  const lang: ContextLang = opts.lang ?? "sk"
  const embeddingModelVersion = getEmbeddingModelId()
  // The full representation chain, resolved once so every row of this document is stamped
  // identically. A reindex that changed model mid-flight would otherwise produce a mixed index —
  // half the vectors from one model, half from another — which is worse than no index at all.
  const manifest = currentManifest()
  const tokenEstimatorVersion = manifest.tokenEstimatorVersion
  const indexVersion = manifestKey(manifest)
  const embeddingDimensions = manifest.embeddingDimensions

  // --- Chunking -------------------------------------------------------------
  // Hierarchical, token-aware chunker v2 by default; `CHUNKER=legacy` restores the
  // pre-upgrade character-sized flat chunker bit-for-bit.
  const hierarchical = isHierarchicalChunkerEnabled()
  const prepared: PreparedChunk[] = []
  let skipped = 0
  let reused = 0
  /** Content hashes kept from the previous index (incremental mode). Function-scoped: the
   *  persistence block below is shared with the legacy branch. */
  const reusedHashes: string[] = []
  const graphCandidates: Array<{ sectionKind: string; content: string; chunkId?: string }> = []

  if (hierarchical) {
    const { chunks } = chunkDocument(markdown, documentId, opts.pageAnchors ?? null, {
      ...opts.chunker,
      lang,
      documentTitle,
      domain: domainContext,
    })

    // Incremental mode: reuse rows that are already embedded with the same content,
    // chunker version and embedding model. Everything else is re-embedded.
    const reusableHashes = new Set<string>()
    if (opts.incremental) {
      try {
        const existing = (await prisma.$queryRaw`
          SELECT "contentHash" FROM "DocumentChunk"
          WHERE "workspaceId" = ${workspaceId}
            AND "documentId" = ${documentId}
            AND "contentHash" IS NOT NULL
            AND "chunkerVersion" = ${CHUNKER_VERSION}
            AND "embeddingModelVersion" = ${embeddingModelVersion}
        `) as Array<{ contentHash: string | null }>
        for (const row of existing) if (row.contentHash) reusableHashes.add(row.contentHash)
      } catch (err) {
        console.warn("[VectorRAG] incremental hash lookup failed, falling back to full reindex:", err)
      }
    }

    const toEmbed = chunks.filter((c) => {
      if (reusableHashes.has(c.contentHash)) {
        reusableHashes.delete(c.contentHash)
        reusedHashes.push(c.contentHash)
        reused++
        return false
      }
      return true
    })

    // Batch embedding: one registry call handles cache lookup, batching and the
    // serialized WASM queue, so a 900-chunk dissertation no longer issues 900
    // individual inference promises.
    let embeddings: number[][] = []
    try {
      embeddings = await generateLocalEmbeddings(toEmbed.map((c) => c.embeddingText), "passage")
    } catch (err) {
      console.error("[VectorRAG] batch embedding failed, retrying chunk-by-chunk:", err)
      embeddings = []
      for (const c of toEmbed) {
        try {
          embeddings.push(await generateLocalEmbedding(c.embeddingText, "passage"))
        } catch (innerErr) {
          console.error(`[VectorRAG] Failed to embed chunk "${c.heading}":`, innerErr)
          embeddings.push([])
        }
      }
    }

    toEmbed.forEach((c, i) => {
      const embedding = embeddings[i]
      if (!embedding || embedding.length === 0) {
        skipped++
        return
      }
      prepared.push({
        id: c.id,
        heading: c.heading,
        content: c.content,
        tokens: c.tokenCount,
        kind: c.kind,
        contextPrefix: c.contextPrefix,
        embeddingStr: `[${embedding.join(",")}]`,
        chunkType: c.chunkType,
        ordinal: c.ordinal,
        pageStart: c.pageStart,
        pageEnd: c.pageEnd,
        chapter: c.chapter,
        section: c.section,
        subsection: c.subsection,
        sectionPath: c.sectionPath,
        sourceElementIds: c.sourceElementIds,
        parentChunkId: c.parentChunkId,
        previousChunkId: c.previousChunkId,
        nextChunkId: c.nextChunkId,
        characterCount: c.characterCount,
        oversized: c.oversized,
        contentHash: c.contentHash,
        parserVersion: c.parserVersion,
        chunkerVersion: c.chunkerVersion,
        embeddingModelVersion,
        tokenEstimatorVersion: c.tokenEstimatorVersion,
        embeddingDimensions: embedding.length,
        indexVersion,
      })
      if (GRAPH_RAG_ENABLED && c.content.length >= GRAPH_EXTRACTION_MIN_CHARS && !c.isParent) {
        graphCandidates.push({ sectionKind: c.sectionKind, content: c.content, chunkId: c.id })
      }
    })
  } else {
    // ---- Legacy path (CHUNKER=legacy) — unchanged behaviour ----------------
    const rawChunks = chunkMarkdown(markdown, documentId, opts)
    const embedTextsLegacy: string[] = []
    const metas: Array<Omit<PreparedChunk, "embeddingStr">> = []
    for (const chunk of rawChunks) {
      const contextHeading = chunk.headingPath || chunk.heading
      const contextual = buildContextualPrefix({
        documentTitle,
        domain: domainContext,
        heading: chunk.heading,
        headingPath: chunk.headingPath,
        sectionKind: chunk.sectionKind,
        kind: chunk.kind,
        lang,
      })
      // Structural kinds get specialised embedding text (tables: flattened
      // description; equations: symbol inventory). The contextual prefix always
      // leads the embedding text and is stored separately for the FTS index.
      let embedText: string
      if (chunk.kind === "table") {
        embedText = `${contextual} ${describeTableChunk(chunk.content, contextHeading)}`
      } else if (chunk.kind === "equation") {
        embedText = `${contextual} ${describeEquationChunk(chunk.content, contextHeading)}`
      } else {
        embedText = contextHeading ? `${contextual} ${contextHeading}: ${chunk.content}` : `${contextual} ${chunk.content}`
      }
      embedTextsLegacy.push(embedText)
      metas.push({
        id: null,
        heading: chunk.heading,
        content: chunk.content,
        tokens: chunk.tokens,
        kind: chunk.kind,
        contextPrefix:
          chunk.kind === "table"
            ? `${contextual} ${describeTableChunk(chunk.content, contextHeading)}`
            : chunk.kind === "equation"
              ? `${contextual} ${describeEquationChunk(chunk.content, contextHeading)}`
              : contextual,
        chunkType: chunk.kind === "prose" ? "paragraph" : chunk.kind,
        ordinal: metas.length,
        pageStart: null,
        pageEnd: null,
        chapter: null,
        section: null,
        subsection: null,
        sectionPath: chunk.headingPath ?? null,
        sourceElementIds: [],
        parentChunkId: null,
        previousChunkId: null,
        nextChunkId: null,
        characterCount: chunk.content.length,
        oversized: false,
        contentHash: null,
        parserVersion: PARSER_VERSION,
        chunkerVersion: "1.x",
        embeddingModelVersion,
        tokenEstimatorVersion,
        embeddingDimensions,
        indexVersion,
      })
      if (GRAPH_RAG_ENABLED && chunk.content.length >= GRAPH_EXTRACTION_MIN_CHARS) {
        graphCandidates.push({ sectionKind: chunk.sectionKind, content: chunk.content })
      }
    }
    const legacyEmbeddings = await generateLocalEmbeddings(embedTextsLegacy, "passage")
    metas.forEach((meta, i) => {
      const embedding = legacyEmbeddings[i]
      if (!embedding || embedding.length === 0) {
        skipped++
        return
      }
      prepared.push({ ...meta, embeddingStr: `[${embedding.join(",")}]` })
    })
  }

  // --- Representation guard --------------------------------------------------
  // A vector written by model A must never be read back as model B. The most common way that
  // happens is a width change: `EMBEDDING_MODEL=Xenova/bge-m3` (1024-dim) against the
  // `vector(384)` column fails deep inside a bulk INSERT, *after* the transaction has already
  // deleted the previous rows. Checking first turns that into a refusal that leaves the old
  // index intact.
  if (prepared.length > 0) {
    const observedWidth = vectorWidthOf(prepared[0].embeddingStr)
    const columnWidth = await readEmbeddingColumnWidth()
    const width = assertVectorWidth(columnWidth, observedWidth)
    if (!width.ok) {
      const err = new Error(width.error ?? "Embedding width mismatch")
      ;(err as { code?: string }).code = "EMBEDDING_WIDTH_MISMATCH"
      if (opts.ingestFileId) {
        await prisma.ingestFile
          .update({ where: { id: opts.ingestFileId }, data: { vectorStatus: "error" } })
          .catch(() => {})
      }
      throw err
    }
  }

  let chunksCreated = 0

  // --- Persistence ----------------------------------------------------------
  // Atomic swap: readers see either the old set or the new one, never a gap.
  if (prepared.length > 0) {
    const INSERT_BATCH = 50
    // Chunk ids are deterministic in v2 so parent/sibling links survive the swap;
    // the legacy path keeps gen_random_uuid() (id = null in the row template).
    const allDeterministic = prepared.every((c) => c.id !== null)
    await prisma.$transaction(async (tx) => {
      if (reused > 0 && reusedHashes.length > 0) {
        // Incremental reindex: keep rows we just recognised as unchanged, drop
        // every other row of this document (including rows whose content has
        // disappeared from the source and legacy rows with no content hash).
        await tx.$executeRaw`
          DELETE FROM "DocumentChunk"
          WHERE "workspaceId" = ${workspaceId}
            AND "documentId" = ${documentId}
            AND ("contentHash" IS NULL OR "contentHash" NOT IN (${Prisma.join(reusedHashes)}))
        `
      } else {
        await tx.documentChunk.deleteMany({ where: { workspaceId, documentId } })
      }
      for (let i = 0; i < prepared.length; i += INSERT_BATCH) {
        const slice = prepared.slice(i, i + INSERT_BATCH)
        /**
         * Renders one VALUES tuple in DOCUMENT_CHUNK_INSERT_COLUMNS order.
         * `id` is last; a null id means "let the database generate one".
         */
        const rowSql = (c: PreparedChunk, id: string | null) => Prisma.sql`(${workspaceId}, ${documentId}, ${c.heading}, ${c.content}, ${c.tokens}, ${c.embeddingStr}::vector, NOW(), ${c.kind}, ${c.contextPrefix}, ${c.chunkType}, ${c.ordinal}, ${c.pageStart}, ${c.pageEnd}, ${c.chapter}, ${c.section}, ${c.subsection}, ${c.sectionPath}, ${c.sourceElementIds}, ${c.parentChunkId}, ${c.previousChunkId}, ${c.nextChunkId}, ${c.characterCount}, ${c.oversized}, ${c.contentHash}, ${c.parserVersion}, ${c.chunkerVersion}, ${c.embeddingModelVersion}, ${id ?? Prisma.raw("gen_random_uuid()")}, ${c.tokenEstimatorVersion}, ${c.embeddingDimensions}, ${c.indexVersion})`
        const values = slice.map((c) => rowSql(c, allDeterministic ? c.id : null))
        await tx.$executeRaw`
          INSERT INTO "DocumentChunk" (${Prisma.raw(DOCUMENT_CHUNK_INSERT_COLUMNS.join(", "))})
          VALUES ${Prisma.join(values)}
        `
        chunksCreated += slice.length
      }
    }, { timeout: 120_000 })
  } else if (reused === 0) {
    // Nothing could be embedded — keep the previous index rather than wiping it.
    console.warn(`[VectorRAG] No chunks embedded for ${workspaceId}/${documentId}; previous index left untouched`)
  }

  // Detached GraphRAG extraction: priority section kinds first, capped per doc.
  // Never awaited — ingestion must not block on graph construction.
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
          vectorStatus: skipped > 0 && chunksCreated === 0 && reused === 0 ? "error" : "ready",
          vectorChunks: chunksCreated + reused,
          vectorIndexedAt: new Date(),
        },
      })
    } catch { /* non-fatal */ }
  }

  return { chunksCreated, skipped, graphQueued, reused }
}
