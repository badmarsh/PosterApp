/**
 * Topic-focused source context for card generation.
 *
 * `loadSourceContext` returns the first N characters of every source file
 * concatenated — for a "Results" card that is introduction + literature review,
 * and the model then "grounds" results bullets in text that contains none. When
 * the workspace has a vector index we instead retrieve the chunks most relevant
 * to the card topic (hybrid search, MMR-deduplicated) and fall back to the raw
 * prefix only when retrieval is unavailable or returns nothing.
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

const GENERIC_TOPICS = new Set(["", "untitled card", "untitled", "new card", "card"])

export async function buildTopicFocusedSourceContext(opts: TopicContextOptions): Promise<string> {
  const topK = opts.topK ?? 10
  const maxChars = opts.maxChars ?? AI_CONFIG.generation.maxSourceChars
  const topic = (opts.topic || "").trim()

  // Autonomous / generic cards have no topic to retrieve for — use the overview prefix.
  if (GENERIC_TOPICS.has(topic.toLowerCase())) return opts.fallback()
  if (process.env.VITEST && !process.env.TEST_REAL_EMBEDDINGS) return opts.fallback()

  try {
    const { searchHybrid, applyMMR } = await import("./vector-rag")
    // One retrieval per selected source (document-level isolation), or workspace-wide.
    const docIds = Array.isArray(opts.sourceIds) && opts.sourceIds.length > 0 ? opts.sourceIds : [undefined]
    const perDoc = Math.max(4, Math.ceil((topK * 3) / docIds.length))
    const results = await Promise.all(
      docIds.map((docId) => searchHybrid(opts.workspaceId, topic, perDoc, "Akademický výskum, STEM a aplikované vedy", docId, { useHyDE: false }))
    )
    const merged = results.flat()
    if (merged.length === 0) return opts.fallback()

    const diverse = applyMMR(merged, Math.min(topK, merged.length), 0.7)
    const parts: string[] = []
    let used = 0
    for (const c of diverse) {
      const block = `### ${c.heading ?? "Untitled section"}\n${c.content}`
      if (used + block.length > maxChars) break
      parts.push(block)
      used += block.length + 2
    }
    if (parts.length === 0) return opts.fallback()
    return `--- Source excerpts retrieved for topic: "${topic}" (${parts.length} passages) ---\n\n${parts.join("\n\n")}`
  } catch (err) {
    // pgvector missing, DB down, embeddings failing — degrade to the raw prefix.
    console.warn("[card-context] topic retrieval unavailable, falling back to raw source prefix:", err instanceof Error ? err.message : err)
    return opts.fallback()
  }
}
