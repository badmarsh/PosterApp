import { NextResponse } from "next/server"
import * as fs from "fs/promises"
import { createReadStream } from "fs"
import { Readable } from "stream"
import path from "path"

import { requireWorkspaceAccess } from "@/lib/auth"
import { workspacePath, WORKSPACES_ROOT } from "@/lib/workspace-files"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; filename: string[] }> }
) {
  const { id, filename } = await params
  
  // Validate workspaceId is a safe identifier (UUID or slug) — no path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 })
  }

  try {
    await requireWorkspaceAccess(id)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const filePath = workspacePath(id, "assets", ...filename)

  // Prevent path traversal
  const resolved = path.resolve(filePath)
  const base = path.resolve(path.join(WORKSPACES_ROOT, id, "assets"))
  const relativePath = path.relative(base, resolved)
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let stat
  try {
    stat = await fs.stat(resolved)
    if (!stat.isFile()) return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const ext = path.extname(resolved).toLowerCase()
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  }
  const contentType = map[ext] || "application/octet-stream"

  // C3: Stream file response using ReadableStream to prevent buffering large files in memory
  const nodeStream = createReadStream(resolved)
  const webStream = Readable.toWeb(nodeStream) as ReadableStream

  return new Response(webStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  })
}
