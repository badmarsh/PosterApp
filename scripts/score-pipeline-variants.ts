/**
 * Scores the historical text-routed query mix on the cleaned Analysis_2 index.
 * --criterion-aware replays the live router and dense/lexical ranking policy.
 * Neither mode is a live Postgres or full multi-source pipeline evaluation.
 * Passage vectors are already in artifacts/analysis-2/embeddings.json.
 * Use --cached-queries for an offline replay; otherwise embed queries only.
 */
import { readFileSync, writeFileSync } from "fs"
import { createHash } from "crypto"
import { buildCriterionRetrievalQuery } from "../lib/ai/criterion-query"
import { getModelHealthSnapshot } from "../lib/ai/model-registry"
import { generateLocalEmbeddings } from "../lib/ai/local-embeddings"
import { fuseCandidates } from "../lib/ai/fusion"
import { expandQuery, generateHypotheticalDocument, getThesisCriterionQueryExpansion, resolveThesisDomainContext } from "../lib/ai/vector-rag"
import { applySectionBoost, mergeDenseCandidates } from "../lib/ai/retrievers/candidate-ranking"
import { DEFAULT_CANDIDATE_LIMITS } from "../lib/ai/retrievers"
import { routeQuery, type RetrievalRoute } from "../lib/ai/query-router"
import { SK_ACADEMIC_RUBRIC_V1 } from "../lib/ai/rubric-engine"
import { buildFtsQuery } from "../lib/ai/retrieval-sql"

interface Unit { sectionPath: string | null; id: string; heading: string | null; pageStart: number | null; norm: string; vector: Float32Array }

function decode(b64: string): Float32Array {
  const buf = Buffer.from(b64, "base64")
  const out = new Float32Array(buf.length / 4)
  for (let i = 0; i < out.length; i++) out[i] = buf.readFloatLE(i * 4)
  return out
}
function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let d = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}
const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase()

const expectBy: Record<string, string[]> = {
  methodology_rigor: ["forward-folding", "likelihood", "parametrisation"],
  analytical_execution: ["half of the maximum", "pseudo-experiment", "hessian"],
  results_validity: ["0.929", "table 7.1", "correction factors, s"],
  discussion_relation: ["closer to unity", "improved agreement", "geant4"],
  limitations_future_work: ["will be later constructed", "not yet been"],
  citations_quality: ["section ??", "sec:background", "bibliography"],
  originality_contribution: ["already proposed long before"],
}

function denseTop(units: Unit[], q: ArrayLike<number>, k = 20): number[] {
  return units.map((u, i) => ({ i, s: cosine(u.vector, q) })).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.i)
}
function lexTop(units: Unit[], query: string): number[] {
  const terms = buildFtsQuery(query).split(" OR ").filter(Boolean)
  const scored: Array<{ i: number; n: number }> = []
  for (let i = 0; i < units.length; i++) {
    let n = 0
    for (const t of terms) if (units[i].norm.includes(t)) n++
    if (n > 0) scored.push({ i, n })
  }
  scored.sort((a, b) => b.n - a.n || a.i - b.i)
  return scored.slice(0, 20).map((s) => s.i)
}
function fuse(lists: number[][]): number[] {
  return fuseCandidates(
    lists.map((ids, s) => ({
      source: (s === lists.length - 1 ? "lexical" : "dense") as "dense" | "lexical",
      items: ids.map((id, rank) => ({ id: String(id), score: 20 - rank })),
    })),
    { method: "weighted-rrf", limit: 8 },
  ).map((f) => Number(f.id))
}
function hits(units: Unit[], ranked: number[], expect: string[], k: number) {
  const needles = expect.map(norm)
  return ranked.slice(0, k).some((i) => needles.some((n) => units[i].norm.includes(n)))
}

export async function scoreCriterionQueries(
  mode: "pipeline" | "comparison" | "criterion-aware" = "pipeline",
  options: { cachedQueries?: boolean; writeReport?: boolean } = {},
) {
  const cachedQueries = options.cachedQueries ?? process.argv.includes("--cached-queries")
  const model = "Xenova/all-MiniLM-L6-v2"
  if (!cachedQueries) {
    process.env.TEST_REAL_EMBEDDINGS = "1"
    process.env.EMBEDDING_LOCAL_ONLY = "1"
    process.env.EMBEDDING_BACKEND = "xenova-v2"
    process.env.EMBEDDING_MODEL = model
    process.env.EMBEDDING_LOCAL_PATH = ".cache/models"
  }

  const indexBytes = readFileSync("artifacts/analysis-2/embeddings.json")
  const index = JSON.parse(indexBytes.toString())
  if (index.model !== model || index.dimensions !== 384) throw new Error("Wrong passage model")
  const units: Unit[] = index.chunks.map((c: { sectionPath: string | null; id: string; heading: string | null; pageStart: number | null; content: string; embedding: string }) => ({
    sectionPath: c.sectionPath, id: c.id, heading: c.heading, pageStart: c.pageStart,
    norm: norm(c.content), vector: decode(c.embedding),
  }))
  const domain = resolveThesisDomainContext({ thesisTitle: "JES and JER from hadronic W bosons" })
  const ids = Object.keys(expectBy)
  const baselineQueries = ids.map((id) => {
    const c = SK_ACADEMIC_RUBRIC_V1.criteria.find((x) => x.id === id)!
    return `${c.labels.en} ${c.description.en} Caution: ${c.cautionGuidance.en}`.slice(0, 300)
  })
  const candidateQueries = ids.map((id) => {
    const c = SK_ACADEMIC_RUBRIC_V1.criteria.find((x) => x.id === id)!
    return buildCriterionRetrievalQuery(id, c.labels.en, `${c.description.en} Caution: ${c.cautionGuidance.en}`, "en", { thesisTitle: "JES and JER from hadronic W bosons" })
  })
  const queries = [...baselineQueries, ...candidateQueries]
  const packs: string[][] = []
  const routes: RetrievalRoute[] = []
  for (const [i, q] of queries.entries()) {
    // Keep historical rows stable; the opt-in replay also merges criterion profiles.
    const route = routeQuery(q, mode === "criterion-aware" ? { criterionId: ids[i % ids.length] } : {})
    routes.push(route)
    const row = route.queryTransform.expand
      ? expandQuery(q, getThesisCriterionQueryExpansion(ids[i % ids.length], "en"))
      : [q]
    if (route.queryTransform.hyde) row.push(await generateHypotheticalDocument(q, domain, "en"))
    packs.push(row)
  }
  const flat = [...new Set(packs.flat())]
  const cachePath = "artifacts/analysis-2/criterion-query-vectors.json"
  const fingerprint = createHash("sha256").update(JSON.stringify({ model: index.model, flat })).digest("hex")
  let vecs: number[][]
  if (cachedQueries) {
    const cache = JSON.parse(readFileSync(cachePath, "utf8"))
    if (cache.model !== model || cache.fingerprint !== fingerprint || cache.fallbackCount !== 0
      || JSON.stringify(cache.queries) !== JSON.stringify(flat)) throw new Error("Query cache mismatch")
    vecs = cache.vectors.map((v: string) => Array.from(decode(v)))
  } else {
    vecs = await generateLocalEmbeddings(flat, "query")
    if (getModelHealthSnapshot().embedding.fallbackCount !== 0) throw new Error("Hash fallback: invalid evaluation")
  }
  if (vecs.length !== flat.length || vecs.some(v => v.length !== 384 || v.some(x => !Number.isFinite(x)))) throw new Error("Invalid query vectors")
  // Store float32 queries and score that same representation for exact offline reproduction.
  vecs = vecs.map(v => Array.from(Float32Array.from(v)))
  if (!cachedQueries) writeFileSync(cachePath, JSON.stringify({
    model: index.model, fingerprint, fallbackCount: 0, queries: flat,
    vectors: vecs.map(v => Buffer.from(Float32Array.from(v).buffer).toString("base64")),
  }))
  const byQuery = new Map(flat.map((q, i) => [q, vecs[i]]))
  function rank(pack: string[], kind: string, route: RetrievalRoute) {
    if (kind === "criterion-aware") {
      const limitFor = (source: "dense" | "lexical") => Math.min(
        route.sources.find(s => s.source === source)!.limit, DEFAULT_CANDIDATE_LIMITS[source],
      )
      const denseLimit = limitFor("dense")
      const perQuery = Math.max(10, Math.ceil(denseLimit * 1.5))
      const all = pack.flatMap(q => units.map((u, i) => ({
        id: u.id, i, sectionPath: u.sectionPath, score: cosine(u.vector, byQuery.get(q)!),
      })).sort((a, b) => b.score - a.score).slice(0, perQuery))
      const dense = mergeDenseCandidates(all, route.preferredSections, denseLimit)
      const terms = buildFtsQuery(pack[0]).split(" OR ").filter(Boolean)
      const lexicalLimit = limitFor("lexical")
      // Still a lexical proxy, NOT PostgreSQL ts_rank. Match production operation order:
      // SQL selects the unboosted top limit first; section boosting only reorders that pool.
      const lexicalPool = units.map((u, i) => ({ id: u.id, i, sectionPath: u.sectionPath,
        score: terms.filter(t => u.norm.includes(t)).length,
      })).filter(c => c.score > 0).sort((a, b) => b.score - a.score || a.i - b.i).slice(0, lexicalLimit)
      const lexical = applySectionBoost(lexicalPool, route.preferredSections).slice(0, lexicalLimit)
      return fuseCandidates([
        { source: "dense", items: dense }, { source: "lexical", items: lexical },
      ], { method: "weighted-rrf", weights: Object.fromEntries(route.sources.map(s => [s.source, s.weight])), limit: 8 })
        .map(c => units.findIndex(u => u.id === c.id))
    }
    const dense = denseTop(units, byQuery.get(pack[0])!)
    if (kind === "dense") return dense
    const lists = kind === "pipeline" ? pack.map(q => denseTop(units, byQuery.get(q)!)) : [dense]
    return fuse([...lists, lexTop(units, pack[0])])
  }
  const protectedIds = ["methodology_rigor", "results_validity", "citations_quality"]
  const targetIds = ids.filter(id => !protectedIds.includes(id))
  const kinds = mode === "comparison" ? ["dense", "dense+fts"] : [mode]
  const conditions = kinds.map(kind => {
    const detail = ids.map((id, i) => {
      const before = rank(packs[i], kind, routes[i])
      const after = rank(packs[i + ids.length], kind, routes[i + ids.length])
      const describe = (ranked: number[]) => ({
        hit5: hits(units, ranked, expectBy[id], 5),
        top5: ranked.slice(0, 5).map(j => ({ id: units[j].id, heading: units[j].heading, page: units[j].pageStart,
          relevant: hits(units, [j], expectBy[id], 1) })),
      })
      return { id, ...(mode === "criterion-aware" ? {
        // Before this follow-up, methodology still used the rubric query.
        previousCandidate: id === "methodology_rigor" ? describe(before) : describe(after),
        baselineRoute: { category: routes[i].category, profiles: routes[i].profiles, sources: routes[i].sources,
          preferredSections: routes[i].preferredSections, variants: packs[i] },
        candidateRoute: { category: routes[i + ids.length].category, profiles: routes[i + ids.length].profiles,
          sources: routes[i + ids.length].sources, preferredSections: routes[i + ids.length].preferredSections,
          variants: packs[i + ids.length] },
      } : {}), baselineQuery: baselineQueries[i], candidateQuery: candidateQueries[i],
        baseline: describe(before), candidate: describe(after) }
    })
    const count = (key: "baseline" | "candidate", subset = ids) => detail.filter(d => subset.includes(d.id) && d[key].hit5).length
    const protectedHitsRetained = protectedIds.every(id => detail.find(d => d.id === id)!.candidate.hit5)
    const targetGains = count("candidate", targetIds) - count("baseline", targetIds)
    // The closer replay has a different starting hit set. Pin what was measured,
    // rather than pretending the historical methodology hit survives all policies.
    const expectedBaselineHitIds = mode === "criterion-aware"
      ? ["analytical_execution", "results_validity", "citations_quality"] : protectedIds
    const baselineReproduced = detail.every(d => d.baseline.hit5 === expectedBaselineHitIds.includes(d.id))
    const noRegressions = detail.every(d => !d.baseline.hit5 || d.candidate.hit5)
    const accepted = baselineReproduced && noRegressions && protectedHitsRetained && targetGains > 0
    return { kind, ...(mode === "criterion-aware" ? {
      expectedBaselineHitIds, previousCandidateHit5: detail.filter(d => d.previousCandidate?.hit5).length,
    } : {}), baselineHit5: count("baseline"), candidateHit5: count("candidate"),
      baselineTargetHit5: count("baseline", targetIds), candidateTargetHit5: count("candidate", targetIds),
      baselineReproduced, protectedHitsRetained, noRegressions, accepted, detail }
  })
  const report = {
    scope: mode === "criterion-aware"
      ? "Analysis_2 only; criterion-aware route, candidate limits, max-cosine dense merge, section boosts and source weights. Exact in-memory cosine and substring lexical proxy, NOT live Postgres. No metadata/citation/graph sources, reranker, MMR, context expansion/compression or LLM HyDE."
      : "Analysis_2 only; frozen substring relevance labels; in-memory cosine + substring lexical proxy + weighted RRF; no Postgres, reranker, MMR, compression or LLM HyDE. Pipeline uses historical text-only routing, not live criterion-aware routing.",
    indexSha256: createHash("sha256").update(indexBytes).digest("hex"),
    model: index.model, passageUnits: units.length, queryFingerprint: fingerprint, fallbackCount: 0,
    protectedIds, targetIds, conditions,
  }
  const reportName = mode === "criterion-aware" ? "criterion-aware" : `criterion-${mode}`
  if (options.writeReport !== false) writeFileSync(`artifacts/analysis-2/${reportName}.json`, JSON.stringify(report, null, 2) + "\n")
  if (options.writeReport !== false) console.log(JSON.stringify(conditions.map(({ detail, ...summary }) => summary), null, 2))
  if (conditions.some(c => !c.accepted)) throw new Error("Criterion retrieval acceptance gate failed")
  return report
}

if (process.argv[1]?.endsWith("score-pipeline-variants.ts")) {
  scoreCriterionQueries(process.argv.includes("--criterion-aware") ? "criterion-aware" : "pipeline").catch((err) => { console.error(err); process.exit(1) })
}
