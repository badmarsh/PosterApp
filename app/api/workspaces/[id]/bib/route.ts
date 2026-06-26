import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { parseBibKeys } from "@/lib/bib-parser"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

function bibPath(id: string) {
  return path.join(WORKSPACES_DIR, id, "references.bib")
}

function workspaceExists(id: string) {
  return fs.existsSync(path.join(WORKSPACES_DIR, id))
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!workspaceExists(id)) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  }
  const p = bibPath(id)
  try {
    const bib = fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : ""
    const keys = parseBibKeys(bib)
    return NextResponse.json({ bib, keys })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!workspaceExists(id)) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  }
  try {
    const body = await req.json() as { bib: string }
    if (typeof body.bib !== "string") {
      return NextResponse.json({ error: "bib must be a string" }, { status: 400 })
    }
    fs.writeFileSync(bibPath(id), body.bib, "utf-8")
    const keys = parseBibKeys(body.bib)
    return NextResponse.json({ ok: true, keys })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
