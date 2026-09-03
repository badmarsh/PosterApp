/**
 * Local cross-encoder reranker (self-hosted, no API calls).
 *
 * Model: Xenova/bge-reranker-base — multilingual (covers SK/CS/EN), ONNX,
 * runs on the same @xenova/transformers WASM runtime as the embedder.
 * A cross-encoder reads (query, passage) *jointly* and is far more accurate
 * than bi-encoder cosine + keyword heuristics for the final top-K.
 *
 * Failure policy: any model error → `null` (callers keep the heuristic order),
 * and the health flag is surfaced through rag-stats.
 */

import { env, AutoTokenizer, AutoModelForSequenceClassification } from "@xenova/transformers"

env.allowLocalModels = false

export const RERANKER_MODEL = process.env.AI_RERANKER_MODEL || "Xenova/bge-reranker-base"
export const RERANKER_ENABLED = process.env.AI_RERANKER_ENABLED !== "false"
/** Passage text longer than this is truncated (tokens ≈ chars/3 for SK) to keep within 512-token pairs. */
const MAX_PASSAGE_CHARS = 1_400

export const rerankerHealth = {
  warmedUp: false,
  lastError: null as string | null,
  failures: 0,
  calls: 0,
}

let loader: Promise<{ tokenizer: any; model: any }> | null = null

async function getReranker() {
  if (!loader) {
    loader = (async () => {
      const tokenizer = await AutoTokenizer.from_pretrained(RERANKER_MODEL)
      const model = await AutoModelForSequenceClassification.from_pretrained(RERANKER_MODEL, { quantized: true })
      rerankerHealth.warmedUp = true
      return { tokenizer, model }
    })().catch((err) => {
      loader = null
      throw err
    })
  }
  return loader
}

export async function warmUpLocalReranker(): Promise<boolean> {
  if (!RERANKER_ENABLED) return false
  if (process.env.VITEST && !process.env.TEST_REAL_EMBEDDINGS) return false
  try {
    await getReranker()
    return true
  } catch (err) {
    rerankerHealth.lastError = err instanceof Error ? err.message : String(err)
    return false
  }
}

// Serialize inference (same reason as embeddings: WASM heap pressure).
let queue: Promise<unknown> = Promise.resolve()

/**
 * Returns a relevance score per passage (higher = more relevant; roughly a
 * logit, usually in [-10, 10]) or `null` if the reranker is unavailable.
 */
export async function crossEncoderScores(query: string, passages: string[]): Promise<number[] | null> {
  if (!RERANKER_ENABLED || passages.length === 0) return null
  if (process.env.VITEST && !process.env.TEST_REAL_EMBEDDINGS) return null

  const run = async (): Promise<number[] | null> => {
    try {
      const { tokenizer, model } = await getReranker()
      rerankerHealth.calls++
      const scores: number[] = []
      // Batches of 8 pairs keep peak memory low on the WASM backend.
      const BATCH = 8
      for (let i = 0; i < passages.length; i += BATCH) {
        const slice = passages.slice(i, i + BATCH).map((p) => p.slice(0, MAX_PASSAGE_CHARS))
        const inputs = tokenizer(new Array(slice.length).fill(query), {
          text_pair: slice,
          padding: true,
          truncation: true,
          max_length: 512,
        })
        const out = await model(inputs)
        const logits = out.logits
        const dims = logits.dims as number[]
        const data = Array.from(logits.data as Float32Array)
        const width = dims.length === 2 ? dims[1] : 1
        for (let r = 0; r < slice.length; r++) scores.push(data[r * width])
      }
      return scores
    } catch (err) {
      rerankerHealth.failures++
      rerankerHealth.lastError = err instanceof Error ? err.message : String(err)
      console.warn("[local-reranker] cross-encoder unavailable, keeping heuristic order:", rerankerHealth.lastError)
      return null
    }
  }

  const result = queue.then(run, run)
  queue = result.then(() => {}, () => {})
  return result
}
