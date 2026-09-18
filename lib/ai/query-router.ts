/**
 * Query router.
 *
 * Decides *how* to retrieve, before retrieval starts. The same embedding over the same index
 * gives different answers depending on what the question is:
 *
 *   "What accuracy did the model reach on the test set?"  → numerical: tables first, exact scan
 *   "How is this different from [Smith 2019]?"            → novelty: citation graph + prior art
 *   "Define gradient clipping."                           → definitional: one passage, small window
 *   "Is the contribution of this thesis coherent?"        → global: community reports + graph
 *
 * Routing is **data-driven**: a table of categories, each with signal patterns (SK / CS / EN),
 * default legs and expansion policy. `routeQuery()` scores the query against the table and merges
 * the result with the criterion profile, so adding a category means adding a row.
 *
 * @module query-router
 */

import { resolveCriterionProfile, type CriterionProfile, type ResolvedProfile, type SufficiencyRule } from "./criterion-profiles"
import type { RetrievalSource } from "./fusion"

export type QueryCategory =
  | "exact-fact"
  | "definitional"
  | "numerical"
  | "methodological"
  | "novelty-prior-art"
  | "limitations"
  | "citation"
  | "structural"
  | "global-synthesis"

export interface QuerySignal {
  /** Machine-readable signal name. */
  name: string
  /** Human-readable reason, surfaced in the trace. */
  reason: string
  /** How strongly this signal supports its category (1–3). */
  weight: number
  category: QueryCategory
}

/**
 * Signal table.
 *
 * Patterns are deliberately multilingual (Slovak / Czech / English) because the corpora are.
 * They match word-ish fragments rather than whole sentences so inflected forms still hit.
 */
const SIGNAL_PATTERNS: Array<{ name: string; category: QueryCategory; weight: number; patterns: RegExp[] }> = [
  {
    name: "numerical-question",
    category: "numerical",
    weight: 3,
    patterns: [/\b(accuracy|presnos|přesnos|f1|precision|recall|auc|rmse|mae|r2|p-value|p-hodnot)/i, /\b(how (much|many)|koľko|kolik)/i, /\b(percent|percentá|%|improve|zlepš)/i, /\b(tabuľk|tabulka|table|graf|figure|obr\.)/i],
  },
  {
    name: "comparison",
    category: "numerical",
    weight: 2,
    patterns: [/\b(compare|comparison|porovnan|versus|vs\.?|baseline|lepš|better than)/i],
  },
  {
    name: "novelty-question",
    category: "novelty-prior-art",
    weight: 3,
    patterns: [/\b(novel|novelty|novosť|original|originál|contribution|prínos|přínos|different from|líši|odliš)/i, /\b(state of the art|stav umenia|related work|súvisiac|prior art)/i],
  },
  {
    name: "prior-art-reference",
    category: "novelty-prior-art",
    weight: 2,
    // [Author, 2019] / [3] / (2019)
    patterns: [/\[[A-Za-zÀ-ž][^\]]{0,40}(19|20)\d{2}\]/, /\[\d{1,3}\]/, /\((19|20)\d{2}\)/],
  },
  {
    name: "definition-request",
    category: "definitional",
    // Weight 2, deliberately below the topical signals: "what are the limitations of this work"
    // is a limitations question that happens to be phrased as a question. The interrogative form
    // is a tiebreaker, not a topic.
    weight: 2,
    patterns: [/\b(what is|what are|define|definition|definíci|definice|je definov|znamená|means)/i],
  },
  {
    name: "method-question",
    category: "methodological",
    weight: 3,
    patterns: [/\b(how (was|were|is|are|does|did)|ako (bol|bola|boli|je|sú)|jak (byl|byla|byli|je|jsou))/i, /\b(method|metodik|metodológi|postup|protocol|pipeline|architecture|architektúr|implement)/i, /\b(dataset|dáta|dátová sada|vzorka|sample|participants|účastní)/i],
  },
  {
    name: "statistical-method",
    category: "methodological",
    weight: 2,
    patterns: [/\b(statistic|štatistick|significance|významnos|confidence interval|interval spoľahlivosti|regression|regresi|anova|t-test|cross-validation|krížová validácia)/i],
  },
  {
    name: "limitation-question",
    category: "limitations",
    weight: 3,
    patterns: [/\b(limitation|limit|limity|obmedzen|weakness|slab|threat|rizik|future work|budúc|budoucn)/i],
  },
  {
    name: "citation-question",
    category: "citation",
    weight: 3,
    patterns: [/\b(citation|citation|citáci|citace|bibliograph|literatúr|reference|zdroj|iso 690|cited)/i],
  },
  {
    name: "structural-question",
    category: "structural",
    weight: 3,
    patterns: [/\b(structure|štruktúr|struktura|chapter|kapitol|section|sekci|organiz|usporiadan|formal|formáln|language|jazykov|grammar|gramatik)/i],
  },
  {
    name: "global-synthesis",
    category: "global-synthesis",
    weight: 3,
    patterns: [/\b(overall|celkov|whole|celý|celá|coheren|konzisten|consisten|synthesi|zhrnut|souhrn|summary of the work|prínos práce)/i, /\b(conclusion|záver|závěr)/i],
  },
  {
    name: "exact-fact-lookup",
    category: "exact-fact",
    weight: 2,
    patterns: [/\b(where|when|who|kde|kedy|kto|which|ktorý|ktorá|name|názov|název)/i],
  },
]

/** Per-category retrieval policy. This is the table the router reads. */
const CATEGORY_POLICY: Record<
  QueryCategory,
  {
    sources: Array<{ source: RetrievalSource; limit: number; weight: number }>
    structuralTypes: string[]
    expansion: { includeParents: boolean; includeNeighbors: boolean; includeRelatedElements: boolean; neighborWindow: number }
    queryTransform: { hyde: boolean; expand: boolean; multiQuery: boolean }
    useDrift: boolean
  }
> = {
  "exact-fact": {
    sources: [
      { source: "lexical", limit: 30, weight: 1.1 },
      { source: "dense", limit: 30, weight: 1 },
    ],
    structuralTypes: [],
    expansion: { includeParents: false, includeNeighbors: true, includeRelatedElements: false, neighborWindow: 1 },
    queryTransform: { hyde: false, expand: false, multiQuery: false },
    useDrift: false,
  },
  definitional: {
    sources: [
      { source: "dense", limit: 25, weight: 1 },
      { source: "lexical", limit: 25, weight: 1 },
    ],
    structuralTypes: [],
    expansion: { includeParents: true, includeNeighbors: false, includeRelatedElements: false, neighborWindow: 0 },
    queryTransform: { hyde: false, expand: true, multiQuery: false },
    useDrift: false,
  },
  numerical: {
    sources: [
      { source: "metadata", limit: 30, weight: 1.1 },
      { source: "dense", limit: 40, weight: 1 },
      { source: "lexical", limit: 40, weight: 1 },
      { source: "graph", limit: 20, weight: 0.6 },
    ],
    // Numerical claims live in tables, figures and their captions.
    structuralTypes: ["table", "figure_caption"],
    expansion: { includeParents: true, includeNeighbors: true, includeRelatedElements: true, neighborWindow: 1 },
    queryTransform: { hyde: false, expand: false, multiQuery: true },
    useDrift: false,
  },
  methodological: {
    sources: [
      { source: "dense", limit: 50, weight: 1 },
      { source: "lexical", limit: 50, weight: 1 },
      { source: "graph", limit: 30, weight: 0.9 },
      { source: "metadata", limit: 20, weight: 0.8 },
      { source: "citation", limit: 15, weight: 0.4 },
    ],
    structuralTypes: ["table", "equation"],
    expansion: { includeParents: true, includeNeighbors: true, includeRelatedElements: true, neighborWindow: 1 },
    queryTransform: { hyde: true, expand: true, multiQuery: false },
    useDrift: true,
  },
  "novelty-prior-art": {
    sources: [
      { source: "citation", limit: 40, weight: 1.1 },
      { source: "dense", limit: 40, weight: 1 },
      { source: "lexical", limit: 40, weight: 0.9 },
      { source: "graph", limit: 30, weight: 0.9 },
      { source: "community", limit: 12, weight: 0.6 },
      { source: "prior-art", limit: 20, weight: 0.8 },
    ],
    structuralTypes: ["citation"],
    expansion: { includeParents: true, includeNeighbors: false, includeRelatedElements: true, neighborWindow: 0 },
    queryTransform: { hyde: true, expand: true, multiQuery: true },
    useDrift: true,
  },
  limitations: {
    sources: [
      { source: "dense", limit: 40, weight: 1 },
      { source: "lexical", limit: 40, weight: 1.1 },
      { source: "graph", limit: 20, weight: 0.7 },
    ],
    structuralTypes: [],
    expansion: { includeParents: true, includeNeighbors: true, includeRelatedElements: false, neighborWindow: 1 },
    queryTransform: { hyde: false, expand: true, multiQuery: false },
    useDrift: false,
  },
  citation: {
    sources: [
      { source: "citation", limit: 40, weight: 1.2 },
      { source: "lexical", limit: 30, weight: 1 },
      { source: "dense", limit: 25, weight: 0.6 },
    ],
    structuralTypes: ["citation"],
    expansion: { includeParents: false, includeNeighbors: true, includeRelatedElements: false, neighborWindow: 1 },
    queryTransform: { hyde: false, expand: false, multiQuery: false },
    useDrift: false,
  },
  structural: {
    sources: [
      { source: "metadata", limit: 25, weight: 1 },
      { source: "dense", limit: 30, weight: 0.9 },
      { source: "lexical", limit: 30, weight: 0.9 },
      { source: "community", limit: 12, weight: 0.7 },
    ],
    structuralTypes: ["section"],
    expansion: { includeParents: true, includeNeighbors: false, includeRelatedElements: false, neighborWindow: 0 },
    queryTransform: { hyde: false, expand: false, multiQuery: false },
    useDrift: false,
  },
  "global-synthesis": {
    sources: [
      { source: "community", limit: 20, weight: 1.2 },
      { source: "graph", limit: 40, weight: 1 },
      { source: "dense", limit: 35, weight: 0.9 },
      { source: "lexical", limit: 35, weight: 0.9 },
    ],
    structuralTypes: ["section"],
    expansion: { includeParents: true, includeNeighbors: false, includeRelatedElements: false, neighborWindow: 0 },
    queryTransform: { hyde: true, expand: true, multiQuery: true },
    useDrift: true,
  },
}

export interface QueryClassification {
  category: QueryCategory
  confidence: number
  signals: QuerySignal[]
  /** Scores for every category, for the trace. */
  scores: Record<QueryCategory, number>
}

/** Classifies a query into one routing category with the evidence for that decision. */
export function classifyQuery(query: string): QueryClassification {
  const scores: Record<QueryCategory, number> = {
    "exact-fact": 0,
    definitional: 0,
    numerical: 0,
    methodological: 0,
    "novelty-prior-art": 0,
    limitations: 0,
    citation: 0,
    structural: 0,
    "global-synthesis": 0,
  }
  const signals: QuerySignal[] = []

  for (const sig of SIGNAL_PATTERNS) {
    for (const re of sig.patterns) {
      const m = re.exec(query)
      if (!m) continue
      signals.push({ name: sig.name, category: sig.category, weight: sig.weight, reason: m[0].trim().slice(0, 40) })
      scores[sig.category] += sig.weight
    }
  }

  // Long criterion-style queries ("assess whether the methodology …") are methodological by
  // default unless a stronger signal says otherwise; short lookups are exact-fact.
  if (query.length > 240 && scores.methodological === 0) scores.methodological += 1

  const ranked = (Object.keys(scores) as QueryCategory[]).sort((a, b) => scores[b] - scores[a])
  const category = scores[ranked[0]] > 0 ? ranked[0] : "definitional"
  const total = ranked.reduce((s, k) => s + scores[k], 0)
  const confidence = total > 0 ? scores[category] / total : 0.5

  return { category, confidence, signals, scores }
}

export interface RetrievalRoute {
  category: QueryCategory
  confidence: number
  signals: QuerySignal[]
  /** Which criterion profiles contributed. */
  profiles: string[]
  /** Legs to run, with per-leg candidate counts and fusion weights. */
  sources: Array<{ source: RetrievalSource; limit: number; weight: number }>
  structuralTypes: string[]
  expansion: { includeParents: boolean; includeNeighbors: boolean; includeRelatedElements: boolean; neighborWindow: number }
  queryTransform: { hyde: boolean; expand: boolean; multiQuery: boolean }
  useDrift: boolean
  expectedEvidence: string[]
  preferredSections: string[]
  relevantEntityTypes: string[]
  expectedCounterEvidence: string[]
  sufficiency: SufficiencyRule
}

/**
 * Produces the retrieval route for one criterion query.
 *
 * The category policy and the criterion profile are *merged*: the category decides the shape of
 * the retrieval (drift? HyDE? parent expansion?), the profile decides the content expectations
 * (what counts as evidence, which sections to boost, what would refute it). Where both name a
 * leg, the higher limit and the higher weight win — losing a leg silently is worse than running it.
 */
export function routeQuery(query: string, opts: { criterionId?: string | null; profile?: ResolvedProfile } = {}): RetrievalRoute {
  const classification = classifyQuery(query)
  const profile: ResolvedProfile = opts.profile ?? resolveCriterionProfile(opts.criterionId)
  const policy = CATEGORY_POLICY[classification.category]

  const merged = new Map<RetrievalSource, { source: RetrievalSource; limit: number; weight: number }>()
  for (const s of [...policy.sources, ...profile.strategies]) {
    const existing = merged.get(s.source)
    if (!existing) merged.set(s.source, { ...s })
    else merged.set(s.source, { source: s.source, limit: Math.max(existing.limit, s.limit), weight: Math.max(existing.weight, s.weight) })
  }

  const sufficiency: SufficiencyRule = {
    ...profile.sufficiency,
    requiresGlobalContext: profile.sufficiency.requiresGlobalContext || classification.category === "global-synthesis",
  }

  return {
    category: classification.category,
    confidence: classification.confidence,
    signals: classification.signals,
    profiles: profile.keys,
    sources: Array.from(merged.values()).sort((a, b) => b.weight - a.weight),
    structuralTypes: Array.from(new Set([...policy.structuralTypes, ...profile.structuralTypes])),
    expansion: policy.expansion,
    queryTransform: policy.queryTransform,
    useDrift: policy.useDrift,
    expectedEvidence: profile.expectedEvidence,
    preferredSections: profile.preferredSections,
    relevantEntityTypes: profile.relevantEntityTypes,
    expectedCounterEvidence: profile.expectedCounterEvidence,
    sufficiency,
  }
}

/** Convenience for tests and the dev dashboard: the raw policy for one category. */
export function categoryPolicy(category: QueryCategory) {
  return CATEGORY_POLICY[category]
}

/** All categories, for enumeration in tests and the ablation harness. */
export const QUERY_CATEGORIES = Object.keys(CATEGORY_POLICY) as QueryCategory[]

export type { CriterionProfile, ResolvedProfile, SufficiencyRule }
