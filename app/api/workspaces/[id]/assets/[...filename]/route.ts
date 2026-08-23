import { NextResponse } from "next/server"
import * as fs from "fs/promises"
import path from "path"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const workspace = await prisma.workspace.findUnique({ where: { id, userId }, select: { id: true } })
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const filePath = path.join(WORKSPACES_DIR, id, "assets", ...filename)

  // Prevent path traversal
  const resolved = path.resolve(filePath)
  const base = path.resolve(path.join(WORKSPACES_DIR, id, "assets"))
  const relativePath = path.relative(base, resolved)
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    await fs.access(resolved)
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const buffer = await fs.readFile(resolved)
const ext = path.extname(resolved).toLowerCase()
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".svg": "image/svg+xml",
  }
  const contentType = map[ext] || "image/png"

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
    },
  })
}
