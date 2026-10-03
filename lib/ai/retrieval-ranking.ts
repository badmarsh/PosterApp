/**
 * Ranking stage: diversity selection, neural reranking and novelty-drift detection.
 *
 * Extracted so the candidate generators (`lib/ai/retrievers/*`) and the legacy
 * `vector-rag.ts` pipeline share one implementation instead of two diverging copies.
 * `vector-rag.ts` re-exports these symbols, so existing import paths keep working.
 *
 * Three honest layers, in increasing order of cost and trust:
 *
 *   1. fusion            — makes heterogeneous legs comparable (`lib/ai/fusion.ts`)
 *   2. diversity (MMR)   — stops the top-k being the same paragraph four times
 *   3. neural rerank     — a real cross-encoder, or nothing; never a lexical heuristic
 *                          dressed up as one
 *
 * Layer 3 is explicitly optional. When no reranker model is loaded the caller is told so
 * (`usedNeuralReranker: false`) rather than being handed a lexical score labelled "rerank".
 *
 * @module retrieval-ranking
 */

import { embedTexts, getReranker, lexicalHeuristicScores } from "./model-registry"

// ---------------------------------------------------------------------------
// Diversity
// ---------------------------------------------------------------------------

export const DEFAULT_MMR_LAMBDA = 0.7

/** Min-max normalize relevance scores so they share a [0, 1] scale with overlap penalties. */
export function normalizeRelevanceScores(scores: number[]): number[] {
  if (scores.length === 0) return []
  const finite = scores.map((score) => (Number.isFinite(score) ? score : 0))
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const span = max - min
  if (span <= 0) return finite.map(() => 1)
  return finite.map((score) => Math.max(0, Math.min(1, (score - min) / span)))
}

export interface MmrOptions {
  lambda?: number
  similarityThreshold?: number
  signal?: AbortSignal
}

/**
 * Generic maximal-marginal-relevance selection.
 *
 * `scoreOf` is the fusion score; embeddings are optional per item, so callers that only have
 * lexical candidates still get MMR over what they have.
 */
export function mmrSelect<T>(
  items: T[],
  opts: {
    scoreOf: (item: T) => number
    idOf: (item: T) => string
    embeddingOf: (item: T) => number[] | null
    limit: number
    lambda?: number
    similarityThreshold?: number
    signal?: AbortSignal
  }
): T[] {
  if (items.length === 0) return []
  const lambda = Math.max(0, Math.min(1, opts.lambda ?? DEFAULT_MMR_LAMBDA))
  const limit = Math.min(Math.max(0, Math.floor(opts.limit)), items.length)
  if (limit <= 0) return []

  // Fusion (especially RRF) has a much smaller numeric range than cosine similarity.
  // Normalize it before combining relevance with the [0,1] redundancy penalty.
  const relevance = normalizeRelevanceScores(items.map(opts.scoreOf))
  const pool = items.map((item, index) => ({
    item,
    id: opts.idOf(item),
    relevance: relevance[index],
    embedding: opts.embeddingOf(item),
  }))
  const byRelevance = (a: typeof pool[number], b: typeof pool[number]) =>
    b.relevance - a.relevance || a.id.localeCompare(b.id)
  if (pool.length <= limit) return pool.sort(byRelevance).map((candidate) => candidate.item)

  const selected: typeof pool = []
  const selectedEmbs: number[][] = []
  pool.sort(byRelevance)
  selected.push(pool.shift()!)
  if (selected[0].embedding) selectedEmbs.push(selected[0].embedding)

  while (selected.length < limit && pool.length > 0) {
    if (opts.signal?.aborted) break
    let bestIdx = 0
    let bestMmr = -Infinity
    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i]
      let maxSim = 0
      if (candidate.embedding && selectedEmbs.length > 0) {
        for (const selectedEmbedding of selectedEmbs) {
          const sim = cosineSimilarity(candidate.embedding, selectedEmbedding)
          if (sim > maxSim) maxSim = sim
        }
      }
      const mmr = lambda * candidate.relevance - (1 - lambda) * maxSim
      if (
        mmr > bestMmr ||
        (mmr === bestMmr && candidate.id.localeCompare(pool[bestIdx].id) < 0)
      ) {
        bestMmr = mmr
        bestIdx = i
      }
    }
    const chosen = pool.splice(bestIdx, 1)[0]
    selected.push(chosen)
    if (chosen.embedding) selectedEmbs.push(chosen.embedding)
  }
  return selected.map((candidate) => candidate.item)
}

/**
 * Maximal Marginal Relevance over lexical n-gram overlap.
 *
 * Moved verbatim from `vector-rag.ts` (which re-exports it) so the new candidate-generator
 * pipeline and the legacy hybrid search share one implementation instead of two drifting copies.
 *
 * Redundancy is measured by word bigram / trigram / character 4-gram Jaccard overlap, computed
 * in JS — no embeddings required, <1 ms for a pool of 20. `similarity` MUST be on a [0,1] scale
 * so it is commensurable with the Jaccard penalty. λ=1.0 disables MMR (pure relevance).
 */
export function applyMMR<T extends { id: string; content: string; heading: string | null; similarity?: number }>(
  chunks: T[],
  topK: number,
  lambda = DEFAULT_MMR_LAMBDA
): T[] {
  const limit = Math.min(Math.max(0, Math.floor(topK)), chunks.length)
  if (limit <= 0) return []
  const boundedLambda = Math.max(0, Math.min(1, lambda))
  // `similarity` is already calibrated to [0,1] (cosine-like retrieval score).
  // Do not min-max it per candidate pool: that turns a valid 0.70 hit into 0 and
  // can make a near-duplicate outrank an unrelated but still relevant passage.
  const relevanceScores = chunks.map((chunk) => {
    const score = chunk.similarity ?? 0
    return Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0
  })
  const initialOrder = chunks
    .map((chunk, index) => ({ chunk, index, relevance: relevanceScores[index] }))
    .sort((a, b) => b.relevance - a.relevance || a.chunk.id.localeCompare(b.chunk.id))
  if (chunks.length <= limit || boundedLambda >= 1) return initialOrder.slice(0, limit).map(({ chunk }) => chunk)

  function tokenize(text: string): Set<string> {
    const clean = text.toLowerCase()
    const words = clean.split(/\s+/).filter((w) => w.length > 2)
    const ngrams = new Set<string>()
    for (let i = 0; i < words.length - 1; i++) {
      ngrams.add(`w2:${words[i]} ${words[i + 1]}`)
      if (i < words.length - 2) {
        ngrams.add(`w3:${words[i]} ${words[i + 1]} ${words[i + 2]}`)
      }
    }
    const condensed = clean.replace(/\s+/g, " ")
    for (let i = 0; i < Math.min(condensed.length - 3, 500); i += 2) {
      ngrams.add(`c4:${condensed.slice(i, i + 4)}`)
    }
    return ngrams
  }

  function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0
    let inter = 0
    for (const t of a) if (b.has(t)) inter++
    return inter / (a.size + b.size - inter)
  }

  const tokenSets = chunks.map((c) => tokenize(c.content))
  const selected: number[] = []
  const remaining = new Set(chunks.map((_, i) => i))

  while (selected.length < limit && remaining.size > 0) {
    let bestIdx = -1
    let bestScore = -Infinity

    for (const idx of remaining) {
      const relevance = relevanceScores[idx]
      let maxSim = 0
      for (const selIdx of selected) {
        maxSim = Math.max(maxSim, jaccard(tokenSets[idx], tokenSets[selIdx]))
      }
      const mmrScore = boundedLambda * relevance - (1 - boundedLambda) * maxSim
      if (
        mmrScore > bestScore ||
        (mmrScore === bestScore && (bestIdx === -1 || chunks[idx].id.localeCompare(chunks[bestIdx].id) < 0))
      ) {
        bestScore = mmrScore
        bestIdx = idx
      }
    }

    if (bestIdx === -1) break
    selected.push(bestIdx)
    remaining.delete(bestIdx)
  }

  return selected.map((i) => chunks[i])
}

// ---------------------------------------------------------------------------
// Novelty drift
// ---------------------------------------------------------------------------

/**
 * Detects when a query has no near match anywhere in the corpus.
 *
 * New in this module (not extracted): `novelty-detector.ts` compares thesis claims against
 * *external* papers with a 0.82 cosine threshold. This is the intra-corpus question — "is there
 * anything in this thesis close to what was asked?" — so the threshold is much lower: at 0.5,
 * nothing in the corpus is even loosely on topic.
 *
 * Requires query embeddings; without them no claim can be made, so it returns `triggered: false`
 * rather than guessing.
 */
export function detectNoveltyDrift(
  queryEmbeddings: number[][],
  candidates: Array<{ embedding: number[] | null }>,
  opts: { maxSimilarity?: number } = {}
): { triggered: boolean; maxSimilarity: number | null } {
  const threshold = opts.maxSimilarity ?? 0.5
  let maxSimilarity: number | null = null
  const candidateEmbs = candidates.map((c) => c.embedding).filter((e): e is number[] => Boolean(e))
  if (candidateEmbs.length === 0 || queryEmbeddings.length === 0) {
    return { triggered: false, maxSimilarity: null }
  }
  for (const qe of queryEmbeddings) {
    for (const ce of candidateEmbs) {
      const sim = cosineSimilarity(qe, ce)
      if (maxSimilarity === null || sim > maxSimilarity) maxSimilarity = sim
    }
  }
  return { triggered: maxSimilarity !== null && maxSimilarity < threshold, maxSimilarity }
}

// ---------------------------------------------------------------------------
// Reranking
// ---------------------------------------------------------------------------

export interface RerankableCandidate {
  id: string
  content: string
  /** Fusion score, used when no neural reranker is available. */
  score: number
}

export interface RerankResult<T extends RerankableCandidate> {
  items: Array<T & { rerankScore: number }>
  /** True only when a real cross-encoder produced the scores. */
  usedNeuralReranker: boolean
  /** What actually produced the ordering — recorded in the trace, never guessed. */
  scorer: "cross-encoder" | "lexical-heuristic" | "fusion-score"
  error?: string
  latencyMs: number
}

/**
 * Reranks a candidate pool with a real cross-encoder when one is available.
 *
 * Falls back to the fusion score (not to a lexical heuristic) and says so. A lexical heuristic
 * is available explicitly via `lexicalHeuristicScores`; it is a keyword scorer and is labelled
 * as one, so no evaluation table can claim a cross-encoder was used when it was not.
 */
export async function rerankCandidates<T extends RerankableCandidate>(
  query: string,
  candidates: T[],
  opts: { limit?: number; useNeural?: boolean; signal?: AbortSignal } = {}
): Promise<RerankResult<T>> {
  const started = Date.now()
  const limit = opts.limit ?? candidates.length
  if (candidates.length === 0) {
    return { items: [], usedNeuralReranker: false, scorer: "fusion-score", latencyMs: 0 }
  }
  if (opts.useNeural === false) {
    const sorted = [...candidates].sort((a, b) => b.score - a.score).slice(0, limit)
    return {
      items: sorted.map((c) => ({ ...c, rerankScore: c.score })),
      usedNeuralReranker: false,
      scorer: "fusion-score",
      latencyMs: Date.now() - started,
    }
  }

  const reranker = opts.signal?.aborted ? null : getReranker()
  if (!reranker) {
    const sorted = [...candidates].sort((a, b) => b.score - a.score).slice(0, limit)
    return {
      items: sorted.map((c) => ({ ...c, rerankScore: c.score })),
      usedNeuralReranker: false,
      scorer: "fusion-score",
      latencyMs: Date.now() - started,
      error: "reranker disabled or unavailable",
    }
  }

  try {
    const scores = await reranker.rerank(query, candidates.map((c) => c.content))
    if (!scores || scores.length !== candidates.length) {
      // `null` is the reranker's own "I could not run" signal — not an error to hide.
      const sorted = [...candidates].sort((a, b) => b.score - a.score).slice(0, limit)
      return {
        items: sorted.map((c) => ({ ...c, rerankScore: c.score })),
        usedNeuralReranker: false,
        scorer: "fusion-score",
        error: "reranker returned no scores",
        latencyMs: Date.now() - started,
      }
    }
    const scored = scores
      .map((score, index) => ({ ...candidates[index], rerankScore: score }))
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, limit)
    return { items: scored, usedNeuralReranker: true, scorer: "cross-encoder", latencyMs: Date.now() - started }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const sorted = [...candidates].sort((a, b) => b.score - a.score).slice(0, limit)
    return {
      items: sorted.map((c) => ({ ...c, rerankScore: c.score })),
      usedNeuralReranker: false,
      scorer: "fusion-score",
      error: message,
      latencyMs: Date.now() - started,
    }
  }
}

/**
 * Lexical-heuristic scoring for candidates.
 *
 * Kept separate and honestly named: this is what the legacy pipeline called "rerank", and it is
 * not a cross-encoder. It stays available because it is fast, dependency-free and useful as an
 * ablation baseline.
 */
export function heuristicRerankScores(query: string, contents: string[]): number[] {
  return lexicalHeuristicScores(query, contents)
}

// ---------------------------------------------------------------------------
// Vector maths
// ---------------------------------------------------------------------------

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/** Embeds a batch of texts for MMR, tolerating per-text failures. */
export async function embedForDiversity(texts: string[]): Promise<Array<number[] | null>> {
  if (texts.length === 0) return []
  try {
    return await embedTexts(texts, "passage")
  } catch {
    return texts.map(() => null)
  }
}
