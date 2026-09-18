/**
 * Unit tests for query routing, criterion profiles and the ranking stage.
 *
 * These modules are pure (no Prisma, no model), so this is where the *decisions* the retrieval
 * pipeline makes get pinned down: which category a question falls into, what evidence that
 * category is expected to produce, and how the final order is produced and labelled.
 *
 * The routing table is data, and the reason it is data rather than a switch statement is that a
 * reviewer has to be able to see why a question was answered from tables rather than prose. These
 * tests are that visibility, in executable form.
 */

import { describe, expect, it } from "vitest"
import { QUERY_CATEGORIES, categoryPolicy, classifyQuery, routeQuery } from "../query-router"
import { CRITERION_PROFILES, resolveCriterionProfile, requiresCounterEvidenceSearch } from "../criterion-profiles"
import { applyMMR, cosineSimilarity, detectNoveltyDrift, heuristicRerankScores, mmrSelect, rerankCandidates } from "../retrieval-ranking"
import { buildEvidenceContext, selectCounterEvidence, selectRetrievalUnits, type ContextChunk } from "../parent-context"

// ---------------------------------------------------------------------------
// Query classification
// ---------------------------------------------------------------------------

describe("classifyQuery", () => {
  const cases: Array<[string, string]> = [
    ["Akú presnosť dosiahol model a o koľko percent sa zlepšil?", "numerical"],
    ["How many participants were in the study and what was the p-value?", "numerical"],
    ["V čom je prínos práce originálny oproti stavu umenia?", "novelty-prior-art"],
    ["Ako bola navrhnutá metodika experimentálneho overenia?", "methodological"],
    ["What is gradient clipping?", "definitional"],
    ["Aké sú limity a obmedzenia navrhovaného riešenia?", "limitations"],
    ["Sú citácie v norme ISO 690 a je bibliografia úplná?", "citation"],
    ["Je štruktúra práce a jazyková úroveň v poriadku?", "structural"],
    ["Je celkový prínos práce konzistentný so závermi?", "global-synthesis"],
  ]

  it.each(cases)("routes %s to %s", (query, expected) => {
    expect(classifyQuery(query).category).toBe(expected)
  })

  it("exposes the signal that produced the decision, for the trace", () => {
    const c = classifyQuery("Akú presnosť dosiahol model?")
    expect(c.signals.length).toBeGreaterThan(0)
    expect(c.signals[0].reason.length).toBeGreaterThan(0)
    expect(c.signals[0].category).toBe("numerical")
  })

  it("reports confidence as the winning category's share of the total signal", () => {
    const c = classifyQuery("Akú presnosť dosiahol model a o koľko percent sa zlepšil?")
    expect(c.confidence).toBeGreaterThan(0)
    expect(c.confidence).toBeLessThanOrEqual(1)
    const total = Object.values(c.scores).reduce((a, b) => a + b, 0)
    expect(c.scores[c.category] / total).toBeCloseTo(c.confidence, 6)
  })

  it("falls back to a defined category when nothing matches, rather than to undefined", () => {
    const c = classifyQuery("xyzzy")
    expect(QUERY_CATEGORIES).toContain(c.category)
    expect(c.confidence).toBe(0.5)
  })

  it("handles all three corpus languages", () => {
    expect(classifyQuery("Jaká byla metodika sběru dat?").category).toBe("methodological")
    expect(classifyQuery("Jaké jsou limity práce?").category).toBe("limitations")
    expect(classifyQuery("What are the limitations of this work?").category).toBe("limitations")
  })
})

// ---------------------------------------------------------------------------
// Criterion profiles
// ---------------------------------------------------------------------------

describe("resolveCriterionProfile", () => {
  it("matches every criterion id in the shipped rubric to at least one profile", () => {
    const rubricIds = [
      "problem_relevance",
      "objectives_clarity",
      "theoretical_background",
      "methodology_rigor",
      "analytical_execution",
      "results_validity",
      "discussion_relation",
      "originality_contribution",
      "structure_coherence",
      "citations_quality",
      "ethics_transparency",
      "limitations_future_work",
    ]
    for (const id of rubricIds) {
      const p = resolveCriterionProfile(id)
      expect(p.matched.length, `no profile matched ${id}`).toBeGreaterThan(0)
      expect(p.strategies.length).toBeGreaterThan(0)
    }
  })

  it("unions the profiles of a criterion that spans two families", () => {
    // analytical_execution is both methodology and results.
    const p = resolveCriterionProfile("analytical_execution")
    expect(p.keys).toContain("methodology")
    expect(p.keys).toContain("results")
    expect(new Set(p.strategies.map((s) => s.source)).size).toBeGreaterThan(2)
  })

  it("takes the strictest sufficiency when several profiles apply", () => {
    const p = resolveCriterionProfile("originality_contribution")
    expect(p.sufficiency.minEvidenceChunks).toBeGreaterThanOrEqual(3)
    expect(p.sufficiency.requiresGlobalContext).toBe(true)
    expect(requiresCounterEvidenceSearch(p)).toBe(true)
  })

  it("returns a usable default for an unknown criterion instead of nothing", () => {
    const p = resolveCriterionProfile("some_future_criterion_xyz")
    expect(p.keys).toEqual(["default"])
    expect(p.strategies.map((s) => s.source)).toEqual(expect.arrayContaining(["dense", "lexical"]))
    expect(p.sufficiency.minEvidenceChunks).toBeGreaterThan(0)
  })

  it("treats a missing criterion id as the default, not as a crash", () => {
    expect(resolveCriterionProfile(undefined).keys).toEqual(["default"])
    expect(resolveCriterionProfile(null).keys).toEqual(["default"])
    expect(resolveCriterionProfile("").keys).toEqual(["default"])
  })

  it("every profile declares at least one retrieval leg and one expected evidence type", () => {
    for (const profile of CRITERION_PROFILES) {
      expect(profile.strategies.length, profile.key).toBeGreaterThan(0)
      expect(profile.expectedEvidence.length, profile.key).toBeGreaterThan(0)
      expect(profile.sufficiency.minEvidenceChunks, profile.key).toBeGreaterThan(0)
    }
  })

  it("carries Slovak, Czech and English heading fragments for the section boost", () => {
    const p = resolveCriterionProfile("results_validity")
    const joined = p.preferredSections.join(" ").toLowerCase()
    expect(joined).toContain("výsledk") // sk
    expect(joined).toContain("result") // en
    expect(joined).toContain("diskus") // sk/cs discussion
  })
})

// ---------------------------------------------------------------------------
// routeQuery — category policy merged with the criterion profile
// ---------------------------------------------------------------------------

describe("routeQuery", () => {
  it("gives a numerical criterion the table/figure structural types", () => {
    const r = routeQuery("Akú presnosť dosiahol model?", { criterionId: "results_validity" })
    expect(r.structuralTypes).toEqual(expect.arrayContaining(["table", "figure_caption"]))
    expect(r.expansion.includeRelatedElements).toBe(true)
  })

  it("never loses a leg when the category and the profile disagree", () => {
    const r = routeQuery("Akú presnosť dosiahol model?", { criterionId: "results_validity" })
    const sources = r.sources.map((s) => s.source)
    for (const s of categoryPolicy("numerical").sources) expect(sources).toContain(s.source)
    for (const s of resolveCriterionProfile("results_validity").strategies) expect(sources).toContain(s.source)
  })

  it("takes the higher limit and weight when both name the same leg", () => {
    const r = routeQuery("Akú presnosť dosiahol model?", { criterionId: "results_validity" })
    const dense = r.sources.find((s) => s.source === "dense")!
    const fromPolicy = categoryPolicy("numerical").sources.find((s) => s.source === "dense")!
    const fromProfile = resolveCriterionProfile("results_validity").strategies.find((s) => s.source === "dense")!
    expect(dense.limit).toBe(Math.max(fromPolicy.limit, fromProfile.limit))
    expect(dense.weight).toBe(Math.max(fromPolicy.weight, fromProfile.weight))
  })

  it("orders legs by weight so the strongest signal is retrieved first", () => {
    const r = routeQuery("V čom je prínos práce originálny?", { criterionId: "originality_contribution" })
    const weights = r.sources.map((s) => s.weight)
    expect([...weights].sort((a, b) => b - a)).toEqual(weights)
  })

  it("forces global context on for a whole-thesis question", () => {
    const r = routeQuery("Je celkový prínos práce konzistentný so závermi?", { criterionId: "some_unknown_id" })
    expect(r.category).toBe("global-synthesis")
    expect(r.sufficiency.requiresGlobalContext).toBe(true)
  })

  it("every category in the policy table has a complete policy", () => {
    for (const category of QUERY_CATEGORIES) {
      const policy = categoryPolicy(category)
      expect(policy.sources.length, category).toBeGreaterThan(0)
      expect(policy.expansion.neighborWindow).toBeGreaterThanOrEqual(0)
      expect(typeof policy.useDrift).toBe("boolean")
    }
  })
})

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

describe("applyMMR", () => {
  const chunks = [
    { id: "a", heading: null, content: "presnosť modelu F1 92.4 percenta na testovacej sade", similarity: 0.9 },
    { id: "b", heading: null, content: "presnosť modelu F1 92.4 percenta na testovacej sade", similarity: 0.88 },
    { id: "c", heading: null, content: "úplne iná téma: etika výskumu a ochrana dát", similarity: 0.5 },
  ]

  it("prefers a diverse second pick over a near-duplicate of the first", () => {
    const out = applyMMR(chunks, 2, 0.7)
    expect(out.map((c) => c.id)).toEqual(["a", "c"])
  })

  it("reduces to pure relevance at lambda = 1", () => {
    const out = applyMMR(chunks, 2, 1)
    expect(out.map((c) => c.id)).toEqual(["a", "b"])
  })

  it("returns everything when the pool is already smaller than topK", () => {
    expect(applyMMR(chunks, 10)).toHaveLength(3)
  })

  it("is generic, so the new pipeline can reuse it on its own row shape", () => {
    const withExtra = chunks.map((c) => ({ ...c, pageStart: 1 }))
    const out = applyMMR(withExtra, 2, 0.7)
    expect(out[0].pageStart).toBe(1)
  })
})

describe("mmrSelect", () => {
  it("penalises candidates close to what is already selected", () => {
    const items = [
      { id: "a", score: 1.0, emb: [1, 0, 0] },
      { id: "b", score: 0.9, emb: [0.99, 0.01, 0] },
      { id: "c", score: 0.5, emb: [0, 0, 1] },
    ]
    const out = mmrSelect(items, {
      scoreOf: (i) => i.score,
      idOf: (i) => i.id,
      embeddingOf: (i) => i.emb,
      limit: 2,
      lambda: 0.5,
    })
    expect(out[0].id).toBe("a")
    expect(out[1].id).toBe("c")
  })

  it("returns the pool sorted by score when it already fits", () => {
    const items = [
      { id: "a", score: 0.2, emb: [1, 0] },
      { id: "b", score: 0.9, emb: [0, 1] },
    ]
    expect(mmrSelect(items, { scoreOf: (i) => i.score, idOf: (i) => i.id, embeddingOf: (i) => i.emb, limit: 5 }).map((i) => i.id)).toEqual(["b", "a"])
  })

  it("handles items with no embedding without throwing", () => {
    const items = [
      { id: "a", score: 1, emb: null },
      { id: "b", score: 0.5, emb: null },
    ]
    expect(mmrSelect(items, { scoreOf: (i) => i.score, idOf: (i) => i.id, embeddingOf: () => null, limit: 2 })).toHaveLength(2)
  })
})

describe("cosineSimilarity", () => {
  it("is 1 for identical directions and 0 for orthogonal ones", () => {
    expect(cosineSimilarity([1, 0], [2, 0])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1)
  })

  it("does not divide by zero", () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0)
    expect(cosineSimilarity([], [])).toBe(0)
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0)
  })
})

describe("detectNoveltyDrift", () => {
  it("triggers when nothing in the corpus is even loosely on topic", () => {
    const drift = detectNoveltyDrift([[1, 0, 0]], [{ embedding: [0, 1, 0] }, { embedding: [0, 0, 1] }])
    expect(drift.triggered).toBe(true)
    expect(drift.maxSimilarity).toBeLessThan(0.5)
  })

  it("does not trigger when a close match exists", () => {
    const drift = detectNoveltyDrift([[1, 0]], [{ embedding: [0.98, 0.2] }])
    expect(drift.triggered).toBe(false)
  })

  it("makes no claim without query embeddings or candidate embeddings", () => {
    expect(detectNoveltyDrift([], [{ embedding: [1, 0] }])).toEqual({ triggered: false, maxSimilarity: null })
    expect(detectNoveltyDrift([[1, 0]], [{ embedding: null }])).toEqual({ triggered: false, maxSimilarity: null })
  })
})

describe("rerankCandidates", () => {
  const candidates = [
    { id: "a", content: "presnosť modelu", score: 0.4 },
    { id: "b", content: "etika výskumu", score: 0.9 },
  ]

  it("keeps the fused order and says so when the neural reranker is off", async () => {
    const r = await rerankCandidates("presnosť", candidates, { useNeural: false })
    expect(r.scorer).toBe("fusion-score")
    expect(r.usedNeuralReranker).toBe(false)
    expect(r.items.map((i) => i.id)).toEqual(["b", "a"])
  })

  it("never labels a lexical heuristic as a cross-encoder", async () => {
    const r = await rerankCandidates("presnosť", candidates, { useNeural: false })
    expect(r.scorer).not.toBe("cross-encoder")
    expect(r.usedNeuralReranker).toBe(false)
  })

  it("returns an empty result for an empty pool", async () => {
    const r = await rerankCandidates("q", [])
    expect(r.items).toEqual([])
    expect(r.usedNeuralReranker).toBe(false)
  })

  it("exposes the lexical heuristic under its own honest name", () => {
    const scores = heuristicRerankScores("presnosť modelu", ["presnosť modelu F1", "úplne nesúvisiaci text"])
    expect(scores[0]).toBeGreaterThan(scores[1])
  })
})

// ---------------------------------------------------------------------------
// Evidence assembly
// ---------------------------------------------------------------------------

const chunk = (over: Partial<ContextChunk> & { id: string }): ContextChunk => ({
  documentId: "d1",
  heading: "Výsledky",
  content: "Obsah.",
  tokens: 20,
  kind: "prose",
  chunkType: "paragraph",
  sectionPath: "4 Výsledky",
  pageStart: 12,
  pageEnd: 13,
  parentChunkId: null,
  previousChunkId: null,
  nextChunkId: null,
  sourceElementIds: [],
  contextPrefix: null,
  ordinal: 1,
  role: "retrieved",
  ...over,
})

describe("buildEvidenceContext", () => {
  it("labels each block so an assertion can be traced to its evidence", () => {
    const ctx = buildEvidenceContext({
      criterion: "results_validity",
      question: "Aká je presnosť?",
      expectedEvidence: ["quantitative results"],
      direct: [chunk({ id: "a", content: "F1 92.4 %" })],
      counter: [chunk({ id: "b", content: "Avšak bez testu významnosti." })],
      graph: [],
      citation: [],
      numerical: ["F1 = 0.924 (n = 1200)"],
      priorArt: [],
      uncertainties: ["no significance test"],
    })
    expect(ctx).toContain("CRITERION: results_validity")
    expect(ctx).toContain("EXPECTED EVIDENCE: quantitative results")
    expect(ctx).toContain("DIRECT EVIDENCE:")
    expect(ctx).toContain("COUNTER-EVIDENCE")
    expect(ctx).toContain("NUMERICAL EVIDENCE")
    expect(ctx).toContain("UNCERTAINTIES")
    // pageStart != pageEnd renders as a range
    expect(ctx).toContain("[a] (4 Výsledky, p. 12–13) Výsledky")
  })

  it("omits blocks that have nothing in them", () => {
    const ctx = buildEvidenceContext({ direct: [chunk({ id: "a" })], counter: [], graph: [], citation: [], numerical: [], priorArt: [], uncertainties: [] })
    expect(ctx).not.toContain("COUNTER-EVIDENCE")
    expect(ctx).not.toContain("PRIOR-ART EVIDENCE")
  })

  it("respects the character budget", () => {
    const big = Array.from({ length: 40 }, (_, i) => chunk({ id: `c${i}`, content: "x".repeat(500) }))
    const ctx = buildEvidenceContext({ direct: big, counter: [], graph: [], citation: [], numerical: [], priorArt: [], uncertainties: [], maxChars: 2000 })
    expect(ctx.length).toBeLessThanOrEqual(2100)
  })
})

describe("selectRetrievalUnits", () => {
  it("excludes section-level parents from the ranked list", () => {
    const ids = selectRetrievalUnits([
      { id: "child", chunkType: "paragraph" },
      { id: "parent", chunkType: "section" },
      { id: "table", chunkType: "table" },
    ])
    expect(ids).toEqual(["child", "table"])
  })

  it("treats a missing chunkType as a paragraph", () => {
    expect(selectRetrievalUnits([{ id: "x" }])).toEqual(["x"])
  })
})

describe("selectCounterEvidence", () => {
  it("labels chunks that qualify the finding, in all three languages", () => {
    const chunks = [
      chunk({ id: "en", content: "The model improves accuracy. However, no significance test was performed on the difference." }),
      chunk({ id: "sk", content: "Model zlepšuje presnosť. Avšak rozdiel nebol overený štatistickým testom významnosti." }),
      chunk({ id: "cs", content: "Model zlepšuje přesnost. Přesto nebyl rozdíl ověřen statistickým testem." }),
      chunk({ id: "plain", content: "Model dosahuje dobré výsledky na všetkých datasetoch." }),
    ]
    const counter = selectCounterEvidence(chunks).map((c) => c.id)
    expect(counter).toContain("en")
    expect(counter).toContain("sk")
    expect(counter).toContain("cs")
    expect(counter).not.toContain("plain")
  })

  it("never treats a very short chunk as counter-evidence", () => {
    expect(selectCounterEvidence([chunk({ id: "x", content: "Avšak." })])).toEqual([])
  })
})
