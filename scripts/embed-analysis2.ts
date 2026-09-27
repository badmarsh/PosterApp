/**
 * Chunk Analysis_2.pdf and write real local embeddings.
 *
 * Usage: pnpm exec tsx scripts/embed-analysis2.ts
 * Set TEST_REAL_EMBEDDINGS=1 so the registry does not substitute hash vectors.
 * Hugging Face is not required. Place a local ONNX at
 * .cache/models/Xenova/all-MiniLM-L6-v2/ (config.json, tokenizer.json,
 * tokenizer_config.json, onnx/model.onnx). The weights used here came from
 * the npm package @xcidos/genesis-memory-model@0.1.0-alpha.1, which vendors
 * all-MiniLM-L6-v2. Do not commit that ONNX file.
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs"
import { cleanExtractedPdfMarkdown } from "../lib/services/margin-line-numbers"
import { chunkDocument } from "../lib/ai/chunker-v2"
import { generateLocalEmbeddings } from "../lib/ai/local-embeddings"
import { getModelHealthSnapshot } from "../lib/ai/model-registry"

function cosine(a: number[], b: number[]): number {
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

async function main() {
  process.env.TEST_REAL_EMBEDDINGS = "1"
  process.env.EMBEDDING_LOCAL_ONLY = "1"
  process.env.EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2"
  process.env.EMBEDDING_LOCAL_PATH = process.env.EMBEDDING_LOCAL_PATH || ".cache/models"
  const raw = readFileSync("artifacts/analysis-2/manuscript.md", "utf8")
  const cleaned = cleanExtractedPdfMarkdown(raw)
  if (cleaned.marginLinesStripped < 40) throw new Error("margin line-number stripper did not fire")
  mkdirSync("artifacts/analysis-2", { recursive: true })
  writeFileSync("artifacts/analysis-2/manuscript.clean.md", cleaned.text)

  const { chunks } = chunkDocument(cleaned.text, "analysis-2", null, {
    documentTitle: "JES and JER from hadronic W bosons",
    domain: "Particle physics, ATLAS jet calibration",
    lang: "en",
  })
  const units = chunks.filter((c) => !c.isParent)
  console.log(`chunks ${chunks.length} retrieval units ${units.length} margin lines stripped ${cleaned.marginLinesStripped} running headers stripped ${cleaned.runningHeadersStripped}`)

  const texts = units.map((c) => c.embeddingText)
  const started = Date.now()
  const vectors = await generateLocalEmbeddings(texts, "passage")
  const elapsed = Date.now() - started
  const health = getModelHealthSnapshot()
  if (health.embedding.fallbackCount > 0) {
    throw new Error(`hash fallback used (${health.embedding.fallbackCount}): ${health.embedding.lastError}`)
  }
  if (vectors.length !== units.length) throw new Error(`embedding count ${vectors.length} != ${units.length}`)
  const dim = vectors[0]?.length ?? 0
  if (dim < 8) throw new Error(`unexpected embedding width ${dim}`)
  const finite = vectors.every((v) => v.length === dim && v.every((x) => Number.isFinite(x)))
  if (!finite) throw new Error("non-finite embedding")

  // Compact index: float32 base64, not a 384-number JSON array per chunk.
  const index = {
    documentId: "analysis-2",
    source: "Analysis_2.pdf",
    model: process.env.EMBEDDING_MODEL || "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    dimensions: dim,
    marginLinesStripped: cleaned.marginLinesStripped,
    runningHeadersStripped: cleaned.runningHeadersStripped,
    retrievalUnits: units.length,
    embedMs: elapsed,
    chunks: units.map((c, i) => ({
      id: c.id,
      heading: c.heading,
      sectionPath: c.sectionPath,
      kind: c.kind,
      pageStart: c.pageStart,
      tokens: c.tokenCount,
      content: c.content,
      embedding: Buffer.from(Float32Array.from(vectors[i]).buffer).toString("base64"),
    })),
  }
  writeFileSync("artifacts/analysis-2/embeddings.json", JSON.stringify(index))
  console.log(`wrote embeddings.json dim=${dim} units=${units.length} in ${elapsed} ms`)

  const probes = [
    "unresolved Section ?? cross references",
    "statistical uncertainty half of the maximum likelihood one sigma",
    "JES correction factors s_i Run 2 low pT",
    "in situ JER smearing not yet derived",
    "forward folding formula jet response mode",
  ]
  const qVecs = await generateLocalEmbeddings(probes, "query")
  const report: Array<{ query: string; hits: Array<{ heading: string | null; score: number; preview: string }> }> = []
  for (let q = 0; q < probes.length; q++) {
    const ranked = vectors
      .map((v, i) => ({ i, score: cosine(qVecs[q], v) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
    report.push({
      query: probes[q],
      hits: ranked.map(({ i, score }) => ({
        heading: units[i].heading,
        score: Number(score.toFixed(3)),
        preview: units[i].content.replace(/\s+/g, " ").slice(0, 220),
      })),
    })
  }
  writeFileSync("artifacts/analysis-2/retrieval-probe.json", JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
