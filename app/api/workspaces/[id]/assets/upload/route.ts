import { NextResponse } from "next/server"
import * as fs from "fs/promises"
import path from "path"
import { requireWorkspaceEditor } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"
import { detectedImageMime, MAX_UPLOAD_BYTES, SAFE_FILENAME, workspacePath } from "@/lib/workspace-files"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 })
  }

  try {
    await requireWorkspaceEditor(id)

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
