import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

export async function GET() {
  try {
    if (!fs.existsSync(WORKSPACES_DIR)) {
      return NextResponse.json([])
    }
    const entries = fs.readdirSync(WORKSPACES_DIR, { withFileTypes: true })
    const workspaces = entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const projectPath = path.join(WORKSPACES_DIR, e.name, "project.json")
        if (!fs.existsSync(projectPath)) return null
        try {
          const data = JSON.parse(fs.readFileSync(projectPath, "utf-8"))
          return { id: data.id, name: data.name }
        } catch {
          return null
        }
      })
      .filter(Boolean)
    return NextResponse.json(workspaces)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { id, name } = body
    if (!id || !name) {
      return NextResponse.json({ error: "id and name required" }, { status: 400 })
    }
    const workspaceDir = path.join(WORKSPACES_DIR, id)
    fs.mkdirSync(path.join(workspaceDir, "assets", "unused"), { recursive: true })
    fs.mkdirSync(path.join(workspaceDir, "logos"), { recursive: true })
    const project = {
      id,
      name,
      posterTitle: name,
      authors: "",
      venue: "",
      templateName: "tikzposter / 3-column portrait (a0)",
      cards: [],
    }
    fs.writeFileSync(path.join(workspaceDir, "project.json"), JSON.stringify(project, null, 2))
    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
