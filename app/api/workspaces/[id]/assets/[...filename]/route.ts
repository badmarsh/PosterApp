import { NextResponse } from "next/server"
import * as fs from "fs/promises"
import path from "path"
import mime from "mime"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; filename: string[] }> }
) {
  const { id, filename } = await params
  
  // Validate workspaceId is a safe identifier (UUID or slug) — no path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 })
  }

  const filePath = path.join(WORKSPACES_DIR, id, "assets", ...filename)

  // Prevent path traversal
  const resolved = path.resolve(filePath)
  const base = path.resolve(path.join(WORKSPACES_DIR, id, "assets"))
  if (!resolved.startsWith(base)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    await fs.access(resolved)
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const buffer = await fs.readFile(resolved)
  const contentType = mime.getType(resolved) || "image/png"

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3333",
    },
  })
}
