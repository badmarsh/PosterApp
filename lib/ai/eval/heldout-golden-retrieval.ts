/**
 * Held-out retrieval evaluation over the committed arXiv corpus.
 *
 * Purpose: a retrieval measurement on documents OTHER than the Analysis_2
 * development chapter, with the ranking policy shared by production (max-cosine
 * dense merge, 1.15 section boost, routed candidate limits, weighted RRF).
 *
 * Honest limits — the report repeats these and no claim may exceed them:
 *  - Judgments: `data/eval/golden-v2` chunk-level graded rows (0–3) are USED
 *    AS COMMITTED. They are not edited, not re-annotated, and not treated as
 *    verified human ground truth: `label-audit.json` measures their mechanical
 *    chunk-binding and provenance anomalies. These metrics pin harness
 *    behavior (regression contract); they do NOT establish real retrieval
 *    quality, and they are NOT review accuracy.
 *  - Documents: the three arXiv papers in `data/eval/corpus` (two systems
 *    papers, one prompting study). No qualitative thesis is available in the
 *    repo, so none is claimed.
 *  - Engines: `*-memory` conditions are in-memory cosine plus the historical
 *    substring lexical proxy — NOT PostgreSQL. `*-pglite` conditions execute
 *    real PostgreSQL/pgvector SQL (`<=>`, `websearch_to_tsquery('simple')`,
 *    `ts_rank`) through the in-process PGlite engine (WASM); real
 *    tokenization and exact pgvector distances, but no ANN index and no
 *    production server planner/latency.
 *  - Not measured: metadata/citation/graph/community legs, reranker, MMR,
 *    context expansion/compression, LLM HyDE, template HyDE and rubric query
 *    expansion (topic queries are replayed raw). The calibration-specific
 *    criterion rewrites do not apply here: the held-out titles must keep the
 *    original rubric queries, and the test asserts that scope gate.
 */
import { createHash } from "crypto"
import { mkdirSync, readFileSync, writeFileSync } from "fs"
import { chunkMarkdown } from "../document-chunker"
import { buildFtsQuery } from "../retrieval-sql"
import { fuseCandidates, type RetrievalSource } from "../fusion"
import { applySectionBoost, mergeDenseCandidates, type ScoredSectionCandidate } from "../retrievers/candidate-ranking"
import { DEFAULT_CANDIDATE_LIMITS } from "../retrievers"
import { routeQuery, type RetrievalRoute } from "../query-router"
import { generateLocalEmbeddings } from "../local-embeddings"
import { getModelHealthSnapshot } from "../model-registry"
import { openLivePg, toVectorLiteral } from "./pg-live"
import {
  computeMrr,
  computeNdcgAtK,
  computeRecallAtK,
  loadGoldenJudgments,
  type GoldenJudgment,
  type GoldenQuery,
} from "./real-corpus-benchmark"

/** Minimal ChunkRow for the split-for-eval binding (mirrors the old real-corpus-benchmark type). */
interface ChunkRow {
  id: string
  content: string
  heading: string | null
}

/** Split markdown into heading-bounded sections — exact replica of pre-PR#31 real-corpus-benchmark.ts. */
function splitMarkdownForEval(markdown: string, docId: string): ChunkRow[] {
  const headingRe = /^#{1,4}\s+.+$/m
  const lines = markdown.split("\n")
  const sections: Array<{ heading: string | null; text: string }> = []
  let currentHeading: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    if (headingRe.test(line)) {
      if (currentLines.join("\n").trim().length > 20) {
        sections.push({ heading: currentHeading, text: currentLines.join("\n").trim() })
      }
      currentHeading = line.replace(/^#+\s+/, "").trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }
  if (currentLines.join("\n").trim().length > 20) {
    sections.push({ heading: currentHeading, text: currentLines.join("\n").trim() })
  }

  const chunks: ChunkRow[] = []
  for (const section of sections) {
    const text = section.text
    if (text.length <= 800) {
      const idx = chunks.length
      chunks.push({ id: docId + "_" + String(idx).padStart(4, "0"), content: text, heading: section.heading })
    } else {
      const paras = text.split(/\n\n+/).filter((p) => p.trim().length > 20)
      let buf = ""
      let bufHeading = section.heading
      for (const para of paras) {
        if ((buf + "\n\n" + para).length > 800 && buf.length > 0) {
          const idx = chunks.length
          chunks.push({ id: docId + "_" + String(idx).padStart(4, "0"), content: buf.trim(), heading: bufHeading })
          buf = para
          bufHeading = section.heading
        } else {
          buf = buf ? buf + "\n\n" + para : para
        }
      }
      if (buf.trim().length > 20) {
        const idx = chunks.length
        chunks.push({ id: docId + "_" + String(idx).padStart(4, "0"), content: buf.trim(), heading: bufHeading })
      }
    }
  }
  return chunks
}


export type HeldoutBinding = "chunk-markdown" | "split-for-eval"
export const HELDOUT_BINDINGS: HeldoutBinding[] = ["chunk-markdown", "split-for-eval"]

export interface HeldoutUnit {
  id: string
  heading: string | null
  sectionPath: string | null
  content: string
  norm: string
}

export interface LabelAuditRow {
  queryId: string
  chunkId: string
  grade: number
  annotatorId: string
  /** Fraction of the rationale's content tokens found in the chunk text, per binding. */
  rationaleTokenContainment: Record<HeldoutBinding, number | null>
}

export interface LabelAudit {
  method: string
  queries: number
  judgments: number
  summary: {
    /** Rows whose rationale is a verbatim "Independent verification by annotator-N:" copy of another row. */
    templatedVerificationRows: number
    /** Same (query, chunkId) judged with conflicting grades. */
    gradeConflicts: number
    /** Judged chunk ids absent from a binding's chunk listing. */
    missingChunkIds: Partial<Record<HeldoutBinding, number>>
    meanRationaleTokenContainment: Record<HeldoutBinding, number>
    rationaleBindingPreference: { "chunk-markdown": number; "split-for-eval": number; tie: number }
  }
  rows: LabelAuditRow[]
}

export interface HeldoutPerQuery {
  id: string
  ndcg10: number
  mrr: number
  recall5: number
  recall10: number
}

export interface HeldoutCondition {
  name: string
  engine: string
  database: "none (offline proxy)" | "pglite (real PostgreSQL + pgvector, in-process WASM)"
  macro: { ndcg10: number; mrr: number; recall5: number; recall10: number; hit5: number; hit10: number }
  perQuery: HeldoutPerQuery[]
  /** Lowest-nDCG queries kept for qualitative inspection. */
  lowestNdcg10: Array<{ id: string; query: string; ndcg10: number }>
}

export interface HeldoutBindingResult {
  binding: HeldoutBinding
  chunkUnits: number
  judgedChunksMissing: number
  conditions: HeldoutCondition[]
}

export interface HeldoutGoldenReport {
  scope: string
  labelProvenance: string
  model: string
  dimensions: number
  fallbackCount: number
  queryCount: number
  corpusSha256: string
  judgmentsSha256: string
  vectorFingerprint: string
  labelAudit: LabelAudit["summary"]
  bindings: HeldoutBindingResult[]
}

const MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
const DIMENSIONS = 384
const FUSION_LIMIT = 10
const NDCG_K = 10

const normText = (s: string) => s.replace(/\s+/g, " ").toLowerCase()

const LIGATURES: Record<string, string> = { "\ufb00": "ff", "\ufb01": "fi", "\ufb02": "fl", "\ufb03": "ffi", "\ufb04": "ffl", "\u00ad": "" }

function auditTokens(s: string): Set<string> {
  let t = s.toLowerCase()
  for (const [from, to] of Object.entries(LIGATURES)) t = t.split(from).join(to)
  return new Set(t.split(/[^a-z0-9]+/).filter((w) => w.length > 3))
}

function rationaleContainment(rationale: string, chunkText: string): number {
  const tokens = auditTokens(rationale)
  if (tokens.size === 0) return 0
  const hay = chunkText.toLowerCase()
  let hit = 0
  for (const tok of tokens) if (hay.includes(tok)) hit++
  return hit / tokens.size
}

export function loadHeldoutCorpus(corpusDir = "data/eval/corpus"): {
  docs: Array<{ docId: string; title: string }>
  chunksByBinding: Record<HeldoutBinding, HeldoutUnit[]>
} {
  const manifest = JSON.parse(readFileSync(`${corpusDir}/manifest.json`, "utf8")) as Array<{ docId: string; title: string; path: string }>
  const chunksByBinding: Record<HeldoutBinding, HeldoutUnit[]> = { "chunk-markdown": [], "split-for-eval": [] }
  for (const doc of manifest) {
    const markdown = readFileSync(doc.path, "utf8")
    // Binding A: chunkMarkdown(), the listing corpus-chunk-inspect writes to
    // chunks-index.json (ids {docId}_{ordinal:04d}, per document).
    let ordinal = 0
    for (const c of chunkMarkdown(markdown, doc.docId)) {
      const headingPath = (c as { headingPath?: string | null }).headingPath ?? null
      chunksByBinding["chunk-markdown"].push({
        id: `${doc.docId}_${String(ordinal++).padStart(4, "0")}`,
        heading: c.heading,
        sectionPath: headingPath ?? c.heading,
        content: c.content,
        norm: normText(c.content),
      })
    }
    // Binding B: splitMarkdownForEval(), the listing real-corpus-benchmark ingests.
    for (const c of splitMarkdownForEval(markdown, doc.docId)) {
      chunksByBinding["split-for-eval"].push({
        id: c.id,
        heading: c.heading,
        sectionPath: c.heading,
        content: c.content,
        norm: normText(c.content),
      })
    }
  }
  return { docs: manifest.map((d) => ({ docId: d.docId, title: d.title })), chunksByBinding }
}

/** Mechanical audit of the committed judgments. Text-only; no judgments are edited. */
export function auditGoldenLabels(
  queries: GoldenQuery[],
  chunksByBinding: Record<HeldoutBinding, HeldoutUnit[]>,
): LabelAudit {
  const byBinding = HELDOUT_BINDINGS.map((b) => [b, new Map(chunksByBinding[b].map((u) => [u.id, u]))] as const)
  const containment: Record<HeldoutBinding, number[]> = { "chunk-markdown": [], "split-for-eval": [] }
  const preference = { "chunk-markdown": 0, "split-for-eval": 0, tie: 0 }
  const missing: Partial<Record<HeldoutBinding, number>> = {}
  let templatedVerificationRows = 0
  let gradeConflicts = 0
  const rows: LabelAuditRow[] = []

  for (const q of queries) {
    const coreRationales = new Set(q.judgments.map((j) => j.rationale.replace(/^Independent verification by annotator-\d+: /, "")))
    for (const j of q.judgments) {
      const core = j.rationale.replace(/^Independent verification by annotator-\d+: /, "")
      if (j.rationale !== core && coreRationales.has(core)) templatedVerificationRows++
      const perBinding: Record<HeldoutBinding, number | null> = { "chunk-markdown": null, "split-for-eval": null }
      for (const [b, index] of byBinding) {
        const unit = index.get(j.chunkId)
        if (!unit) {
          missing[b] = (missing[b] ?? 0) + 1
          continue
        }
        const c = rationaleContainment(j.rationale, unit.content)
        perBinding[b] = c
        containment[b].push(c)
      }
      const a = perBinding["chunk-markdown"]
      const b = perBinding["split-for-eval"]
      if (a !== null && b !== null) {
        if (a > b + 0.05) preference["chunk-markdown"]++
        else if (b > a + 0.05) preference["split-for-eval"]++
        else preference.tie++
      }
      rows.push({ queryId: q.id, chunkId: j.chunkId, grade: j.grade, annotatorId: j.annotatorId, rationaleTokenContainment: perBinding })
    }
    const gradesByChunk = new Map<string, Set<number>>()
    for (const j of q.judgments) {
      const set = gradesByChunk.get(j.chunkId) ?? new Set<number>()
      set.add(j.grade)
      gradesByChunk.set(j.chunkId, set)
    }
    for (const set of gradesByChunk.values()) if (set.size > 1) gradeConflicts++
  }

  const mean = (a: number[]) => (a.length === 0 ? 0 : Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 1000) / 1000)
  return {
    method:
      "Mechanical only: rationale-token containment against the chunk text under each committed chunking " +
      "(chunk-markdown = corpus-chunk-inspect/chunks-index.json ids; split-for-eval = real-corpus-benchmark ingest ids). " +
      "This audits label-chunk binding consistency; it is not a relevance judgment and edits nothing.",
    queries: queries.length,
    judgments: rows.length,
    summary: {
      templatedVerificationRows,
      gradeConflicts,
      missingChunkIds: missing,
      meanRationaleTokenContainment: { "chunk-markdown": mean(containment["chunk-markdown"]), "split-for-eval": mean(containment["split-for-eval"]) },
      rationaleBindingPreference: preference,
    },
    rows,
  }
}

function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let d = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

function decode(b64: string): Float32Array {
  const buf = Buffer.from(b64, "base64")
  const out = new Float32Array(buf.length / 4)
  for (let i = 0; i < out.length; i++) out[i] = buf.readFloatLE(i * 4)
  return out
}

interface VectorEntry { key: string; role: "query" | "passage"; text: string }

function vectorEntries(
  queries: GoldenQuery[],
  chunksByBinding: Record<HeldoutBinding, HeldoutUnit[]>,
): VectorEntry[] {
  const entries: VectorEntry[] = queries.map((q) => ({ key: `query:${q.id}`, role: "query" as const, text: q.query }))
  for (const b of HELDOUT_BINDINGS) {
    for (const u of chunksByBinding[b]) entries.push({ key: `chunk:${b}:${u.id}`, role: "passage", text: u.content })
  }
  return entries
}

function fingerprintEntries(model: string, entries: VectorEntry[]): string {
  return createHash("sha256")
    .update(JSON.stringify({ model, keys: entries.map((e) => e.key), textHashes: entries.map((e) => createHash("sha256").update(e.text).digest("hex")) }))
    .digest("hex")
}

async function resolveVectors(
  entries: VectorEntry[],
  options: { cachedVectors: boolean; vectorsPath: string },
): Promise<{ vectors: number[][]; fingerprint: string }> {
  const fingerprint = fingerprintEntries(MODEL, entries)
  if (options.cachedVectors) {
    const cache = JSON.parse(readFileSync(options.vectorsPath, "utf8"))
    if (cache.model !== MODEL || cache.fingerprint !== fingerprint || cache.fallbackCount !== 0
      || cache.dimensions !== DIMENSIONS || JSON.stringify(cache.keys) !== JSON.stringify(entries.map((e) => e.key))) {
      throw new Error("Held-out vector cache mismatch")
    }
    return { vectors: cache.vectors.map((v: string) => Array.from(decode(v))), fingerprint }
  }
  process.env.TEST_REAL_EMBEDDINGS = "1"
  process.env.EMBEDDING_LOCAL_ONLY = "1"
  process.env.EMBEDDING_BACKEND = "xenova-v2"
  process.env.EMBEDDING_MODEL = MODEL
  process.env.EMBEDDING_LOCAL_PATH = process.env.EMBEDDING_LOCAL_PATH || ".cache/models"
  const vectors = await generateLocalEmbeddings(entries.map((e) => e.text), "passage")
  if (getModelHealthSnapshot().embedding.fallbackCount !== 0) throw new Error("Hash fallback: invalid evaluation")
  if (vectors.length !== entries.length || vectors.some((v) => v.length !== DIMENSIONS || v.some((x) => !Number.isFinite(x)))) {
    throw new Error("Invalid held-out vectors")
  }
  // Float32 in, float32 out: generation and replay score the same representation.
  const f32 = vectors.map((v) => Array.from(Float32Array.from(v)))
  mkdirSync(options.vectorsPath.replace(/\/[^/]+$/, ""), { recursive: true })
  writeFileSync(options.vectorsPath, JSON.stringify({
    model: MODEL,
    dimensions: DIMENSIONS,
    fallbackCount: 0,
    fingerprint,
    keys: entries.map((e) => e.key),
    vectors: f32.map((v) => Buffer.from(Float32Array.from(v).buffer).toString("base64")),
  }) + "\n")
  return { vectors: f32, fingerprint }
}

function routeLimits(route: RetrievalRoute): { dense: number; lexical: number; weights: Partial<Record<RetrievalSource, number>> } {
  const limitFor = (source: RetrievalSource) => Math.min(
    route.sources.find((s) => s.source === source)?.limit ?? DEFAULT_CANDIDATE_LIMITS[source],
    DEFAULT_CANDIDATE_LIMITS[source],
  )
  return {
    dense: limitFor("dense"),
    lexical: limitFor("lexical"),
    weights: Object.fromEntries(route.sources.map((s) => [s.source, s.weight])),
  }
}

function lexicalProxyPool(units: HeldoutUnit[], query: string, limit: number): ScoredSectionCandidate[] {
  const terms = buildFtsQuery(query).split(" OR ").filter(Boolean)
  return units
    .map((u) => ({ id: u.id, score: terms.filter((t) => u.norm.includes(t)).length, sectionPath: u.sectionPath }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, limit)
}

/** Shared ranking policy: dense merge + section boost + routed limits + weighted RRF. */
function rankFromPools(
  densePool: ScoredSectionCandidate[],
  lexicalPool: ScoredSectionCandidate[],
  route: RetrievalRoute,
  kind: "dense" | "hybrid",
): string[] {
  const { dense: denseLimit, lexical: lexicalLimit, weights } = routeLimits(route)
  const dense = mergeDenseCandidates(densePool, route.preferredSections, denseLimit)
  if (kind === "dense") return dense.slice(0, FUSION_LIMIT).map((c) => c.id)
  const lexical = applySectionBoost(lexicalPool, route.preferredSections).slice(0, lexicalLimit)
  return fuseCandidates(
    [{ source: "dense", items: dense }, { source: "lexical", items: lexical }],
    { method: "weighted-rrf", weights, limit: FUSION_LIMIT },
  ).map((c) => c.id)
}

interface PgliteRanker {
  rank: (query: string, vec: number[], route: RetrievalRoute, kind: "dense" | "hybrid") => Promise<string[]>
  close: () => Promise<void>
  diagnostics: { emptyLexicalRuns: number }
}

async function pgliteRanker(units: HeldoutUnit[], vectors: Map<string, number[]>): Promise<PgliteRanker> {
  const db = await openLivePg({ flavor: "pglite" })
  await db.exec(
    "CREATE TABLE heldout_chunk (id TEXT PRIMARY KEY, heading TEXT, section_path TEXT, content TEXT, embedding vector(384))",
  )
  const sectionById = new Map(units.map((u) => [u.id, u.sectionPath]))
  const BATCH = 50
  for (let i = 0; i < units.length; i += BATCH) {
    const rows = units.slice(i, i + BATCH)
    const values: string[] = []
    const params: unknown[] = []
    rows.forEach((u, j) => {
      values.push(`($${j * 5 + 1}, $${j * 5 + 2}, $${j * 5 + 3}, $${j * 5 + 4}, $${j * 5 + 5}::vector)`)
      params.push(u.id, u.heading, u.sectionPath, u.content, toVectorLiteral(vectors.get(u.id)!))
    })
    await db.query(
      `INSERT INTO heldout_chunk (id, heading, section_path, content, embedding) VALUES ${values.join(", ")}`,
      params,
    )
  }
  // No ANN index: this benchmark measures exact pgvector distance ordering and
  // real ts_rank tokenization. ANN-at-scale behavior remains unvalidated.
  const diagnostics = { emptyLexicalRuns: 0 }
  return {
    diagnostics,
    close: () => db.close(),
    rank: async (query, vec, route, kind) => {
      const { dense: denseLimit, lexical: lexicalLimit } = routeLimits(route)
      const perQuery = Math.max(10, Math.ceil(denseLimit * 1.5))
      // Production dense SQL shape: ORDER BY embedding <=> $vec. Id tiebreak for replay stability.
      const denseRows = (await db.query<{ id: string }>(
        "SELECT id FROM heldout_chunk ORDER BY embedding <=> $1::vector ASC, id ASC LIMIT $2",
        [toVectorLiteral(vec), perQuery],
      )).rows
      const densePool: ScoredSectionCandidate[] = denseRows.map((r) => ({
        id: r.id,
        // Score with the same float32 vectors the memory legs use; SQL decides order.
        score: cosine(vectors.get(r.id)!, vec),
        sectionPath: sectionById.get(r.id) ?? null,
      }))
      if (kind === "dense") return rankFromPools(densePool, [], route, "dense")
      // Production lexical SQL shape: websearch_to_tsquery('simple', buildFtsQuery(...)) + ts_rank.
      const fts = buildFtsQuery(query)
      const lexRows = (await db.query<{ id: string; rank: string }>(
        "SELECT id, ts_rank(to_tsvector('simple', content), websearch_to_tsquery('simple', $1)) AS rank" +
        " FROM heldout_chunk WHERE to_tsvector('simple', content) @@ websearch_to_tsquery('simple', $1)" +
        " ORDER BY rank DESC, id ASC LIMIT $2",
        [fts, lexicalLimit],
      )).rows
      if (lexRows.length === 0) diagnostics.emptyLexicalRuns++
      const lexicalPool: ScoredSectionCandidate[] = lexRows.map((r) => ({
        id: r.id,
        score: Number(r.rank),
        sectionPath: sectionById.get(r.id) ?? null,
      }))
      return rankFromPools(densePool, lexicalPool, route, "hybrid")
    },
  }
}

function metricsFor(ranked: string[], judgments: GoldenJudgment[]): { ndcg10: number; mrr: number; recall5: number; recall10: number; hit5: number; hit10: number } {
  const gradeMap = new Map<string, number>()
  for (const j of judgments) gradeMap.set(j.chunkId, j.grade)
  const relevant = new Set(judgments.filter((j) => j.grade >= 1).map((j) => j.chunkId))
  return {
    ndcg10: computeNdcgAtK(ranked, gradeMap, NDCG_K),
    mrr: computeMrr(ranked, relevant),
    recall5: computeRecallAtK(ranked, judgments, 5),
    recall10: computeRecallAtK(ranked, judgments, 10),
    hit5: ranked.slice(0, 5).some((id) => relevant.has(id)) ? 1 : 0,
    hit10: ranked.slice(0, 10).some((id) => relevant.has(id)) ? 1 : 0,
  }
}

const round3 = (x: number) => Math.round(x * 1000) / 1000

export interface HeldoutEvalOptions {
  cachedVectors?: boolean
  writeArtifacts?: boolean
  corpusDir?: string
  goldenDir?: string
  artifactsDir?: string
}

export async function runHeldoutGoldenEval(options: HeldoutEvalOptions = {}): Promise<{
  report: HeldoutGoldenReport
  labelAudit: LabelAudit
}> {
  const corpusDir = options.corpusDir ?? "data/eval/corpus"
  const goldenDir = options.goldenDir ?? "data/eval/golden-v2"
  const artifactsDir = options.artifactsDir ?? "artifacts/eval/heldout-golden"
  const vectorsPath = `${artifactsDir}/vectors.json`
  const cachedVectors = options.cachedVectors ?? process.argv.includes("--cached-vectors")

  const queries = loadGoldenJudgments(goldenDir)
  if (queries.length === 0) throw new Error("No golden queries found")
  const { docs, chunksByBinding } = loadHeldoutCorpus(corpusDir)
  const labelAudit = auditGoldenLabels(queries, chunksByBinding)

  const entries = vectorEntries(queries, chunksByBinding)
  const { vectors: flatVectors, fingerprint } = await resolveVectors(entries, { cachedVectors, vectorsPath })
  const vecByKey = new Map(entries.map((e, i) => [e.key, flatVectors[i]]))

  const corpusHash = createHash("sha256")
  for (const d of docs) corpusHash.update(d.docId).update("\n")
  for (const b of HELDOUT_BINDINGS) for (const u of chunksByBinding[b]) corpusHash.update(u.id).update(u.content)
  const judgmentsSha256 = createHash("sha256").update(JSON.stringify(queries)).digest("hex")

  const bindings: HeldoutBindingResult[] = []
  for (const binding of HELDOUT_BINDINGS) {
    const units = chunksByBinding[binding]
    const judgedIds = new Set(queries.flatMap((q) => q.judgments.map((j) => j.chunkId)))
    const unitIds = new Set(units.map((u) => u.id))
    const judgedChunksMissing = [...judgedIds].filter((id) => !unitIds.has(id)).length

    const memoryDensePool = (vec: number[], limit: number): ScoredSectionCandidate[] =>
      units
        .map((u) => ({ id: u.id, score: cosine(vecByKey.get(`chunk:${binding}:${u.id}`)!, vec), sectionPath: u.sectionPath }))
        .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .slice(0, limit)

    const pglite = await pgliteRanker(
      units,
      new Map(units.map((u) => [u.id, vecByKey.get(`chunk:${binding}:${u.id}`)!])),
    )

    const conditions: HeldoutCondition[] = []
    const specs = [
      { name: "dense-memory", kind: "dense" as const, useDb: false, engine: "in-memory cosine over float32 vectors; production max-cosine merge + 1.15 section boost + routed limits", database: "none (offline proxy)" as const },
      { name: "hybrid-memory-proxy", kind: "hybrid" as const, useDb: false, engine: "dense-memory + substring lexical proxy (buildFtsQuery term counts; NOT ts_rank) fused with weighted RRF at routed source weights", database: "none (offline proxy)" as const },
      { name: "dense-pglite", kind: "dense" as const, useDb: true, engine: "pgvector cosine distance <=> on PGlite, same merge + section boost + routed limits; exact distances, no ANN index", database: "pglite (real PostgreSQL + pgvector, in-process WASM)" as const },
      { name: "hybrid-pglite", kind: "hybrid" as const, useDb: true, engine: "pgvector dense + websearch_to_tsquery('simple')/ts_rank lexical (production SQL shape), same weighted RRF fusion", database: "pglite (real PostgreSQL + pgvector, in-process WASM)" as const },
    ]
    for (const cond of specs) {
      const perQuery: HeldoutPerQuery[] = []
      let ndcg10 = 0, mrr = 0, recall5 = 0, recall10 = 0, hit5 = 0, hit10 = 0
      for (const q of queries) {
        const route = routeQuery(q.query)
        const vec = vecByKey.get(`query:${q.id}`)!
        const limits = routeLimits(route)
        const perQueryPool = Math.max(10, Math.ceil(limits.dense * 1.5))
        const ranked = cond.useDb
          ? await pglite.rank(q.query, vec, route, cond.kind)
          : rankFromPools(
              memoryDensePool(vec, perQueryPool),
              cond.kind === "hybrid" ? lexicalProxyPool(units, q.query, limits.lexical) : [],
              route,
              cond.kind,
            )
        const m = metricsFor(ranked, q.judgments)
        ndcg10 += m.ndcg10; mrr += m.mrr; recall5 += m.recall5; recall10 += m.recall10; hit5 += m.hit5; hit10 += m.hit10
        perQuery.push({ id: q.id, ndcg10: round3(m.ndcg10), mrr: round3(m.mrr), recall5: round3(m.recall5), recall10: round3(m.recall10) })
      }
      const n = queries.length
      conditions.push({
        name: cond.name,
        engine: cond.engine,
        database: cond.database,
        macro: {
          ndcg10: round3(ndcg10 / n), mrr: round3(mrr / n), recall5: round3(recall5 / n),
          recall10: round3(recall10 / n), hit5: round3(hit5 / n), hit10: round3(hit10 / n),
        },
        perQuery,
        lowestNdcg10: [...perQuery]
          .sort((a, b) => a.ndcg10 - b.ndcg10 || (a.id < b.id ? -1 : 1))
          .slice(0, 5)
          .map((p) => ({ id: p.id, query: queries.find((q) => q.id === p.id)!.query, ndcg10: p.ndcg10 })),
      })
    }
    await pglite.close()
    bindings.push({ binding, chunkUnits: units.length, judgedChunksMissing, conditions })
  }

  const report: HeldoutGoldenReport = {
    scope:
      "Held-out retrieval evaluation on the three committed arXiv papers (data/eval/corpus) — NOT the Analysis_2 " +
      "chapter, NOT review accuracy, NOT a live-pipeline result. Ranking policy shared with production replay " +
      "(max-cosine merge, 1.15 section boost, routed limits, weighted RRF). Offline-memory legs use in-memory cosine " +
      "and a substring lexical proxy; pglite legs execute real PostgreSQL/pgvector SQL on the in-process PGlite WASM " +
      "engine (real ts_rank tokenization, exact pgvector distances, no ANN index). Chunk binding is a sensitivity " +
      "dimension: the committed judgments do not consistently bind to either chunking (see labelAudit). No " +
      "metadata/citation/graph legs, reranker, MMR, compression, HyDE or rubric expansion; topic queries replayed raw.",
    labelProvenance:
      "data/eval/golden-v2 chunk-level graded rows are used exactly as committed (no edits, no new labels). They are " +
      "NOT verified human ground truth: templated 'Independent verification' rows duplicate another annotator's " +
      "rationale verbatim, and rationale-to-chunk consistency is mixed across the two chunk bindings. These numbers " +
      "pin harness behavior for regression detection; they do not establish real retrieval quality.",
    model: MODEL,
    dimensions: DIMENSIONS,
    fallbackCount: 0,
    queryCount: queries.length,
    corpusSha256: corpusHash.digest("hex"),
    judgmentsSha256,
    vectorFingerprint: fingerprint,
    labelAudit: labelAudit.summary,
    bindings,
  }

  if (options.writeArtifacts !== false) {
    mkdirSync(artifactsDir, { recursive: true })
    writeFileSync(`${artifactsDir}/report.json`, JSON.stringify(report, null, 2) + "\n")
    writeFileSync(`${artifactsDir}/label-audit.json`, JSON.stringify(labelAudit, null, 2) + "\n")
  }
  return { report, labelAudit }
}
