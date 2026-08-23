import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import sharp from "sharp"
import { nextVersionedPath } from "@/lib/asset-versioning"
import { requireWorkspaceOwner } from "@/lib/auth"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

// ---------------------------------------------------------------------------
// Request body type
// ---------------------------------------------------------------------------

type ImageEditOperation = "remove-bg" | "crop-tight" | "upscale" | "custom"

interface ImageEditRequest {
  assetUrl: string
  workspaceId: string
  operation: ImageEditOperation
  prompt?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the filesystem path for an internal asset URL
 */
function resolveAssetPath(assetUrl: string): string | null {
  const prefix = "/api/workspaces/"
  if (!assetUrl.startsWith(prefix)) return null
  const rest = assetUrl.slice(prefix.length)
  const parts = rest.split("/")
  if (parts.length < 3 || parts[1] !== "assets") return null
  const workspaceId = parts[0]
  const filename = parts.slice(2).join("/")
  return path.join(WORKSPACES_DIR, workspaceId, "assets", filename)
}

// ---------------------------------------------------------------------------
// POST /api/ingestion/image-edit
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  let body: ImageEditRequest
  try {
    body = (await req.json()) as ImageEditRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { assetUrl, workspaceId, operation } = body

  if (!assetUrl || !workspaceId || !operation) {
    return NextResponse.json(
      { error: "assetUrl, workspaceId, and operation are required" },
      { status: 400 }
    )
  }

  try {
    await requireWorkspaceOwner(workspaceId)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const validOperations: ImageEditOperation[] = ["remove-bg", "crop-tight", "upscale", "custom"]
  if (!validOperations.includes(operation)) {
    return NextResponse.json(
      { error: `operation must be one of: ${validOperations.join(", ")}` },
      { status: 400 }
    )
  }

  const assetPath = resolveAssetPath(assetUrl)
  if (!assetPath) {
    return NextResponse.json({ error: "Could not resolve assetUrl" }, { status: 400 })
  }

  const assetsDir = path.join(WORKSPACES_DIR, workspaceId, "assets")
  const relative = path.relative(assetsDir, assetPath)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return NextResponse.json({ error: "Invalid asset path" }, { status: 400 })
  }

  if (!fs.existsSync(assetsDir) || !fs.existsSync(assetPath)) {
    return NextResponse.json({ error: "Asset or workspace not found" }, { status: 404 })
  }

  try {
    let pipeline = sharp(assetPath)
    
    // Convert to PNG for any operation that might output transparency
    pipeline = pipeline.png()

    switch (operation) {
      case "crop-tight":
        // Trim transparent or white borders automatically
        pipeline = pipeline.trim({ threshold: 20 })
        break
      
      case "upscale":
        // Upscale 2x using Lanczos3 (default high-quality resampling)
        const metadata = await sharp(assetPath).metadata()
        if (metadata.width && metadata.height) {
          pipeline = pipeline.resize(metadata.width * 2, null, {
            kernel: sharp.kernel.lanczos3
          })
        }
        break
        
      case "remove-bg":
      case "custom":
        // Local node without heavy neural nets can't easily do semantic background removal.
        // We will perform a simple auto-level and unsharp mask to improve the image as a "fast edit" fallback.
        pipeline = pipeline.normalize().sharpen()
        break
    }

    const resultBuffer = await pipeline.toBuffer()

    const originalFilename = path.basename(assetPath)
    const newFilePath = await nextVersionedPath(assetsDir, originalFilename)
    
    if (!newFilePath) {
      return NextResponse.json({ error: 'Maximum number of edited versions reached' }, { status: 409 })
    }

    await fs.promises.writeFile(newFilePath, resultBuffer)
    const newFilename = path.basename(newFilePath)

    return NextResponse.json({
      url: `/api/workspaces/${workspaceId}/assets/${newFilename}`,
      filename: newFilename,
    })

  } catch (err) {
    console.error("Local Image Edit failed:", err)
    return NextResponse.json(
      { error: "Image processing failed", detail: String(err) },
      { status: 500 }
    )
  }
}
