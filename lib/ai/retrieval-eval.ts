/**
 * Retrieval evaluation harness (golden set).
 *
 * Real SK/CS thesis evaluation maps each rubric criterion to the section
 * headings where supporting content is expected to live. A retrieval run is
 * scored with:
 *   - Recall@K: fraction of expected sections present in the top-K results
 *   - MRR: mean reciprocal rank of the first expected hit
 *
 * The metrics are pure functions over `(rankedChunkIds, expectedSectionHits)`
 * so they run without a database. The gated vitest in
 * lib/__tests__/retrieval-golden.test.ts wires them to the real embedding /
 * hybrid pipeline under TEST_REAL_EMBEDDINGS=1; without that flag it runs the
 * same assertions against a deterministic lexical retriever so the metrics
 * code itself is always covered.
 *
 * Tunables (λ, boosts, chunk size) live in one place here so an evaluation run
 * reports them alongside the metrics instead of being hidden in comments.
 */

export interface GoldenQuery {
  /** Criterion this query evaluates. */
  criterionId: string
  lang: "sk" | "cs" | "en"
  /** The natural-language retrieval query (criterion label + guidance). */
  query: string
  /**
   * Heading substrings that a correctly-retrieved chunk is expected to carry
   * (e.g. "Metodika" / "Methodology"). A chunk matches if its heading contains
   * ANY expected substring (case-insensitive).
   */
  expectedSections: string[]
}

/** Tunable snapshot recorded with every evaluation run. */
export const RETRIEVAL_TUNABLES = {
  lambda: 0.7,
  rrfVectorWeight: 0.7,
  rrfFtsWeight: 0.3,
  rrfK: 60,
  crossEncoderBlend: 0.8,
  heuristicPriorBlend: 0.2,
  chunkSizeShort: 1200,
  chunkSizeLong: 1500,
} as const

export interface RetrievedChunkLite {
  id: string
  heading: string | null
}

export interface QueryScore {
  criterionId: string
  recallAtK: number
  successAtK: number
  reciprocalRank: number
  /** Rank (1-based) of the first expected hit, or null when none. */
  firstHitRank: number | null
}

function headingMatches(heading: string | null, expected: string[]): boolean {
  if (!heading) return false
  const h = heading.toLowerCase()
  return expected.some((e) => h.includes(e.toLowerCase()))
}

/**
 * Coverage@K: fraction of the expected section substrings represented in the
 * top-K results (multiple chunks from the same section count once). Use when
 * the expectation is that every listed section must appear.
 */
export function recallAtK(
  ranked: RetrievedChunkLite[],
  expectedSections: string[],
  k: number
): number {
  if (expectedSections.length === 0) return 1
  const topK = ranked.slice(0, k)
  const hit = new Set<string>()
  for (const chunk of topK) {
    for (const expected of expectedSections) {
      if (headingMatches(chunk.heading, [expected])) hit.add(expected.toLowerCase())
    }
  }
  return hit.size / expectedSections.length
}

/**
 * Success@K: 1 if ANY expected section appears within the top-K results, else
 * 0. The golden-set expectations are *alternatives* (the methodology answer
 * may live under "Metodika" OR "Návrh" OR "Experimenty" depending on the
 * thesis), so success@K — like retrieval "hit rate" in RAG evaluations — is
 * the correct headline metric; mean success = hit rate over the golden set.
 */
export function successAtK(ranked: RetrievedChunkLite[], expectedSections: string[], k: number): number {
  if (expectedSections.length === 0) return 1
  return ranked.slice(0, k).some((chunk) => headingMatches(chunk.heading, expectedSections)) ? 1 : 0
}

/** Reciprocal rank of the first chunk whose heading matches any expectation. */
export function reciprocalRank(ranked: RetrievedChunkLite[], expectedSections: string[]): number {
  for (let i = 0; i < ranked.length; i++) {
    if (headingMatches(ranked[i].heading, expectedSections)) return 1 / (i + 1)
  }
  return 0
}

export interface RetrievalEvalReport {
  queries: number
  /** Fraction of golden queries with at least one expected section in top-K (hit rate). */
  hitRateAtK: number
  /** Strict coverage mean (all expected sections present — mostly for diagnostics). */
  meanRecallAtK: number
  mrr: number
  perQuery: QueryScore[]
  tunables: typeof RETRIEVAL_TUNABLES
  k: number
}

/**
 * Evaluates a retriever over the golden set. `retrieve` maps a query to the
 * ranked chunks the pipeline produced. Pure and side-effect free.
 */
export async function evaluateRetrieval(
  golden: GoldenQuery[],
  retrieve: (q: GoldenQuery) => Promise<RetrievedChunkLite[]>,
  k = 8
): Promise<RetrievalEvalReport> {
  const perQuery: QueryScore[] = []
  for (const q of golden) {
    const ranked = await retrieve(q)
    const recall = recallAtK(ranked, q.expectedSections, k)
    const success = successAtK(ranked, q.expectedSections, k)
    const rr = reciprocalRank(ranked, q.expectedSections)
    let firstHitRank: number | null = null
    for (let i = 0; i < ranked.length; i++) {
      if (headingMatches(ranked[i].heading, q.expectedSections)) {
        firstHitRank = i + 1
        break
      }
    }
    perQuery.push({ criterionId: q.criterionId, recallAtK: recall, successAtK: success, reciprocalRank: rr, firstHitRank })
  }
  const meanRecallAtK = perQuery.reduce((a, s) => a + s.recallAtK, 0) / Math.max(1, perQuery.length)
  const hitRateAtK = perQuery.reduce((a, s) => a + s.successAtK, 0) / Math.max(1, perQuery.length)
  const mrr = perQuery.reduce((a, s) => a + s.reciprocalRank, 0) / Math.max(1, perQuery.length)
  return {
    queries: perQuery.length,
    hitRateAtK: Math.round(hitRateAtK * 1000) / 1000,
    meanRecallAtK: Math.round(meanRecallAtK * 1000) / 1000,
    mrr: Math.round(mrr * 1000) / 1000,
    perQuery,
    tunables: RETRIEVAL_TUNABLES,
    k,
  }
}

// ---------------------------------------------------------------------------
// Golden set — 40 queries distilled from real SK/CS thesis review criteria
// (criterion → sections expected to contain the answer).
// ---------------------------------------------------------------------------

export const GOLDEN_RETRIEVAL_SET: GoldenQuery[] = [
  // --- goals / problem relevance ---
  { criterionId: "goal_definition", lang: "sk", query: "formulácia cieľov práce výskumné otázky hypotézy", expectedSections: ["úvod", "cieľ", "zadanie", "abstrakt"] },
  { criterionId: "goal_definition", lang: "en", query: "formulation of thesis goals research questions hypotheses", expectedSections: ["introduction", "goal", "objective", "abstract"] },
  { criterionId: "problem_relevance", lang: "sk", query: "motivácia a aktuálnosť riešeného problému", expectedSections: ["úvod", "motiv", "stav", "problém"] },
  { criterionId: "objectives_clarity", lang: "cs", query: "vymezení cílů a přínosů práce", expectedSections: ["úvod", "cíl", "přínos"] },

  // --- methodology ---
  { criterionId: "methodology_rigor", lang: "sk", query: "metodika výskumu návrh architektúry experimentálne overenie", expectedSections: ["metod", "návrh", "architektúra", "experiment"] },
  { criterionId: "methodology_rigor", lang: "en", query: "research methodology architecture experimental design", expectedSections: ["method", "design", "architecture", "experiment"] },
  { criterionId: "analytical_execution", lang: "sk", query: "analýza dát postup spracovania implementácia", expectedSections: ["metod", "implement", "analýz", "spracovan"] },
  { criterionId: "analytical_execution", lang: "cs", query: "analýza dat implementace metody zpracování", expectedSections: ["metod", "implement", "analýz", "zpracován"] },

  // --- results ---
  { criterionId: "results_validity", lang: "sk", query: "výsledky experimentov namerané hodnoty štatistické vyhodnotenie", expectedSections: ["výsledk", "experiment", "vyhodnoten"] },
  { criterionId: "results_validity", lang: "en", query: "experimental results measured values statistical evaluation", expectedSections: ["result", "experiment", "evaluat"] },
  { criterionId: "discussion_relation", lang: "sk", query: "diskusia výsledkov interpretácia porovnanie s predpokladmi", expectedSections: ["diskus", "interpret", "porovnan"] },
  { criterionId: "discussion_relation", lang: "cs", query: "diskuze výsledků interpretace porovnání", expectedSections: ["diskus", "interpret", "porovnán"] },
  { criterionId: "originality_contribution", lang: "sk", query: "originálny prínos práce novosť riešenia", expectedSections: ["prínos", "záver", "novost", "originál"] },
  { criterionId: "originality_contribution", lang: "en", query: "original contribution novelty of the work", expectedSections: ["contribution", "conclusion", "novelty"] },
  { criterionId: "limitations_future_work", lang: "sk", query: "limity a obmedzenia práce návrhy na budúci výskum", expectedSections: ["limit", "budúc", "záver", "diskus"] },
  { criterionId: "limitations_future_work", lang: "en", query: "limitations threats to validity future work", expectedSections: ["limitation", "future", "conclusion", "discussion"] },

  // --- literature / theory ---
  { criterionId: "theoretical_background", lang: "sk", query: "teoretické východiská prehľad literatúry stav problematiky", expectedSections: ["literat", "teoret", "stav", "rešerš"] },
  { criterionId: "theoretical_background", lang: "en", query: "theoretical background literature review state of the art", expectedSections: ["literature", "background", "related", "state of"] },
  { criterionId: "theoretical_background", lang: "cs", query: "teoretická východiska přehled literatury rešerše", expectedSections: ["literatur", "teoret", "rešerš", "stav"] },

  // --- citations ---
  { criterionId: "citations_quality", lang: "sk", query: "zoznam použitej literatúry citácie bibliografia ISO 690", expectedSections: ["literat", "bibliograph", "referenc", "zoznam"] },
  { criterionId: "citations_quality", lang: "en", query: "bibliography references citation style", expectedSections: ["reference", "bibliograph"] },
  { criterionId: "citations_bibliography", lang: "sk", query: "citácie v texte odkazy na zdroje", expectedSections: ["literat", "citáci", "referenc"] },

  // --- formal ---
  { criterionId: "structure_coherence", lang: "sk", query: "štruktúra práce formálna úprava členenie kapitol", expectedSections: ["obsah", "štruktúr", "úvod", "záver"] },
  { criterionId: "structure_coherence", lang: "en", query: "document structure formal layout chapter organization", expectedSections: ["structure", "content", "introduction", "conclusion"] },
  { criterionId: "language_quality", lang: "sk", query: "jazyková úroveň odborná terminológia štylistika", expectedSections: ["jazyk", "terminolog", "formáln", "štylist"] },
  { criterionId: "formal_structure", lang: "cs", query: "formální úprava typografie grafická úprava", expectedSections: ["formáln", "typografi", "grafick"] },
  { criterionId: "ethics_transparency", lang: "sk", query: "etika výskumu transparentnosť zdrojov dát", expectedSections: ["etik", "transparent", "ochran", "dát"] },
  { criterionId: "ethics_transparency", lang: "en", query: "research ethics data transparency", expectedSections: ["ethic", "transparency", "data"] },

  // --- tables / figures / equations (structural) ---
  { criterionId: "results_validity", lang: "sk", query: "tabuľka výsledkov meraní prehľad hodnôt", expectedSections: ["tabuľk", "tab.", "výsledk"] },
  { criterionId: "analytical_execution", lang: "sk", query: "matematické rovnice odvodenie vzťahov", expectedSections: ["rovnic", "vzorec", "matematick", "metod"] },
  { criterionId: "results_validity", lang: "en", query: "figure graph of results comparison plot", expectedSections: ["figure", "fig.", "graph", "result"] },
  { criterionId: "results_validity", lang: "sk", query: "graf porovnanie presnosti modelov", expectedSections: ["graf", "obrázok", "obr.", "porovnan"] },

  // --- defense ---
  { criterionId: "defense_questions", lang: "sk", query: "otázky na obhajobu slabé miesta rizika", expectedSections: ["záver", "diskus", "limit", "otázk"] },
  { criterionId: "defense_questions", lang: "en", query: "defense questions weaknesses methodological risks", expectedSections: ["conclusion", "discussion", "limitation"] },

  // --- mixed / abstract / conclusion ---
  { criterionId: "goal_definition", lang: "sk", query: "abstrakt zhrnutie cieľov a výsledkov", expectedSections: ["abstrakt", "abstract", "zhrnut"] },
  { criterionId: "originality_contribution", lang: "cs", query: "závěr shrnutí přínosů a výsledků", expectedSections: ["závěr", "závěry", "shrnut"] },
  { criterionId: "results_validity", lang: "cs", query: "výsledky měření přesnost klasifikace", expectedSections: ["výsledk", "měřen", "klasifikac"] },
  { criterionId: "methodology_rigor", lang: "cs", query: "metodika návrh systému experimenty", expectedSections: ["metodik", "návrh", "experiment"] },
  { criterionId: "theoretical_background", lang: "cs", query: "související práce analýza existujících řešení", expectedSections: ["souvisejíc", "existujíc", "literatur", "stav"] },
  { criterionId: "citations_quality", lang: "cs", query: "seznam literatury citace norma ISO 690", expectedSections: ["literatur", "seznam", "bibliograf"] },
  { criterionId: "problem_relevance", lang: "en", query: "problem statement motivation relevance of topic", expectedSections: ["introduction", "motivation", "problem"] },
]
