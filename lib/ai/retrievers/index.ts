/**
 * Candidate-generator orchestration.
 *
 * Runs the enabled legs in parallel, bounds each one by a deadline, and returns
 * both the raw per-source results (for the trace) and fusion-ready ranked
 * lists. A leg that throws or times out contributes an empty list plus an
 * `error` string — it never fails the retrieval, and the caller can see exactly
 * which leg degraded.
 *
 * @module retrievers
 */

import { fuseCandidates, type FusionOptions, type RankedSource, type RetrievalSource } from "../fusion"
import { ALL_GENERATORS } from "./generators"
import type { CandidateGenerator, GeneratorResult, RetrievalCandidate, RetrievalContext } from "./types"

export * from "./types"
export { ALL_GENERATORS, denseExactFallback } from "./generators"

/** Default per-leg deadline. Retrieval must never be the reason a review hangs. */
export const GENERATOR_TIMEOUT_MS = Number(process.env.RETRIEVAL_GENERATOR_TIMEOUT_MS) || 15_000

/** Default candidate-pool sizes per source (the "retrieve wide, rank narrow" budget). */
export const DEFAULT_CANDIDATE_LIMITS: Record<RetrievalSource, number> = {
  dense: 50,
  lexical: 50,
  graph: 30,
  "graph-drift": 20,
  citation: 30,
  metadata: 20,
  community: 12,
  "prior-art": 20,
}

export interface RunOptions {
  /** Per-source candidate counts; merged over DEFAULT_CANDIDATE_LIMITS. */
  limits?: Partial<Record<RetrievalSource, number>>
  /** Restrict which legs run (ablations). Omit to run everything that is enabled. */
  only?: RetrievalSource[]
  /**
   * Legs excluded by an ablation. They are NOT silently dropped: each one is reported with
   * `enabled: false` and `excludedByAblation: true`, so a trace can tell "we switched this off"
   * apart from "this leg was never configured for this route".
   */
  excluded?: RetrievalSource[]
  generatorTimeoutMs?: number
  /** Extra generators (used by the evaluation harness). */
  generators?: CandidateGenerator[]
}

export interface CandidatePool {
  results: GeneratorResult[]
  rankedSources: RankedSource<RetrievalCandidate>[]
  candidateCounts: Record<string, number>
  totalCandidates: number
  uniqueCandidates: number
  /** Sources that were expected to run but failed. */
  degradedSources: Array<{ source: RetrievalSource; error: string }>
  latencyMs: number
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Runs every enabled candidate generator against one context.
 *
 * Legs run concurrently but each gets its own deadline, so one slow leg costs
 * `generatorTimeoutMs` and not the sum of all legs.
 */
export async function runCandidateGenerators(ctx: RetrievalContext, opts: RunOptions = {}): Promise<CandidatePool> {
  const started = Date.now()
  const allGenerators = opts.generators ?? ALL_GENERATORS
  const excluded = new Set(opts.excluded ?? [])
  const generators = allGenerators.filter((g) => {
    if (excluded.has(g.source)) return false
    return !opts.only || opts.only.includes(g.source)
  })
  const timeoutMs = opts.generatorTimeoutMs ?? GENERATOR_TIMEOUT_MS

  const results = await Promise.all(
    generators.map(async (gen): Promise<GeneratorResult> => {
      const limit = opts.limits?.[gen.source] ?? DEFAULT_CANDIDATE_LIMITS[gen.source] ?? 30
      const genCtx: RetrievalContext = { ...ctx, limit }
      let enabled = false
      try {
        enabled = gen.enabled(genCtx)
      } catch {
        enabled = false
      }
      if (!enabled) {
        return { source: gen.source, items: [], latencyMs: 0, enabled: false }
      }
      const t0 = Date.now()
      try {
        const items = await withTimeout(gen.retrieve(genCtx), timeoutMs, `${gen.source} retriever`)
        return { source: gen.source, items, latencyMs: Date.now() - t0, enabled: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[retrievers] ${gen.source} leg failed (non-fatal):`, message)
        return { source: gen.source, items: [], latencyMs: Date.now() - t0, enabled: true, error: message }
      }
    })
  )

  // Report ablated legs explicitly rather than letting them vanish from the trace.
  for (const gen of allGenerators) {
    if (excluded.has(gen.source) && !results.some((r) => r.source === gen.source)) {
      results.push({ source: gen.source, items: [], latencyMs: 0, enabled: false, excludedByAblation: true })
    }
  }

  const rankedSources: RankedSource<RetrievalCandidate>[] = results.map((r) => ({
    source: r.source,
    items: r.items.map((c) => ({ id: c.id, score: c.score, payload: c })),
  }))

  const candidateCounts: Record<string, number> = {}
  let total = 0
  const unique = new Set<string>()
  for (const r of results) {
    candidateCounts[r.source] = r.items.length
    total += r.items.length
    for (const c of r.items) unique.add(c.id)
  }

  return {
    results,
    rankedSources,
    candidateCounts,
    totalCandidates: total,
    uniqueCandidates: unique.size,
    degradedSources: results.filter((r) => r.error).map((r) => ({ source: r.source, error: r.error! })),
    latencyMs: Date.now() - started,
  }
}

/** Convenience: run generators and fuse in one call. */
export async function retrieveAndFuse(
  ctx: RetrievalContext,
  opts: RunOptions & { fusion?: FusionOptions } = {}
): Promise<{ pool: CandidatePool; fused: ReturnType<typeof fuseCandidates<RetrievalCandidate>> }> {
  const pool = await runCandidateGenerators(ctx, opts)
  const fused = fuseCandidates<RetrievalCandidate>(pool.rankedSources, {
    method: "weighted-rrf",
    ...opts.fusion,
  })
  return { pool, fused }
}
