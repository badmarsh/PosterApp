/**
 * Pluggable local model registry.
 *
 * Why this exists
 * ---------------
 * The retrieval stack used to be hard-wired to a single embedding model
 * (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, 384-dim, 512-token window) and a single
 * reranker. That makes two things impossible:
 *
 *   1. **Benchmarking.** You cannot compare embedding/reranker combinations on a workload
 *      if the model is a constant inside the module that uses it.
 *   2. **Upgrading.** Changing model means editing code in ≥6 files, and the vector column
 *      dimension silently disagrees with the vectors being written.
 *
 * This module therefore owns *model selection*, *inference*, *batching* and *caching*, and
 * exposes one narrow interface to the rest of the pipeline:
 *
 *   embed(text, kind) / embedBatch(texts, kind) / rerank(query, docs)
 *   getDimensions() / getMaxTokens() / getModelInfo()
 *
 * Backends
 * --------
 * - `xenova-v2`          Transformers.js v2 (`@xenova/transformers`, already a dependency).
 *                        This is the default and the only backend that needs no new install.
 * - `hf-v3`              `@huggingface/transformers` v3/v4, loaded through a *runtime*
 *                        (non-static) import so the build does not require the package.
 *                        Needed for models Transformers.js v2 cannot run (e.g. Qwen3-Embedding).
 * - `openai-compatible`  Any gateway exposing `POST /v1/embeddings`. Lets a deployment use a
 *                        hosted multilingual model without local inference.
 * - `reference-ngram`    Dependency-free deterministic hashing vectoriser (word uni/bigrams +
 *                        char 3–5 grams, L2-normalised). It is **not** a neural embedding and
 *                        is never claimed to be one; it exists so the retrieval pipeline,
 *                        fusion layer and evaluation harness are runnable and reproducible in
 *                        environments with no model download (CI, offline sandboxes).
 *
 * Nothing here calls an external embedding API unless `EMBEDDING_BACKEND=openai-compatible`
 * is explicitly configured.
 *
 * @module model-registry
 */

import { createHash } from "crypto"

// ---------------------------------------------------------------------------
// Descriptors
// ---------------------------------------------------------------------------

export type EmbeddingBackend = "xenova-v2" | "hf-v3" | "openai-compatible" | "reference-ngram"
export type EmbeddingInputKind = "query" | "passage"

export interface ModelInfo {
  /** Model identifier as the backend understands it (e.g. an HF repo id). */
  id: string
  kind: "embedding" | "reranker"
  backend: EmbeddingBackend
  /** Output dimensionality. Vectors written to pgvector must match the column. */
  dimensions: number
  /** Maximum input tokens the model will actually attend to. */
  maxTokens: number
  /**
   * Calibration constant for the offline token estimator (see `token-budget.ts`).
   * Only used when the model's real tokenizer is not loaded.
   */
  charsPerToken: number
  languages: string[]
  /** Instruction/prefix required in front of queries (E5-style, Qwen3-style). */
  queryPrefix?: string
  /** Instruction/prefix required in front of passages (E5-style). */
  passagePrefix?: string
  /** Matryoshka (MRL) output dimensions the model can be truncated to. */
  matryoshkaDims?: number[]
  /** Where the descriptor came from. `user` = declared via env, unverified upstream. */
  source: "builtin" | "user"
  notes?: string
}

/**
 * Known multilingual retrieval models.
 *
 * `dimensions` / `maxTokens` are the values published on the upstream model cards. They are
 * *declarations*, not measurements: `verifyDimensions()` re-checks the real width of the first
 * vector produced and records the observed value in `modelHealth`, so a wrong declaration
 * surfaces as a loud mismatch instead of a corrupt index.
 *
 * Deliberately absent: any claim that one of these is "the best". Which one wins is decided by
 * `lib/ai/eval/model-benchmark.ts` on this workload, not by reputation.
 */
const BUILTIN_EMBEDDINGS: ModelInfo[] = [
  {
    id: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    kind: "embedding",
    backend: "xenova-v2",
    dimensions: 384,
    maxTokens: 512,
    charsPerToken: 3.6,
    languages: ["sk", "cs", "en", "de", "pl", "+50"],
    source: "builtin",
    notes: "Legacy default. Small and fast; short window makes it a weak fit for 1.5k-char chunks.",
  },
  {
    id: "Xenova/bge-m3",
    kind: "embedding",
    backend: "xenova-v2",
    dimensions: 1024,
    maxTokens: 8192,
    charsPerToken: 3.4,
    languages: ["sk", "cs", "en", "+100"],
    source: "builtin",
    notes: "BGE-M3 class: very long context, dense+sparse+multi-vector training objective.",
  },
  {
    id: "Xenova/multilingual-e5-base",
    kind: "embedding",
    backend: "xenova-v2",
    dimensions: 768,
    maxTokens: 512,
    charsPerToken: 3.6,
    languages: ["sk", "cs", "en", "+98"],
    queryPrefix: "query: ",
    passagePrefix: "passage: ",
    source: "builtin",
    notes: "Multilingual E5 class. REQUIRES the query:/passage: prefixes — omitting them loses most of the quality.",
  },
  {
    id: "Xenova/multilingual-e5-large",
    kind: "embedding",
    backend: "xenova-v2",
    dimensions: 1024,
    maxTokens: 512,
    charsPerToken: 3.6,
    languages: ["sk", "cs", "en", "+98"],
    queryPrefix: "query: ",
    passagePrefix: "passage: ",
    source: "builtin",
  },
  {
    id: "Xenova/multilingual-e5-large-instruct",
    kind: "embedding",
    backend: "xenova-v2",
    dimensions: 1024,
    maxTokens: 512,
    charsPerToken: 3.6,
    languages: ["sk", "cs", "en", "+98"],
    queryPrefix: "query: ",
    passagePrefix: "passage: ",
    source: "builtin",
  },
  {
    id: "Qwen/Qwen3-Embedding-0.6B",
    kind: "embedding",
    backend: "hf-v3",
    dimensions: 1024,
    maxTokens: 32768,
    charsPerToken: 3.2,
    languages: ["sk", "cs", "en", "+100"],
    matryoshkaDims: [32, 64, 128, 256, 512, 768, 1024],
    queryPrefix: "Instruct: Given a thesis-review question, retrieve the passages that answer it\nQuery: ",
    source: "builtin",
    notes: "Qwen3-Embedding class. Needs Transformers.js v3/v4 (backend=hf-v3); Matryoshka output dims.",
  },
  {
    id: "Qwen/Qwen3-Embedding-4B",
    kind: "embedding",
    backend: "hf-v3",
    dimensions: 2560,
    maxTokens: 32768,
    charsPerToken: 3.2,
    languages: ["sk", "cs", "en", "+100"],
    matryoshkaDims: [32, 64, 128, 256, 512, 768, 1024, 1536, 2048, 2560],
    queryPrefix: "Instruct: Given a thesis-review question, retrieve the passages that answer it\nQuery: ",
    source: "builtin",
    notes: "Large; local CPU inference is impractical — benchmark only where a GPU or a served endpoint exists.",
  },
  {
    id: "reference-ngram",
    kind: "embedding",
    backend: "reference-ngram",
    dimensions: 384,
    maxTokens: 8192,
    charsPerToken: 4,
    languages: ["any"],
    source: "builtin",
    notes:
      "Deterministic hashing vectoriser. NOT a neural embedding. Exists so retrieval/fusion/eval " +
      "code paths are executable and reproducible with no model download.",
  },
]

const BUILTIN_RERANKERS: ModelInfo[] = [
  {
    id: "Xenova/bge-reranker-v2-m3",
    kind: "reranker",
    backend: "xenova-v2",
    dimensions: 1,
    maxTokens: 512,
    charsPerToken: 3.4,
    languages: ["sk", "cs", "en", "+100"],
    source: "builtin",
    notes: "True cross-encoder: reads (query, passage) jointly and emits a relevance logit.",
  },
  {
    id: "Xenova/bge-reranker-base",
    kind: "reranker",
    backend: "xenova-v2",
    dimensions: 1,
    maxTokens: 512,
    charsPerToken: 3.6,
    languages: ["en", "zh"],
    source: "builtin",
    notes: "English-biased; kept as a small-memory option, not recommended for SK/CS theses.",
  },
  {
    id: "Xenova/bge-reranker-large",
    kind: "reranker",
    backend: "xenova-v2",
    dimensions: 1,
    maxTokens: 512,
    charsPerToken: 3.6,
    languages: ["en", "zh"],
    source: "builtin",
  },
  {
    id: "Xenova/ms-marco-MiniLM-L-6-v2",
    kind: "reranker",
    backend: "xenova-v2",
    dimensions: 1,
    maxTokens: 512,
    charsPerToken: 4,
    languages: ["en"],
    source: "builtin",
  },
  {
    id: "Qwen/Qwen3-Reranker-0.6B",
    kind: "reranker",
    backend: "hf-v3",
    dimensions: 1,
    maxTokens: 32768,
    charsPerToken: 3.2,
    languages: ["sk", "cs", "en", "+100"],
    source: "builtin",
    notes:
      "Generative reranker: scores a yes/no token logit rather than a classification head. " +
      "Substantially slower than a cross-encoder on CPU; benchmark before enabling.",
  },
  {
    id: "lexical-heuristic",
    kind: "reranker",
    backend: "reference-ngram",
    dimensions: 1,
    maxTokens: 8192,
    charsPerToken: 4,
    languages: ["any"],
    source: "builtin",
    notes:
      "Baseline 'reranker' = the existing token-overlap + section-alignment heuristic. " +
      "Named explicitly so benchmark tables never present a heuristic as a cross-encoder.",
  },
]

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function envStr(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

export interface RegistryConfig {
  embeddingModel: string
  embeddingBackend: EmbeddingBackend
  embeddingDim: number
  maxEmbeddingTokens: number
  rerankerEnabled: boolean
  rerankerModel: string
  /** Matryoshka truncation for MRL models (0 = use the model's native width). */
  embeddingTruncateDim: number
  batchSize: number
  cacheSize: number
}

const DEFAULT_EMBEDDING_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
const DEFAULT_RERANKER_MODEL = "Xenova/bge-reranker-v2-m3"

/**
 * Resolves the active configuration. Re-read on every call so tests (and a running server
 * that mutates `process.env`) see changes without a module reload.
 */
export function getRegistryConfig(): RegistryConfig {
  const embeddingModel = envStr("EMBEDDING_MODEL") ?? DEFAULT_EMBEDDING_MODEL
  const known = BUILTIN_EMBEDDINGS.find((m) => m.id === embeddingModel)
  const declaredDim = envInt("EMBEDDING_DIM", 0)
  return {
    embeddingModel,
    embeddingBackend: (envStr("EMBEDDING_BACKEND") as EmbeddingBackend) ?? known?.backend ?? "xenova-v2",
    embeddingDim: declaredDim > 0 ? declaredDim : known?.dimensions ?? 384,
    maxEmbeddingTokens: envInt("MAX_EMBEDDING_TOKENS", known?.maxTokens ?? 512),
    rerankerEnabled: envStr("RERANKER_ENABLED") !== "false" && envStr("AI_RERANKER_ENABLED") !== "false",
    // RERANKER_MODEL is the documented name; AI_RERANKER_MODEL is the pre-existing one.
    rerankerModel: envStr("RERANKER_MODEL") ?? envStr("AI_RERANKER_MODEL") ?? DEFAULT_RERANKER_MODEL,
    embeddingTruncateDim: envInt("EMBEDDING_TRUNCATE_DIM", 0),
    batchSize: envInt("EMBEDDING_BATCH_SIZE", 8),
    cacheSize: envInt("MODEL_CACHE_SIZE", 2048),
  }
}

/** Looks up a descriptor, synthesising a `source: "user"` entry for unknown ids. */
export function describeModel(id: string, kind: "embedding" | "reranker"): ModelInfo {
  const table = kind === "embedding" ? BUILTIN_EMBEDDINGS : BUILTIN_RERANKERS
  const hit = table.find((m) => m.id === id)
  if (hit) return hit
  const cfg = getRegistryConfig()
  return {
    id,
    kind,
    backend: kind === "embedding" ? cfg.embeddingBackend : "xenova-v2",
    dimensions: kind === "embedding" ? cfg.embeddingDim : 1,
    maxTokens: kind === "embedding" ? cfg.maxEmbeddingTokens : 512,
    charsPerToken: 3.6,
    languages: ["unknown"],
    source: "user",
    notes: "Unknown model id — dimensions taken from EMBEDDING_DIM; verify before indexing.",
  }
}

export function listKnownModels(kind?: "embedding" | "reranker"): ModelInfo[] {
  if (kind === "embedding") return [...BUILTIN_EMBEDDINGS]
  if (kind === "reranker") return [...BUILTIN_RERANKERS]
  return [...BUILTIN_EMBEDDINGS, ...BUILTIN_RERANKERS]
}

// ---------------------------------------------------------------------------
// Health / observability
// ---------------------------------------------------------------------------

export const modelHealth = {
  embedding: {
    model: "",
    backend: "" as EmbeddingBackend | "",
    declaredDimensions: 0,
    observedDimensions: 0 as number | null,
    /** Vectors produced by the deterministic fallback path (semantic quality degraded). */
    fallbackCount: 0,
    lastError: null as string | null,
    warmedUp: false,
    inferenceCalls: 0,
    inferenceMs: 0,
  },
  reranker: {
    model: "",
    backend: "" as EmbeddingBackend | "",
    enabled: false,
    failures: 0,
    calls: 0,
    lastError: null as string | null,
    warmedUp: false,
    inferenceMs: 0,
  },
  cache: { hits: 0, misses: 0, size: 0, maxSize: 0 },
}

export function getModelHealthSnapshot() {
  return JSON.parse(JSON.stringify(modelHealth)) as typeof modelHealth
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * Bounded LRU keyed by `modelId:kind:sha256(text)`.
 *
 * The key includes the model id and the input kind so that (a) switching `EMBEDDING_MODEL`
 * can never serve a vector from the previous model, and (b) an E5 `query:` prefixed vector is
 * never reused as a passage vector.
 */
const cache = new Map<string, number[]>()

function cacheKey(modelId: string, kind: EmbeddingInputKind, text: string): string {
  return `${modelId}|${kind}|${createHash("sha256").update(text, "utf8").digest("hex").slice(0, 32)}`
}

function cacheGet(key: string): number[] | undefined {
  const hit = cache.get(key)
  if (hit) {
    // Refresh recency (Map iterates in insertion order).
    cache.delete(key)
    cache.set(key, hit)
    modelHealth.cache.hits++
    return hit
  }
  modelHealth.cache.misses++
  return undefined
}

function cachePut(key: string, vec: number[]): void {
  const max = getRegistryConfig().cacheSize
  if (cache.size >= max) {
    const oldest = cache.keys().next().value as string | undefined
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, vec)
  modelHealth.cache.size = cache.size
  modelHealth.cache.maxSize = max
}

export function getModelCacheStats() {
  return { size: cache.size, maxSize: getRegistryConfig().cacheSize, hits: modelHealth.cache.hits, misses: modelHealth.cache.misses }
}

export function clearModelCache(): void {
  cache.clear()
  modelHealth.cache.size = 0
  modelHealth.cache.hits = 0
  modelHealth.cache.misses = 0
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

export function l2Normalize(vec: number[]): number[] {
  let sum = 0
  for (const v of vec) sum += v * v
  const norm = Math.sqrt(sum) || 1
  return vec.map((v) => v / norm)
}

/** Matryoshka truncation + renormalisation (for MRL models). */
export function truncateVector(vec: number[], dim: number): number[] {
  if (dim <= 0 || vec.length <= dim) return vec
  return l2Normalize(vec.slice(0, dim))
}

/**
 * Deterministic hashing vectoriser. Word uni/bigrams + character 3/4/5-grams are hashed into
 * `dim` signed buckets, then L2-normalised. Zero dependencies, fully reproducible, and
 * sensitive to subword overlap (so it is not identical to exact-match lexical search).
 *
 * It is a *reference* backend for exercising and benchmarking pipeline machinery. It is not a
 * semantic model and benchmark rows produced with it are labelled as such.
 */
export function referenceNgramVector(text: string, dim: number): number[] {
  const vec = new Array<number>(dim).fill(0)
  const clean = text.toLowerCase().replace(/\s+/g, " ").trim()
  if (!clean) return vec
  const words = clean.split(" ").filter(Boolean)
  const hashTo = (s: string): number => {
    // FNV-1a — fast, stable, dependency-free.
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h
  }
  const bump = (feat: string, weight: number) => {
    const h = hashTo(feat)
    const idx = h % dim
    const sign = (h >>> 16) & 1 ? 1 : -1
    vec[idx] += sign * weight
  }
  for (const w of words) bump(`w1:${w}`, 1)
  for (let i = 0; i + 1 < words.length; i++) bump(`w2:${words[i]} ${words[i + 1]}`, 0.8)
  const condensed = clean.replace(/ /g, "")
  for (let n = 3; n <= 5; n++) {
    const w = n === 3 ? 0.5 : n === 4 ? 0.35 : 0.25
    for (let i = 0; i + n <= condensed.length; i++) bump(`c${n}:${condensed.slice(i, i + n)}`, w)
  }
  return l2Normalize(vec)
}

// ---------------------------------------------------------------------------
// Backend loaders
// ---------------------------------------------------------------------------

type XenovaPipeline = (text: string, opts: Record<string, unknown>) => Promise<{ data: ArrayLike<number> }>

let xenovaEmbedder: Promise<XenovaPipeline> | null = null
let xenovaEmbedderModel = ""

async function loadXenovaEmbedder(modelId: string): Promise<XenovaPipeline> {
  if (xenovaEmbedder && xenovaEmbedderModel === modelId) return xenovaEmbedder
  xenovaEmbedderModel = modelId
  xenovaEmbedder = (async () => {
    const path = await import("path")
    const mod: any = await import("@xenova/transformers")
    mod.env.allowLocalModels = false
    mod.env.cacheDir = process.env.CACHE_DIR || path.join(process.cwd(), ".cache")
    const p = await mod.pipeline("feature-extraction", modelId)
    modelHealth.embedding.warmedUp = true
    return p as XenovaPipeline
  })().catch((err) => {
    xenovaEmbedder = null
    xenovaEmbedderModel = ""
    throw err
  })
  return xenovaEmbedder
}

/**
 * Loads `@huggingface/transformers` (v3/v4) through a runtime specifier so webpack/turbopack
 * never tries to bundle it. The package is intentionally NOT a dependency of this repository:
 * a deployment that wants Qwen3-Embedding-class models installs it and sets
 * `EMBEDDING_BACKEND=hf-v3`.
 */
async function loadHfV3Embedder(modelId: string): Promise<XenovaPipeline> {
  if (xenovaEmbedder && xenovaEmbedderModel === modelId) return xenovaEmbedder
  xenovaEmbedderModel = modelId
  xenovaEmbedder = (async () => {
    const specifier = "@huggingface/transformers"
    const mod: any = await import(/* webpackIgnore: true */ specifier)
    mod.env.allowLocalModels = false
    const p = await mod.pipeline("feature-extraction", modelId, { dtype: "q8" })
    modelHealth.embedding.warmedUp = true
    return p as XenovaPipeline
  })().catch((err) => {
    xenovaEmbedder = null
    xenovaEmbedderModel = ""
    throw err
  })
  return xenovaEmbedder
}

/** OpenAI-compatible `/v1/embeddings`. Uses the same endpoint config as the LLM client. */
async function embedViaHttp(modelId: string, texts: string[]): Promise<number[][]> {
  const baseUrl = (process.env.EMBEDDING_BASE_URL || process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.AI_API_KEY || ""
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model: modelId, input: texts }),
    signal: AbortSignal.timeout(Number(process.env.EMBEDDING_TIMEOUT_MS) || 60_000),
  })
  if (!res.ok) throw new Error(`embeddings HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json: any = await res.json()
  const data: Array<{ embedding: number[]; index: number }> = json?.data ?? []
  return data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

// ---------------------------------------------------------------------------
// Inference (serialized)
// ---------------------------------------------------------------------------

/**
 * WASM inference is serialized through one promise chain. Concurrent criterion retrievals
 * otherwise allocate several model graphs at once and blow the WASM heap — this was already
 * true of the previous implementation and remains true.
 */
let inferenceQueue: Promise<unknown> = Promise.resolve()

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = inferenceQueue.then(fn, fn)
  inferenceQueue = run.then(
    () => {},
    () => {}
  )
  return run
}

/** Deterministic fallback vector so a model failure degrades retrieval instead of failing it. */
function fallbackVector(text: string, dim: number): number[] {
  const hash = createHash("sha256").update(text, "utf8").digest()
  const raw = new Array<number>(dim).fill(0).map((_, i) => (hash[i % hash.length] - 128) / 128)
  return l2Normalize(raw)
}

function withPrefixes(info: ModelInfo, text: string, kind: EmbeddingInputKind): string {
  const prefix = kind === "query" ? info.queryPrefix : info.passagePrefix
  if (!prefix) return text
  return text.startsWith(prefix) ? text : `${prefix}${text}`
}

/**
 * Core embedding entry point.
 *
 * @param text  Raw text. Prefixes required by the model are applied here, never by callers.
 * @param kind  `query` | `passage` — matters for E5/Qwen3-class models.
 */
export async function embedText(text: string, kind: EmbeddingInputKind = "passage"): Promise<number[]> {
  const [vec] = await embedTexts([text], kind)
  return vec
}

/**
 * Batched embedding. Cache hits are served without inference; only misses reach the backend,
 * in `EMBEDDING_BATCH_SIZE` slices.
 */
export async function embedTexts(texts: string[], kind: EmbeddingInputKind = "passage"): Promise<number[][]> {
  const cfg = getRegistryConfig()
  const info = describeModel(cfg.embeddingModel, "embedding")
  const out: number[][] = new Array(texts.length)
  const misses: number[] = []

  for (let i = 0; i < texts.length; i++) {
    const prepared = withPrefixes(info, texts[i], kind)
    const cached = cacheGet(cacheKey(info.id, kind, prepared))
    if (cached) out[i] = cached
    else misses.push(i)
  }
  if (misses.length === 0) return out

  modelHealth.embedding.model = info.id
  modelHealth.embedding.backend = info.backend
  modelHealth.embedding.declaredDimensions = info.dimensions

  const started = Date.now()
  const produced = await enqueue(async () => {
    const results: number[][] = new Array(misses.length)
    for (let s = 0; s < misses.length; s += cfg.batchSize) {
      const sliceIdx = misses.slice(s, s + cfg.batchSize)
      const sliceText = sliceIdx.map((i) => withPrefixes(info, texts[i], kind))
      let vectors: number[][]
      try {
        vectors = await runBackend(info, sliceText)
        modelHealth.embedding.inferenceCalls++
      } catch (err) {
        modelHealth.embedding.fallbackCount += sliceText.length
        modelHealth.embedding.lastError = err instanceof Error ? err.message : String(err)
        console.warn(`[model-registry] embedding inference failed (${info.id}), using deterministic fallback:`, modelHealth.embedding.lastError)
        vectors = sliceText.map((t) => fallbackVector(t, info.dimensions))
      }
      for (let j = 0; j < sliceIdx.length; j++) {
        let v = l2Normalize(vectors[j] ?? [])
        if (cfg.embeddingTruncateDim > 0) v = truncateVector(v, cfg.embeddingTruncateDim)
        results[s + j] = v
      }
    }
    return results
  })
  modelHealth.embedding.inferenceMs += Date.now() - started

  for (let k = 0; k < misses.length; k++) {
    const vec = produced[k]
    if (!modelHealth.embedding.observedDimensions && vec?.length) {
      modelHealth.embedding.observedDimensions = vec.length
    }
    out[misses[k]] = vec
    cachePut(cacheKey(info.id, kind, withPrefixes(info, texts[misses[k]], kind)), vec)
  }
  return out
}

async function runBackend(info: ModelInfo, texts: string[]): Promise<number[][]> {
  // Unit-test short-circuit. The suite must not attempt a model download; it asserts pipeline
  // behaviour, not model quality. Set TEST_REAL_EMBEDDINGS=1 to exercise the real backend.
  // This mirrors the long-standing behaviour of local-embeddings.ts so existing tests are
  // bit-for-bit unaffected.
  if (process.env.VITEST && !process.env.TEST_REAL_EMBEDDINGS && info.backend === "xenova-v2") {
    return texts.map((t) => fallbackVector(t, info.dimensions))
  }
  switch (info.backend) {
    case "reference-ngram":
      return texts.map((t) => referenceNgramVector(t, info.dimensions))
    case "openai-compatible":
      return embedViaHttp(info.id, texts)
    case "hf-v3": {
      const p = await loadHfV3Embedder(info.id)
      // transformers.js v3 accepts a string OR a string[]; the local pipeline type only
      // declares the single-text form, so widen the call site rather than lie in the type.
      const batched = p as unknown as (input: string | string[], o?: Record<string, unknown>) => Promise<unknown>
      const out = await batched(texts, { pooling: "mean", normalize: true, truncation: true, max_length: info.maxTokens })
      return splitBatchOutput(out as any, texts.length, info.dimensions)
    }
    case "xenova-v2":
    default: {
      const p = await loadXenovaEmbedder(info.id)
      const results: number[][] = []
      for (const t of texts) {
        const out = await p(t, { pooling: "mean", normalize: true, truncation: true, max_length: info.maxTokens })
        results.push(Array.from(out.data) as number[])
      }
      return results
    }
  }
}

/**
 * Transformers.js returns either a flat tensor (`{data, dims:[n,d]}`) or an array of tensors
 * depending on version/batching. Normalise both shapes.
 */
function splitBatchOutput(out: { data: ArrayLike<number>; dims?: number[] }, n: number, fallbackDim: number): number[][] {
  if (Array.isArray(out)) return (out as unknown as Array<{ data: ArrayLike<number> }>).map((o) => Array.from(o.data))
  const dims = out.dims
  const dim = dims && dims.length === 2 ? dims[1] : fallbackDim
  const flat = Array.from(out.data)
  const rows: number[][] = []
  for (let i = 0; i < n; i++) rows.push(flat.slice(i * dim, (i + 1) * dim))
  return rows
}

// ---------------------------------------------------------------------------
// Public embedding model object
// ---------------------------------------------------------------------------

export interface EmbeddingModel {
  embed(text: string, kind?: EmbeddingInputKind): Promise<number[]>
  embedBatch(texts: string[], kind?: EmbeddingInputKind): Promise<number[][]>
  getDimensions(): number
  getMaxTokens(): number
  getModelInfo(): ModelInfo
}

/** Returns the active embedding model. Cheap and side-effect free. */
export function getEmbeddingModel(): EmbeddingModel {
  const cfg = getRegistryConfig()
  const info = describeModel(cfg.embeddingModel, "embedding")
  return {
    embed: (text, kind = "passage") => embedText(text, kind),
    embedBatch: (texts, kind = "passage") => embedTexts(texts, kind),
    getDimensions: () => (cfg.embeddingTruncateDim > 0 ? cfg.embeddingTruncateDim : info.dimensions),
    getMaxTokens: () => info.maxTokens,
    getModelInfo: () => ({
      ...info,
      dimensions: cfg.embeddingTruncateDim > 0 ? cfg.embeddingTruncateDim : info.dimensions,
      maxTokens: cfg.maxEmbeddingTokens,
    }),
  }
}

/**
 * Eagerly loads the embedding model. Safe to call repeatedly; errors are recorded in
 * `modelHealth.embedding` and reported as `false` instead of throwing.
 */
export async function warmUpEmbeddingModel(): Promise<boolean> {
  const info = getEmbeddingModel().getModelInfo()
  modelHealth.embedding.model = info.id
  modelHealth.embedding.backend = info.backend
  if (info.backend === "reference-ngram") {
    modelHealth.embedding.warmedUp = true
    return true
  }
  try {
    await embedTexts(["warmup"], "passage")
    modelHealth.embedding.warmedUp = true
    return true
  } catch (err) {
    modelHealth.embedding.lastError = err instanceof Error ? err.message : String(err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Reranker
// ---------------------------------------------------------------------------

export interface RerankModel {
  /**
   * Relevance score per document (higher = more relevant). Returns `null` when the reranker
   * is unavailable, so callers keep the fused/heuristic order instead of failing.
   */
  rerank(query: string, documents: string[]): Promise<number[] | null>
  getModelInfo(): ModelInfo
}


let _pyRerankProc: any = null
let _pyRerankQueue: Array<{ resolve: (s: number[] | null) => void }> = []

function startPythonReranker(): void {
  if (_pyRerankProc) return
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { spawn } = require("child_process") as typeof import("child_process")
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path") as typeof import("path")
  const scriptPath = path.resolve(process.cwd(), "lib/ai/eval/qwen-reranker-server.py")
  const env = { ...process.env, RERANKER_MODEL: getRegistryConfig().rerankerModel }
  const proc = spawn("python", [scriptPath], { stdio: ["pipe", "pipe", "inherit"], env })
  _pyRerankProc = proc
  let buf = ""
  proc.stdout.on("data", (chunk: Buffer) => {
    buf += chunk.toString()
    const lines = buf.split("\n")
    buf = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line)
        if (msg.status === "ready") {
          console.info("[model-registry] Python GPU reranker ready:", msg.model, "on", msg.device)
        } else if (typeof msg.scores !== "undefined" && _pyRerankQueue.length > 0) {
          _pyRerankQueue.shift()!.resolve(msg.scores)
        } else if (msg.error && _pyRerankQueue.length > 0) {
          console.warn("[model-registry] Python reranker:", msg.error)
          _pyRerankQueue.shift()!.resolve(null)
        }
      } catch { /* ignore parse errors */ }
    }
  })
  proc.on("exit", () => { _pyRerankProc = null; for (const p of _pyRerankQueue) p.resolve(null); _pyRerankQueue = [] })
}

async function rerankViaPython(query: string, documents: string[], _modelId: string): Promise<number[] | null> {
  if (documents.length === 0) return null
  const started = Date.now()
  try {
    startPythonReranker()
    const scores = await new Promise<number[] | null>((resolve) => {
      _pyRerankQueue.push({ resolve })
      _pyRerankProc.stdin.write(JSON.stringify({ query, passages: documents.map((d) => (d == null ? "" : String(d))) }) + "\n")
    })
    modelHealth.reranker.calls++
    modelHealth.reranker.inferenceMs += Date.now() - started
    return scores
  } catch (err) {
    modelHealth.reranker.failures++
    modelHealth.reranker.lastError = err instanceof Error ? err.message : String(err)
    console.warn("[model-registry] Python reranker unavailable:", modelHealth.reranker.lastError)
    return null
  }
}

let rerankerLoader: Promise<{ tokenizer: any; model: any }> | null = null
let rerankerLoaderId = ""

async function loadXenovaReranker(modelId: string) {
  if (rerankerLoader && rerankerLoaderId === modelId) return rerankerLoader
  rerankerLoaderId = modelId
  rerankerLoader = (async () => {
    const mod: any = await import("@xenova/transformers")
    mod.env.allowLocalModels = false
    if (process.env.HF_TOKEN) {
      mod.env.token = process.env.HF_TOKEN
      mod.env.authToken = process.env.HF_TOKEN
    }
    const tokenizer = await mod.AutoTokenizer.from_pretrained(modelId)
    const model = await mod.AutoModelForSequenceClassification.from_pretrained(modelId, { quantized: true })
    modelHealth.reranker.warmedUp = true
    return { tokenizer, model }
  })().catch((err) => {
    rerankerLoader = null
    rerankerLoaderId = ""
    throw err
  })
  return rerankerLoader
}

/**
 * The lexical/heuristic "reranker". It is exported so the benchmark can run it as the explicit
 * baseline row — and so nobody can mistake a heuristic for a cross-encoder in a results table.
 * Scores are token-overlap based and bounded to [0,1].
 */
export function lexicalHeuristicScores(query: string, documents: string[]): number[] {
  const qTokens = new Set(
    query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2)
  )
  if (qTokens.size === 0) return documents.map(() => 0)
  return documents.map((doc) => {
    const words = doc.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2)
    if (words.length === 0) return 0
    let hits = 0
    const seen = new Set<string>()
    for (const w of words) {
      if (qTokens.has(w) && !seen.has(w)) {
        hits++
        seen.add(w)
      }
    }
    return hits / Math.min(qTokens.size, Math.max(1, new Set(words).size))
  })
}

/** Returns the active reranker, or `null` when reranking is disabled. */
export function getReranker(): RerankModel | null {
  const cfg = getRegistryConfig()
  if (!cfg.rerankerEnabled) return null
  const info = describeModel(cfg.rerankerModel, "reranker")
  modelHealth.reranker.enabled = true
  modelHealth.reranker.model = info.id
  modelHealth.reranker.backend = info.backend

  return {
    getModelInfo: () => info,
    rerank: async (query, documents) => {
      if (documents.length === 0) return null
      if (info.backend === "reference-ngram") return lexicalHeuristicScores(query, documents)
      if (info.backend === "hf-v3") return rerankViaPython(query, documents, info.id)
      if (process.env.VITEST && !process.env.TEST_REAL_EMBEDDINGS) return null
      const started = Date.now()
      const scores = await enqueue(async () => {
        const { tokenizer, model } = await loadXenovaReranker(info.id)
        modelHealth.reranker.calls++
        const out: number[] = []
        const BATCH = 8
        const maxChars = info.maxTokens * 3
        for (let i = 0; i < documents.length; i += BATCH) {
          const slice = documents.slice(i, i + BATCH).map((d) => d.slice(0, maxChars))
          const inputs = tokenizer(new Array(slice.length).fill(query), {
            text_pair: slice,
            padding: true,
            truncation: true,
            max_length: info.maxTokens,
          })
          const res = await model(inputs)
          const dims = res.logits.dims as number[]
          const data = Array.from(res.logits.data as Float32Array)
          const width = dims.length === 2 ? dims[1] : 1
          for (let r = 0; r < slice.length; r++) out.push(data[r * width])
        }
        return out
      }).catch((err) => {
        modelHealth.reranker.failures++
        modelHealth.reranker.lastError = err instanceof Error ? err.message : String(err)
        console.warn("[model-registry] reranker unavailable, keeping fused order:", modelHealth.reranker.lastError)
        return null
      })
      modelHealth.reranker.inferenceMs += Date.now() - started
      return scores
    },
  }
}

export async function warmUpReranker(): Promise<boolean> {
  const r = getReranker()
  if (!r) return false
  const info = r.getModelInfo()
  if (info.backend === "reference-ngram") {
    modelHealth.reranker.warmedUp = true
    return true
  }
  if (process.env.VITEST && !process.env.TEST_REAL_EMBEDDINGS) return false
  try {
    await loadXenovaReranker(info.id)
    return true
  } catch (err) {
    modelHealth.reranker.lastError = err instanceof Error ? err.message : String(err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Dimension safety
// ---------------------------------------------------------------------------

export interface DimensionCheck {
  ok: boolean
  model: string
  declared: number
  observed: number | null
  message: string
}

/**
 * Guards the single most destructive misconfiguration available here: writing N-dimensional
 * vectors into a `vector(M)` column. Callers (reindex, ingest) refuse to proceed when the
 * first produced vector does not match the declared width.
 */
export function verifyDimensions(sampleText = "dimension probe"): DimensionCheck {
  const info = getEmbeddingModel().getModelInfo()
  const observed = modelHealth.embedding.observedDimensions
  if (observed === null) {
    return {
      ok: true,
      model: info.id,
      declared: info.dimensions,
      observed: null,
      message: "No vector produced yet; dimension not verified.",
    }
  }
  const ok = observed === info.dimensions
  return {
    ok,
    model: info.id,
    declared: info.dimensions,
    observed,
    message: ok
      ? `Observed ${observed}-dim vectors match the declared width.`
      : `MISMATCH: model ${info.id} produced ${observed}-dim vectors but EMBEDDING_DIM/declared width is ${info.dimensions}. Refusing to index — run the embedding-column resize script and reindex.`,
  }
}

/** Test hook: resets loaders, caches and health counters. */
export function __resetModelRegistryForTests(): void {
  clearModelCache()
  xenovaEmbedder = null
  xenovaEmbedderModel = ""
  rerankerLoader = null
  rerankerLoaderId = ""
  modelHealth.embedding = {
    model: "",
    backend: "",
    declaredDimensions: 0,
    observedDimensions: null,
    fallbackCount: 0,
    lastError: null,
    warmedUp: false,
    inferenceCalls: 0,
    inferenceMs: 0,
  }
  modelHealth.reranker = {
    model: "",
    backend: "",
    enabled: false,
    failures: 0,
    calls: 0,
    lastError: null,
    warmedUp: false,
    inferenceMs: 0,
  }
}
