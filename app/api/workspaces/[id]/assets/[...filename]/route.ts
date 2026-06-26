import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import mime from "mime"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; filename: string[] }> }
) {
  const { id, filename } = await params
  const filePath = path.join(WORKSPACES_DIR, id, "assets", ...filename)

  // Prevent path traversal
  const resolved = path.resolve(filePath)
  const base = path.resolve(path.join(WORKSPACES_DIR, id, "assets"))
  if (!resolved.startsWith(base)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const buffer = fs.readFileSync(resolved)
  const contentType = mime.getType(resolved) ?? "application/octet-stream"

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  })
}
