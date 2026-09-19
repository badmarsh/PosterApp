/**
 * Local cross-encoder reranker — compatibility façade over `model-registry.ts`.
 *
 * Terminology note (deliberate): the word "cross-encoder" in this repository means an actual
 * cross-encoder/reranker *model* is executed — `Xenova/bge-reranker-v2-m3` by default, which
 * reads (query, passage) jointly through a sequence-classification head. The heading/keyword
 * scorer in `vector-rag.ts::rerankChunks` is a **lexical heuristic**, and the benchmark tables
 * label it as `lexical-heuristic`, never as a cross-encoder.
 *
 * Model selection now lives in the registry (`RERANKER_MODEL`, `RERANKER_ENABLED`;
 * `AI_RERANKER_MODEL` / `AI_RERANKER_ENABLED` are still honoured).
 *
 * Failure policy is unchanged: any model error → `null`, and callers keep the *normalised*
 * heuristic/fused order. Health is surfaced through rag-stats.
 */

import { getReranker, getRegistryConfig, modelHealth, warmUpReranker, describeModel } from "./model-registry"

export const RERANKER_MODEL = process.env.RERANKER_MODEL || process.env.AI_RERANKER_MODEL || "Xenova/bge-reranker-v2-m3"
export const RERANKER_ENABLED = process.env.RERANKER_ENABLED !== "false" && process.env.AI_RERANKER_ENABLED !== "false"

/** Live view over the registry's reranker counters (keeps the rag-stats contract). */
export const rerankerHealth: {
  warmedUp: boolean
  lastError: string | null
  failures: number
  calls: number
} = {
  get warmedUp() {
    return modelHealth.reranker.warmedUp
  },
  get lastError() {
    return modelHealth.reranker.lastError
  },
  get failures() {
    return modelHealth.reranker.failures
  },
  get calls() {
    return modelHealth.reranker.calls
  },
}

export async function warmUpLocalReranker(): Promise<boolean> {
  return warmUpReranker()
}

/** Descriptor of the active reranker (id, backend, token window). */
export function getRerankerModelInfo() {
  const cfg = getRegistryConfig()
  return cfg.rerankerEnabled ? describeModel(cfg.rerankerModel, "reranker") : null
}

/**
 * Returns a relevance score per passage (higher = more relevant; roughly a logit, usually in
 * [-10, 10]) or `null` if the reranker is unavailable.
 */
export async function crossEncoderScores(query: string, passages: string[]): Promise<number[] | null> {
  const reranker = getReranker()
  if (!reranker) return null
  return reranker.rerank(query, passages)
}
