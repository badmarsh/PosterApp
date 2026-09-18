/**
 * Local embeddings — compatibility façade over `model-registry.ts`.
 *
 * This module used to own the model id, the 512-token window, the LRU cache and the WASM
 * queue. All of that now lives in `lib/ai/model-registry.ts` so the embedding model is
 * configurable (`EMBEDDING_MODEL`, `EMBEDDING_DIM`, `MAX_EMBEDDING_TOKENS`,
 * `EMBEDDING_BACKEND`) and benchmarkable.
 *
 * The exports below are preserved verbatim because they are consumed by `vector-rag.ts`,
 * `graph-rag.ts`, `document-chunker.ts`, `novelty-detector.ts`, `evidence-validator.ts`,
 * `instrumentation.ts`, the rag-stats route and several tests. Nothing outside this file had
 * to change to get the registry.
 *
 * No API calls to OpenAI or other external providers are made unless
 * `EMBEDDING_BACKEND=openai-compatible` is explicitly configured.
 */

import {
  embedText,
  embedTexts,
  getModelCacheStats,
  clearModelCache,
  getEmbeddingModel,
  warmUpEmbeddingModel,
  modelHealth,
  type EmbeddingInputKind,
} from "./model-registry"

/**
 * Process-wide health of the local embedder. When `fallbackCount > 0`, some vectors in the
 * index are hash-based pseudo-embeddings and semantic retrieval quality is degraded — the UI
 * surfaces this instead of silently returning nonsense matches.
 *
 * Backed by live getters over `modelHealth` so the rag-stats route always reports the current
 * registry state rather than a stale copy.
 */
export const embeddingHealth: {
  fallbackCount: number
  lastError: string | null
  lastFallbackAt: string | null
  warmedUp: boolean
} = {
  get fallbackCount() {
    return modelHealth.embedding.fallbackCount
  },
  set fallbackCount(v: number) {
    modelHealth.embedding.fallbackCount = v
  },
  get lastError() {
    return modelHealth.embedding.lastError
  },
  set lastError(v: string | null) {
    modelHealth.embedding.lastError = v
  },
  lastFallbackAt: null,
  get warmedUp() {
    return modelHealth.embedding.warmedUp
  },
  set warmedUp(v: boolean) {
    modelHealth.embedding.warmedUp = v
  },
}

/** Returns current cache statistics — useful for diagnostics. */
export function getEmbeddingCacheStats() {
  return getModelCacheStats()
}

/** Clears the entire embedding cache. */
export function clearEmbeddingCache() {
  clearModelCache()
}

/**
 * Loads the embedding model ahead of the first real query. Safe to call repeatedly; errors are
 * recorded in `embeddingHealth` and reported as `false`.
 */
export async function warmUpLocalEmbeddings(): Promise<boolean> {
  return warmUpEmbeddingModel()
}

/**
 * Generates an embedding for `text` using the configured model.
 *
 * @param text The text to embed.
 * @param kind `query` | `passage`. Matters for E5/Qwen3-class models that require instruction
 *             prefixes; ignored by models without prefixes. Defaults to `passage`, which
 *             reproduces the historical behaviour for every existing caller.
 * @returns L2-normalised embedding vector of `getEmbeddingModel().getDimensions()` width.
 */
export async function generateLocalEmbedding(text: string, kind: EmbeddingInputKind = "passage"): Promise<number[]> {
  const vec = await embedText(text, kind)
  if (modelHealth.embedding.fallbackCount > 0 && !embeddingHealth.lastFallbackAt) {
    embeddingHealth.lastFallbackAt = new Date().toISOString()
  }
  return vec
}

/** Batched variant — one call per batch instead of one per chunk during ingestion. */
export async function generateLocalEmbeddings(texts: string[], kind: EmbeddingInputKind = "passage"): Promise<number[][]> {
  return embedTexts(texts, kind)
}

/** Width of the vectors this process writes to pgvector. */
export function getEmbeddingDimensions(): number {
  return getEmbeddingModel().getDimensions()
}

/** Token window the active model will actually attend to. */
export function getEmbeddingMaxTokens(): number {
  return getEmbeddingModel().getMaxTokens()
}

/** Active model id (surfaced by rag-stats and the evaluation dashboard). */
export function getEmbeddingModelId(): string {
  return getEmbeddingModel().getModelInfo().id
}
