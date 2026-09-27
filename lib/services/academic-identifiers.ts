/**
 * Identifier & text helpers shared by the academic provider clients and the connector.
 *
 * Pure functions only (no I/O) so they are trivially unit-testable:
 *   - DOI extraction/normalisation tolerant of sentence punctuation (AR-04)
 *   - arXiv ids, including DataCite `10.48550/arXiv.*` DOIs (AR-03)
 *   - Unicode-safe title keys — non-Latin titles must not collapse to "" (AR-01)
 *   - title similarity used to gate fuzzy verification (AR-06)
 *   - author sentinel handling (AR-10)
 */

/** A DOI anywhere in free text. Trailing punctuation is trimmed by `extractDoi`. */
const DOI_IN_TEXT = /\b(10\.\d{4,9}\/[^\s"'<>]+)/i

const TRAILING_PUNCT = /[.,;:!?]+$/
const ARXIV_DOI_PREFIX = /^10\.48550\/arxiv\./i

/**
 * Strip URL/`doi:` prefixes and sentence punctuation that pasted citations carry
 * (`10.1038/nature14539.` → `10.1038/nature14539`; balanced parentheses such as in
 * `10.1016/s0140-6736(97)11096-0` are preserved). Case is preserved — use
 * `normalizeDoi` for identity comparison.
 */
export function stripDoi(raw: string): string {
  let doi = raw
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
  // Peel trailing punctuation and unbalanced closing brackets.
  for (;;) {
    const before = doi
    doi = doi.replace(TRAILING_PUNCT, "")
    while (/[)\]}]$/.test(doi)) {
      const close = doi[doi.length - 1]
      const open = close === ")" ? "(" : close === "]" ? "[" : "{"
      const opens = doi.split(open).length - 1
      const closes = doi.split(close).length - 1
      if (closes > opens) doi = doi.slice(0, -1)
      else break
    }
    if (doi === before) break
  }
  return doi
}

/** Lower-cased, stripped DOI for identity comparison (DOIs are case-insensitive). */
export function normalizeDoi(raw: string): string {
  return stripDoi(raw).toLowerCase()
}

/** Find the first DOI in a text (case preserved, punctuation stripped); undefined when none. */
export function extractDoi(text: string): string | undefined {
  const m = text.match(DOI_IN_TEXT)
  if (!m) return undefined
  const doi = stripDoi(m[1])
  return doi.length > 7 ? doi : undefined
}

/** Bare arXiv id (without version) from an id, an `arXiv:` prefix or a DataCite DOI. */
export function normalizeArxivId(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined
  const cleaned = raw
    .trim()
    .replace(/^arxiv:\s*/i, "")
    .replace(/^https?:\/\/arxiv\.org\/(?:abs|pdf)\//i, "")
    .replace(/\.pdf$/i, "")
    .replace(/v\d+$/i, "")
  return /^\d{4}\.\d{4,5}$/.test(cleaned) || /^[a-z-]+(?:\.[A-Z]{2})?\/\d{7}$/i.test(cleaned) ? cleaned : undefined
}

export function arxivIdFromDoi(doi: string | undefined | null): string | undefined {
  if (!doi || !ARXIV_DOI_PREFIX.test(doi)) return undefined
  return normalizeArxivId(doi.replace(ARXIV_DOI_PREFIX, ""))
}

/**
 * Unicode-safe title key for cross-provider deduplication: NFKD, strip diacritics and
 * everything that is not a letter or digit in any script. `深度学习` keeps its characters.
 */
export function titleKey(title: string | undefined | null): string {
  if (!title) return ""
  return title
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/^retracted(?:\s+article)?\s*[:\-–—]\s*/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
}

function normalizeText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokens(s: string): Set<string> {
  return new Set(normalizeText(s).split(" ").filter((t) => t.length > 2))
}

interface TitleMatch {
  /** Normalised strings are identical. */
  exact: boolean
  /** Token-set Jaccard over tokens longer than two characters. */
  jaccard: number
  /** One normalised string contains the other (only meaningful for long titles). */
  contains: boolean
}

export function compareTitles(a: string, b: string): TitleMatch {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  const exact = na.length > 0 && na === nb
  const ta = tokens(a)
  const tb = tokens(b)
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const union = ta.size + tb.size - inter
  const jaccard = union === 0 ? (exact ? 1 : 0) : inter / union
  const shorter = na.length <= nb.length ? na : nb
  const longer = na.length <= nb.length ? nb : na
  const contains = shorter.length >= 20 && longer.includes(shorter)
  return { exact, jaccard, contains }
}

/** Confidence bucket for a fuzzy title match; null = no match. */
export function titleMatchConfidence(query: string, candidate: string): "high" | "medium" | "low" | null {
  const m = compareTitles(query, candidate)
  if (m.exact || m.jaccard >= 0.65 || m.contains) return "high"
  if (m.jaccard >= 0.45) return "medium"
  if (m.jaccard >= 0.25) return "low"
  return null
}

const AUTHOR_SENTINELS = new Set(["unknown author", "unknown", "anonymous", "n/a", "na", ""])

function isKnownAuthor(name: string | undefined | null): boolean {
  return Boolean(name) && !AUTHOR_SENTINELS.has(String(name).trim().toLowerCase())
}

/** Drop sentinels/empties; keep order and uniqueness. */
export function cleanAuthors(authors: readonly string[] | undefined | null): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const a of authors ?? []) {
    const name = (a ?? "").trim()
    if (!isKnownAuthor(name)) continue
    const key = normalizeText(name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/** Surname heuristic ("Ashish Vaswani" → "vaswani", "VASWANI, Ashish" → "vaswani"). */
function surnameKey(name: string | undefined | null): string {
  if (!name) return ""
  const trimmed = name.trim()
  if (trimmed.includes(",")) return normalizeText(trimmed.split(",")[0])
  const parts = normalizeText(trimmed).split(" ").filter(Boolean)
  return parts[parts.length - 1] ?? ""
}

/** True when the strings share ≥ 1 surname among their first three authors. */
export function authorsOverlap(a: readonly string[], b: readonly string[]): boolean {
  const ka = new Set(a.slice(0, 3).map(surnameKey).filter((k) => k.length > 1))
  const kb = new Set(b.slice(0, 3).map(surnameKey).filter((k) => k.length > 1))
  for (const k of ka) if (kb.has(k)) return true
  return false
}

/** Trim ISO 690 / parser residue from a citation title before searching (AR-08). */
export function cleanCitationTitle(title: string): string {
  return title
    .replace(/^\s*(?:19|20)\d{2}[a-z]?\s*[.):,;]?\s*/u, "") // leading year "1998. "
    .replace(/\s*\b(?:In|Available|Dostupné|DOI|ISBN|pp|Vol)\s*[:.]?\s*$/iu, "") // dangling terminator
    .replace(/[\s.,;:]+$/u, "")
    .trim()
}
