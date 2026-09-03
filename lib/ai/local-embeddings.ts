import { pipeline, env } from "@xenova/transformers"
import { createHash } from "crypto"

// We want to download the model if it's missing, but not rely on local filesystem caching
// inside standard Next.js folders that might get wiped.
env.allowLocalModels = false

class PipelineSingleton {
  static task: any = "feature-extraction"
  // Multilingual MiniLM-L12-v2: Slovak, Czech, English, 384-dim, runs fully in Node.js WASM
  static model = "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
  static instancePromise: Promise<any> | null = null

  static async getInstance(progress_callback?: any) {
    if (!this.instancePromise) {
      this.instancePromise = pipeline(this.task, this.model, { progress_callback }).catch((err) => {
        this.instancePromise = null
        throw err
      })
    }
    return this.instancePromise
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

// Sequential queue to serialize WASM inference passes and prevent out-of-memory spikes
let embeddingQueue: Promise<unknown> = Promise.resolve()

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
 * at 1024 entries with LRU-style eviction (oldest insertion first).
 *
 * Calls are serialized through an in-memory queue so concurrent criterion requests
 * do not overwhelm Node's WebAssembly heap.
 *
 * No API calls to OpenAI or external providers are made.
 *
 * @param text The text to embed
 * @returns number[384] — L2-normalized embedding vector
 */
/**
 * Process-wide health of the local embedder. When `fallbackCount > 0`, some
 * vectors in the index are hash-based pseudo-embeddings and semantic retrieval
 * quality is degraded — the UI surfaces this instead of silently returning
 * nonsense matches.
 */
export const embeddingHealth = {
  fallbackCount: 0,
  lastError: null as string | null,
  lastFallbackAt: null as string | null,
  warmedUp: false,
}

/**
 * Loads the WASM model ahead of the first real query (10–30 s cold start on
 * first boot). Safe to call repeatedly; errors are recorded in `embeddingHealth`.
 */
export async function warmUpLocalEmbeddings(): Promise<boolean> {
  if (embeddingHealth.warmedUp) return true
  if (process.env.VITEST && !process.env.TEST_REAL_EMBEDDINGS) { embeddingHealth.warmedUp = true; return true }
  try {
    await PipelineSingleton.getInstance()
    embeddingHealth.warmedUp = true
    return true
  } catch (err) {
    embeddingHealth.lastError = err instanceof Error ? err.message : String(err)
    return false
  }
}

export async function generateLocalEmbedding(text: string): Promise<number[]> {
  const key = cacheKey(text)
  const cached = embeddingCache.get(key)
  if (cached) return cached

  if (process.env.VITEST && !process.env.TEST_REAL_EMBEDDINGS) {
    const hash = createHash("sha256").update(text).digest()
    const vec = new Array(384).fill(0).map((_, i) => (hash[i % hash.length] - 128) / 128)
    const norm = Math.hypot(...vec) || 1
    const normalized = vec.map((v) => v / norm)
    cachePut(key, normalized)
    return normalized
  }

  // Chain WASM inference through sequential queue to prevent Zone Allocation OOM
  const runTask = async (): Promise<number[]> => {
    // Re-check cache in case a previously queued task already computed this embedding
    const cachedAgain = embeddingCache.get(key)
    if (cachedAgain) return cachedAgain

    try {
      const embedder = await PipelineSingleton.getInstance()
      embeddingHealth.warmedUp = true
      // Explicit 512-token window (model_max_length of MiniLM-L12) so a whole
      // 1.2–1.5k-char chunk is embedded, not just its first ~128 tokens.
      const output = await embedder(text, { pooling: "mean", normalize: true, truncation: true, max_length: 512 })
      const vec = Array.from(output.data) as number[]
      cachePut(key, vec)
      return vec
    } catch (err) {
      embeddingHealth.fallbackCount++
      embeddingHealth.lastError = err instanceof Error ? err.message : String(err)
      embeddingHealth.lastFallbackAt = new Date().toISOString()
      console.warn("[local-embeddings] Embedding inference failed, using deterministic fallback vector:", err)
      // Return a deterministic fallback vector so the process never crashes
      const hash = createHash("sha256").update(text).digest()
      const fallback = new Array(384).fill(0).map((_, i) => (hash[i % hash.length] - 128) / 128)
      const norm = Math.hypot(...fallback) || 1
      const normalized = fallback.map((v) => v / norm)
      return normalized
    }
  }

  const resultPromise = embeddingQueue.then(runTask, runTask)
  embeddingQueue = resultPromise.then(() => {}, () => {})
  return resultPromise
}
