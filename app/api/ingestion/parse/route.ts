import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"
import { jsonStringify } from "@/lib/db-helpers"
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
// Helper
// ---------------------------------------------------------------------------

async function generateCaption(base64Image: string, context: string): Promise<{caption: string, snippet: string}> {
  try {
    const prompt = context
      ? `You are an academic assistant. Here is the text surrounding this image in the document:\n\n<context>\n${context}\n</context>\n\nBased on the text context and the image, please provide:\n1. The exact original caption of the figure or table as it appears in the text.\n2. A concise 1-2 sentence description of what the figure or table shows. Do not start with phrases like "The figure shows" or "This image depicts" — just write the description directly.\n\nRespond EXACTLY with the following XML tags and nothing else:\n<original_caption>...</original_caption>\n<description>...</description>`
      : `You are an academic assistant. Concisely describe this figure or table in 1-2 sentences. Do not start with phrases like "The figure shows" or "This image depicts" — just write the description directly.\n\nRespond EXACTLY with the following XML tags and nothing else:\n<original_caption></original_caption>\n<description>...</description>`

    if (!process.env.AI_API_URL || !process.env.AI_API_KEY) {
      return { caption: "", snippet: "" }
    }

    const response = await fetch(process.env.AI_API_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.AI_VISION_MODEL || process.env.AI_MODEL || "gemini-3-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) return { caption: "", snippet: "" }
    const data = await response.json()
    const rawText = data.choices?.[0]?.message?.content?.trim() ?? ""
    
    // Extract using more forgiving regex
    const captionMatch = rawText.match(/<original_caption>([\s\S]*?)(?:<\/original[^>]*>|<description>|$)/i)
    const descMatch = rawText.match(/<description>([\s\S]*?)(?:<\/description[^>]*>|$)/i)
    
    // Fallback: if it ignored tags completely, just dump everything into snippet
    if (!captionMatch && !descMatch) {
      return { caption: "", snippet: rawText.replace(/<\/?[^>]+(>|$)/g, "").trim() }
    }
    
    let caption = captionMatch ? captionMatch[1].replace(/<\/?[^>]+(>|$)/g, "").trim() : ""
    let snippet = descMatch ? descMatch[1].replace(/<\/?[^>]+(>|$)/g, "").trim() : ""
    
    return { caption, snippet }
  } catch (e) {
    console.error("Vision caption generation failed:", e)
    return { caption: "", snippet: "" }
  }
}

function resolveCaption(img: MinerUImage): string {
  return img.img_caption ?? img.caption ?? ""
}

function resolveKind(img: MinerUImage): "figure" | "table" {
  const cat = (img.category ?? img.type ?? "").toLowerCase()
  if (cat.includes("table")) return "table"
  return "figure"
}

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
  if (fileId && typeof fileId === "string" && results?.md_content) {
    const sourcesDir = path.join(WORKSPACES_DIR, workspaceId, "sources")
    if (!fs.existsSync(sourcesDir)) fs.mkdirSync(sourcesDir, { recursive: true })
    await fs.promises.writeFile(path.join(sourcesDir, `${fileId}.md`), results.md_content)

    // Auto-extract references to BibTeX
    try {
      const refMatch = results.md_content.match(/#+\s*References?\s*\n([\s\S]+)$/i)
      if (refMatch && process.env.AI_API_URL && process.env.AI_API_KEY) {
        const refText = refMatch[1].substring(0, 8000) // Limit size to ~8k chars
        const prompt = `Convert the following references section from a research paper into valid BibTeX format. Make sure to generate cite keys in a standard format (e.g. FirstAuthorYear). Provide ONLY the raw BibTeX output, no markdown wrappers, no explanations.\n\n${refText}`
        const res = await fetch(process.env.AI_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.AI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: process.env.AI_MODEL || "gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }]
          })
        })
        if (res.ok) {
          const data = await res.json()
          let bibtex = data.choices?.[0]?.message?.content || ""
          bibtex = bibtex.replace(/```bibtex/gi, "").replace(/```/g, "").trim()
          if (bibtex.length > 20) {
            const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
            if (workspace) {
              const currentBib = workspace.bibContent || ""
              const oldKeysStr = workspace.bibKeys || "[]"
              const oldKeys = new Set<string>(JSON.parse(oldKeysStr))
              
              const entries = bibtex.split(/(?=@\w+\{)/)
              let deduplicatedBibtex = ""
              let newKeysCount = 0

              for (const entry of entries) {
                if (!entry.trim()) continue
                const match = /@\w+\{([^,]+),/.exec(entry)
                if (match) {
                  const key = match[1].trim()
                  if (!oldKeys.has(key)) {
                    deduplicatedBibtex += entry.trim() + "\n\n"
                    oldKeys.add(key)
                    newKeysCount++
                  }
                } else {
                  deduplicatedBibtex += entry.trim() + "\n\n"
                }
              }

              deduplicatedBibtex = deduplicatedBibtex.trim()
              if (deduplicatedBibtex.length > 0) {
                const newBib = currentBib ? currentBib + "\n\n" + deduplicatedBibtex : deduplicatedBibtex
                await prisma.workspace.update({
                  where: { id: workspaceId },
                  data: {
                    bibContent: newBib,
                    bibKeys: JSON.stringify(Array.from(oldKeys))
                  }
                })
                console.log(`Successfully extracted ${newKeysCount} new BibTeX citations for workspace ${workspaceId}`)
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to auto-extract BibTeX:", err)
    }
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
        const destPath = path.join(assetsDir, filename)
        try {
          const base64Payload = (base64Data as string).includes(",")
            ? (base64Data as string).split(",")[1]
            : (base64Data as string)
          await fs.promises.writeFile(destPath, Buffer.from(base64Payload, "base64"))
        } catch {
          // skip unwritable images
        }
      })
    )

    // Second pass: generate captions in parallel for new assets
    await Promise.all(
      imageEntries.map(async ([filename, base64Data]) => {
        const uniqueFilename = filename
        const destPath = path.join(assetsDir, uniqueFilename)
        // Skip if file failed to write
        if (!fs.existsSync(destPath)) return

        const base64Payload = (base64Data as string).includes(",")
          ? (base64Data as string).split(",")[1]
          : (base64Data as string)

        let generated = { caption: "", snippet: "" }
        if (existingAssets.includes(uniqueFilename)) {
          console.log(`Skipping caption generation for ${uniqueFilename} (already exists).`)
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
          generated = await generateCaption(base64Payload, contextWindow)
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
