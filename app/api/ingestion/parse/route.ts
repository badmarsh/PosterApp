import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"
import { jsonStringify } from "@/lib/db-helpers"
import { generateCaption } from "@/lib/services/vision-service"
import { extractBibTeX } from "@/lib/services/bibtex-service"
import { requireWorkspaceEditor } from "@/lib/auth"
import { detectedPdf, MAX_UPLOAD_BYTES, SAFE_FILE_ID, SAFE_FILENAME, workspacePath } from "@/lib/workspace-files"
const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")
const MINERU_API_URL = process.env.MINERU_API_URL ?? "http://127.0.0.1:8001"

// ---------------------------------------------------------------------------
// Types for the MinerU response
// ---------------------------------------------------------------------------

interface MinerUImage {
  /** Absolute or relative path to the extracted image on the MinerU host */
  path: string
  img_caption?: string
  caption?: string
  /** Page number (1-indexed) */
  page_no?: number
  /** Category hint: "figure" | "table" | ... */
  category?: string
  type?: string
}

interface MinerUResponse {
  /** All extracted images (figures + tables rendered as images) */
  images?: MinerUImage[]
  /** Some versions expose these separately */
  figures?: MinerUImage[]
  tables?: MinerUImage[]
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// POST /api/ingestion/parse?workspaceId=<id>
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const { allowed, retryAfterMs } = rateLimit(ip, 10, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429, headers: { 'Retry-After': Math.ceil(retryAfterMs / 1000).toString() } })
  }

  const url = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId")

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId query parameter is required" },
      { status: 400 }
    )
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json(
      { error: "Invalid workspaceId" },
      { status: 400 }
    )
  }

  try { await requireWorkspaceEditor(workspaceId) } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: { code: "AUTH_FAILED", message: "Could not authorize ingestion" } }, { status: 500 }) }

  const contentLength = Number(req.headers.get("content-length"))
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_UPLOAD_BYTES + 128 * 1024) return NextResponse.json({ error: "Upload is too large" }, { status: 413 })

  // -- Validate workspace exists ------------------------------------------
  const assetsDir = path.join(WORKSPACES_DIR, workspaceId, "assets")
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true })
  }

  // -- Parse incoming multipart form (Next.js 15 native formData) -----------
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { error: "Failed to parse multipart form data" },
      { status: 400 }
    )
  }

  const fileEntry = formData.get("file")
  if (!fileEntry || typeof fileEntry === "string") {
    return NextResponse.json(
      { error: "No file field found in form data" },
      { status: 400 }
    )
  }

  const uploadedFile = fileEntry as File
  if (uploadedFile.size <= 0 || uploadedFile.size > MAX_UPLOAD_BYTES || !/\.pdf$/i.test(uploadedFile.name) || !detectedPdf(new Uint8Array(await uploadedFile.slice(0, 5).arrayBuffer()))) {
    return NextResponse.json({ error: "Only valid PDF documents up to 25 MB are accepted" }, { status: 415 })
  }

  let existingAssets: string[] = []
  const existingAssetsStr = formData.get("existingAssets")
  if (existingAssetsStr && typeof existingAssetsStr === "string") {
    try {
      existingAssets = JSON.parse(existingAssetsStr)
    } catch {}
  }

  // -- Forward to MinerU ---------------------------------------------------
  const mineruForm = new FormData()
  mineruForm.append("files", uploadedFile, uploadedFile.name)
  mineruForm.append("return_images", "true")
  mineruForm.append("return_middle_json", "true")

  let mineruResponse: Response
  try {
    mineruResponse = await fetch(`${MINERU_API_URL}/file_parse`, {
      method: "POST",
      body: mineruForm,
      // No explicit Content-Type — let fetch set the boundary for multipart
      signal: AbortSignal.timeout(300_000), // 5 minute timeout for large PDFs
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        error: "MinerU is unavailable",
        detail: message,
      },
      { status: 502 }
    )
  }

  if (!mineruResponse!.ok) {
    const body = await mineruResponse.text().catch(() => "")
    return NextResponse.json(
      {
        error: "MinerU returned an error",
        status: mineruResponse.status,
        detail: body,
      },
      { status: 502 }
    )
  }

  let mineruData: { results?: Record<string, { md_content?: string, images?: Record<string, string>, middle_json?: any }> }
  try {
    mineruData = await mineruResponse.json()
  } catch {
    return NextResponse.json(
      { error: "Failed to parse MinerU JSON response" },
      { status: 502 }
    )
  }

  // -- Parse new MinerU API format ------------------------------------------
  const rawBasename = path.basename(uploadedFile.name, path.extname(uploadedFile.name))
  const results = mineruData.results?.[rawBasename]
  const basename = rawBasename.replace(/[^a-zA-Z0-9_-]/g, "_")

  // Map to hold extracted table rows by their original image_path
  const tableMap = new Map<string, string[][]>()
  const pageMap = new Map<string, number>()
  
  if (results?.middle_json) {
    try {
      const middle = typeof results.middle_json === "string" ? JSON.parse(results.middle_json) : results.middle_json
      let pageNum = 1
      for (const p of middle.pdf_info || []) {
        const searchImagePaths = (obj: any) => {
          if (!obj) return
          if (typeof obj === 'object') {
            if (obj.image_path) {
              pageMap.set(obj.image_path, pageNum)
            }
            if (obj.type === "table" && obj.html && obj.image_path) {
              const rows: string[][] = []
              const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
              let trMatch
              while ((trMatch = trRegex.exec(obj.html)) !== null) {
                const cells: string[] = []
                const tdRegex = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi
                let tdMatch
                while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
                  cells.push(tdMatch[2].replace(/<[^>]+>/g, "").trim())
                }
                if (cells.length > 0) rows.push(cells)
              }
              tableMap.set(obj.image_path, rows)
            }
            for (const key of Object.keys(obj)) {
              searchImagePaths(obj[key])
            }
          }
        }
        searchImagePaths(p)
        pageNum++
      }
    } catch (e) {
      console.error("Failed to parse middle_json for tables and pages", e)
    }
  }

  // Rename images to structured names to avoid long hashes
  if (results?.images && results?.md_content) {
    let figureIndex = 1
    let tableIndex = 1
    const newImages: Record<string, string> = {}
    for (const [filename, base64Data] of Object.entries(results.images)) {
      const ext = path.extname(filename) || '.jpg'
      const normName = filename.split('/').pop() || filename
      let newFilename = ""
      if (tableMap.has(normName)) {
        newFilename = `${basename}_table_${tableIndex++}${ext}`
        tableMap.set(newFilename, tableMap.get(normName)!)
        pageMap.set(newFilename, pageMap.get(normName) || 1)
      } else {
        newFilename = `${basename}_figure_${figureIndex++}${ext}`
        pageMap.set(newFilename, pageMap.get(normName) || 1)
      }
      newImages[newFilename] = base64Data
      // Replace references to the old filename globally in the markdown
      results.md_content = results.md_content.split(filename).join(newFilename)
    }
    results.images = newImages
  }

  // Save parsed markdown to sources/ directory for RAG
  const fileId = formData.get("fileId")
  if (fileId && (typeof fileId !== "string" || !SAFE_FILE_ID.test(fileId))) return NextResponse.json({ error: "Invalid file ID" }, { status: 400 })
  if (fileId && typeof fileId === "string" && results?.md_content) {
    const sourcesDir = workspacePath(workspaceId, "sources")
    if (!fs.existsSync(sourcesDir)) fs.mkdirSync(sourcesDir, { recursive: true })
    await fs.promises.writeFile(workspacePath(workspaceId, "sources", `${fileId}.md`), results.md_content.slice(0, 5_000_000))

    // Auto-extract references to BibTeX
    await extractBibTeX(results.md_content, workspaceId)
  }

  const assets: {
    id: string
    filename: string
    url: string
    thumbnailUrl: string
    kind: "figure" | "table"
    caption: string
    snippet?: string
    tableRows?: string[][]
    page: number
  }[] = []

  if (results?.images) {
    // First pass: write all image files to disk in parallel
    const imageEntries = Object.entries(results.images).filter(([, v]) => typeof v === "string")
    await Promise.all(
      imageEntries.map(async ([filename, base64Data]) => {
        if (!SAFE_FILENAME.test(filename)) return
        const destPath = workspacePath(workspaceId, "assets", filename)
        try {
          const base64Payload = (base64Data as string).includes(",")
            ? (base64Data as string).split(",")[1]
            : (base64Data as string)
          const image = Buffer.from(base64Payload, "base64")
          if (image.byteLength > 10 * 1024 * 1024) return
          await fs.promises.writeFile(destPath, image)
        } catch {
          // skip unwritable images
        }
      })
    )

    // Second pass: generate captions in batches for new assets
    let aiFailed = false
    const CHUNK_SIZE = 6
    for (let i = 0; i < imageEntries.length; i += CHUNK_SIZE) {
      const chunk = imageEntries.slice(i, i + CHUNK_SIZE)
      await Promise.all(
        chunk.map(async ([filename, base64Data]) => {
          const uniqueFilename = filename
          const destPath = path.join(assetsDir, uniqueFilename)
          if (!fs.existsSync(destPath)) return

          const base64Payload = (base64Data as string).includes(",")
            ? (base64Data as string).split(",")[1]
            : (base64Data as string)

          let generated = { caption: "", snippet: "" }
          if (existingAssets.includes(uniqueFilename) || aiFailed) {
            // Caption already generated or AI unavailable
          } else {
            let contextWindow = ""
            if (results?.md_content) {
              const idx = results.md_content.indexOf(filename)
              if (idx !== -1) {
                contextWindow = results.md_content.substring(
                  Math.max(0, idx - 800),
                  Math.min(results.md_content.length, idx + 800)
                )
              }
            }
            try {
              generated = await generateCaption(base64Payload, contextWindow)
              if (!generated.caption && !generated.snippet) {
                aiFailed = true
              }
            } catch (err) {
              console.error(`[Ingestion] Failed to generate AI caption for ${uniqueFilename}:`, err)
              generated = { caption: "Extracted Figure", snippet: "" }
              aiFailed = true
            }
          }

          const isTable = tableMap.has(uniqueFilename)
          assets.push({
            id: randomUUID(),
            filename: uniqueFilename,
            url: `/api/workspaces/${workspaceId}/assets/${uniqueFilename}`,
            thumbnailUrl: `/api/workspaces/${workspaceId}/assets/${uniqueFilename}`,
            kind: isTable ? "table" : "figure",
            caption: isTable ? "Table" : (generated.caption || "Figure"),
            snippet: generated.snippet,
            tableRows: isTable ? tableMap.get(uniqueFilename) : undefined,
            page: pageMap.get(uniqueFilename) || 1,
          })
        })
      )
    }
  }

  // Insert assets into Prisma
  if (assets.length > 0) {
    const parsedFileId = typeof fileId === "string" ? fileId : "unknown-file"
    await prisma.$transaction(
      assets.map(a => prisma.asset.create({
        data: {
          ...a,
          tableRows: a.tableRows ? jsonStringify(a.tableRows) : undefined,
          workspaceId,
          fileId: parsedFileId,
          confidence: "high",
        }
      }))
    )
  }

  return NextResponse.json({ assets })
}
