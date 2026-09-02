import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { generateFullTemplate } from "@/lib/latex"
import { resolveBibSource } from "@/lib/latex/bib-source"
import { materializeRemoteFigures, rewriteTexRemoteUrls } from "@/lib/latex/remote-assets"
import { WORKSPACES_ROOT, workspacePath } from "@/lib/workspace-files"
import { safeLog, runSandboxedLatex } from "@/lib/latex/compiler-runner"
import { safeApiError } from "@/lib/security"
import type { Card, Project } from "@/lib/poster-types"

/** Per-workspace mutex to guarantee serial, atomic PDF installation (B3) */
const workspaceCompileLocks = new Map<string, Promise<void>>()

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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let stage = ""
  try {
    const url = new URL(req.url)
    const expectedRevision = url.searchParams.get("revision")

    const { workspace, userId } = await requireWorkspaceEditor(id)

    const { allowed, retryAfterMs } = await rateLimitAsync(
      `${userId}:${id}:compile`,
      10,
      60_000
    )
    if (!allowed) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: `Too many compilations — try again in ${Math.ceil(retryAfterMs / 1000)}s` } },
        { status: 429 }
      )
    }

    if (expectedRevision && workspace.revision !== parseInt(expectedRevision, 10)) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "Workspace modified concurrently" } }, { status: 409 })
    }

    const full = await (await import("@/lib/prisma")).prisma.workspace.findUnique({ where: { id }, include: { outputs: { include: { cards: true } }, assets: true } })
    if (!full) return NextResponse.json({ error: { code: "WORKSPACE_NOT_FOUND", message: "Workspace not found" } }, { status: 404 })

    const project = asProject(full)
    const output = project.outputs.find((item) => item.id === project.activeOutputId)
    if (!output) return NextResponse.json({ error: { code: "NO_OUTPUT", message: "No output is selected" } }, { status: 400 })

    let tex = generateFullTemplate(project, output, id)

    stage = await fs.mkdtemp(path.join(os.tmpdir(), `posterapp-${id}-`))

    // pdflatex cannot fetch http(s) URLs — download remote figures into the
    // stage and rewrite the .tex to reference local files (B6 remote-assets)
    const remoteMapping = await materializeRemoteFigures(project, stage)
    tex = rewriteTexRemoteUrls(tex, remoteMapping)

    await fs.writeFile(path.join(stage, "main.tex"), tex, "utf8")

    // Shared bib source resolution (B4)
    const bibContent = resolveBibSource(workspace, output.cards)
    if (bibContent.trim()) {
      await fs.writeFile(path.join(stage, "references.bib"), bibContent, "utf8")
    }
    const assets = path.join(WORKSPACES_ROOT, id, "assets")
    await fs.cp(assets, path.join(stage, "assets"), { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)
    const stylesDir = path.join(process.cwd(), "public", "latex-styles")
    await fs.cp(stylesDir, stage, { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)
    const workspaceStyles = path.join(WORKSPACES_ROOT, id)
    // Also copy any workspace root .sty or .cls files if present
    const wsFiles = await fs.readdir(workspaceStyles).catch(() => [] as string[])
    for (const f of wsFiles) {
      if (f.endsWith(".sty") || f.endsWith(".cls") || f.endsWith(".bst")) {
        await fs.copyFile(path.join(workspaceStyles, f), path.join(stage, f)).catch(() => undefined)
      }
    }
    const defaultLogos = path.join(process.cwd(), "public", "logos")
    await fs.cp(defaultLogos, path.join(stage, "logos"), { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)
    const workspaceLogos = path.join(WORKSPACES_ROOT, id, "logos")
    await fs.cp(workspaceLogos, path.join(stage, "logos"), { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)

    let log = ""
    const image = process.env.LATEX_COMPILER_IMAGE
    const hasCitations = tex.includes("\\cite") || tex.includes("\\bibliography") || tex.includes("\\addbibresource")
    const hasBibContent = Boolean(bibContent.trim())
    const needsBibtex = hasCitations && hasBibContent

    const runCompiler = async () => {
      const buildCmd = needsBibtex
        ? "pdflatex -shell-restricted -interaction=nonstopmode main.tex && (bibtex main || true) && pdflatex -shell-restricted -interaction=nonstopmode main.tex && pdflatex -shell-restricted -interaction=nonstopmode -halt-on-error main.tex"
        : "pdflatex -shell-restricted -interaction=nonstopmode -halt-on-error main.tex"

      return await runSandboxedLatex({ stage, buildCmd, timeoutMs: 60_000, image })
    }

    try {
      log = await runCompiler()
    } catch (initialError: any) {
      const errorLog = initialError instanceof Error ? initialError.message : String(initialError)
      if (errorLog.includes("COMPILER_UNAVAILABLE")) {
        return NextResponse.json({ error: { code: "COMPILER_UNAVAILABLE", message: "The production compiler worker is not configured" } }, { status: 503 })
      }

      throw new Error(errorLog)
    }

    const compiled = path.join(stage, "main.pdf")
    const targetDir = workspacePath(id)
    await fs.mkdir(targetDir, { recursive: true })

    // B3: Per-workspace mutex lock for atomic PDF install
    const compileTimestamp = Date.now()
    let releaseLock: () => void = () => {}
    const prevLock = workspaceCompileLocks.get(id) || Promise.resolve()
    const currentLock = new Promise<void>((resolve) => { releaseLock = resolve })
    workspaceCompileLocks.set(id, prevLock.then(() => currentLock))

    await prevLock
    try {
      const targetPdf = path.join(targetDir, "main.pdf")
      const tempInstallPdf = path.join(targetDir, `main.${compileTimestamp}.tmp.pdf`)
      await fs.copyFile(compiled, tempInstallPdf)
      await fs.rename(tempInstallPdf, targetPdf)
    } finally {
      releaseLock()
      if (workspaceCompileLocks.get(id) === currentLock) {
        workspaceCompileLocks.delete(id)
      }
    }

    return NextResponse.json({ ok: true, revision: workspace.revision, log: safeLog(log) })
  } catch (error) {
    if (error instanceof Response) return error
    console.error("[compile] failed", error instanceof Error ? error.name : "unknown")
    return NextResponse.json({ ok: false, error: { code: "COMPILE_FAILED", message: "Compilation failed" }, log: safeLog(error instanceof Error ? error.message : "Compiler failed") }, { status: 422 })
  } finally {
    if (stage) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined)
  }
}