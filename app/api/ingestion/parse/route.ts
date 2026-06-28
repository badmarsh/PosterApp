import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")
const MINERU_API_URL = process.env.MINERU_API_URL ?? "http://localhost:8000"
const OLLAMA_API_URL = process.env.OLLAMA_API_URL ?? "http://localhost:11434"
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? "minicpm-v"

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

async function generateCaptionWithOllama(base64Image: string, context: string): Promise<{caption: string, snippet: string}> {
  try {
    const prompt = context
      ? `You are an academic assistant. Here is the text surrounding this image in the document:\n\n<context>\n${context}\n</context>\n\nBased on the text context and the image, please provide:\n1. The exact original caption of the figure or table as it appears in the text.\n2. A concise 1-2 sentence description of what the figure or table shows.\n\nRespond EXACTLY with the following XML tags and nothing else:\n<original_caption>...</original_caption>\n<description>...</description>`
      : `You are an academic assistant. Concisely describe this figure or table in 1-2 sentences.\n\nRespond EXACTLY with the following XML tags and nothing else:\n<original_caption></original_caption>\n<description>...</description>`

    const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_VISION_MODEL,
        prompt: prompt,
        stream: false,
        images: [base64Image]
      })
    })

    if (!response.ok) return { caption: "", snippet: "" }
    const data = await response.json()
    const rawText = data.response?.trim() ?? ""
    
    // Extract using regex
    const captionMatch = rawText.match(/<original_caption>([\s\S]*?)<\/original_caption>/i)
    const descMatch = rawText.match(/<description>([\s\S]*?)<\/description>/i)
    
    // Fallback: if it ignored tags completely, just dump everything into snippet
    if (!captionMatch && !descMatch) {
      return { caption: "", snippet: rawText }
    }
    
    return {
      caption: captionMatch ? captionMatch[1].trim() : "",
      snippet: descMatch ? descMatch[1].trim() : ""
    }
  } catch (e) {
    console.error("Ollama caption generation failed:", e)
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
    return NextResponse.json(
      { error: `Workspace '${workspaceId}' not found` },
      { status: 404 }
    )
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

  let mineruData: { results?: Record<string, { md_content?: string, images?: Record<string, string> }> }
  try {
    mineruData = await mineruResponse.json()
  } catch {
    return NextResponse.json(
      { error: "Failed to parse MinerU JSON response" },
      { status: 502 }
    )
  }

  // -- Parse new MinerU API format ------------------------------------------
  const basename = path.basename(uploadedFile.name, path.extname(uploadedFile.name))
  const results = mineruData.results?.[basename]

  // Save parsed markdown to sources/ directory for RAG
  const fileId = formData.get("fileId")
  if (fileId && typeof fileId === "string" && results?.md_content) {
    const sourcesDir = path.join(WORKSPACES_DIR, workspaceId, "sources")
    if (!fs.existsSync(sourcesDir)) fs.mkdirSync(sourcesDir, { recursive: true })
    await fs.promises.writeFile(path.join(sourcesDir, `${fileId}.md`), results.md_content)
  }

  const assets: {
    id: string
    filename: string
    url: string
    thumbnailUrl: string
    kind: "figure" | "table"
    caption: string
    snippet?: string
    page: number
  }[] = []

  if (results?.images) {
    // Images are returned as a map of filename -> base64
    for (const [filename, base64Data] of Object.entries(results.images)) {
      if (typeof base64Data !== "string") continue

      const originalFilename = filename
      const uniqueFilename = originalFilename
      const destPath = path.join(assetsDir, uniqueFilename)

      let base64Payload = base64Data
      try {
        // base64Data is a data URI like "data:image/jpeg;base64,/9j/4AAQ..."
        // We must strip the prefix before decoding.
        base64Payload = base64Data.includes(",") 
          ? base64Data.split(",")[1] 
          : base64Data
        const buf = Buffer.from(base64Payload, "base64")
        await fs.promises.writeFile(destPath, buf)
      } catch {
        continue
      }
      
      let generated = { caption: "", snippet: "" }
      if (existingAssets.includes(uniqueFilename)) {
        console.log(`Skipping caption generation for ${uniqueFilename} as it already exists.`)
      } else {
        console.log(`Generating caption for ${uniqueFilename}...`)
        
        let contextWindow = ""
        if (results?.md_content) {
          const idx = results.md_content.indexOf(filename)
          if (idx !== -1) {
            // Extract roughly 800 chars before and after for context
            contextWindow = results.md_content.substring(Math.max(0, idx - 800), Math.min(results.md_content.length, idx + 800))
          }
        }

        generated = await generateCaptionWithOllama(base64Payload, contextWindow)
      }

      // Default attributes for images extracted from MinerU base64 map
      assets.push({
        id: randomUUID(),
        filename: uniqueFilename,
        url: `/api/workspaces/${workspaceId}/assets/${uniqueFilename}`,
        thumbnailUrl: `/api/workspaces/${workspaceId}/assets/${uniqueFilename}`,
        kind: "figure",
        caption: generated.caption,
        snippet: generated.snippet,
        page: 1,
      })
    }
  }

  // Insert assets into Prisma
  if (assets.length > 0) {
    const parsedFileId = typeof fileId === "string" ? fileId : "unknown-file"
    await prisma.$transaction(
      assets.map(a => prisma.asset.create({
        data: {
          ...a,
          workspaceId,
          fileId: parsedFileId,
          confidence: "high",
        }
      }))
    )
  }

  return NextResponse.json({ assets })
}
