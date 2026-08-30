import { pipeline, env } from "@xenova/transformers"
import { createHash } from "crypto"

// We want to download the model if it's missing, but not rely on local filesystem caching
// inside standard Next.js folders that might get wiped.
env.allowLocalModels = false

class PipelineSingleton {
  static task: any = "feature-extraction"
  // Multilingual MiniLM-L12-v2: Slovak, Czech, English, 384-dim, runs fully in Node.js WASM
  static model = "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
  static instance: any = null

  static async getInstance(progress_callback?: any) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback })
    }
    return this.instance
  }
}

// ---------------------------------------------------------------------------
// In-process LRU Embedding Cache
// ---------------------------------------------------------------------------
// Avoids redundant WASM inference calls for identical text inputs.
// Bounded at MAX_CACHE_SIZE entries; when full, the oldest entry (by insertion
// order) is evicted (Map preserves insertion order in V8).
// Keyed by SHA-256(text).slice(0,16) — collision probability negligible for
// the expected cardinality (<10k unique queries per server lifetime).

const EMBEDDING_CACHE_MAX = 1024
const embeddingCache = new Map<string, number[]>()

function cacheKey(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16)
}

function cachePut(key: string, vec: number[]): void {
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
    // Evict the oldest insertion (first key in Map iteration order)
    embeddingCache.delete(embeddingCache.keys().next().value as string)
  }
  embeddingCache.set(key, vec)
}

/** Returns current cache hit statistics — useful for diagnostics. */
export function getEmbeddingCacheStats() {
  return { size: embeddingCache.size, maxSize: EMBEDDING_CACHE_MAX }
}

/** Clears the entire embedding cache. */
export function clearEmbeddingCache() {
  embeddingCache.clear()
}

/**
 * Generates an embedding array for the given text using local Transformers.js model.
 * Results are cached in-process to avoid redundant WASM inference. Cache is bounded
 * at 512 entries with LRU-style eviction (oldest insertion first).
 *
 * No API calls to OpenAI or external providers are made.
 *
 * @param text The text to embed
 * @returns number[384] — L2-normalized embedding vector
 */
export async function generateLocalEmbedding(text: string): Promise<number[]> {
  const key = cacheKey(text)
  const cached = embeddingCache.get(key)
  if (cached) return cached

  const embedder = await PipelineSingleton.getInstance()
  const output = await embedder(text, { pooling: "mean", normalize: true })

  // output.data is a Float32Array — convert to plain Array for Prisma/Postgres
  const vec = Array.from(output.data) as number[]
  cachePut(key, vec)
  return vec
}
