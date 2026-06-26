import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { randomUUID } from "crypto"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")
const MINERU_API_URL = process.env.MINERU_API_URL ?? "http://localhost:8000"

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

  // -- Forward to MinerU ---------------------------------------------------
  const mineruForm = new FormData()
  mineruForm.append("file", uploadedFile, uploadedFile.name)

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
        hint: `Ensure the MinerU sidecar is running at ${MINERU_API_URL}`,
      },
      { status: 503 }
    )
  }

  if (!mineruResponse.ok) {
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

  let mineruData: MinerUResponse
  try {
    mineruData = (await mineruResponse.json()) as MinerUResponse
  } catch {
    return NextResponse.json(
      { error: "Failed to parse MinerU JSON response" },
      { status: 502 }
    )
  }

  // -- Normalise images list -----------------------------------------------
  const rawImages: MinerUImage[] = [
    ...(mineruData.images ?? []),
    ...(mineruData.figures ?? []),
    ...(mineruData.tables ?? []),
  ]

  // -- Copy extracted files into the workspace assets dir ------------------
  const assets: {
    id: string
    filename: string
    url: string
    type: "figure" | "table"
    caption: string
  }[] = []

  for (const img of rawImages) {
    if (!img.path) continue

    const sourcePath = img.path
    const originalFilename = path.basename(sourcePath)
    const ext = path.extname(originalFilename) || ".png"
    const stem = path.basename(originalFilename, ext)
    const uniqueFilename = `${stem}_${randomUUID().slice(0, 8)}${ext}`
    const destPath = path.join(assetsDir, uniqueFilename)

    try {
      if (fs.existsSync(sourcePath)) {
        // MinerU output is accessible on the local filesystem (same machine / WSL mount)
        fs.copyFileSync(sourcePath, destPath)
      } else {
        // Fallback: try to fetch via HTTP if the path looks like a URL
        if (sourcePath.startsWith("http")) {
          const imgResp = await fetch(sourcePath)
          if (imgResp.ok) {
            const buf = Buffer.from(await imgResp.arrayBuffer())
            fs.writeFileSync(destPath, buf)
          } else {
            continue
          }
        } else {
          // Cannot resolve — skip this asset
          continue
        }
      }
    } catch {
      // Skip unreadable assets rather than failing the whole request
      continue
    }

    assets.push({
      id: randomUUID(),
      filename: uniqueFilename,
      url: `/api/workspaces/${workspaceId}/assets/${uniqueFilename}`,
      type: resolveKind(img),
      caption: resolveCaption(img),
    })
  }

  return NextResponse.json({ assets })
}
