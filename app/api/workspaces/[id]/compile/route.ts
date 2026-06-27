import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { execSync } from "child_process"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

function workspaceDir(id: string) {
  return path.join(WORKSPACES_DIR, id)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Validate id to prevent path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ ok: false, log: "Invalid workspace id" }, { status: 400 })
  }

  const dir = workspaceDir(id)
  if (!fs.existsSync(dir)) {
    return NextResponse.json({ ok: false, log: "Workspace not found" }, { status: 404 })
  }

  let tex: string
  try {
    const body = await req.json()
    if (typeof body.tex !== "string") {
      return NextResponse.json({ ok: false, log: "Missing tex string in body" }, { status: 400 })
    }
    tex = body.tex
  } catch {
    return NextResponse.json({ ok: false, log: "Invalid JSON body" }, { status: 400 })
  }

  // Write the LaTeX source
  const mainTexPath = path.join(dir, "main.tex")
  try {
    fs.writeFileSync(mainTexPath, tex, "utf-8")
  } catch (err) {
    return NextResponse.json({ ok: false, log: `Failed to write main.tex: ${String(err)}` }, { status: 500 })
  }

  // Build the WSL command — escape the workspace id for shell safety
  const escapedId = id.replace(/'/g, "'\\''")
  const baseCmd = `cd /mnt/c/Users/marek/Documents/Robco\\ PhD/PosterApp/workspaces/${escapedId}`
  
  const hasBib = tex.includes("\\bibliography{")

  let wslCmd = ""
  if (hasBib) {
    wslCmd = `wsl bash -c "${baseCmd} && pdflatex -interaction=nonstopmode -halt-on-error main.tex && (bibtex main || true) && pdflatex -interaction=nonstopmode -halt-on-error main.tex && pdflatex -interaction=nonstopmode -halt-on-error main.tex 2>&1"`
  } else {
    wslCmd = `wsl bash -c "${baseCmd} && pdflatex -interaction=nonstopmode -halt-on-error main.tex 2>&1"`
  }

  let log = ""
  let ok = false

  try {
    const output = execSync(wslCmd, {
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    log = output.toString("utf-8")
    // pdflatex might fail but wsl bash still exits 0
    ok = !log.includes("Fatal error occurred") && !log.includes("! LaTeX Error:")
  } catch (err: unknown) {
    // execSync throws when exit code is non-zero; the stderr/stdout is on err.stdout
    if (
      err &&
      typeof err === "object" &&
      "stdout" in err &&
      err.stdout instanceof Buffer
    ) {
      log = err.stdout.toString("utf-8")
    } else {
      log = String(err)
    }
    ok = false
  }

  return NextResponse.json({ ok, log })
}
