/**
 * Academic retrieval evaluation harness (golden set + metrics).
 *
 * Scores the multi-source Academic Connector (`searchAcademicPaper`,
 * `verifySingleCitation`) the way an IR system is scored:
 *
 *   - P@1 / MRR       against the graded `relevance` judgements of each query
 *   - nDCG@5          graded (2 = the paper a researcher wants, 1 = related, 0 = noise)
 *   - duplicateRate   share of result rows that repeat an earlier row's identity
 *                     (same DOI, same arXiv id, or same normalised title)
 *   - fieldCompleteness  share of rows carrying doi / year / venue / real authors /
 *                     citationCount / open-access link
 *   - providerAgreement  share of the top-k confirmed by ≥ 2 providers (needs `sources`)
 *   - verification    verified / not_found / unavailable rates for citation strings
 *
 * All metric functions are pure so they run without network or database; the
 * benchmark test wires them to the connector behind the fixture-replay `fetch`
 * (recorded mode) or the real network (`ACADEMIC_LIVE=1`).
 */

import type { AcademicPaperResult, CitationCheckResult } from "@/lib/services/academic-connector"

// ---------------------------------------------------------------------------
// Golden set
// ---------------------------------------------------------------------------

export type RelevanceGrade = 1 | 2

export interface GoldenSearchCase {
  id: string
  kind: "search"
  label: string
  query: string
  limit?: number
  yearFrom?: number
  /**
   * Graded relevance keyed by identity: bare lower-case DOI, `arxiv:<id>`, or the
   * normalised title (see `identityKeys`). Anything absent is grade 0 (noise).
   */
  relevance: Record<string, RelevanceGrade>
  /** Identity keys accepted at rank 1 for P@1 / MRR. */
  target: string[]
  expectedMode?: "doi" | "arxiv" | "search"
  minResults?: number
  /** With `yearFrom`, no result may carry a year below this value. */
  mustNotContainYearBelow?: number
  /** The rank-1 result must be flagged retracted. */
  expectRetractedTop?: boolean
}

export interface GoldenCitationCase {
  id: string
  kind: "citation"
  label: string
  citedText: string
  expect: "verified" | "not_found"
  expectRetracted?: boolean
}

export type GoldenCase = GoldenSearchCase | GoldenCitationCase

const AIAYN = "attentionisallyouneed"

export const ACADEMIC_GOLDEN_SET: GoldenCase[] = [
  {
    id: "G1",
    kind: "search",
    label: "exact title (Transformer paper) — provider order vs citation sort, S2/OpenAlex duplicate",
    query: "Attention Is All You Need",
    relevance: {
      [AIAYN]: 2,
      "10.65215/2q58a426": 2, // OpenAlex's DOI for the same work
      "arxiv:1706.03762": 2,
      "10.1109/icassp39728.2021.9413901": 1,
      "10.1609/aaai.v34i07.6693": 1,
      "10.1093/bib/bbad467": 1,
      "10.48550/arxiv.2102.05095": 1,
      "10.48550/arxiv.2501.06425": 1,
      "10.48550/arxiv.2412.01818": 1,
      "10.1007/978-3-031-84300-6_13": 1,
    },
    target: [AIAYN, "10.65215/2q58a426", "arxiv:1706.03762"],
    expectedMode: "search",
    minResults: 5,
  },
  {
    id: "G2",
    kind: "search",
    label: "topical keyword query — classics vs recent, Crossref noise",
    query: "quantum machine learning",
    relevance: {
      "10.1038/nature23474": 2,
      "10.1103/physrevlett.122.040504": 2,
      "10.1080/00107514.2014.964942": 2,
      "10.1038/s43588-022-00311-3": 2,
      "10.1038/s41467-021-22539-9": 2,
      "10.1109/access.2025.3573244": 2,
      "10.1007/s42484-021-00056-8": 2,
      "10.1016/j.mex.2025.103318": 1,
      "10.1038/s41467-025-55877-z": 1,
      "10.48550/arxiv.2505.17756": 1,
      "arxiv:2503.02934": 1,
      trainonclassicaldeployonquantumscalinggenerativequantummachinelearningtoathousandqubits: 1,
      "10.5821/dissertation-2117-348901": 1,
      "10.1007/978-1-4842-7098-1": 1,
      "10.1007/s42484-026-00373-w": 1,
      "10.1088/2632-2153/ab9803": 1,
      "10.26434/chemrxiv-2025-71814": 1,
    },
    target: ["10.1038/nature23474"],
    expectedMode: "search",
    minResults: 5,
  },
  {
    id: "G3",
    kind: "search",
    label: "DOI lookup",
    query: "10.1038/nature14539",
    relevance: { "10.1038/nature14539": 2 },
    target: ["10.1038/nature14539"],
    expectedMode: "doi",
    minResults: 1,
  },
  {
    id: "G4",
    kind: "search",
    label: "DOI pasted with sentence punctuation",
    query: "10.1038/nature14539.",
    relevance: { "10.1038/nature14539": 2 },
    target: ["10.1038/nature14539"],
    expectedMode: "doi",
    minResults: 1,
  },
  {
    id: "G5",
    kind: "search",
    label: "arXiv identifier",
    query: "arXiv:1706.03762",
    relevance: { [AIAYN]: 2, "arxiv:1706.03762": 2 },
    target: [AIAYN, "arxiv:1706.03762"],
    expectedMode: "arxiv",
    minResults: 1,
  },
  {
    id: "G6",
    kind: "search",
    label: "topical query with 'last two years' filter — year-window parity across providers",
    query: "quantum machine learning",
    // The API allows limit ≤ 20; at the dialog's limit of 8 the citation sort happens to
    // push the out-of-window Crossref rows below the cut, which masks the leak.
    limit: 12,
    yearFrom: 2024,
    relevance: {
      "10.1016/j.cosrev.2024.100619": 2,
      "10.1088/2632-2153/ad2aef": 2,
      "10.1109/access.2024.3353461": 2,
      "10.1038/s41467-024-49877-8": 2,
      "10.1088/1361-6633/ad7f69": 2,
      "10.1109/access.2025.3573244": 2,
      "10.1016/j.mex.2025.103318": 1,
      "10.1038/s41467-025-55877-z": 1,
      "10.48550/arxiv.2505.17756": 1,
      "arxiv:2503.02934": 1,
      trainonclassicaldeployonquantumscalinggenerativequantummachinelearningtoathousandqubits: 1,
      "10.1201/9781003646068-6": 1,
      "10.1007/s42484-026-00373-w": 1,
      "10.26434/chemrxiv-2025-71814": 1,
    },
    target: ["10.1016/j.cosrev.2024.100619", "10.1109/access.2025.3573244", "10.1088/2632-2153/ad2aef", "10.1109/access.2024.3353461"],
    expectedMode: "search",
    minResults: 5,
    mustNotContainYearBelow: 2024,
  },
  {
    id: "G7",
    kind: "search",
    label: "non-Latin (CJK) query — Unicode survival",
    query: "深度学习",
    relevance: {
      "10.3788/cjl230924": 2,
      "10.3788/lop230488": 2,
      "10.3788/cjl230470": 2,
      "10.3799/dqkx.2020.111": 2,
      "10.3788/lop232464": 2,
    },
    target: ["10.3788/cjl230924", "10.3788/lop230488", "10.3788/cjl230470", "10.3799/dqkx.2020.111", "10.3788/lop232464"],
    expectedMode: "search",
    minResults: 5,
  },
  {
    id: "G8",
    kind: "search",
    label: "retracted paper (Wakefield 1998) — retraction flag must survive merging",
    query: "Ileal-lymphoid-nodular hyperplasia non-specific colitis pervasive developmental disorder children",
    relevance: {
      "10.1016/s0140-6736(97)11096-0": 2,
      "10.1016/s0140-6736(10)60175-4": 1,
      "10.1016/s0140-6736(05)77837-5": 1,
      "10.1016/s0140-6736(02)08948-1": 1,
      ileallymphoidnodularhyperplasianonspecificcolitisandpervasivedevelopmentaldisorderinchildrenretractedarticleseevol375pg4452010: 1,
    },
    target: ["10.1016/s0140-6736(97)11096-0"],
    expectedMode: "search",
    minResults: 3,
    expectRetractedTop: true,
  },
  // ----- citation verification (auditThesisCitations path) --------------------
  {
    id: "C1",
    kind: "citation",
    label: "ISO 690 conference citation, no identifier — must verify even when Semantic Scholar is rate-limited",
    citedText: "VASWANI, Ashish et al. 2017. Attention is all you need. In: Advances in Neural Information Processing Systems 30. pp. 5998–6008.",
    expect: "verified",
  },
  {
    id: "C2",
    kind: "citation",
    label: "journal citation with DOI (Semantic Scholar knows the DOI, OpenAlex too)",
    citedText: "BIAMONTE, Jacob et al. 2017. Quantum machine learning. Nature, 549(7671), pp. 195–202. DOI: 10.1038/nature23474",
    expect: "verified",
  },
  {
    id: "C3",
    kind: "citation",
    label: "journal citation with DOI URL — Semantic Scholar answers 404 for this DOI (recorded), OpenAlex resolves it",
    citedText: "LECUN, Yann, BENGIO, Yoshua, HINTON, Geoffrey. 2015. Deep learning. Nature 521, 436–444. https://doi.org/10.1038/nature14539",
    expect: "verified",
  },
  {
    id: "C4",
    kind: "citation",
    label: "retracted paper cited by title — should verify AND surface the retraction",
    citedText: "WAKEFIELD, A. J. et al. 1998. Ileal-lymphoid-nodular hyperplasia, non-specific colitis, and pervasive developmental disorder in children. The Lancet, 351(9103), pp. 637–641.",
    expect: "verified",
    expectRetracted: true,
  },
  {
    id: "C5",
    kind: "citation",
    label: "fabricated Slovak thesis citation — must be reported not_found (not 'unavailable')",
    citedText: "NOVÁK, Ján. 2019. Neexistujúca práca o kvantových sieťach v priemysle. Bratislava: FMFI UK. 84 s.",
    expect: "not_found",
  },
]

// ---------------------------------------------------------------------------
// Identity & metrics (pure)
// ---------------------------------------------------------------------------

export function normalizeTitleIdentity(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
}

const ARXIV_DOI_PREFIX = /^10\.48550\/arxiv\./i

/** Every key under which a result can be recognised. */
export function identityKeys(r: Pick<AcademicPaperResult, "doi" | "arxivId" | "title">): string[] {
  const keys: string[] = []
  if (r.doi) {
    const doi = r.doi.toLowerCase().replace(/^https?:\/\/doi\.org\//, "")
    keys.push(doi)
    if (ARXIV_DOI_PREFIX.test(doi)) keys.push(`arxiv:${doi.replace(ARXIV_DOI_PREFIX, "").replace(/v\d+$/, "")}`)
  }
  if (r.arxivId) keys.push(`arxiv:${r.arxivId.replace(/v\d+$/, "")}`)
  const t = normalizeTitleIdentity(r.title || "")
  if (t) keys.push(t)
  return keys
}

export function gradeOf(r: AcademicPaperResult, relevance: Record<string, RelevanceGrade>): 0 | 1 | 2 {
  let best: 0 | 1 | 2 = 0
  for (const k of identityKeys(r)) {
    const g = relevance[k]
    if (g && g > best) best = g
  }
  return best
}

export function isTarget(r: AcademicPaperResult, target: string[]): boolean {
  const keys = new Set(identityKeys(r))
  return target.some((t) => keys.has(t))
}

export function precisionAt1(results: AcademicPaperResult[], target: string[]): number {
  return results.length > 0 && isTarget(results[0], target) ? 1 : 0
}

export function reciprocalRank(results: AcademicPaperResult[], target: string[]): number {
  const idx = results.findIndex((r) => isTarget(r, target))
  return idx === -1 ? 0 : 1 / (idx + 1)
}

export function ndcgAtK(results: AcademicPaperResult[], relevance: Record<string, RelevanceGrade>, k = 5): number {
  const gains = results.slice(0, k).map((r) => gradeOf(r, relevance))
  const dcg = gains.reduce((acc, g, i) => acc + (Math.pow(2, g) - 1) / Math.log2(i + 2), 0)
  const ideal = Object.values(relevance)
    .sort((a, b) => b - a)
    .slice(0, k)
    .reduce((acc, g, i) => acc + (Math.pow(2, g) - 1) / Math.log2(i + 2), 0)
  return ideal === 0 ? 0 : dcg / ideal
}

/** Number of rows whose identity repeats an earlier row (DOI, arXiv id or title). */
export function duplicateRows(results: AcademicPaperResult[]): Array<{ index: number; duplicateOf: number; via: string }> {
  const seen = new Map<string, number>()
  const dups: Array<{ index: number; duplicateOf: number; via: string }> = []
  results.forEach((r, i) => {
    const keys = identityKeys(r)
    const hit = keys.find((k) => seen.has(k))
    if (hit !== undefined) dups.push({ index: i, duplicateOf: seen.get(hit)!, via: hit })
    for (const k of keys) if (!seen.has(k)) seen.set(k, i)
  })
  return dups
}

export function duplicateRate(results: AcademicPaperResult[]): number {
  return results.length === 0 ? 0 : duplicateRows(results).length / results.length
}

const AUTHOR_SENTINELS = new Set(["unknown author", "unknown", "n/a", ""])

export function hasRealAuthors(r: Pick<AcademicPaperResult, "authors">): boolean {
  return (r.authors ?? []).some((a) => !AUTHOR_SENTINELS.has(a.trim().toLowerCase()))
}

export interface FieldCompleteness {
  doi: number
  year: number
  venue: number
  authors: number
  citationCount: number
  openAccess: number
}

export function fieldCompleteness(results: AcademicPaperResult[]): FieldCompleteness {
  const n = results.length || 1
  const share = (pred: (r: AcademicPaperResult) => boolean) => results.filter(pred).length / n
  return {
    doi: share((r) => Boolean(r.doi)),
    year: share((r) => typeof r.year === "number"),
    venue: share((r) => Boolean(r.venue && r.venue.trim())),
    authors: share(hasRealAuthors),
    citationCount: share((r) => typeof r.citationCount === "number"),
    openAccess: share((r) => Boolean(r.openAccessPdfUrl)),
  }
}

/** Share of the top-k confirmed by ≥ 2 providers; null when provenance is unavailable. */
export function providerAgreement(results: Array<AcademicPaperResult & { sources?: string[] }>, k = 5): number | null {
  const top = results.slice(0, k)
  if (top.length === 0 || top.every((r) => !r.sources)) return null
  return top.filter((r) => (r.sources?.length ?? 0) >= 2).length / top.length
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface SearchOutcome {
  results: AcademicPaperResult[]
  mode?: "doi" | "arxiv" | "search"
  providers?: Record<string, { status: string; count: number; latencyMs?: number }>
  elapsedMs: number
}

export interface SearchCaseReport {
  id: string
  label: string
  query: string
  yearFrom?: number
  mode: string | null
  count: number
  precisionAt1: number
  reciprocalRank: number
  ndcgAt5: number
  duplicateRows: number
  duplicateRate: number
  fieldCompleteness: FieldCompleteness
  providerAgreement: number | null
  yearLeaks: number
  retractedTop: boolean | null
  providers: SearchOutcome["providers"] | null
  elapsedMs: number
  top: Array<{
    rank: number
    title: string
    doi?: string
    year?: number | null
    source: string
    sources?: string[]
    citationCount?: number
    isRetracted?: boolean
    grade: 0 | 1 | 2
  }>
  violations: string[]
}

export interface CitationCaseReport {
  id: string
  label: string
  status: string
  found: boolean
  confidence: string
  matchedTitle: string | null
  isRetracted: boolean
  expected: "verified" | "not_found"
  pass: boolean
  elapsedMs: number
  issues: string[]
}

export interface GoldenRunReport {
  mode: "recorded" | "live"
  generatedAt: string
  searches: SearchCaseReport[]
  citations: CitationCaseReport[]
  aggregate: {
    searchCases: number
    meanPrecisionAt1: number
    meanReciprocalRank: number
    meanNdcgAt5: number
    totalDuplicateRows: number
    meanDuplicateRate: number
    fieldCompleteness: FieldCompleteness
    providerAgreement: number | null
    yearLeaks: number
    violations: number
    citationCases: number
    verifiedRate: number
    correctClassificationRate: number
    unavailable: number
  }
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
}

export function scoreSearchCase(c: GoldenSearchCase, outcome: SearchOutcome): SearchCaseReport {
  const { results } = outcome
  const dups = duplicateRows(results)
  const violations: string[] = []
  const yearLeaks =
    c.mustNotContainYearBelow !== undefined
      ? results.filter((r) => typeof r.year === "number" && r.year < c.mustNotContainYearBelow!).length
      : 0
  if (c.minResults !== undefined && results.length < c.minResults) {
    violations.push(`expected ≥ ${c.minResults} results, got ${results.length}`)
  }
  if (c.expectedMode && outcome.mode && outcome.mode !== c.expectedMode) {
    violations.push(`expected mode ${c.expectedMode}, got ${outcome.mode}`)
  }
  if (yearLeaks > 0) violations.push(`${yearLeaks} result(s) older than ${c.mustNotContainYearBelow}`)
  if (dups.length > 0) violations.push(`${dups.length} duplicate row(s): ${dups.map((d) => `#${d.index + 1}≡#${d.duplicateOf + 1} via ${d.via}`).join(", ")}`)
  const retractedTop = c.expectRetractedTop ? Boolean(results[0]?.isRetracted) : null
  if (c.expectRetractedTop && !retractedTop) violations.push("rank-1 result is not flagged retracted")
  if (results.length > 0 && !isTarget(results[0], c.target)) violations.push(`rank-1 is not a target: "${results[0].title}"`)

  return {
    id: c.id,
    label: c.label,
    query: c.query,
    yearFrom: c.yearFrom,
    mode: outcome.mode ?? null,
    count: results.length,
    precisionAt1: precisionAt1(results, c.target),
    reciprocalRank: reciprocalRank(results, c.target),
    ndcgAt5: ndcgAtK(results, c.relevance, 5),
    duplicateRows: dups.length,
    duplicateRate: duplicateRate(results),
    fieldCompleteness: fieldCompleteness(results),
    providerAgreement: providerAgreement(results),
    yearLeaks,
    retractedTop,
    providers: outcome.providers ?? null,
    elapsedMs: outcome.elapsedMs,
    top: results.slice(0, 5).map((r, i) => ({
      rank: i + 1,
      title: r.title,
      doi: r.doi,
      year: r.year,
      source: r.source,
      sources: (r as AcademicPaperResult & { sources?: string[] }).sources,
      citationCount: r.citationCount,
      isRetracted: r.isRetracted,
      grade: gradeOf(r, c.relevance),
    })),
    violations,
  }
}

export function scoreCitationCase(c: GoldenCitationCase, result: CitationCheckResult, elapsedMs: number): CitationCaseReport {
  const issues: string[] = []
  const found = result.verification.found
  const status = result.status
  const isRetracted = Boolean(result.enriched?.isRetracted)
  let pass: boolean
  if (c.expect === "verified") {
    pass = found && status === "verified"
    if (!pass) issues.push(`expected verified, got ${status}`)
    if (c.expectRetracted && !isRetracted) {
      pass = false
      issues.push("retraction not surfaced")
    }
  } else {
    pass = !found && status === "not_found"
    if (!pass) issues.push(`expected not_found, got ${status}${found ? " (found)" : ""}`)
  }
  return {
    id: c.id,
    label: c.label,
    status,
    found,
    confidence: result.verification.confidence,
    matchedTitle: result.verification.paper?.title ?? null,
    isRetracted,
    expected: c.expect,
    pass,
    elapsedMs,
    issues,
  }
}

export function aggregateReport(
  mode: "recorded" | "live",
  searches: SearchCaseReport[],
  citations: CitationCaseReport[]
): GoldenRunReport {
  const fc = (key: keyof FieldCompleteness) => mean(searches.map((s) => s.fieldCompleteness[key]))
  const agreements = searches.map((s) => s.providerAgreement).filter((x): x is number => x !== null)
  return {
    mode,
    generatedAt: new Date().toISOString(),
    searches,
    citations,
    aggregate: {
      searchCases: searches.length,
      meanPrecisionAt1: mean(searches.map((s) => s.precisionAt1)),
      meanReciprocalRank: mean(searches.map((s) => s.reciprocalRank)),
      meanNdcgAt5: mean(searches.map((s) => s.ndcgAt5)),
      totalDuplicateRows: searches.reduce((a, s) => a + s.duplicateRows, 0),
      meanDuplicateRate: mean(searches.map((s) => s.duplicateRate)),
      fieldCompleteness: {
        doi: fc("doi"),
        year: fc("year"),
        venue: fc("venue"),
        authors: fc("authors"),
        citationCount: fc("citationCount"),
        openAccess: fc("openAccess"),
      },
      providerAgreement: agreements.length ? mean(agreements) : null,
      yearLeaks: searches.reduce((a, s) => a + s.yearLeaks, 0),
      violations: searches.reduce((a, s) => a + s.violations.length, 0),
      citationCases: citations.length,
      verifiedRate: citations.length ? citations.filter((c) => c.found && c.status === "verified").length / citations.length : 0,
      correctClassificationRate: citations.length ? citations.filter((c) => c.pass).length / citations.length : 0,
      unavailable: citations.filter((c) => ["rate_limited", "timeout", "service_error"].includes(c.status)).length,
    },
  }
}

export interface GoldenRunners {
  search: (c: GoldenSearchCase) => Promise<SearchOutcome>
  verify: (c: GoldenCitationCase) => Promise<CitationCheckResult>
}

export async function runGoldenSet(mode: "recorded" | "live", runners: GoldenRunners, cases: GoldenCase[] = ACADEMIC_GOLDEN_SET): Promise<GoldenRunReport> {
  const searches: SearchCaseReport[] = []
  const citations: CitationCaseReport[] = []
  for (const c of cases) {
    if (c.kind === "search") {
      const outcome = await runners.search(c)
      searches.push(scoreSearchCase(c, outcome))
    } else {
      const started = Date.now()
      const result = await runners.verify(c)
      citations.push(scoreCitationCase(c, result, Date.now() - started))
    }
  }
  return aggregateReport(mode, searches, citations)
}

// ---------------------------------------------------------------------------
// Comparison (baseline vs optimized)
// ---------------------------------------------------------------------------

export interface MetricDelta {
  metric: string
  baseline: number | null
  optimized: number | null
  delta: number | null
  better: "up" | "down" | "same" | "n/a"
  higherIsBetter: boolean
}

export function compareReports(baseline: GoldenRunReport, optimized: GoldenRunReport): {
  aggregate: MetricDelta[]
  perQuery: Array<{ id: string; label: string; baselineTop: string[]; optimizedTop: string[]; changed: boolean; baselineViolations: string[]; optimizedViolations: string[] }>
  citations: Array<{ id: string; baseline: string; optimized: string; baselinePass: boolean; optimizedPass: boolean }>
} {
  const rows: Array<[string, (r: GoldenRunReport) => number | null, boolean]> = [
    ["meanPrecisionAt1", (r) => r.aggregate.meanPrecisionAt1, true],
    ["meanReciprocalRank", (r) => r.aggregate.meanReciprocalRank, true],
    ["meanNdcgAt5", (r) => r.aggregate.meanNdcgAt5, true],
    ["totalDuplicateRows", (r) => r.aggregate.totalDuplicateRows, false],
    ["meanDuplicateRate", (r) => r.aggregate.meanDuplicateRate, false],
    ["yearLeaks", (r) => r.aggregate.yearLeaks, false],
    ["violations", (r) => r.aggregate.violations, false],
    ["fieldCompleteness.doi", (r) => r.aggregate.fieldCompleteness.doi, true],
    ["fieldCompleteness.year", (r) => r.aggregate.fieldCompleteness.year, true],
    ["fieldCompleteness.venue", (r) => r.aggregate.fieldCompleteness.venue, true],
    ["fieldCompleteness.authors", (r) => r.aggregate.fieldCompleteness.authors, true],
    ["fieldCompleteness.citationCount", (r) => r.aggregate.fieldCompleteness.citationCount, true],
    ["fieldCompleteness.openAccess", (r) => r.aggregate.fieldCompleteness.openAccess, true],
    ["providerAgreement", (r) => r.aggregate.providerAgreement, true],
    ["verifiedRate", (r) => r.aggregate.verifiedRate, true],
    ["correctClassificationRate", (r) => r.aggregate.correctClassificationRate, true],
    ["unavailable", (r) => r.aggregate.unavailable, false],
  ]
  const aggregate: MetricDelta[] = rows.map(([metric, get, higherIsBetter]) => {
    const b = get(baseline)
    const o = get(optimized)
    const delta = b === null || o === null ? null : o - b
    let better: MetricDelta["better"] = "n/a"
    if (delta !== null) {
      if (Math.abs(delta) < 1e-9) better = "same"
      else better = (delta > 0) === higherIsBetter ? "up" : "down"
    }
    return { metric, baseline: b, optimized: o, delta, better, higherIsBetter }
  })
  const perQuery = baseline.searches.map((bs) => {
    const os = optimized.searches.find((s) => s.id === bs.id)
    const baselineTop = bs.top.slice(0, 3).map((t) => `${t.title}${t.doi ? ` [${t.doi}]` : ""}`)
    const optimizedTop = (os?.top ?? []).slice(0, 3).map((t) => `${t.title}${t.doi ? ` [${t.doi}]` : ""}`)
    return {
      id: bs.id,
      label: bs.label,
      baselineTop,
      optimizedTop,
      changed: JSON.stringify(baselineTop) !== JSON.stringify(optimizedTop),
      baselineViolations: bs.violations,
      optimizedViolations: os?.violations ?? [],
    }
  })
  const citations = baseline.citations.map((bc) => {
    const oc = optimized.citations.find((c) => c.id === bc.id)
    return { id: bc.id, baseline: bc.status, optimized: oc?.status ?? "n/a", baselinePass: bc.pass, optimizedPass: oc?.pass ?? false }
  })
  return { aggregate, perQuery, citations }
}
