/**
 * Topic-focused source context for card generation.
 *
 * `loadSourceContext` returns the first N characters of every source file
 * concatenated — for a "Results" card that is introduction + literature review,
 * and the model then "grounds" results bullets in text that contains none. When
 * the workspace has a vector index we instead retrieve the chunks most relevant
 * to the card topic (hybrid search, MMR-deduplicated) and fall back to the raw
 * prefix only when retrieval is unavailable or returns nothing.
 *
 * `buildRagGroundedContext` is the grounding-grade variant used by the card
 * auto-fill endpoint: it additionally returns per-chunk IDs (so bullets can be
 * anchored to retrievable evidence) and ranks MinerU figure assets by text
 * proximity to the retrieved chunks.
 */

import { AI_CONFIG } from "@/lib/config/ai"

export interface TopicContextOptions {
  workspaceId: string
  topic: string
  sourceIds?: string[]
  /** Called when vector retrieval is unavailable / empty. */
  fallback: () => Promise<string>
  /** Max chunks to include (default 10). */
  topK?: number
  /** Hard cap on returned characters (default AI_CONFIG.generation.maxSourceChars). */
  maxChars?: number
}

export interface RagEvidenceChunk {
  id: string
  heading: string | null
  kind: string
  documentId?: string
  /** Verbatim chunk text (never the contextual prefix) — quote-checkable. */
  content: string
}

export interface RagGroundedContext {
  /** Prompt-ready source context (RAG passages or fallback prefix). */
  context: string
  /** True when `context` came from vector retrieval (chunk-anchored). */
  fromRag: boolean
  /** Retrieved chunks with stable IDs for citation anchoring (empty when fallback). */
  chunks: RagEvidenceChunk[]
}

/** A figure/table asset candidate the model may assign to the card. */
export interface AssetCandidate {
  id: string
  filename?: string
  kind: string
  caption?: string
  snippet?: string
  section?: string | null
  /** Proximity score vs. the retrieved evidence (higher = closer). */
  score?: number
}

const GENERIC_TOPICS = new Set(["", "untitled card", "untitled", "new card", "card"])

function tokenize(text: string): Set<string> {
  return new Set(
    (text || "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 2)
  )
}

function jaccardTokens(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

/**
 * Text-proximity ranking of MinerU-extracted figure assets against retrieved
 * chunks (Objective C.3): an asset is suggested when its caption, section
 * label, filename and snippet share vocabulary with the chunk evidence the
 * card will be built from. Pure function — unit-testable, no DB/model access.
 *
 * @param chunks  Retrieved evidence chunks (heading + content used for proximity).
 * @param assets  Workspace assets (MinerU figures/tables/equations).
 * @param topic   The card topic — assets matching it get a small boost.
 * @param maxSuggestions Maximum number of assets to suggest (default 2).
 */
export function suggestAssetsForChunks(
  chunks: RagEvidenceChunk[],
  assets: AssetCandidate[],
  topic: string,
  maxSuggestions = 2
): Array<AssetCandidate & { score: number }> {
  if (chunks.length === 0 || assets.length === 0) return []

  // Evidence profile: headings weigh double (they name the section the figure
  // lives next to); body text provides the topical vocabulary.
  const chunkTokens = new Set<string>()
  for (const c of chunks) {
    for (const t of tokenize(c.heading ?? "")) chunkTokens.add(t)
    for (const t of tokenize(c.content.slice(0, 800))) chunkTokens.add(t)
  }
  const topicTokens = tokenize(topic)

  const scored = assets
    .filter((a) => a && a.id && (a.kind === "figure" || a.kind === "table" || a.kind === "equation" || !a.kind))
    .map((a) => {
      const assetText = [a.caption, a.section, a.snippet, a.filename]
        .filter(Boolean)
        .join(" ")
      const assetTokens = tokenize(assetText)
      let score = jaccardTokens(assetTokens, chunkTokens)
      if (topicTokens.size > 0) score += 0.25 * jaccardTokens(assetTokens, topicTokens)
      return { ...a, score: Number(score.toFixed(4)) }
    })
    .filter((a) => a.score > 0.02)
    .sort((x, y) => y.score - x.score)

  return scored.slice(0, maxSuggestions)
}

/**
 * RAG-grounded source context for card auto-fill.
 *
 * Retrieves the chunks most relevant to the card topic (multi-query hybrid
 * search with document isolation) and returns them WITH their chunk IDs so the
 * generation prompt can require evidence-anchored bullets. Falls back to the
 * raw source prefix when retrieval is unavailable, the topic is generic, or
 * nothing matched — identical to buildTopicFocusedSourceContext.
 */
export async function buildRagGroundedContext(opts: TopicContextOptions): Promise<RagGroundedContext> {
  const topK = opts.topK ?? 8
  const maxChars = opts.maxChars ?? AI_CONFIG.generation.maxSourceChars
  const topic = (opts.topic || "").trim()

  // Autonomous / generic cards have no topic to retrieve for — use the overview prefix.
  if (GENERIC_TOPICS.has(topic.toLowerCase())) {
    return { context: await opts.fallback(), fromRag: false, chunks: [] }
  }
  if (process.env.VITEST && !process.env.TEST_REAL_EMBEDDINGS) {
    return { context: await opts.fallback(), fromRag: false, chunks: [] }
  }

  try {
    const { searchHybrid, applyMMR } = await import("./vector-rag")
    // One retrieval per selected source (document-level isolation), or workspace-wide.
    const docIds = Array.isArray(opts.sourceIds) && opts.sourceIds.length > 0 ? opts.sourceIds : [undefined]
    const perDoc = Math.max(4, Math.ceil((topK * 3) / docIds.length))
    const results = await Promise.all(
      docIds.map((docId) =>
        searchHybrid(opts.workspaceId, topic, perDoc, "Akademický výskum, STEM a aplikované vedy", docId, { useHyDE: false })
      )
    )
    const merged = results.flat()
    if (merged.length === 0) {
      return { context: await opts.fallback(), fromRag: false, chunks: [] }
    }

    const diverse = applyMMR(merged, Math.min(topK, merged.length), 0.7)

    const chunks: RagEvidenceChunk[] = diverse.map((c) => ({
      id: c.id,
      heading: c.heading,
      kind: (c as { kind?: string }).kind ?? "prose",
      documentId: (c as { documentId?: string }).documentId,
      // Verbatim content only — the contextual prefix is deliberately excluded
      // so prompts quote text that also exists in the source document.
      content: c.content,
    }))

    const parts: string[] = []
    let used = 0
    for (const c of chunks) {
      const block = `### ${c.heading ?? "Untitled section"}\n${c.content}`
      if (used + block.length > maxChars) break
      parts.push(block)
      used += block.length + 2
    }
    if (parts.length === 0) {
      return { context: await opts.fallback(), fromRag: false, chunks: [] }
    }
    return {
      context: `--- Source excerpts retrieved for topic: "${topic}" (${parts.length} passages) ---\n\n${parts.join("\n\n")}`,
      fromRag: true,
      chunks,
    }
  } catch (err) {
    // pgvector missing, DB down, embeddings failing — degrade to the raw prefix.
    console.warn("[card-context] topic retrieval unavailable, falling back to raw source prefix:", err instanceof Error ? err.message : err)
    return { context: await opts.fallback(), fromRag: false, chunks: [] }
  }
}

const FALLBACK_NOTE = "Retrieval-based grounding unavailable"

export { FALLBACK_NOTE }

export async function buildTopicFocusedSourceContext(opts: TopicContextOptions): Promise<string> {
  const grounded = await buildRagGroundedContext(opts)
  return grounded.context
}
