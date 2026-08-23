import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { spawn } from "child_process"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ ok: false, log: "Unauthorized" }, { status: 401 })

  const owned = await prisma.workspace.findUnique({ where: { id, userId } })
  if (!owned) return NextResponse.json({ ok: false, log: "Workspace not found or unauthorized" }, { status: 404 })

  const dir = workspaceDir(id)

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
    await fs.promises.mkdir(dir, { recursive: true })
    await fs.promises.writeFile(mainTexPath, tex, "utf-8")
  } catch (err) {
    return NextResponse.json({ ok: false, log: `Failed to write main.tex: ${String(err)}` }, { status: 500 })
  }

  const windowsDir = workspaceDir(id)
  const hasBib = tex.includes("\\bibliography{")

  const bashScript = hasBib
    ? "pdflatex -interaction=nonstopmode -halt-on-error main.tex && (bibtex main || true) && pdflatex -interaction=nonstopmode -halt-on-error main.tex && pdflatex -interaction=nonstopmode -halt-on-error main.tex 2>&1"
    : "pdflatex -interaction=nonstopmode -halt-on-error main.tex 2>&1"

  const wslArgs = [
    "--cd", windowsDir,
    "bash", "-c",
    bashScript
  ]

  let log = ""
  let ok = false

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("wsl", wslArgs, {
        signal: AbortSignal.timeout(60_000),
      })

      child.stdout.on("data", (data) => {
        log += data.toString()
      })

      child.stderr.on("data", (data) => {
        log += data.toString()
      })

      child.on("error", (error) => {
        reject(error)
      })

      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}`))
        } else {
          resolve()
        }
      })
    })

    // pdflatex might fail but wsl bash still exits 0
    ok = !log.includes("Fatal error occurred") && !log.includes("! LaTeX Error:")
  } catch (err: unknown) {
    if (err instanceof Error) {
      log += "\n" + err.message
    } else {
      log += "\n" + String(err)
    }
    ok = false
  }

  return NextResponse.json({ ok, log })
}
