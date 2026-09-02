import { NextResponse } from "next/server"
import * as fs from "fs/promises"
import path from "path"
import { requireWorkspaceEditor } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"
import { rateLimitAsync } from "@/lib/rate-limit"
import { detectedImageMime, MAX_UPLOAD_BYTES, SAFE_FILENAME, workspacePath } from "@/lib/workspace-files"
import { WORKSPACES_ROOT } from "@/lib/workspace-files"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 })
  }

  // A5: Reject early if size info is absent — prevents streaming bypass of size limit
  const contentLengthHeader = req.headers.get("content-length")
  const transferEncoding = req.headers.get("transfer-encoding") ?? ""
  const contentLength = Number(contentLengthHeader)
  if (!contentLengthHeader || !Number.isFinite(contentLength) || contentLength <= 0) {
    return NextResponse.json(
      { error: "Content-Length header is required for uploads" },
      { status: 411 }
    )
  }
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB upload limit` },
      { status: 413 }
    )
  }

  try {
    const { userId } = await requireWorkspaceEditor(id)

    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:upload`, 10, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many upload requests", retryAfterMs },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    
    if (!file || file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    if (!SAFE_FILENAME.test(safeName)) return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
    const filename = `${Date.now()}_${safeName}`
    const destDir = workspacePath(id, "assets")

    await fs.mkdir(destDir, { recursive: true })
    
    const destPath = path.join(destDir, filename)
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const mime = detectedImageMime(bytes)
    if (!mime || !["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"].includes(mime)) return NextResponse.json({ error: "Unsupported or invalid file format" }, { status: 415 })
    await fs.writeFile(destPath, bytes)

    const url = `/api/workspaces/${id}/assets/${filename}`

    // Optionally create an Asset record in the database
    const asset = await prisma.asset.create({
      data: {
        id: randomUUID(),
        workspaceId: id,
        fileId: "manual-upload",
        filename,
        url,
        thumbnailUrl: url,
        kind: "figure",
        page: 1,
        confidence: "high",
      }
    })

    return NextResponse.json({ ok: true, asset })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("Asset upload error:", err)
    return NextResponse.json({ error: "Failed to upload asset" }, { status: 500 })
  }
}
