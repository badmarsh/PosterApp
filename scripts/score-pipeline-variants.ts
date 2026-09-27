/**
 * Scores the review pipeline's actual query mix on the cleaned Analysis_2 index.
 * Passage vectors are already in artifacts/analysis-2/embeddings.json.
 */
import { readFileSync } from "fs"
import { generateLocalEmbeddings } from "../lib/ai/local-embeddings"
import { fuseCandidates } from "../lib/ai/fusion"
import { expandQuery, generateHypotheticalDocument, getThesisCriterionQueryExpansion, resolveThesisDomainContext } from "../lib/ai/vector-rag"
import { routeQuery } from "../lib/ai/query-router"
import { SK_ACADEMIC_RUBRIC_V1 } from "../lib/ai/rubric-engine"
import { buildFtsQuery } from "../lib/ai/retrieval-sql"

interface Unit { norm: string; vector: Float32Array }

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

async function main() {
  process.env.TEST_REAL_EMBEDDINGS = "1"
  process.env.EMBEDDING_LOCAL_ONLY = "1"
  process.env.EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2"
  process.env.EMBEDDING_LOCAL_PATH = ".cache/models"

  const index = JSON.parse(readFileSync("artifacts/analysis-2/embeddings.json", "utf8"))
  const units: Unit[] = index.chunks.map((c: { content: string; embedding: string }) => ({
    norm: norm(c.content),
    vector: decode(c.embedding),
  }))
  const domain = resolveThesisDomainContext({ thesisTitle: "JES and JER from hadronic W bosons" })
  const ids = Object.keys(expectBy)
  const queries = ids.map((id) => {
    const c = SK_ACADEMIC_RUBRIC_V1.criteria.find((x) => x.id === id)!
    const guidance = `${c.description.en} Caution: ${c.cautionGuidance.en}`
    return `${c.labels.en} ${guidance}`.slice(0, 300)
  })

  const packs: string[][] = []
  for (const q of queries) {
    const route = routeQuery(q)
    const variants = route.queryTransform.expand
      ? expandQuery(q, getThesisCriterionQueryExpansion(ids[queries.indexOf(q)], "en"))
      : [q]
    const row = [...variants]
    if (route.queryTransform.hyde) row.push(await generateHypotheticalDocument(q, domain, "en"))
    packs.push(row)
    console.log(q.slice(0, 48), "→", route.category, "variants", row.length, "hyde", route.queryTransform.hyde)
  }
  const flat = packs.flat()
  const prefixed = flat.map((v) => `${domain}: ${v}`)
  console.log("embedding", flat.length * 2, "query variants")
  const vecs = await generateLocalEmbeddings([...flat, ...prefixed], "query")
  const bare = vecs.slice(0, flat.length)
  const pref = vecs.slice(flat.length)

  let offset = 0
  const summary = { bareHit5: 0, prefixedHit5: 0, fusedBareHit5: 0, fusedPrefixedHit5: 0, n: ids.length }
  const detail: Array<Record<string, unknown>> = []
  ids.forEach((id, qi) => {
    const pack = packs[qi]
    const bareLists = pack.map((_, j) => denseTop(units, bare[offset + j]))
    const prefLists = pack.map((_, j) => denseTop(units, pref[offset + j]))
    const lex = lexTop(units, queries[qi])
    const fusedBare = fuse([...bareLists, lex])
    const fusedPref = fuse([...prefLists, lex])
    const base = denseTop(units, bare[offset])
    const expect = expectBy[id]
    if (hits(units, base, expect, 5)) summary.bareHit5++
    if (hits(units, denseTop(units, pref[offset]), expect, 5)) summary.prefixedHit5++
    if (hits(units, fusedBare, expect, 5)) summary.fusedBareHit5++
    if (hits(units, fusedPref, expect, 5)) summary.fusedPrefixedHit5++
    detail.push({
      id,
      category: routeQuery(queries[qi]).category,
      bare: hits(units, base, expect, 5),
      fusedBare: hits(units, fusedBare, expect, 5),
      fusedPrefixed: hits(units, fusedPref, expect, 5),
    })
    offset += pack.length
  })
  console.log(JSON.stringify({ domain, summary, detail }, null, 2))
}

main().catch((err) => { console.error(err); process.exit(1) })
