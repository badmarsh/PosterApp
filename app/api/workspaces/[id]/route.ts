import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

function workspaceDir(id: string) {
  return path.join(WORKSPACES_DIR, id)
}

function projectPath(id: string) {
  return path.join(workspaceDir(id), "project.json")
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const p = projectPath(id)
  if (!fs.existsSync(p)) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  }
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"))
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const p = projectPath(id)
  if (!fs.existsSync(path.dirname(p))) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  }
  try {
    const body = await req.json()
    fs.writeFileSync(p, JSON.stringify(body, null, 2))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const dir = workspaceDir(id)
  if (!fs.existsSync(dir)) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
