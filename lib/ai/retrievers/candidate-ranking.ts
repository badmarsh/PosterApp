/** Pure candidate ranking shared by the DB generators and offline route replay. */
export interface ScoredSectionCandidate {
  id: string
  score: number
  sectionPath: string | null
  meta?: Record<string, unknown>
}

function normalizeSectionText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(?:chapter|kapitola|section|sekcia)?\s*\d+(?:\.\d+)*[.):\s-]*/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function sectionQuality(path: string, prefixes: string[] | undefined): { penalty: number; hit: boolean } {
  const normalized = normalizeSectionText(path)
  const normalizedPrefixes = (prefixes ?? []).map(normalizeSectionText).filter(Boolean)
  const citationRoute = normalizedPrefixes.some((prefix) => /citation|reference|bibliograph|literature|zdroj|literatur/.test(prefix))
  const structuralRoute = normalizedPrefixes.some((prefix) => /formal|structure|contents|obsah|outline/.test(prefix))
  const goalRoute = normalizedPrefixes.some((prefix) => /goal|objective|introduction|abstract|motivation|ciel|uvod/.test(prefix))
  const referenceSection = /(?:^|\s)(?:references?|bibliographies?|citations?|referencie|zoznam literatury|seznam literatury|zoznam pouzitej literatury)(?:$|\s)/.test(normalized)
  const hit = normalizedPrefixes.some((prefix) => normalized.includes(prefix)) || (citationRoute && referenceSection)

  if (/acknowledg|podakov|podekov|dedication|thank you/.test(normalized)) return { penalty: 0.35, hit }
  if (/table of contents|^contents$|^obsah$|obsah prace/.test(normalized) && !structuralRoute) return { penalty: 0.35, hit }
  if (/references|bibliography|referencie|zoznam literatury|seznam literatury|zoznam pouzitej literatury/.test(normalized) && !citationRoute) return { penalty: 0.35, hit }
  if (/title page|front matter|titulna strana|titulni strana|cover page/.test(normalized) && !goalRoute) return { penalty: 0.45, hit }
  return { penalty: 1, hit }
}

/** Section-path boost plus strong downranking for non-evidence boilerplate. */
export function applySectionBoost<T extends ScoredSectionCandidate>(candidates: T[], prefixes: string[] | undefined, boost = 1.15): T[] {
  if (candidates.length === 0) return candidates
  let changed = false
  const ranked = candidates.map((candidate) => {
    const { penalty, hit } = sectionQuality(candidate.sectionPath ?? "", prefixes)
    const nextScore = candidate.score * penalty * (hit ? boost : 1)
    if (penalty !== 1 || hit) changed = true
    if (!changed && nextScore === candidate.score) return candidate
    return {
      ...candidate,
      score: nextScore,
      meta: {
        ...(candidate.meta ?? {}),
        ...(penalty !== 1 ? { sectionPenalty: penalty } : {}),
        ...(hit ? { sectionBoost: true } : {}),
      },
    }
  })

  // Preserve identity when the input carried no paths/signals, while resolving ties
  // deterministically once ranking actually has to make a choice.
  if (!changed) return candidates
  return ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
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
  const merged = Array.from(best.values()).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  return applySectionBoost(merged, prefixes).slice(0, limit)
}
