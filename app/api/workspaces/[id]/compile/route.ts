import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { spawn } from "child_process"
import { requireWorkspaceEditor } from "@/lib/auth"
import { generateFullTemplate } from "@/lib/latex"
import { safeJsonParse } from "@/lib/db-helpers"
import type { Card, Project } from "@/lib/poster-types"

const ROOT = path.join(process.cwd(), "workspaces")
const MAX_LOG = 8_000

function safeLog(value: string) {
  return value.replace(/[A-Za-z]:\\[^\s]+/g, "[path]").replace(/\/[^\s]+/g, "[path]").slice(-MAX_LOG)
}

function asProject(workspace: any): Project {
  const outputs = workspace.outputs.map((output: any) => ({
    ...output,
    cards: output.cards.map((card: any): Card => ({
      ...card,
      table: card.table ?? { hasHeader: true, caption: "", rows: [] },
      figures: card.figures ?? [],
      sourceIds: card.sourceIds ?? [],
    })),
  }))
  const active = outputs.find((output: any) => output.isActive) ?? outputs[0]
  return {
    id: workspace.id, revision: workspace.revision, name: workspace.name, authors: workspace.authors, venue: workspace.venue,
    outputs, activeOutputId: active?.id ?? "", assets: workspace.assets.map((asset: any) => ({ ...asset, tableRows: asset.tableRows ?? undefined })), ingestFiles: [],
  }
}

async function run(command: string, args: string[], cwd: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, signal: AbortSignal.timeout(60_000) })
    let log = ""
    child.stdout.on("data", (data) => { log = (log + data.toString()).slice(-MAX_LOG * 2) })
    child.stderr.on("data", (data) => { log = (log + data.toString()).slice(-MAX_LOG * 2) })
    child.on("error", reject)
    child.on("close", (code) => code === 0 ? resolve(log) : reject(new Error(safeLog(log || `Compiler exited with ${code}`))) )
  })
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let stage = ""
  try {
    const { workspace } = await requireWorkspaceEditor(id)
    const full = await (await import("@/lib/prisma")).prisma.workspace.findUnique({ where: { id }, include: { outputs: { include: { cards: true } }, assets: true } })
    if (!full) return NextResponse.json({ error: { code: "WORKSPACE_NOT_FOUND", message: "Workspace not found" } }, { status: 404 })
    const project = asProject(full)
    const output = project.outputs.find((item) => item.id === project.activeOutputId)
    if (!output) return NextResponse.json({ error: { code: "NO_OUTPUT", message: "No output is selected" } }, { status: 400 })
    const tex = generateFullTemplate(project, output, id)

    stage = await fs.mkdtemp(path.join(os.tmpdir(), `posterapp-${id}-`))
    await fs.writeFile(path.join(stage, "main.tex"), tex, "utf8")
    const assets = path.join(ROOT, id, "assets")
    await fs.cp(assets, path.join(stage, "assets"), { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)

    let log = ""
    const image = process.env.LATEX_COMPILER_IMAGE
    
    const runCompiler = async () => {
      if (image) {
        // Production worker: an isolated container with no network and only this job's staging directory mounted.
        return await run("docker", ["run", "--rm", "--network", "none", "--cpus", "1", "--memory", "512m", "--pids-limit", "64", "--security-opt", "no-new-privileges", "-v", `${stage}:/work`, "-w", "/work", image, "pdflatex", "-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], stage)
      } else if (process.env.NODE_ENV !== "production") {
        // Development-only WSL fallback; production must configure LATEX_COMPILER_IMAGE.
        return await run("wsl", ["--cd", stage, "bash", "-lc", "ulimit -t 55 -v 524288 -f 20480 -u 64; exec pdflatex -no-shell-escape -interaction=nonstopmode -halt-on-error main.tex"], stage)
      } else {
        throw new Error("COMPILER_UNAVAILABLE")
      }
    }

    try {
      log = await runCompiler()
    } catch (initialError: any) {
      if (!process.env.AI_API_URL || !process.env.AI_API_KEY) throw initialError
      
      const errorLog = initialError instanceof Error ? initialError.message : String(initialError)
      if (errorLog.includes("COMPILER_UNAVAILABLE")) {
        return NextResponse.json({ error: { code: "COMPILER_UNAVAILABLE", message: "The production compiler worker is not configured" } }, { status: 503 })
      }
      
      console.log("[compile] Compilation failed, attempting AI recovery...")
      
      const modelToUse = process.env.AI_REVIEW_MODEL || process.env.AI_MODEL || "gemini-3-flash"
      const systemPrompt = "You are a LaTeX expert. The user's pdflatex compilation failed. Fix the following compilation error. Return ONLY the fully corrected raw LaTeX document."
      const userPrompt = `=== COMPILER ERROR LOG ===\n${errorLog}\n\n=== ORIGINAL LATEX ===\n${tex}\n\nPlease fix the LaTeX errors and return the entire document. Do not include any explanations.`
      
      const response = await fetch(process.env.AI_API_URL as string, {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.1,
        })
      })

      if (!response.ok) throw initialError
      const data = await response.json()
      let fixedTex = data.choices?.[0]?.message?.content || ""
      if (!fixedTex) throw initialError
      
      fixedTex = fixedTex.replace(/^```(?:latex|tex)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "").trim()
      await fs.writeFile(path.join(stage, "main.tex"), fixedTex, "utf8")
      
      try {
        const recoveryLog = await runCompiler()
        log = errorLog + "\n\n--- AI AUTO-RECOVERY SUCCESSFUL ---\n\n" + recoveryLog
      } catch (recoveryError: any) {
        throw new Error(errorLog + "\n\n--- AI AUTO-RECOVERY FAILED ---\n\n" + (recoveryError instanceof Error ? recoveryError.message : String(recoveryError)))
      }
    }

    const compiled = path.join(stage, "main.pdf")
    const targetDir = path.join(ROOT, id)
    await fs.mkdir(targetDir, { recursive: true })
    await fs.rename(compiled, path.join(targetDir, `main.${Date.now()}.pdf`))
    const candidates = await fs.readdir(targetDir)
    const produced = candidates.filter((name) => /^main\.\d+\.pdf$/.test(name)).sort().at(-1)
    if (!produced) throw new Error("Compiler produced no PDF")
    await fs.rename(path.join(targetDir, produced), path.join(targetDir, "main.pdf"))
    return NextResponse.json({ ok: true, log: safeLog(log) })
  } catch (error) {
    if (error instanceof Response) return error
    console.error("[compile] failed", error instanceof Error ? error.name : "unknown")
    return NextResponse.json({ ok: false, error: { code: "COMPILE_FAILED", message: "Compilation failed" }, log: safeLog(error instanceof Error ? error.message : "Compiler failed") }, { status: 422 })
  } finally {
    if (stage) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined)
  }
}
