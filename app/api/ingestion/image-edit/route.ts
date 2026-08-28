import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import sharp from "sharp"
import { atomicCreateVersionedFile } from "@/lib/asset-versioning"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

type ImageEditOperation = "remove-bg" | "crop-tight" | "upscale" | "custom" | "discard" | "accept"

interface ImageEditRequest {
  assetUrl: string
  workspaceId: string
  operation: ImageEditOperation
  prompt?: string
  originalFilename?: string
}

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

  let userId: string;
  try {
    const access = await requireWorkspaceEditor(workspaceId);
    userId = access.userId;
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfterMs } = rateLimit(`${userId}:image-edit`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429, headers: { 'Retry-After': Math.ceil(retryAfterMs / 1000).toString() } })
  }

  const validOperations: ImageEditOperation[] = ["remove-bg", "crop-tight", "upscale", "custom", "discard", "accept"]
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

  if (assetPath.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "PDF assets cannot be image-edited directly." }, { status: 400 })
  }

  if (operation === "discard") {
    if (assetPath.includes("draft-")) {
      await fs.promises.unlink(assetPath).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  if (operation === "accept") {
    if (!assetPath.includes("draft-")) {
      return NextResponse.json({ error: "Not a draft asset" }, { status: 400 })
    }
    const originalName = body.originalFilename || path.basename(assetPath).replace(/draft-\d+-[a-z0-9]+-/, "") || "image.png"
    const newFilePath = await atomicCreateVersionedFile(assetsDir, originalName, ".png")
    if (!newFilePath) return NextResponse.json({ error: 'Maximum number of edited versions reached' }, { status: 409 })
    
    await fs.promises.copyFile(assetPath, newFilePath)
    await fs.promises.unlink(assetPath).catch(() => {})
    
    const newFilename = path.basename(newFilePath)
    return NextResponse.json({
      url: `/api/workspaces/${workspaceId}/assets/${newFilename}`,
      filename: newFilename,
    })
  }

  if (operation === "remove-bg" || operation === "custom") {
    // Note: To support true semantic AI edits, integrate with a Vision provider (e.g. OpenAI DALL-E or OpenRouter) here.
    return NextResponse.json(
      { error: "Semantic image edits are not supported without a configured AI vision/generation provider." },
      { status: 501 }
    )
  }

  try {
    let pipeline = sharp(assetPath)
    
    // Always convert output to PNG for consistency and alpha channel support
    pipeline = pipeline.png()

    switch (operation) {
      case "crop-tight":
        pipeline = pipeline.trim({ threshold: 20 })
        break
      
      case "upscale":
        const metadata = await sharp(assetPath).metadata()
        if (metadata.width && metadata.height) {
          pipeline = pipeline.resize(metadata.width * 2, null, {
            kernel: sharp.kernel.lanczos3
          })
        }
        break
    }

    const resultBuffer = await pipeline.toBuffer()

    const originalFilename = path.basename(assetPath)
    const draftName = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}-${originalFilename}`
    const draftPath = path.join(assetsDir, draftName)
    
    await fs.promises.writeFile(draftPath, resultBuffer)

    return NextResponse.json({
      url: `/api/workspaces/${workspaceId}/assets/${draftName}`,
      filename: draftName,
    })

  } catch (err) {
    console.error("Local Image Edit failed:", err)
    return NextResponse.json(
      { error: "Image processing failed", detail: String(err) },
      { status: 500 }
    )
  }
}
