/**
 * Real Corpus Benchmark Runner — Phase 3
 *
 * Executes retrieval benchmarks against a real PGlite in-process database,
 * producing empirical Recall@K, nDCG@10 and MRR numbers from the golden-v2 query set.
 */

import * as fs from "fs"
import * as path from "path"
import { openLivePg, applyMigrations, toVectorLiteral } from "./pg-live"

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface GoldenJudgment {
  queryId: string
  chunkId: string
  grade: 0 | 1 | 2 | 3
  annotatorId: string
  date: string
  rationale: string
}

export interface GoldenQuery {
  id: string
  query: string
  domain: string
  language: string
  judgments: GoldenJudgment[]
}

export interface PerQueryResult {
  queryId: string
  query: string
  recallAt5: number
  recallAt10: number
  recallAt20: number
  ndcgAt10: number
  mrr: number
  retrievedChunkIds: string[]
  latencyMs: number
}

export interface ArchitectureResult {
  name: string
  status: "executed" | "not-executed"
  methodology: "empirical" | "not-executed"
  reason?: string
  queriesEvaluated: number
  recallAt5: number
  recallAt10: number
  recallAt20: number
  ndcgAt10: number
  mrr: number
  latencyMs: number
  perQuery: PerQueryResult[]
}

export interface RealBenchmarkReport {
  timestamp: string
  methodology: "empirical"
  methodologyNote: string
  goldenSetSize: number
  corpusChunks: number
  limitations: string[]
  architectures: ArchitectureResult[]
  comparison: {
    posterappVsBaseline: {
      bm25: { recallAt10Delta: number; ndcgAt10Delta: number; mrrDelta: number } | null
      naiveRag: { recallAt10Delta: number; ndcgAt10Delta: number; mrrDelta: number } | null
    }
  }
}
// ---------------------------------------------------------------------------
// Metric helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Recall@K: fraction of relevant chunks (grade >= 1) that appear in the top-K results.
 * Returns 1.0 when there are no relevant chunks (vacuously true).
 */
export function computeRecallAtK(
  retrievedIds: string[],
  judgments: GoldenJudgment[],
  k: number
): number {
  const relevant = new Set(judgments.filter((j) => j.grade >= 1).map((j) => j.chunkId))
  if (relevant.size === 0) return 1.0
  const topK = retrievedIds.slice(0, k)
  const hits = topK.filter((id) => relevant.has(id)).length
  return hits / relevant.size
}

/** nDCG@K using logarithmic gain from grades 0-3.
 *  Accepts either a GoldenJudgment[] or a pre-built Map<chunkId, grade>. */
export function computeNdcgAtK(
  retrievedIds: string[],
  judgments: GoldenJudgment[] | Map<string, number>,
  k: number
): number {
  const gradeMap: Map<string, number> =
    judgments instanceof Map
      ? judgments
      : (() => {
          const m = new Map<string, number>()
          for (const j of judgments as GoldenJudgment[]) m.set(j.chunkId, j.grade)
          return m
        })()
  // Vacuously 1.0 when there are no graded items
  if (gradeMap.size === 0) return 1.0
  const dcg = (ids: string[]) =>
    ids.slice(0, k).reduce((acc, id, i) => acc + (gradeMap.get(id) ?? 0) / Math.log2(i + 2), 0)
  const idealIds = [...gradeMap.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const ideal = dcg(idealIds)
  if (ideal === 0) return 0
  return dcg(retrievedIds) / ideal
}

/** MRR: reciprocal rank of the first relevant (grade >= 1) result.
 *  Accepts either a GoldenJudgment[] or a pre-built Set<chunkId>. */
export function computeMrr(
  retrievedIds: string[],
  judgments: GoldenJudgment[] | Set<string>
): number {
  const relevant: Set<string> =
    judgments instanceof Set
      ? judgments
      : new Set((judgments as GoldenJudgment[]).filter((j) => j.grade >= 1).map((j) => j.chunkId))
  for (let i = 0; i < retrievedIds.length; i++) {
    if (relevant.has(retrievedIds[i])) return 1 / (i + 1)
  }
  return 0
}

// ---------------------------------------------------------------------------
// Golden judgment loader
// ---------------------------------------------------------------------------

export function loadGoldenJudgments(goldenDir: string): GoldenQuery[] {
  if (!fs.existsSync(goldenDir)) return []
  const files = fs
    .readdirSync(goldenDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
  const queries: GoldenQuery[] = []
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(goldenDir, f), "utf8")
      queries.push(JSON.parse(raw) as GoldenQuery)
    } catch {
      // skip malformed
    }
  }
  return queries
}

// ---------------------------------------------------------------------------
// Corpus ingestion into PGlite
// ---------------------------------------------------------------------------

const EVAL_WORKSPACE_ID = "eval-benchmark-workspace"

async function ensureWorkspace(db: Awaited<ReturnType<typeof openLivePg>>): Promise<void> {
  await db.exec(
    `INSERT INTO "Workspace" ("id","name","authors","venue","userId")` +
    ` VALUES ('eval-benchmark-workspace','Eval Benchmark','Annotator','ArXiv','eval-runner')` +
    ` ON CONFLICT ("id") DO NOTHING`
  )
}

interface ChunkRow {
  id: string
  content: string
  heading: string | null
}

/**
 * Very small markdown splitter for eval use — splits on headings or every ~400 chars.
 * Returns stable chunk IDs in the format docId_NNNN.
 */
function splitMarkdownForEval(markdown: string, docId: string): ChunkRow[] {
  // Split on h1-h4 headings
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

  // Sub-split large sections at ~400 chars
  const chunks: ChunkRow[] = []
  for (const section of sections) {
    const text = section.text
    if (text.length <= 800) {
      const idx = chunks.length
      chunks.push({
        id: docId + "_" + String(idx).padStart(4, "0"),
        content: text,
        heading: section.heading,
      })
    } else {
      // Split on double newlines
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

async function ingestCorpus(
  db: Awaited<ReturnType<typeof openLivePg>>,
  corpusDir: string
): Promise<{ totalChunks: number; chunksByDoc: Record<string, ChunkRow[]> }> {
  const manifestPath = path.join(corpusDir, "manifest.json")
  if (!fs.existsSync(manifestPath)) {
    return { totalChunks: 0, chunksByDoc: {} }
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Array<{
    docId: string
    title: string
    path: string
  }>

  // Set up schema — minimal inline DDL for the eval workspace
  await db.exec(
    'CREATE TABLE IF NOT EXISTS "Workspace" (' +
    '"id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "authors" TEXT NOT NULL,' +
    ' "venue" TEXT NOT NULL, "userId" TEXT NOT NULL)'
  )
  await db.exec(
    'CREATE TABLE IF NOT EXISTS "DocumentChunk" (' +
    '"id" TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "documentId" TEXT NOT NULL,' +
    ' "heading" TEXT, "content" TEXT NOT NULL, "tokens" INT NOT NULL DEFAULT 0,' +
    " \"kind\" TEXT NOT NULL DEFAULT 'prose', \"ordinal\" INT NOT NULL DEFAULT 0," +
    ' "createdAt" TIMESTAMPTZ DEFAULT NOW())'
  )
  // Add embedding column separately — vector() needs the extension
  try {
    await db.exec('ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "embedding" vector(384)')
  } catch {
    // If already exists, ignore
  }

  await ensureWorkspace(db)

  // Import embeddings lazily — only needed for dense retrieval
  let embedTexts: ((texts: string[]) => Promise<number[][]>) | null = null
  try {
    const mod = await import("@/lib/ai/local-embeddings")
    embedTexts = (texts: string[]) => mod.generateLocalEmbeddings(texts, "passage")
  } catch {
    // Dense retrieval will be skipped if embeddings unavailable
  }

  const chunksByDoc: Record<string, ChunkRow[]> = {}
  let totalChunks = 0

  for (const doc of manifest) {
    const mdPath = path.resolve(process.cwd(), doc.path)
    if (!fs.existsSync(mdPath)) continue
    const markdown = fs.readFileSync(mdPath, "utf8")
    const chunks = splitMarkdownForEval(markdown, doc.docId)
    chunksByDoc[doc.docId] = chunks

    // Embed all chunks for this document
    let embeddings: number[][] | null = null
    if (embedTexts) {
      try {
        embeddings = await embedTexts(chunks.map((c) => c.content))
      } catch {
        embeddings = null
      }
    }

    // Insert chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const tokens = Math.ceil(chunk.content.length / 4)
      if (embeddings && embeddings[i] && embeddings[i].length > 0) {
        const vecLit = toVectorLiteral(embeddings[i])
        await db.query(
          "INSERT INTO \"DocumentChunk\" (id, \"workspaceId\", \"documentId\", heading, content, tokens, ordinal, embedding)" +
          " VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector) ON CONFLICT (id) DO NOTHING",
          [chunk.id, EVAL_WORKSPACE_ID, doc.docId, chunk.heading, chunk.content, tokens, i, vecLit]
        )
      } else {
        await db.query(
          "INSERT INTO \"DocumentChunk\" (id, \"workspaceId\", \"documentId\", heading, content, tokens, ordinal)" +
          " VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING",
          [chunk.id, EVAL_WORKSPACE_ID, doc.docId, chunk.heading, chunk.content, tokens, i]
        )
      }
      totalChunks++
    }
  }

  return { totalChunks, chunksByDoc }
}

// ---------------------------------------------------------------------------
// Retrieval implementations
// ---------------------------------------------------------------------------

async function retrieveBm25(
  db: Awaited<ReturnType<typeof openLivePg>>,
  query: string,
  topK: number
): Promise<string[]> {
  // Sanitise query for tsquery: keep only alphanumeric + spaces
  const sanitised = query.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean).join(" & ")
  if (!sanitised) return []
  try {
    const res = await db.query<{ id: string }>(
      "SELECT id FROM \"DocumentChunk\"" +
      " WHERE \"workspaceId\" = $1" +
      "   AND to_tsvector('english', content) @@ to_tsquery('english', $2)" +
      " ORDER BY ts_rank(to_tsvector('english', content), to_tsquery('english', $2)) DESC" +
      " LIMIT $3",
      [EVAL_WORKSPACE_ID, sanitised, topK]
    )
    if (res.rows.length > 0) return res.rows.map((r) => r.id)
  } catch {
    // tsquery parse failure — fallback to ILIKE
  }
  // Fallback: ILIKE on first keyword
  const kw = query.split(/\s+/)[0] ?? query
  const res2 = await db.query<{ id: string }>(
    "SELECT id FROM \"DocumentChunk\" WHERE \"workspaceId\" = $1 AND content ILIKE $2 LIMIT $3",
    [EVAL_WORKSPACE_ID, "%" + kw + "%", topK]
  )
  return res2.rows.map((r) => r.id)
}

async function retrieveDense(
  db: Awaited<ReturnType<typeof openLivePg>>,
  queryVec: number[] | null,
  topK: number
): Promise<string[]> {
  if (!queryVec || queryVec.length === 0) return []
  try {
    const vecLit = toVectorLiteral(queryVec)
    const res = await db.query<{ id: string }>(
      "SELECT id FROM \"DocumentChunk\"" +
      " WHERE \"workspaceId\" = $1 AND embedding IS NOT NULL" +
      " ORDER BY embedding <=> $2::vector" +
      " LIMIT $3",
      [EVAL_WORKSPACE_ID, vecLit, topK]
    )
    return res.rows.map((r) => r.id)
  } catch {
    return []
  }
}

/** Reciprocal Rank Fusion of two ranked lists. */
function rrfFuse(denseIds: string[], bm25Ids: string[], topK: number): string[] {
  const scores = new Map<string, number>()
  const add = (ids: string[]) => {
    ids.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (60 + rank + 1))
    })
  }
  add(denseIds)
  add(bm25Ids)
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id]) => id)
}

// ---------------------------------------------------------------------------
// Per-architecture evaluation runner
// ---------------------------------------------------------------------------

function avgMetric(results: PerQueryResult[], key: keyof PerQueryResult): number {
  if (results.length === 0) return 0
  const sum = results.reduce((acc, r) => acc + (r[key] as number), 0)
  return sum / results.length
}

async function runArchitecture(
  name: string,
  db: Awaited<ReturnType<typeof openLivePg>>,
  queries: GoldenQuery[],
  embedQuery: ((q: string) => Promise<number[] | null>) | null,
  strategy: "bm25" | "dense" | "naive-rag" | "posterapp"
): Promise<ArchitectureResult> {
  const TOP_K = 20
  const perQuery: PerQueryResult[] = []

  for (const gq of queries) {
    const t0 = Date.now()
    let retrievedIds: string[] = []

    if (strategy === "bm25") {
      retrievedIds = await retrieveBm25(db, gq.query, TOP_K)
    } else if (strategy === "dense") {
      const vec = embedQuery ? await embedQuery(gq.query) : null
      retrievedIds = await retrieveDense(db, vec, TOP_K)
    } else if (strategy === "naive-rag") {
      // naive RAG: dense only, no reranking
      const vec = embedQuery ? await embedQuery(gq.query) : null
      retrievedIds = await retrieveDense(db, vec, TOP_K)
      if (retrievedIds.length === 0) {
        retrievedIds = await retrieveBm25(db, gq.query, TOP_K)
      }
    } else {
      // posterapp: dense + BM25 + RRF
      const vec = embedQuery ? await embedQuery(gq.query) : null
      const denseIds = await retrieveDense(db, vec, TOP_K)
      const bm25Ids = await retrieveBm25(db, gq.query, TOP_K)
      retrievedIds = rrfFuse(denseIds, bm25Ids, TOP_K)
    }

    const latencyMs = Date.now() - t0
    perQuery.push({
      queryId: gq.id,
      query: gq.query,
      recallAt5: computeRecallAtK(retrievedIds, gq.judgments, 5),
      recallAt10: computeRecallAtK(retrievedIds, gq.judgments, 10),
      recallAt20: computeRecallAtK(retrievedIds, gq.judgments, 20),
      ndcgAt10: computeNdcgAtK(retrievedIds, gq.judgments, 10),
      mrr: computeMrr(retrievedIds, gq.judgments),
      retrievedChunkIds: retrievedIds,
      latencyMs,
    })
  }

  return {
    name,
    status: "executed",
    methodology: "empirical",
    queriesEvaluated: perQuery.length,
    recallAt5: avgMetric(perQuery, "recallAt5"),
    recallAt10: avgMetric(perQuery, "recallAt10"),
    recallAt20: avgMetric(perQuery, "recallAt20"),
    ndcgAt10: avgMetric(perQuery, "ndcgAt10"),
    mrr: avgMetric(perQuery, "mrr"),
    latencyMs: avgMetric(perQuery, "latencyMs"),
    perQuery,
  }
}

function notExecutedArch(name: string, reason: string): ArchitectureResult {
  return {
    name,
    status: "not-executed",
    methodology: "not-executed",
    reason,
    queriesEvaluated: 0,
    recallAt5: 0,
    recallAt10: 0,
    recallAt20: 0,
    ndcgAt10: 0,
    mrr: 0,
    latencyMs: 0,
    perQuery: [],
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Runs the real corpus benchmark.
 *
 * @param corpusDir   Directory with manifest.json and *.md corpus files (default data/eval/corpus)
 * @param goldenDir   Directory with q-*.json golden query files (default data/eval/golden-v2)
 * @param outputDir   Directory to write JSON artifacts (default artifacts/eval/real)
 */
export async function runRealCorpusBenchmark(
  corpusDir = "data/eval/corpus",
  goldenDir = "data/eval/golden-v2",
  outputDir = "artifacts/eval/real"
): Promise<RealBenchmarkReport> {
  const timestamp = new Date().toISOString()
  const limitations: string[] = []

  // Load golden queries
  const absGoldenDir = path.isAbsolute(goldenDir) ? goldenDir : path.resolve(process.cwd(), goldenDir)
  const queries = loadGoldenJudgments(absGoldenDir)

  if (queries.length === 0) {
    limitations.push("No golden judgments found — all architectures marked not-executed")
    const emptyReport: RealBenchmarkReport = {
      timestamp,
      methodology: "empirical",
      methodologyNote: "No golden judgments available. Populate " + goldenDir + " to run retrieval evaluation.",
      goldenSetSize: 0,
      corpusChunks: 0,
      limitations,
      architectures: [
        notExecutedArch("bm25", "No golden judgments"),
        notExecutedArch("dense-minilm", "No golden judgments"),
        notExecutedArch("naive-rag", "No golden judgments"),
        notExecutedArch("posterapp-pipeline", "No golden judgments"),
        notExecutedArch("bge-m3", "Not executed: requires 1024-dim index rebuild"),
        notExecutedArch("colbert", "Not executed: requires ColBERT server"),
      ],
      comparison: {
        posterappVsBaseline: { bm25: null, naiveRag: null },
      },
    }
    writeReport(outputDir, emptyReport)
    return emptyReport
  }

  // Boot PGlite
  let db: Awaited<ReturnType<typeof openLivePg>> | null = null
  let corpusChunks = 0
  const absCorpusDir = path.isAbsolute(corpusDir) ? corpusDir : path.resolve(process.cwd(), corpusDir)

  try {
    db = await openLivePg({ flavor: "pglite" })
    // Apply real migrations if available, else use inline DDL
    const migResult = await applyMigrations(db, { stopOnError: false })
    const migrationsApplied = migResult.filter((m) => m.ok).length
    if (migrationsApplied === 0) {
      limitations.push("Prisma migrations not applied — using inline eval schema")
    }
    const ingestResult = await ingestCorpus(db, absCorpusDir)
    corpusChunks = ingestResult.totalChunks
    if (corpusChunks === 0) {
      limitations.push("No corpus chunks ingested — check corpusDir path")
    }
  } catch (err) {
    limitations.push("PGlite boot failed: " + String(err))
  }

  // Build embedder for dense retrieval
  let embedQuery: ((q: string) => Promise<number[] | null>) | null = null
  if (db) {
    try {
      const mod = await import("@/lib/ai/local-embeddings")
      embedQuery = (q: string) => mod.generateLocalEmbedding(q, "query").catch(() => null)
    } catch {
      limitations.push("Local embeddings unavailable — dense/posterapp architectures will degrade to BM25")
    }
  }

  // Run architectures
  const archResults: ArchitectureResult[] = []

  if (!db || corpusChunks === 0) {
    archResults.push(notExecutedArch("bm25", "No DB or corpus available"))
    archResults.push(notExecutedArch("dense-minilm", "No DB or corpus available"))
    archResults.push(notExecutedArch("naive-rag", "No DB or corpus available"))
    archResults.push(notExecutedArch("posterapp-pipeline", "No DB or corpus available"))
  } else {
    archResults.push(await runArchitecture("bm25", db, queries, null, "bm25"))
    archResults.push(await runArchitecture("dense-minilm", db, queries, embedQuery, "dense"))
    archResults.push(await runArchitecture("naive-rag", db, queries, embedQuery, "naive-rag"))
    archResults.push(await runArchitecture("posterapp-pipeline", db, queries, embedQuery, "posterapp"))
  }

  // These require infrastructure not present in the eval harness
  archResults.push(notExecutedArch("bge-m3", "Not executed: requires 1024-dim index rebuild"))
  archResults.push(notExecutedArch("colbert", "Not executed: requires ColBERT server"))

  // Build comparison
  const posterapp = archResults.find((a) => a.name === "posterapp-pipeline")
  const bm25Arch = archResults.find((a) => a.name === "bm25")
  const naiveRag = archResults.find((a) => a.name === "naive-rag")

  const delta = (a: ArchitectureResult | undefined, b: ArchitectureResult | undefined) => {
    if (!a || !b || a.status !== "executed" || b.status !== "executed") return null
    return {
      recallAt10Delta: a.recallAt10 - b.recallAt10,
      ndcgAt10Delta: a.ndcgAt10 - b.ndcgAt10,
      mrrDelta: a.mrr - b.mrr,
    }
  }

  const report: RealBenchmarkReport = {
    timestamp,
    methodology: "empirical",
    methodologyNote:
      "Retrieval benchmarked against " + queries.length + " golden queries " +
      "(" + corpusChunks + " chunks ingested) using PGlite in-process. " +
      "Metrics: Recall@5/10/20, nDCG@10, MRR.",
    goldenSetSize: queries.length,
    corpusChunks,
    limitations,
    architectures: archResults,
    comparison: {
      posterappVsBaseline: {
        bm25: delta(posterapp, bm25Arch),
        naiveRag: delta(posterapp, naiveRag),
      },
    },
  }

  if (db) await db.close().catch(() => {})

  writeReport(outputDir, report)
  return report
}

function writeReport(outputDir: string, report: RealBenchmarkReport): void {
  try {
    const absOut = path.isAbsolute(outputDir) ? outputDir : path.resolve(process.cwd(), outputDir)
    fs.mkdirSync(absOut, { recursive: true })
    // Per-architecture artifacts
    for (const arch of report.architectures) {
      if (arch.status === "executed") {
        fs.writeFileSync(
          path.join(absOut, "arch-" + arch.name + ".json"),
          JSON.stringify(arch, null, 2),
          "utf8"
        )
      }
    }
    fs.writeFileSync(
      path.join(absOut, "real-benchmark-report.json"),
      JSON.stringify(report, null, 2),
      "utf8"
    )
  } catch {
    // Non-fatal: benchmark result is still returned
  }
}

