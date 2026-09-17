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

export type { SectionKind }
export type { ChunkKind }

// ---------------------------------------------------------------------------
// Contextual Retrieval (Anthropic-style chunk enrichment)
// ---------------------------------------------------------------------------

/** Supported languages for the contextual prefix (matches review languages). */
export type ContextLang = "sk" | "cs" | "en"

export interface ChunkContextInput {
  /** Document title (IngestFile.name / thesis title). */
  documentTitle?: string | null
  /** Research domain, e.g. "Informatika, AI a dátové vedy". */
  domain?: string | null
  /** Immediate section heading. */
  heading?: string | null
  /** Full hierarchical section path, e.g. "Kapitola 3: Metodika > 3.2 Štatistická analýza". */
  headingPath?: string | null
  /** Classified section kind (drives the section-objective sentence). */
  sectionKind?: SectionKind | null
  /** Structural kind of the chunk (table chunks get a flattened description instead). */
  kind?: ChunkKind | null
  /** Language for the prefix text (default "sk" — Slovak theses). */
  lang?: ContextLang
}

const SECTION_OBJECTIVES: Record<SectionKind, Record<ContextLang, string>> = {
  preamble: {
    sk: "predstavuje dokument a jeho štruktúru",
    cs: "představuje dokument a jeho strukturu",
    en: "introduces the document and its structure",
  },
  introduction: {
    sk: "uvádza do problematiky, motivuje tému a stanovuje ciele práce",
    cs: "uvádí do problematiky, motivuje tému a stanovuje cíle práce",
    en: "introduces the problem, motivates the topic and states the objectives",
  },
  literature: {
    sk: "rešíruje súčasný stav poznania a súvisiace vedecké práce",
    cs: "rešeršuje současný stav poznání a související vědecké práce",
    en: "surveys the state of the art and related work",
  },
  methodology: {
    sk: "popisuje metodiku, postupy, dáta a experimentálny návrh",
    cs: "popisuje metodiku, postupy, data a experimentální návrh",
    en: "describes the methodology, procedures, data and experimental design",
  },
  results: {
    sk: "prezentuje výsledky experimentov a ich vyhodnotenie vrátane štatistických údajov",
    cs: "prezentuje výsledky experimentů a jejich vyhodnocení včetně statistických údajů",
    en: "presents experimental results and their evaluation including statistical data",
  },
  discussion: {
    sk: "interpretuje výsledky, porovnáva ich s existujúcimi riešeniami a diskutuje limitácie",
    cs: "interpretuje výsledky, porovnává je s existujícími řešeními a diskutuje limitace",
    en: "interprets the results, compares them with existing work and discusses limitations",
  },
  conclusion: {
    sk: "sumarizuje závery a prínos práce pre odbornú verejnosť",
    cs: "sumarizuje závěry a přínos práce pro odbornou veřejnost",
    en: "summarises the conclusions and the contribution of the work",
  },
  references: {
    sk: "obsahuje zoznam citovanej literatúry",
    cs: "obsahuje seznam citované literatury",
    en: "contains the list of cited literature",
  },
  appendix: {
    sk: "obsahuje prílohy a doplnkový materiál",
    cs: "obsahuje přílohy a doplňkový materiál",
    en: "contains appendices and supplementary material",
  },
  unknown: {
    sk: "rozvíja hlavnú tému práce",
    cs: "rozvíjí hlavní téma práce",
    en: "develops the main topic of the work",
  },
}

/** LaTeX symbol names that make equation chunks findable by natural-language queries. */
const EQUATION_SYMBOL_LABELS: Array<[RegExp, string]> = [
  [/\\alpha|\balpha\b/i, "alpha (α)"],
  [/\\beta|\bbeta\b/i, "beta (β)"],
  [/\\gamma|\bgamma\b|\\Gamma/i, "gamma (γ)"],
  [/\\delta|\bdelta\b|\\Delta/i, "delta (δ/Δ)"],
  [/\\sigma|\bsigma\b|\\Sigma/i, "sigma (σ)"],
  [/\\lambda|\blambda\b|\\Lambda/i, "lambda (λ)"],
  [/\\mu|\bmu\b/i, "mu (μ)"],
  [/\\theta|\btheta\b/i, "theta (θ)"],
  [/\\pi|\bpi\b/i, "pi (π)"],
  [/\\epsilon|\bvarepsilon|\bvarepsilon\b/i, "epsilon (ε)"],
  [/\\sum\b|\\sum_/i, "sum"],
  [/\\int\b|\\oint/i, "integral"],
  [/\\nabla/i, "nabla (gradient)"],
  [/\\partial/i, "parciálna derivácia (partial derivative)"],
  [/[√\\sqrt]/, "odmocnina (square root)"],
  [/\\leq|\\le\b|≤/, "nerovnosť (inequality ≤)"],
  [/\\approx|≈/, "približne rovné (approximately equal)"],
]

/**
 * Builds a 1–2 sentence Anthropic-style contextual prefix for a chunk.
 *
 * Isolated 1,200–1,800-char chunks (statistical paragraphs, equations, table
 * fragments) lose the document/section framing needed for queries that
 * reference the overarching hypothesis or methodology ("Aká bola hypotéza
 * práce?", "…v kapitole 3.2"). The prefix re-attaches that framing:
 *   document title → research domain → hierarchical section path → objective.
 *
 * The prefix is stored SEPARATELY (`DocumentChunk.contextPrefix`) and only
 * fed to the embedding model and the FTS tsvector — `content` keeps the
 * verbatim source text so evidence validation ([c-anchor] quote checks)
 * continues to match the original document word-for-word.
 */
export function buildContextualPrefix(ctx: ChunkContextInput): string {
  const lang: ContextLang = ctx.lang ?? "sk"
  const sentences: string[] = []

  const title = (ctx.documentTitle || "").trim()
  const domain = (ctx.domain || "").trim()
  const sectionPath = (ctx.headingPath || ctx.heading || "").trim()

  // Sentence 1 — where this chunk lives.
  if (lang === "en") {
    sentences.push(
      `Excerpt from ${title ? `the work "${trimTitle(title)}"` : "an academic work"}${domain ? ` (field: ${domain})` : ""}${sectionPath ? `, section "${sectionPath}"` : ""}.`
    )
  } else if (lang === "cs") {
    sentences.push(
      `Úryvek z ${title ? `práce „${trimTitle(title)}“` : "akademické práce"}${domain ? ` (obor: ${domain})` : ""}${sectionPath ? `, sekce „${sectionPath}“` : ""}.`
    )
  } else {
    sentences.push(
      `Úryvok z ${title ? `práce „${trimTitle(title)}“` : "akademickej práce"}${domain ? ` (odbor: ${domain})` : ""}${sectionPath ? `, sekcia „${sectionPath}“` : ""}.`
    )
  }

  // Sentence 2 — what this section is about (objective), unless the path
  // already makes it obvious and the section is the whole path.
  const objective = SECTION_OBJECTIVES[ctx.sectionKind ?? "unknown"][lang]
  const structuralNote = structuralPrefixNote(ctx.kind, lang)
  if (lang === "en") {
    sentences.push(`This section ${objective}${structuralNote ? `; ${structuralNote}` : ""}.`)
  } else {
    sentences.push(`Táto časť ${objective}${structuralNote ? `; ${structuralNote}` : ""}.`)
  }

  return sentences.join(" ")
}

function trimTitle(t: string): string {
  // Strip file extensions from IngestFile names ("thesis_final.pdf" → "thesis_final").
  return t.replace(/\.(pdf|md|markdown|docx?|tex)$/i, "").slice(0, 120)
}

function structuralPrefixNote(kind: ChunkKind | null | undefined, lang: ContextLang): string {
  if (kind === "table") {
    return lang === "en"
      ? "it is a data table — questions about specific values are answered by it"
      : "ide o dátovú tabuľku — otázky na konkrétne hodnoty sa zodpovedajú z nej"
  }
  if (kind === "equation") {
    return lang === "en"
      ? "it is a mathematical equation block"
      : "ide o matematický vzorec"
  }
  if (kind === "figure_caption") {
    return lang === "en"
      ? "it is a figure/table caption"
      : "ide o popis obrázka alebo tabuľky"
  }
  return ""
}

/**
 * Natural-language label for an equation chunk: heading + symbol inventory so
 * keyword queries ("rovnica pre gradient", "alfa parameter") can match without
 * containing raw LaTeX. Pure function — unit-testable.
 */
export function describeEquationChunk(content: string, heading: string | null): string {
  const symbols = EQUATION_SYMBOL_LABELS.filter(([re]) => re.test(content)).map(([, label]) => label)
  const parts: string[] = []
  if (heading) parts.push(heading)
  parts.push("matematický vzorec / equation")
  if (symbols.length > 0) parts.push(`obsahuje: ${symbols.slice(0, 8).join(", ")}`)
  // Keep a short verbatim tail so exact LaTeX tokens are still embeddable.
  parts.push(content.replace(/\s+/g, " ").slice(0, 300))
  return parts.join(". ")
}

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
  } = {}
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

  const rawChunks = chunkMarkdown(markdown, documentId, opts)

  let chunksCreated = 0
  let skipped = 0
  const graphCandidates: Array<{ sectionKind: string; content: string }> = []
  const prepared: Array<{ heading: string | null; content: string; tokens: number; kind: ChunkKind; contextPrefix: string | null; embeddingStr: string }> = []

  // Phase 1 — embed everything first (WASM, slow). The old chunks stay in
  // place meanwhile, so a review started during a reindex still retrieves
  // from the previous index instead of an empty one.
  for (let i = 0; i < rawChunks.length; i += concurrency) {
    const batch = rawChunks.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async (chunk) => {
        try {
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

          // Structural kinds get specialised embedding text:
          //  - tables: full retrieval description (columns, flattened rows,
          //    notable/extreme values, p-values) — raw pipe scaffolding wastes
          //    the embedding window and never matches natural-language questions
          //  - equations: symbol inventory + heading so they match keyword
          //    queries that don't contain LaTeX
          //  - figures: content plus heading context
          // The contextual prefix ALWAYS leads the embedding text (Anthropic-style:
          // context before content) and is stored separately for the FTS index.
          let embedText: string
          if (chunk.kind === "table") {
            embedText = `${contextual} ${describeTableChunk(chunk.content, contextHeading)}`
          } else if (chunk.kind === "equation") {
            embedText = `${contextual} ${describeEquationChunk(chunk.content, contextHeading)}`
          } else if (chunk.kind === "figure_caption") {
            embedText = contextHeading
              ? `${contextual} ${contextHeading}: ${chunk.content}`
              : `${contextual} ${chunk.content}`
          } else {
            // Prepend hierarchical heading path for rich contextual semantic embedding
            embedText = contextHeading ? `${contextual} ${contextHeading}: ${chunk.content}` : `${contextual} ${chunk.content}`
          }
          const embedding = await generateLocalEmbedding(embedText)
          prepared.push({
            heading: chunk.heading,
            content: chunk.content,
            tokens: chunk.tokens,
            kind: chunk.kind,
            // Tables/equations get the retrieval description as their prefix so
            // the FTS tsvector also covers headers, notable values and symbols.
            contextPrefix:
              chunk.kind === "table"
                ? `${contextual} ${describeTableChunk(chunk.content, contextHeading)}`
                : chunk.kind === "equation"
                ? `${contextual} ${describeEquationChunk(chunk.content, contextHeading)}`
                : contextual,
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
          (c) => Prisma.sql`(gen_random_uuid(), ${workspaceId}, ${documentId}, ${c.heading}, ${c.content}, ${c.tokens}, ${c.embeddingStr}::vector, NOW(), ${c.kind}, ${c.contextPrefix})`
        )
        await tx.$executeRaw`
          INSERT INTO "DocumentChunk" (id, "workspaceId", "documentId", heading, content, tokens, embedding, "createdAt", kind, "contextPrefix")
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
