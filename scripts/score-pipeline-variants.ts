/**
 * Scores the historical text-routed query mix on the cleaned Analysis_2 index.
 * This is not the live criterion-aware router or Postgres pipeline.
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
import { routeQuery } from "../lib/ai/query-router"
import { SK_ACADEMIC_RUBRIC_V1 } from "../lib/ai/rubric-engine"
import { buildFtsQuery } from "../lib/ai/retrieval-sql"

interface Unit { id: string; heading: string | null; pageStart: number | null; norm: string; vector: Float32Array }

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
  mode: "pipeline" | "comparison" = "pipeline",
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
  const units: Unit[] = index.chunks.map((c: { id: string; heading: string | null; pageStart: number | null; content: string; embedding: string }) => ({
    id: c.id, heading: c.heading, pageStart: c.pageStart,
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
    return buildCriterionRetrievalQuery(id, c.labels.en, `${c.description.en} Caution: ${c.cautionGuidance.en}`, "en")
  })
  const queries = [...baselineQueries, ...candidateQueries]
  const packs: string[][] = []
  for (const [i, q] of queries.entries()) {
    // Preserve the historical harness's text-only routing (not live criterion routing).
    const route = routeQuery(q)
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
  function rank(pack: string[], kind: string) {
    const dense = denseTop(units, byQuery.get(pack[0])!)
    if (kind === "dense") return dense
    const lists = kind === "pipeline" ? pack.map(q => denseTop(units, byQuery.get(q)!)) : [dense]
    return fuse([...lists, lexTop(units, pack[0])])
  }
  const protectedIds = ["methodology_rigor", "results_validity", "citations_quality"]
  const targetIds = ids.filter(id => !protectedIds.includes(id))
  const kinds = mode === "comparison" ? ["dense", "dense+fts"] : ["pipeline"]
  const conditions = kinds.map(kind => {
    const detail = ids.map((id, i) => {
      const before = rank(packs[i], kind)
      const after = rank(packs[i + ids.length], kind)
      const describe = (ranked: number[]) => ({
        hit5: hits(units, ranked, expectBy[id], 5),
        top5: ranked.slice(0, 5).map(j => ({ id: units[j].id, heading: units[j].heading, page: units[j].pageStart,
          relevant: hits(units, [j], expectBy[id], 1) })),
      })
      return { id, baselineQuery: baselineQueries[i], candidateQuery: candidateQueries[i],
        baseline: describe(before), candidate: describe(after) }
    })
    const count = (key: "baseline" | "candidate", subset = ids) => detail.filter(d => subset.includes(d.id) && d[key].hit5).length
    const protectedHitsRetained = protectedIds.every(id => detail.find(d => d.id === id)!.candidate.hit5)
    const targetGains = count("candidate", targetIds) - count("baseline", targetIds)
    const baselineReproduced = detail.every(d => d.baseline.hit5 === protectedIds.includes(d.id))
    const noRegressions = detail.every(d => !d.baseline.hit5 || d.candidate.hit5)
    const accepted = baselineReproduced && noRegressions && protectedHitsRetained && targetGains > 0
    return { kind, baselineHit5: count("baseline"), candidateHit5: count("candidate"),
      baselineTargetHit5: count("baseline", targetIds), candidateTargetHit5: count("candidate", targetIds),
      baselineReproduced, protectedHitsRetained, noRegressions, accepted, detail }
  })
  const report = {
    scope: "Analysis_2 only; frozen substring relevance labels; in-memory cosine + substring lexical proxy + weighted RRF; no Postgres, reranker, MMR, compression or LLM HyDE. Pipeline uses historical text-only routing, not live criterion-aware routing.",
    indexSha256: createHash("sha256").update(indexBytes).digest("hex"),
    model: index.model, passageUnits: units.length, queryFingerprint: fingerprint, fallbackCount: 0,
    protectedIds, targetIds, conditions,
  }
  if (options.writeReport !== false) writeFileSync(`artifacts/analysis-2/criterion-${mode}.json`, JSON.stringify(report, null, 2) + "\n")
  if (options.writeReport !== false) console.log(JSON.stringify(conditions.map(({ detail, ...summary }) => summary), null, 2))
  if (conditions.some(c => !c.accepted)) throw new Error("Criterion retrieval acceptance gate failed")
  return report
}

if (process.argv[1]?.endsWith("score-pipeline-variants.ts")) {
  scoreCriterionQueries().catch((err) => { console.error(err); process.exit(1) })
}
