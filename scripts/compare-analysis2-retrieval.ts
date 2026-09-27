/**
 * Before/after retrieval comparison for the Analysis_2 chapter.
 *
 * This is the in-memory equivalent of the review pipeline's dense + lexical
 * legs and weighted RRF. It does not hit Postgres. It does use the same
 * chunker, the same FTS query builder, the same fusion function, and the
 * same criterion-query string the review pipeline sends.
 *
 * Usage: pnpm exec tsx scripts/compare-analysis2-retrieval.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs"
import { chunkDocument } from "../lib/ai/chunker-v2"
import { generateLocalEmbeddings } from "../lib/ai/local-embeddings"
import { buildFtsQuery } from "../lib/ai/retrieval-sql"
import { fuseCandidates } from "../lib/ai/fusion"
import { expandQuery, generateHypotheticalDocument, getThesisCriterionQueryExpansion, resolveThesisDomainContext } from "../lib/ai/vector-rag"
import { SK_ACADEMIC_RUBRIC_V1 } from "../lib/ai/rubric-engine"
import { cleanExtractedPdfMarkdown, stripMarginLineNumbers } from "../lib/services/margin-line-numbers"

interface Unit {
  id: string
  heading: string | null
  content: string
  norm: string
  vector: Float32Array
}

interface QueryCase {
  id: string
  group: "finding" | "criterion"
  query: string
  expect: string[]
}

function decode(b64: string): Float32Array {
  const buf = Buffer.from(b64, "base64")
  const out = new Float32Array(buf.length / 4)
  for (let i = 0; i < out.length; i++) out[i] = buf.readFloatLE(i * 4)
  return out
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

function norm(s: string): string {
  return s.replace(/\s+/g, " ").toLowerCase()
}

function hit(units: Unit[], ranked: number[], expect: string[], k: number): boolean {
  const needles = expect.map(norm)
  for (const i of ranked.slice(0, k)) {
    const hay = units[i].norm
    if (needles.some((n) => hay.includes(n))) return true
  }
  return false
}

function mrr(units: Unit[], ranked: number[], expect: string[]): number {
  const needles = expect.map(norm)
  for (let r = 0; r < ranked.length; r++) {
    const hay = units[ranked[r]].norm
    if (needles.some((n) => hay.includes(n))) return 1 / (r + 1)
  }
  return 0
}

/** Proposed lexical builder: keep short all-caps acronyms (JES, JER) and digit tokens. */
export function buildFtsQueryKeepAcronyms(text: string, maxTerms = 8): string {
  const seen = new Set<string>()
  const terms: string[] = []
  for (const raw of text.split(/[^\p{L}\p{N}]+/u)) {
    if (!raw) continue
    const lower = raw.toLowerCase()
    if (seen.has(lower)) continue
    const acronym = raw.length >= 2 && raw.length <= 6 && raw === raw.toUpperCase() && /\p{L}/u.test(raw)
    const hasDigit = /\p{N}/u.test(raw)
    if (lower.length <= 3 && !acronym && !hasDigit) continue
    seen.add(lower)
    terms.push(lower)
    if (terms.length >= maxTerms) break
  }
  return terms.join(" OR ")
}

function lexicalRank(units: Unit[], fts: string): number[] {
  const terms = fts.split(" OR ").map((t) => t.trim()).filter(Boolean)
  if (terms.length === 0) return []
  const scored: Array<{ i: number; n: number }> = []
  for (let i = 0; i < units.length; i++) {
    const hay = units[i].norm
    let n = 0
    for (const t of terms) if (hay.includes(t)) n++
    if (n > 0) scored.push({ i, n })
  }
  scored.sort((a, b) => b.n - a.n || a.i - b.i)
  return scored.slice(0, 20).map((s) => s.i)
}

function denseRank(units: Unit[], q: Float32Array): number[] {
  return units
    .map((u, i) => ({ i, s: cosine(u.vector, q) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 20)
    .map((x) => x.i)
}

function rrf(denseIds: number[], lexIds: number[]): number[] {
  const fused = fuseCandidates(
    [
      { source: "dense", items: denseIds.map((id, rank) => ({ id: String(id), score: 20 - rank })) },
      { source: "lexical", items: lexIds.map((id, rank) => ({ id: String(id), score: 20 - rank })) },
    ],
    { method: "weighted-rrf", limit: 20 },
  )
  return fused.map((f) => Number(f.id))
}

async function embedIndex(label: string, markdown: string): Promise<Unit[]> {
  const cache = `/tmp/analysis2-${label}-emb.json`
  try {
    const cached = JSON.parse(readFileSync(cache, "utf8"))
    if (cached.label === label && Array.isArray(cached.chunks)) {
      console.log(`cache hit ${label} ${cached.chunks.length}`)
      return cached.chunks.map((c: { id: string; heading: string | null; content: string; embedding: string }) => ({
        id: c.id,
        heading: c.heading,
        content: c.content,
        norm: norm(c.content),
        vector: decode(c.embedding),
      }))
    }
  } catch { /* rebuild */ }

  const { chunks } = chunkDocument(markdown, label, null, {
    documentTitle: "JES and JER from hadronic W bosons",
    domain: "Particle physics, ATLAS jet calibration",
    lang: "en",
  })
  const units = chunks.filter((c) => !c.isParent)
  console.log(`embedding ${label} ${units.length} units`)
  const vectors = await generateLocalEmbeddings(units.map((c) => c.embeddingText), "passage")
  const payload = {
    label,
    chunks: units.map((c, i) => ({
      id: c.id,
      heading: c.heading,
      content: c.content,
      embedding: Buffer.from(Float32Array.from(vectors[i]).buffer).toString("base64"),
    })),
  }
  writeFileSync(cache, JSON.stringify(payload))
  return payload.chunks.map((c) => ({
    id: c.id,
    heading: c.heading,
    content: c.content,
    norm: norm(c.content),
    vector: decode(c.embedding),
  }))
}

function loadClean(): Unit[] {
  const index = JSON.parse(readFileSync("artifacts/analysis-2/embeddings.json", "utf8"))
  return index.chunks.map((c: { id: string; heading: string | null; content: string; embedding: string }) => ({
    id: c.id,
    heading: c.heading,
    content: c.content,
    norm: norm(c.content),
    vector: decode(c.embedding),
  }))
}

function summarize(name: string, units: Unit[], ranks: Map<string, number[]>, cases: QueryCase[]) {
  const groups = ["finding", "criterion"] as const
  const row: Record<string, number | string> = { condition: name }
  for (const group of groups) {
    const subset = cases.filter((c) => c.group === group)
    let h1 = 0
    let h3 = 0
    let h5 = 0
    let rr = 0
    for (const c of subset) {
      const ranked = ranks.get(c.id) || []
      if (hit(units, ranked, c.expect, 1)) h1++
      if (hit(units, ranked, c.expect, 3)) h3++
      if (hit(units, ranked, c.expect, 5)) h5++
      rr += mrr(units, ranked, c.expect)
    }
    const n = subset.length || 1
    row[`${group}_hit1`] = Number((h1 / n).toFixed(3))
    row[`${group}_hit3`] = Number((h3 / n).toFixed(3))
    row[`${group}_hit5`] = Number((h5 / n).toFixed(3))
    row[`${group}_mrr`] = Number((rr / n).toFixed(3))
  }
  return row
}

async function main() {
  process.env.TEST_REAL_EMBEDDINGS = "1"
  process.env.EMBEDDING_LOCAL_ONLY = "1"
  process.env.EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2"
  process.env.EMBEDDING_LOCAL_PATH = ".cache/models"

  const rawMd = readFileSync("artifacts/analysis-2/manuscript.md", "utf8")
  const marginOnly = stripMarginLineNumbers(rawMd).text
  const clean = loadClean()
  const raw = await embedIndex("raw", rawMd)
  const margin = await embedIndex("margin", marginOnly)

  const findingCases: QueryCase[] = [
    { id: "half", group: "finding", query: "statistical uncertainty half of the maximum likelihood one sigma", expect: ["half of the maximum value"] },
    { id: "jes", group: "finding", query: "JES correction factors Run 2 low transverse momentum", expect: ["0.929"] },
    { id: "smear", group: "finding", query: "in situ JER smearing not yet derived for the current release", expect: ["not yet been"] },
    { id: "fold", group: "finding", query: "forward folding formula jet response mode", expect: ["(2.2)"] },
    { id: "xref", group: "finding", query: "unresolved Section ?? cross references", expect: ["section ??"] },
    { id: "jerbin", group: "finding", query: "150-200 GeV diagonal JER region excluded poor statistical power", expect: ["poor statistical power"] },
    { id: "inverse", group: "finding", query: "inverse of the fitted JES values applied to data", expect: ["inverse of the fitted values"] },
    { id: "toys", group: "finding", query: "pseudo-experiments sample correction factors from a Gaussian of the total uncertainty", expect: ["pseudo-experiment"] },
    { id: "thresh", group: "finding", query: "jets between 15 and 20 GeV kept so forward folding can cross the threshold", expect: ["15 gev < p"] },
    { id: "bkg", group: "finding", query: "background fraction five percent single top tW", expect: ["only 5%"] },
  ]

  const criterionIds = [
    "methodology_rigor",
    "analytical_execution",
    "results_validity",
    "discussion_relation",
    "limitations_future_work",
    "citations_quality",
    "originality_contribution",
  ]
  const expectByCriterion: Record<string, string[]> = {
    methodology_rigor: ["forward-folding", "likelihood", "parametrisation"],
    analytical_execution: ["half of the maximum", "pseudo-experiment", "hessian"],
    results_validity: ["0.929", "table 7.1", "correction factors, s"],
    discussion_relation: ["closer to unity", "improved agreement", "geant4"],
    limitations_future_work: ["will be later constructed", "not yet been"],
    citations_quality: ["section ??", "sec:background", "bibliography"],
    originality_contribution: ["already proposed long before"],
  }
  const criterionCases: QueryCase[] = criterionIds.map((id) => {
    const c = SK_ACADEMIC_RUBRIC_V1.criteria.find((x) => x.id === id)
    if (!c) throw new Error(`missing criterion ${id}`)
    const guidance = `${c.description.en}${c.cautionGuidance.en ? ` Caution: ${c.cautionGuidance.en}` : ""}`
    const query = `${c.labels.en} ${guidance}`.slice(0, 300)
    return { id, group: "criterion", query, expect: expectByCriterion[id] }
  })
  const cases = [...findingCases, ...criterionCases]

  const title = "JES and JER from hadronic W bosons in single-lepton ttbar"
  const domains = {
    missingMetadata: resolveThesisDomainContext(undefined),
    filename: resolveThesisDomainContext({ thesisTitle: "Analysis_2" }),
    chapterTitle: resolveThesisDomainContext({ thesisTitle: title }),
    spelledOut: resolveThesisDomainContext({ thesisTitle: "Jet energy scale and resolution from hadronic W bosons" }),
  }

  const queryTexts = cases.map((c) => c.query)
  const expanded = criterionCases.map((c) => {
    const variants = expandQuery(c.query, getThesisCriterionQueryExpansion(c.id, "en"))
    return variants.find((v) => v.length > c.query.length) || c.query
  })
  const hyde = await Promise.all(criterionCases.map((c) => generateHypotheticalDocument(c.query, domains.missingMetadata, "en")))
  const prefixed = cases.map((c) => `${domains.missingMetadata}: ${c.query}`)
  const physicsPrefixed = cases.map((c) => `Particle physics, ATLAS jet calibration: ${c.query}`)

  console.log("embedding queries")
  const allQ = [...queryTexts, ...expanded, ...hyde, ...prefixed, ...physicsPrefixed]
  const qVecs = await generateLocalEmbeddings(allQ, "query")
  const n = cases.length
  const qBase = qVecs.slice(0, n)
  const qExp = qVecs.slice(n, n + criterionCases.length)
  const qHyde = qVecs.slice(n + criterionCases.length, n + 2 * criterionCases.length)
  const qDom = qVecs.slice(n + 2 * criterionCases.length, n + 2 * criterionCases.length + n)
  const qPhys = qVecs.slice(n + 2 * criterionCases.length + n)

  function pack(units: Unit[], vectors: Float32Array[], fts: (q: string) => string, which: "base" | "domain" | "physics"): Map<string, number[]> {
    const out = new Map<string, number[]>()
    cases.forEach((c, i) => {
      const qv = which === "base" ? vectors[i] : which === "domain" ? qDom[i] : qPhys[i]
      const dense = denseRank(units, qv)
      const lex = lexicalRank(units, fts(c.query))
      out.set(c.id, rrf(dense, lex))
    })
    return out
  }

  const indexes = [
    { name: "raw", units: raw },
    { name: "margin-only", units: margin },
    { name: "cleaned", units: clean },
  ]
  const rows = []
  const misses: Record<string, string[]> = {}
  for (const index of indexes) {
    const denseOnly = new Map<string, number[]>()
    const rrfCurrent = new Map<string, number[]>()
    const rrfAcronym = new Map<string, number[]>()
    const denseDomain = new Map<string, number[]>()
    cases.forEach((c, i) => {
      denseOnly.set(c.id, denseRank(index.units, qBase[i]))
      denseDomain.set(c.id, denseRank(index.units, qDom[i]))
      rrfCurrent.set(c.id, rrf(denseRank(index.units, qBase[i]), lexicalRank(index.units, buildFtsQuery(c.query))))
      rrfAcronym.set(c.id, rrf(denseRank(index.units, qBase[i]), lexicalRank(index.units, buildFtsQueryKeepAcronyms(c.query))))
    })
    rows.push(summarize(`${index.name} dense`, index.units, denseOnly, cases))
    rows.push(summarize(`${index.name} dense+domainprefix`, index.units, denseDomain, cases))
    rows.push(summarize(`${index.name} rrf current-fts`, index.units, rrfCurrent, cases))
    rows.push(summarize(`${index.name} rrf acronym-fts`, index.units, rrfAcronym, cases))
    if (index.name === "cleaned") {
      const hydeRanks = new Map<string, number[]>()
      const expRanks = new Map<string, number[]>()
      criterionCases.forEach((c, i) => {
        hydeRanks.set(c.id, denseRank(index.units, qHyde[i]))
        expRanks.set(c.id, denseRank(index.units, qExp[i]))
      })
      // Finding queries stay on the base dense rank so the row is comparable.
      findingCases.forEach((c) => {
        hydeRanks.set(c.id, denseOnly.get(c.id) || [])
        expRanks.set(c.id, denseOnly.get(c.id) || [])
      })
      rows.push(summarize("cleaned criterion-hyde", index.units, hydeRanks, cases))
      rows.push(summarize("cleaned criterion-expansion", index.units, expRanks, cases))
      misses.dense = cases.filter((c) => !hit(index.units, denseOnly.get(c.id) || [], c.expect, 5)).map((c) => c.id)
      misses.rrf = cases.filter((c) => !hit(index.units, rrfCurrent.get(c.id) || [], c.expect, 5)).map((c) => c.id)
      misses.acronym = cases.filter((c) => !hit(index.units, rrfAcronym.get(c.id) || [], c.expect, 5)).map((c) => c.id)
      misses.hyde = criterionCases.filter((c) => !hit(index.units, hydeRanks.get(c.id) || [], c.expect, 5)).map((c) => c.id)
      misses.expansion = criterionCases.filter((c) => !hit(index.units, expRanks.get(c.id) || [], c.expect, 5)).map((c) => c.id)
    }
  }

  const ftsExamples = {
    jes: buildFtsQuery("JES correction factors Run 2 low transverse momentum"),
    jesAcronym: buildFtsQueryKeepAcronyms("JES correction factors Run 2 low transverse momentum"),
    xref: buildFtsQuery("unresolved Section ?? cross references"),
    xrefAcronym: buildFtsQueryKeepAcronyms("unresolved Section ?? cross references"),
  }

  const report = { domains, ftsExamples, rows, misses, cleanUnits: clean.length, rawUnits: raw.length, marginUnits: margin.length }
  mkdirSync("artifacts/analysis-2", { recursive: true })
  writeFileSync("artifacts/analysis-2/retrieval-comparison.json", JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
