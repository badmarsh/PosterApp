import { prisma } from "@/lib/prisma"
import { generateLocalEmbedding } from "./local-embeddings"

/**
 * Hybrid search: combines pgvector cosine similarity with PostgreSQL FTS.
 * Default domain "STEM, Fyzika" biases embeddings toward physics/science vocabulary.
 */
export async function searchHybrid(
  workspaceId: string,
  query: string,
  limit = 20,
  domainContext = "STEM, Fyzika"
) {
  const queryEmbedding = await generateLocalEmbedding(`${domainContext}: ${query}`)

  // Convert array to pgvector string format: '[0.1, 0.2, ...]'
  const embeddingString = `[${queryEmbedding.join(",")}]`

  // Hybrid: vector cosine distance + FTS ts_rank weighted 70/30
  const chunks = await prisma.$queryRaw<Array<{
    id: string
    heading: string | null
    content: string
    tokens: number
    similarity: number
  }>>`
    SELECT
      id,
      heading,
      content,
      tokens,
      (
        0.7 * (1 - (embedding <=> ${embeddingString}::vector)) +
        0.3 * ts_rank(to_tsvector('simple', content), plainto_tsquery('simple', ${query}))
      ) AS similarity
    FROM "DocumentChunk"
    WHERE "workspaceId" = ${workspaceId}
      AND embedding IS NOT NULL
    ORDER BY similarity DESC
    LIMIT ${limit}
  `

  return chunks
}

/**
 * Reranks retrieved chunks by relevance to query.
 * Uses a simple cross-score heuristic (keyword overlap + length penalty).
 * For production quality, swap this for Cohere Rerank API.
 */
export async function rerankChunks(
  query: string,
  chunks: Array<{ id: string; content: string; heading: string | null; similarity?: number }>
) {
  const queryTokens = new Set(
    query.toLowerCase().split(/\s+/).filter((t) => t.length > 3)
  )

  const scored = chunks.map((c) => {
    const contentLower = c.content.toLowerCase()
    const headingLower = (c.heading ?? "").toLowerCase()
    let score = c.similarity ?? 0
    // Boost for query term presence in heading
    for (const tok of queryTokens) {
      if (headingLower.includes(tok)) score += 0.15
      if (contentLower.includes(tok)) score += 0.05
    }
    // Slight penalty for very long or very short chunks
    const len = c.content.length
    if (len < 100) score -= 0.1
    if (len > 4000) score -= 0.05
    return { ...c, relevanceScore: score }
  })

  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10)
}
