import fs from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import { requireWorkspaceAccess } from "@/lib/auth"

const ROOT = path.join(process.cwd(), "workspaces")

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await requireWorkspaceAccess(id)
    const file = path.join(ROOT, id, "main.pdf")
    const stat = await fs.stat(file).catch(() => null)
    if (!stat?.isFile()) return NextResponse.json({ error: { code: "PDF_NOT_FOUND", message: "PDF not found — compile first" } }, { status: 404 })
    const range = req.headers.get("range")
    let start = 0
    let end = stat.size - 1
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (!match) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } })
      start = match[1] ? Number(match[1]) : 0
      end = match[2] ? Number(match[2]) : end
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } })
      end = Math.min(end, stat.size - 1)
    }
    const length = end - start + 1
    const handle = await fs.open(file, "r")
    const body = new Uint8Array(length)
    try { await handle.read(body, 0, length, start) } finally { await handle.close() }
    return new Response(body, { status: range ? 206 : 200, headers: {
      "Content-Type": "application/pdf", "Content-Length": String(length), "Accept-Ranges": "bytes", "Content-Range": range ? `bytes ${start}-${end}/${stat.size}` : "", "Cache-Control": "private, no-store",
    } })
  } catch (error) {
    if (error instanceof Response) return error
    return NextResponse.json({ error: { code: "PDF_READ_FAILED", message: "Could not read PDF" } }, { status: 500 })
  }
}
