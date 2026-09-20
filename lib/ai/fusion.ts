/**
 * Candidate fusion.
 *
 * The retrieval pipeline used to fuse its two legs *inside* one SQL statement with hard-coded
 * weights (`0.7/(60+rank_vec) + 0.3/(60+rank_fts)`). That had three problems:
 *
 *   1. Weights were fixed in SQL text, so they could not be varied per query, per criterion or
 *      per ablation run.
 *   2. Only two sources could ever participate. Adding a graph or citation leg meant rewriting
 *      the query.
 *   3. Nothing recorded *why* a chunk was selected, so a bad result could not be diagnosed.
 *
 * This module is the replacement: pure, dependency-free fusion over any number of independently
 * produced ranked lists, with per-source weights and a full contribution record.
 *
 * It never mixes uncalibrated score scales. RRF uses rank positions only, which is the whole
 * point of reciprocal rank fusion: a cosine similarity of 0.83 and a `ts_rank` of 0.041 are not
 * comparable, but "3rd in the dense list" and "3rd in the lexical list" are.
 *
 * @module fusion
 */

/** Where a candidate came from. Kept as a string union so traces stay readable. */
export type RetrievalSource =
  | "dense"
  | "lexical"
  | "graph"
  | "graph-drift"
  | "citation"
  | "metadata"
  | "community"
  | "prior-art"

export type FusionMethod = "rrf" | "weighted-rrf" | "normalized-sum"

export interface SourceItem<T = unknown> {
  id: string
  /** Raw score in the source's own scale. Only used by `normalized-sum` and for diagnostics. */
  score: number
  payload?: T
}

export interface RankedSource<T = unknown> {
  source: RetrievalSource
  /** Items in *descending relevance* order. Position 0 = rank 1. */
  items: SourceItem<T>[]
  /** Optional per-source weight override; otherwise the configured default applies. */
  weight?: number
}

export interface SourceContribution {
  source: RetrievalSource
  /** 1-based rank within that source's list. */
  rank: number
  weight: number
  /** Raw score as reported by the source. */
  rawScore: number
  /** This source's share of the fused score (0–1). */
  contribution: number
}

export interface FusedCandidate<T = unknown> {
  id: string
  fusedScore: number
  /** 1-based rank in the fused list. */
  rank: number
  /** Every source that contributed, strongest first. */
  sources: SourceContribution[]
  /** Payload of the highest-ranked contributing source. */
  payload?: T
}

export interface FusionOptions {
  method?: FusionMethod
  /** RRF smoothing constant. 60 is the value from the original RRF paper. */
  k?: number
  /** Default per-source weights; a source missing here gets 1. */
  weights?: Partial<Record<RetrievalSource, number>>
  /** Stop after this many fused candidates (0 = keep all). */
  limit?: number
}

/**
 * Default fusion weights.
 *
 * These are *starting* values, recorded in every evaluation run so a benchmark can attribute a
 * quality change to them. They are not tuned by intuition alone: `lib/ai/eval/ablations.ts`
 * sweeps them on the golden set, and the dashboard shows the measured result.
 */
export const DEFAULT_FUSION_WEIGHTS: Record<RetrievalSource, number> = {
  dense: 1.0,
  lexical: 0.9,
  graph: 0.6,
  "graph-drift": 0.12,
  citation: 0.6,
  metadata: 0.4,
  community: 0.5,
  "prior-art": 0.5,
}

export const DEFAULT_RRF_K = 60

function resolveWeight(source: RetrievalSource, override?: number, weights?: Partial<Record<RetrievalSource, number>>): number {
  if (typeof override === "number" && Number.isFinite(override)) return override
  return weights?.[source] ?? DEFAULT_FUSION_WEIGHTS[source] ?? 1
}

/** Min–max normalisation of a source's raw scores onto [0,1]. */
export function minMaxNormalize(items: SourceItem[]): number[] {
  if (items.length === 0) return []
  if (items.length === 1) return [1]
  let min = Infinity
  let max = -Infinity
  for (const it of items) {
    if (it.score < min) min = it.score
    if (it.score > max) max = it.score
  }
  const span = max - min
  if (span <= 0) return items.map(() => 1)
  return items.map((it) => (it.score - min) / span)
}

/**
 * Fuses any number of ranked lists into one ranking.
 *
 * - `rrf`            Σ 1/(k + rank)               — weights ignored.
 * - `weighted-rrf`   Σ w_s /(k + rank)            — the default; weights matter, scales do not.
 * - `normalized-sum` Σ w_s · minmax(score_s)      — only for sources whose scores are already
 *                                                   calibrated to a common scale (e.g. two
 *                                                   cross-encoders). Do NOT use to combine
 *                                                   cosine with ts_rank.
 *
 * Ties are broken deterministically by (fusedScore desc, number of contributing sources desc,
 * best contributing rank asc, id asc) so repeated runs are reproducible.
 */
export function fuseCandidates<T = unknown>(
  rankedSources: RankedSource<T>[],
  opts: FusionOptions = {}
): FusedCandidate<T>[] {
  const method = opts.method ?? "weighted-rrf"
  const k = opts.k ?? DEFAULT_RRF_K
  const limit = opts.limit ?? 0

  const acc = new Map<
    string,
    { fusedScore: number; sources: SourceContribution[]; payload?: T; bestRank: number }
  >()

  for (const rs of rankedSources) {
    if (!rs || rs.items.length === 0) continue
    const weight = resolveWeight(rs.source, rs.weight, opts.weights)
    const normalized = method === "normalized-sum" ? minMaxNormalize(rs.items) : null

    rs.items.forEach((item, idx) => {
      const rank = idx + 1
      const raw =
        method === "rrf" ? 1 / (k + rank)
        : method === "normalized-sum" ? (normalized![idx] ?? 0)
        : weight / (k + rank)
      const entry = acc.get(item.id) ?? { fusedScore: 0, sources: [], payload: item.payload, bestRank: rank }
      entry.fusedScore += raw
      entry.sources.push({ source: rs.source, rank, weight, rawScore: item.score, contribution: raw })
      if (rank < entry.bestRank) entry.bestRank = rank
      // Keep the payload from the strongest-ranked contributing source.
      if (entry.payload === undefined && item.payload !== undefined) entry.payload = item.payload
      acc.set(item.id, entry)
    })
  }

  const fused: FusedCandidate<T>[] = Array.from(acc.entries())
    .map(([id, entry]) => ({
      id,
      fusedScore: entry.fusedScore,
      rank: 0,
      sources: entry.sources
        .map((s) => ({ ...s, contribution: entry.fusedScore > 0 ? s.contribution / entry.fusedScore : 0 }))
        .sort((a, b) => b.contribution - a.contribution || a.rank - b.rank),
      payload: entry.payload,
    }))
    .sort(
      (a, b) =>
        b.fusedScore - a.fusedScore ||
        b.sources.length - a.sources.length ||
        bestRankOf(a) - bestRankOf(b) ||
        a.id.localeCompare(b.id)
    )

  fused.forEach((c, i) => {
    c.rank = i + 1
  })
  return limit > 0 ? fused.slice(0, limit) : fused
}

function bestRankOf(c: FusedCandidate): number {
  return c.sources.reduce((m, s) => Math.min(m, s.rank), Number.MAX_SAFE_INTEGER)
}

/** Ids of the sources that produced at least one candidate — used for route diagnostics. */
export function activeSources(rankedSources: RankedSource[]): RetrievalSource[] {
  return rankedSources.filter((s) => s.items.length > 0).map((s) => s.source)
}

/** `{ source: candidateCount }` for the retrieval trace. */
export function candidateCountBySource(rankedSources: RankedSource[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of rankedSources) out[s.source] = s.items.length
  return out
}

/**
 * Deduplicates a fused list down to at most `maxPerParent` entries sharing the same parent
 * section, so one long section cannot monopolise the evidence budget. Pure and order-preserving.
 */
export function diversifyByGroup(
  candidates: FusedCandidate[],
  groupOf: (c: FusedCandidate) => string | null,
  maxPerGroup: number
): FusedCandidate[] {
  if (maxPerGroup <= 0) return candidates
  const seen = new Map<string, number>()
  const out: FusedCandidate[] = []
  for (const c of candidates) {
    const g = groupOf(c)
    if (!g) {
      out.push(c)
      continue
    }
    const n = seen.get(g) ?? 0
    if (n >= maxPerGroup) continue
    seen.set(g, n + 1)
    out.push(c)
  }
  return out
}
