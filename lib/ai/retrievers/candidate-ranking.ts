/** Pure candidate ranking shared by the DB generators and offline route replay. */
export interface ScoredSectionCandidate {
  id: string
  score: number
  sectionPath: string | null
  meta?: Record<string, unknown>
}

/** Section-path boost: a soft preference, applied after the fact so it cannot hide a hit. */
export function applySectionBoost<T extends ScoredSectionCandidate>(candidates: T[], prefixes: string[] | undefined, boost = 1.15): T[] {
  if (!prefixes || prefixes.length === 0) return candidates
  const lowered = prefixes.map((p) => p.toLowerCase())
  return candidates
    .map((c) => {
      const path = (c.sectionPath ?? "").toLowerCase()
      const hit = lowered.some((p) => path.includes(p))
      return hit ? { ...c, score: c.score * boost, meta: { ...(c.meta ?? {}), sectionBoost: true } } : c
    })
    .sort((a, b) => b.score - a.score)
}

/** Fan-out is one dense source: best cosine per chunk, not one RRF vote per query. */
export function mergeDenseCandidates<T extends ScoredSectionCandidate>(
  candidates: T[], prefixes: string[] | undefined, limit: number,
): T[] {
  const best = new Map<string, T>()
  for (const c of candidates) {
    const prev = best.get(c.id)
    if (!prev || c.score > prev.score) best.set(c.id, c)
  }
  const merged = Array.from(best.values()).sort((a, b) => b.score - a.score)
  return applySectionBoost(merged, prefixes).slice(0, limit)
}
