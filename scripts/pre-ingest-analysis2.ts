/**
 * pre-ingest-analysis2.ts
 *
 * Lokálny pre-ingest skript pre Analysis_2.pdf → arena DB.
 * Spusti pred odovzdaním tasku arena agentovi:
 *
 *   npx tsx --env-file=.env.local scripts/pre-ingest-analysis2.ts
 *
 * Čo robí:
 *  1. Vytvorí workspace "phd-analysis-2-jes" v arena DB (ak neexistuje)
 *  2. Pošle Analysis_2.pdf na lokálny MinerU (port 8001) → markdown
 *  3. Uloží markdown do workspaces/phd-analysis-2-jes/sources/<fileId>.md
 *  4. Spustí ingestDocumentChunks() → DocumentChunk rows + pgvector embeddings
 *  5. Vypíše súhrn: počet chunkov, prvé 3 chunk headings, IngestFile.vectorStatus
 *
 * Po úspešnom behu môže arena agent preskočiť kroky 1-3 a ísť rovno
 * na Step 2 (Citation Audit) a Step 3 (Review Generation).
 */

import path from "path"
import fs from "fs"
import FormData from "form-data"
import { PrismaClient } from "@prisma/client"
import { ingestDocumentChunks } from "@/lib/ai/document-chunker"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ARENA_DB_URL = "postgresql://posterapp:posterapp_arena_pass_2026@dev.significa.sk:5435/posterapp"
const WORKSPACE_ID = "phd-analysis-2-jes"
const PDF_PATH = path.resolve(process.cwd(), "Analysis_2.pdf")
const MINERU_URLS = [
  "http://localhost:8001",
  "http://127.0.0.1:8001",
  // fallback: wsl2 mirrored networking
]
const MINERU_API_KEY = process.env.MINERU_API_KEY ?? ""
const FILE_ID = "analysis2-phd-jes-2026"

// ---------------------------------------------------------------------------
// Prisma pointed at arena DB
// ---------------------------------------------------------------------------
const p = new PrismaClient({
  datasources: { db: { url: ARENA_DB_URL } },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function findMinerU(): Promise<string> {
  for (const base of MINERU_URLS) {
    try {
      const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) })
      if (r.ok) {
        console.log(`✅ MinerU found at ${base}`)
        return base
      }
    } catch {}
  }
  throw new Error("MinerU not reachable on ports 8001/8002. Start it first: start-mineru.bat")
}

async function parsePdf(mineruBase: string, pdfPath: string): Promise<{ md: string; images: Record<string, string> }> {
  console.log("📄 Sending PDF to MinerU…")
  const form = new FormData()
  form.append("file", fs.createReadStream(pdfPath), path.basename(pdfPath))
  form.append("output_format", "markdown")

  const headers: Record<string, string> = { ...form.getHeaders() }
  if (MINERU_API_KEY) headers["X-API-Key"] = MINERU_API_KEY

  const res = await fetch(`${mineruBase}/file_parse`, {
    method: "POST",
    headers,
    body: form as any,
    signal: AbortSignal.timeout(5 * 60 * 1000), // 5 min
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`MinerU returned ${res.status}: ${text.slice(0, 300)}`)
  }

  const json = (await res.json()) as any
  const md: string = json.md_content ?? json.markdown ?? json.content ?? ""
  const images: Record<string, string> = json.images ?? {}

  if (!md.trim()) throw new Error("MinerU returned empty markdown")
  console.log(`✅ MinerU parsed: ${md.length.toLocaleString()} chars, ${Object.keys(images).length} images`)
  return { md, images }
}

async function ensureWorkspace() {
  const existing = await p.workspace.findUnique({ where: { id: WORKSPACE_ID } })
  if (existing) {
    console.log(`✅ Workspace "${WORKSPACE_ID}" already exists`)
    return
  }
  await p.workspace.create({
    data: {
      id: WORKSPACE_ID,
      name: "PhD Analysis 2 — JES/JER ATLAS",
      authors: "PhD Candidate",
      venue: "PhD Dissertation",
      userId: "pre-ingest-script",
    },
  })
  console.log(`✅ Created workspace "${WORKSPACE_ID}"`)
}

async function ensureIngestFile() {
  const existing = await p.ingestFile.findUnique({ where: { id: FILE_ID } })
  if (existing) {
    console.log(`✅ IngestFile "${FILE_ID}" already exists (status: ${existing.vectorStatus})`)
    return existing
  }
  const stat = fs.statSync(PDF_PATH)
  const rec = await p.ingestFile.create({
    data: {
      id: FILE_ID,
      workspaceId: WORKSPACE_ID,
      name: "Analysis_2.pdf",
      size: stat.size,
      method: "mineru",
      status: "done",
      progress: 100,
      vectorStatus: "pending",
    },
  })
  console.log(`✅ Created IngestFile "${FILE_ID}"`)
  return rec
}

function saveMarkdown(md: string): string {
  const dir = path.join(process.cwd(), "workspaces", WORKSPACE_ID, "sources")
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${FILE_ID}.md`)
  fs.writeFileSync(filePath, md, "utf-8")
  console.log(`✅ Saved markdown → ${filePath} (${md.length.toLocaleString()} chars)`)
  return filePath
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n🚀 PosterApp pre-ingest script for Analysis_2.pdf → arena DB\n")

  // 0. Verify PDF exists
  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`PDF not found: ${PDF_PATH}`)
  }
  console.log(`📁 PDF: ${PDF_PATH} (${(fs.statSync(PDF_PATH).size / 1e6).toFixed(1)} MB)`)

  // 1. Check for existing chunks (idempotency)
  await ensureWorkspace()
  const existingChunks = await p.documentChunk.count({ where: { workspaceId: WORKSPACE_ID } })
  if (existingChunks > 0) {
    console.log(`\n⚡ Workspace already has ${existingChunks} chunks — skipping parse & chunk steps.`)
    console.log("   Delete existing chunks first if you want to re-index:\n")
    console.log(`   DELETE FROM "DocumentChunk" WHERE "workspaceId" = '${WORKSPACE_ID}';`)
    await printSummary()
    return
  }

  // 2. Parse PDF
  const mineruBase = await findMinerU()
  const { md } = await parsePdf(mineruBase, PDF_PATH)

  // 3. Save markdown to disk
  saveMarkdown(md)

  // 4. Create IngestFile record
  await ensureIngestFile()

  // 5. Chunk + embed → arena DB
  console.log("\n🔢 Chunking & embedding (this will take several minutes on first run — WASM model download)…")
  await ingestDocumentChunks(WORKSPACE_ID, FILE_ID, md, {
    ingestFileId: FILE_ID,
    // Override Prisma connection to use arena DB
    // NOTE: ingestDocumentChunks uses the module-level `prisma` singleton from lib/prisma.ts
    // which reads DATABASE_URL from env. Run this script with:
    //   DATABASE_URL="postgresql://posterapp:posterapp_arena_pass_2026@dev.significa.sk:5435/posterapp" npx tsx ...
  })

  // 6. Summary
  await printSummary()
  console.log("\n✅ Pre-ingest complete! Arena agent can now skip ingestion steps.")
}

async function printSummary() {
  const chunkCount = await p.documentChunk.count({ where: { workspaceId: WORKSPACE_ID } })
  const ingestFile = await p.ingestFile.findUnique({ where: { id: FILE_ID } })
  const sample = await p.documentChunk.findMany({
    where: { workspaceId: WORKSPACE_ID },
    select: { heading: true, chunkType: true, tokens: true },
    take: 5,
    orderBy: { ordinal: "asc" },
  })

  console.log("\n📊 Summary:")
  console.log(`   Workspace:    ${WORKSPACE_ID}`)
  console.log(`   Chunks:       ${chunkCount}`)
  console.log(`   IngestFile:   vectorStatus=${ingestFile?.vectorStatus ?? "N/A"}, vectorChunks=${ingestFile?.vectorChunks ?? 0}`)
  console.log("   First 5 chunks:")
  for (const c of sample) {
    console.log(`     [${c.chunkType}] ${c.heading ?? "(no heading)"} — ${c.tokens} tokens`)
  }
}

main()
  .catch((e) => {
    console.error("\n❌ Error:", e.message)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
