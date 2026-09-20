/**
 * Criterion profiles — the data behind criterion-routed retrieval.
 *
 * The review system has to know *what kind of evidence* a criterion needs before it retrieves,
 * because "methodology quality" and "novelty" are answered by completely different parts of the
 * document, with different structural objects, and with different expectations about
 * counter-evidence.
 *
 * This module is a **table**, not a switch statement. `resolveCriterionProfile()` scores the
 * criterion id against the table's `matches` patterns and merges every profile that fires, so:
 *
 *   - adding a criterion means adding a row, not editing control flow;
 *   - a criterion that legitimately spans two families (e.g. `analytical_execution` is both
 *     methodology and results) gets the union of both profiles;
 *   - the routing decision is inspectable and testable, and shows up in the retrieval trace.
 *
 * Language coverage: `preferredSections` carries Slovak, Czech and English heading fragments,
 * because the section-path boost is a substring match against `DocumentChunk.sectionPath`.
 *
 * @module criterion-profiles
 */

import type { RetrievalSource } from "./fusion"

/** How much evidence a criterion needs before a finding may be asserted. */
export interface SufficiencyRule {
  /** Minimum distinct evidence chunks required. */
  minEvidenceChunks: number
  /** At least one of these structural types must be present (empty = any). */
  requireElementTypes: string[]
  /** Counter-evidence must be actively searched for, not merely tolerated. */
  requireCounterEvidenceSearch: boolean
  /** When true the criterion may not be graded from retrieval alone (needs global context). */
  requiresGlobalContext: boolean
}

export interface CriterionProfile {
  /** Stable profile key — appears in traces and ablation configs. */
  key: string
  /** Criterion ids / substrings this profile applies to (lowercased substring match). */
  matches: string[]
  /** Human description, surfaced in the dev dashboard. */
  description: string
  /** What the reviewer is expected to find. */
  expectedEvidence: string[]
  /** Heading fragments that should be boosted (SK / CS / EN). */
  preferredSections: string[]
  /** Graph entity labels worth traversing. */
  relevantEntityTypes: string[]
  /** Retrieval legs to run, with per-leg candidate counts. */
  strategies: Array<{ source: RetrievalSource; limit?: number; weight?: number }>
  /** Structural chunk types to request explicitly. */
  structuralTypes: string[]
  /** What would qualify or refute a finding on this criterion. */
  expectedCounterEvidence: string[]
  sufficiency: SufficiencyRule
}

const DEFAULT_SUFFICIENCY: SufficiencyRule = {
  minEvidenceChunks: 2,
  requireElementTypes: [],
  requireCounterEvidenceSearch: false,
  requiresGlobalContext: false,
}

/**
 * The profile table.
 *
 * Order matters only for tie-breaking when merging: earlier rows win on conflicting scalars,
 * while list fields are always unioned.
 */
export const CRITERION_PROFILES: CriterionProfile[] = [
  {
    key: "goals",
    matches: ["goal", "objective", "problem_relevance", "zadanie", "cieľ", "cíl", "úvod", "introduction", "motivation", "motivácia"],
    description: "Objectives, research questions, hypotheses and problem relevance.",
    expectedEvidence: [
      "explicit statement of the goal(s) and research questions",
      "hypotheses, if the work is hypothesis-driven",
      "the assignment (zadanie) the work claims to fulfil",
      "motivation linking the problem to prior work",
    ],
    preferredSections: ["úvod", "úvod", "introduction", "cieľ", "cíl", "goal", "objective", "zadanie", "assignment", "abstrakt", "abstract", "motiv"],
    relevantEntityTypes: ["ResearchQuestion", "Hypothesis", "Concept", "Claim"],
    strategies: [
      { source: "dense", limit: 40 },
      { source: "lexical", limit: 40 },
      { source: "graph", limit: 20, weight: 0.7 },
      { source: "metadata", limit: 10 },
    ],
    structuralTypes: [],
    expectedCounterEvidence: [
      "results or discussion that do not address a stated objective",
      "objectives restated in the conclusion with weaker wording",
    ],
    sufficiency: { ...DEFAULT_SUFFICIENCY, minEvidenceChunks: 2 },
  },
  {
    key: "methodology",
    matches: ["methodology", "method", "metodik", "metodológia", "analytical_execution", "design", "návrh", "protocol", "postup", "experiment"],
    description: "Methods, experimental setup, datasets, protocol and statistical analysis.",
    expectedEvidence: [
      "description of the method / architecture / protocol",
      "datasets, materials or participants, with sizes",
      "experimental setup: hardware, parameters, splits, repetitions",
      "statistical analysis plan and significance testing",
      "reproducibility details (seeds, versions, code/data availability)",
    ],
    preferredSections: [
      "metod", "metodik", "metodológia", "method", "návrh", "design", "architecture", "architektúr",
      "experiment", "dataset", "dátová sada", "protocol", "postup", "implement", "štatistick", "statistic", "setup",
    ],
    relevantEntityTypes: ["Method", "Methodology", "Dataset", "Experiment", "Variable", "Metric"],
    strategies: [
      { source: "dense", limit: 50 },
      { source: "lexical", limit: 50 },
      { source: "graph", limit: 30, weight: 0.8 },
      // A table of experimental settings or an equation IS methodology evidence.
      { source: "metadata", limit: 20, weight: 0.7 },
      { source: "citation", limit: 15, weight: 0.4 },
    ],
    structuralTypes: ["table", "equation", "paragraph"],
    expectedCounterEvidence: [
      "described method differing from the implemented one",
      "missing control conditions, baselines or ablations",
      "undefined symbols or variables used but never introduced",
    ],
    sufficiency: {
      minEvidenceChunks: 3,
      requireElementTypes: [],
      requireCounterEvidenceSearch: true,
      requiresGlobalContext: false,
    },
  },
  {
    key: "results",
    matches: ["result", "výsledk", "výsledky", "results_validity", "analytical_execution", "discussion_relation", "interpret", "meran", "measure", "evaluat", "metric"],
    description: "Measured results, statistical tests, figures and their interpretation.",
    expectedEvidence: [
      "quantitative results with units and dispersion",
      "statistical tests and p-values / confidence intervals",
      "figures and tables presenting the measurements",
      "comparison against baselines or prior work",
      "interpretation that stays inside what the numbers show",
    ],
    preferredSections: [
      "výsledk", "výsledky", "result", "experiment", "meran", "měřen", "vyhodnoten", "evaluation",
      "diskus", "diskuse", "discussion", "interpret", "porovnan", "comparison", "graf", "tabuľk", "tab.", "figure", "obr.",
    ],
    relevantEntityTypes: ["Finding", "Metric", "Experiment", "Claim", "Variable"],
    strategies: [
      { source: "dense", limit: 50 },
      { source: "lexical", limit: 50 },
      // Numerical questions are answered by tables and figures first.
      { source: "metadata", limit: 25, weight: 0.9 },
      { source: "graph", limit: 20, weight: 0.6 },
    ],
    structuralTypes: ["table", "figure_caption", "paragraph"],
    expectedCounterEvidence: [
      "text values that disagree with the table or figure",
      "improvements without a significance test",
      "percentages that do not sum, or sample sizes that change between sections",
    ],
    sufficiency: {
      minEvidenceChunks: 3,
      requireElementTypes: ["table", "figure_caption"],
      requireCounterEvidenceSearch: true,
      requiresGlobalContext: false,
    },
  },
  {
    key: "novelty",
    matches: ["novel", "original", "originál", "novosť", "contribution", "prínos", "přínos", "originality_contribution", "state of the art", "related work", "súvisiac"],
    description: "Claimed contribution, related work coverage and prior-art position.",
    expectedEvidence: [
      "explicit contribution claims",
      "related-work survey and the gap it claims to fill",
      "citations supporting the claimed gap",
      "comparison with the closest prior approaches",
    ],
    preferredSections: [
      "úvod", "introduction", "prínos", "přínos", "contribution", "novost", "novosť", "novelty",
      "stav", "state of", "related", "súvisiac", "souvisejíc", "literat", "záver", "conclusion",
    ],
    relevantEntityTypes: ["Claim", "Concept", "Paper", "Citation", "Finding"],
    strategies: [
      { source: "dense", limit: 40 },
      { source: "lexical", limit: 40 },
      // Novelty is a citation-graph question as much as a text question.
      { source: "citation", limit: 30, weight: 0.9 },
      { source: "graph", limit: 30, weight: 0.8 },
      { source: "community", limit: 12, weight: 0.5 },
    ],
    structuralTypes: ["citation", "paragraph"],
    expectedCounterEvidence: [
      "prior work that already reports the claimed contribution",
      "claims of novelty phrased without a comparison",
      "related-work sections that omit the closest approaches",
    ],
    sufficiency: {
      minEvidenceChunks: 3,
      requireElementTypes: ["citation"],
      requireCounterEvidenceSearch: true,
      // "Is this novel?" cannot be answered from one passage; it needs the whole arc.
      requiresGlobalContext: true,
    },
  },
  {
    key: "limitations",
    matches: ["limitation", "limit", "limity", "obmedzen", "future work", "budúc", "threats to validity", "weakness", "slab", "defense"],
    description: "Acknowledged limitations, negative findings and threats to validity.",
    expectedEvidence: [
      "explicitly acknowledged limitations",
      "negative or inconclusive findings",
      "threats to internal/external validity",
      "proposed future work that follows from the limitations",
    ],
    preferredSections: [
      "limit", "obmedzen", "limity", "diskus", "diskuse", "discussion", "záver", "závěr", "conclusion",
      "budúc", "budoucn", "future", "rizik", "risk", "slab", "weakness", "validit",
    ],
    relevantEntityTypes: ["Limitation", "Claim", "Finding", "Conclusion"],
    strategies: [
      { source: "dense", limit: 40 },
      { source: "lexical", limit: 40 },
      { source: "graph", limit: 20, weight: 0.7 },
    ],
    structuralTypes: [],
    expectedCounterEvidence: [
      "conclusions that are stronger than the acknowledged limitations allow",
      "generalisation claims beyond the tested population or dataset",
    ],
    sufficiency: { ...DEFAULT_SUFFICIENCY, minEvidenceChunks: 2, requireCounterEvidenceSearch: true },
  },
  {
    key: "literature",
    matches: ["literature", "literat", "theoretical_background", "teoret", "background", "rešerš", "rešerše", "state of the art"],
    description: "Theoretical grounding and coverage of the state of the art.",
    expectedEvidence: [
      "theoretical foundations with sources",
      "systematic coverage of related work",
      "critical comparison rather than a list of summaries",
    ],
    preferredSections: ["literat", "teoret", "theoret", "background", "východisk", "state of", "related", "rešerš", "rešerše", "prehľad", "přehled", "review"],
    relevantEntityTypes: ["Paper", "Citation", "Concept"],
    strategies: [
      { source: "dense", limit: 40 },
      { source: "lexical", limit: 40 },
      { source: "citation", limit: 30, weight: 1.0 },
      { source: "graph", limit: 20, weight: 0.6 },
    ],
    structuralTypes: ["citation", "paragraph"],
    expectedCounterEvidence: ["claims presented as established without a citation", "outdated sources presented as current"],
    sufficiency: { ...DEFAULT_SUFFICIENCY, minEvidenceChunks: 2, requireElementTypes: ["citation"] },
  },
  {
    key: "citations",
    matches: ["citation", "citations_quality", "citations_bibliography", "citáci", "citace", "bibliograph", "literatúra", "references", "iso 690"],
    description: "Citation practice, bibliography completeness and reference quality.",
    expectedEvidence: ["in-text citations", "the bibliography itself", "citation style consistency", "coverage of primary sources"],
    preferredSections: ["literat", "bibliograph", "referenc", "zoznam", "seznam", "zdroj", "citáci", "citace"],
    relevantEntityTypes: ["Citation", "Paper"],
    strategies: [
      { source: "citation", limit: 40, weight: 1.2 },
      { source: "lexical", limit: 30 },
      { source: "dense", limit: 25, weight: 0.6 },
    ],
    structuralTypes: ["citation"],
    expectedCounterEvidence: ["in-text citations with no bibliography entry and vice versa"],
    sufficiency: { ...DEFAULT_SUFFICIENCY, minEvidenceChunks: 2, requireElementTypes: ["citation"] },
  },
  {
    key: "structure",
    matches: ["structure", "štruktúr", "struktura", "structure_coherence", "formal", "formáln", "coherence", "language_quality", "jazykov"],
    description: "Document structure, coherence and formal/language quality.",
    expectedEvidence: ["chapter organisation", "logical flow between sections", "terminology consistency", "formal requirements"],
    preferredSections: ["obsah", "content", "štruktúr", "struktura", "structure", "úvod", "introduction", "záver", "conclusion", "formáln", "formální"],
    relevantEntityTypes: ["Concept"],
    strategies: [
      { source: "metadata", limit: 20, weight: 0.8 },
      { source: "dense", limit: 30 },
      { source: "lexical", limit: 30 },
      { source: "community", limit: 12, weight: 0.6 },
    ],
    structuralTypes: ["section"],
    expectedCounterEvidence: ["sections referenced but missing", "conclusions that do not follow the chapter order"],
    sufficiency: { ...DEFAULT_SUFFICIENCY, minEvidenceChunks: 2, requiresGlobalContext: true },
  },
  {
    key: "ethics",
    matches: ["ethic", "etik", "transparen", "transparent", "gdpr", "consent", "súhlas", "souhlas", "reproducib", "reprodukovateľ"],
    description: "Research ethics, data protection and transparency of sources.",
    expectedEvidence: ["ethics approval or consent statement", "data provenance and licensing", "conflict-of-interest / funding disclosure"],
    preferredSections: ["etik", "ethic", "transparent", "ochran", "protection", "gdpr", "súhlas", "consent", "dát", "data", "zdroj"],
    relevantEntityTypes: ["Dataset", "Concept"],
    strategies: [
      { source: "lexical", limit: 40, weight: 1.0 },
      { source: "dense", limit: 30 },
      { source: "metadata", limit: 10 },
    ],
    structuralTypes: [],
    expectedCounterEvidence: ["data used without a stated provenance or licence"],
    sufficiency: { ...DEFAULT_SUFFICIENCY, minEvidenceChunks: 1 },
  },
  {
    key: "global",
    matches: ["overall", "celkov", "souhrn", "zhrnut", "coherence between", "konzisten", "consistency", "contribution of the work"],
    description: "Whole-thesis synthesis: contribution, coherence, methodological consistency.",
    expectedEvidence: ["community-level summaries", "cross-chapter consistency", "the arc from question to conclusion"],
    preferredSections: ["záver", "závěr", "conclusion", "úvod", "introduction", "diskus", "discussion"],
    relevantEntityTypes: ["Claim", "Conclusion", "Finding", "Hypothesis", "ResearchQuestion"],
    strategies: [
      { source: "community", limit: 20, weight: 1.2 },
      { source: "graph", limit: 30, weight: 1.0 },
      { source: "dense", limit: 30 },
      { source: "lexical", limit: 30 },
    ],
    structuralTypes: ["section"],
    expectedCounterEvidence: ["conclusions not supported anywhere in the results"],
    sufficiency: { ...DEFAULT_SUFFICIENCY, minEvidenceChunks: 4, requiresGlobalContext: true, requireCounterEvidenceSearch: true },
  },
]

export interface ResolvedProfile {
  keys: string[]
  description: string
  expectedEvidence: string[]
  preferredSections: string[]
  relevantEntityTypes: string[]
  strategies: Array<{ source: RetrievalSource; limit: number; weight: number }>
  structuralTypes: string[]
  expectedCounterEvidence: string[]
  sufficiency: SufficiencyRule
  /** Which profiles matched, with the score that made them match. */
  matched: Array<{ key: string; score: number }>
}

const DEFAULT_STRATEGY_LIMITS: Record<RetrievalSource, number> = {
  dense: 40,
  lexical: 40,
  graph: 25,
  "graph-drift": 20,
  citation: 25,
  metadata: 20,
  community: 12,
  "prior-art": 20,
}

/**
 * Resolves the effective profile for a criterion id.
 *
 * Every profile whose `matches` patterns appear in the (lowercased) criterion id contributes.
 * List fields are unioned; `sufficiency` takes the strictest value per field, because
 * under-requiring evidence is the failure mode that produces unsupported findings.
 *
 * Returns a conservative default profile when nothing matches, so an unknown criterion still
 * retrieves sensibly instead of retrieving nothing.
 */
export function resolveCriterionProfile(criterionId?: string | null): ResolvedProfile {
  const id = (criterionId ?? "").toLowerCase()
  const matched: Array<{ key: string; score: number; profile: CriterionProfile }> = []
  for (const profile of CRITERION_PROFILES) {
    let score = 0
    for (const pattern of profile.matches) {
      if (!pattern) continue
      if (id.includes(pattern)) score += pattern.length >= id.length ? 3 : 2
    }
    if (score > 0) matched.push({ key: profile.key, score, profile })
  }
  matched.sort((a, b) => b.score - a.score)

  if (matched.length === 0) {
    return {
      keys: ["default"],
      description: "No criterion-specific profile matched; generic hybrid retrieval.",
      expectedEvidence: ["passages that directly address the criterion"],
      preferredSections: [],
      relevantEntityTypes: ["Concept"],
      strategies: [
        { source: "dense", limit: 40, weight: 1 },
        { source: "lexical", limit: 40, weight: 0.9 },
      ],
      structuralTypes: [],
      expectedCounterEvidence: [],
      sufficiency: { ...DEFAULT_SUFFICIENCY },
      matched: [],
    }
  }

  const strategies = new Map<RetrievalSource, { source: RetrievalSource; limit: number; weight: number }>()
  const union = (a: string[], b: string[]) => Array.from(new Set([...a, ...b]))

  let expectedEvidence: string[] = []
  let preferredSections: string[] = []
  let relevantEntityTypes: string[] = []
  let structuralTypes: string[] = []
  let expectedCounterEvidence: string[] = []
  const sufficiency: SufficiencyRule = { ...DEFAULT_SUFFICIENCY }

  for (const { profile } of matched) {
    expectedEvidence = union(expectedEvidence, profile.expectedEvidence)
    preferredSections = union(preferredSections, profile.preferredSections)
    relevantEntityTypes = union(relevantEntityTypes, profile.relevantEntityTypes)
    structuralTypes = union(structuralTypes, profile.structuralTypes)
    expectedCounterEvidence = union(expectedCounterEvidence, profile.expectedCounterEvidence)
    sufficiency.minEvidenceChunks = Math.max(sufficiency.minEvidenceChunks, profile.sufficiency.minEvidenceChunks)
    sufficiency.requireElementTypes = union(sufficiency.requireElementTypes, profile.sufficiency.requireElementTypes)
    sufficiency.requireCounterEvidenceSearch = sufficiency.requireCounterEvidenceSearch || profile.sufficiency.requireCounterEvidenceSearch
    sufficiency.requiresGlobalContext = sufficiency.requiresGlobalContext || profile.sufficiency.requiresGlobalContext
    for (const s of profile.strategies) {
      const existing = strategies.get(s.source)
      const limit = s.limit ?? DEFAULT_STRATEGY_LIMITS[s.source] ?? 30
      const weight = s.weight ?? 1
      if (!existing) strategies.set(s.source, { source: s.source, limit, weight })
      else strategies.set(s.source, { source: s.source, limit: Math.max(existing.limit, limit), weight: Math.max(existing.weight, weight) })
    }
  }

  return {
    keys: matched.map((m) => m.key),
    description: matched.map((m) => m.profile.description).join(" + "),
    expectedEvidence,
    preferredSections,
    relevantEntityTypes,
    strategies: Array.from(strategies.values()).sort((a, b) => b.weight - a.weight),
    structuralTypes,
    expectedCounterEvidence,
    sufficiency,
    matched: matched.map((m) => ({ key: m.key, score: m.score })),
  }
}

/** True when the profile asks for counter-evidence to be actively retrieved. */
export function requiresCounterEvidenceSearch(profile: ResolvedProfile): boolean {
  return profile.sufficiency.requireCounterEvidenceSearch
}
