import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import os from "os"
import { prisma } from "@/lib/prisma"
import { generateFullTemplate } from "@/lib/latex"
import { resolveBibSource } from "@/lib/latex/bib-source"
import { materializePublicFigures, materializeRemoteFigures, rewriteTexRemoteUrls } from "@/lib/latex/remote-assets"
import { WORKSPACES_ROOT, workspacePath } from "@/lib/workspace-files"
import { safeLog, runSandboxedLatex } from "@/lib/latex/compiler-runner"
import type { Card, Project } from "@/lib/poster-types"
import { sampleProjects } from "@/lib/mock-data"

/** Per-workspace mutex to guarantee serial, atomic PDF installation (B3) */
const workspaceCompileLocks = new Map<string, Promise<void>>()

function asProject(workspace: any): Project {
  const outputs = workspace.outputs.map((output: any) => ({
    ...output,
    cards: output.cards.map((card: any): Card => ({
      ...card,
      table: (() => { const v = card.table; if (Array.isArray(v) || (v && typeof v === "object")) return v; if (typeof v === "string") { try { return JSON.parse(v) } catch {} } return { hasHeader: true, caption: "", rows: [] } })(),
      figures: (() => { const v = card.figures; if (Array.isArray(v)) return v; if (typeof v === "string") { try { return JSON.parse(v) } catch {} } return [] })(),
      sourceIds: (() => { const v = card.sourceIds; if (Array.isArray(v)) return v; if (typeof v === "string") { try { return JSON.parse(v) } catch {} } return [] })(),
    })),
  }))
  const active = outputs.find((output: any) => output.isActive) ?? outputs[0]
  return {
    id: workspace.id,
    revision: workspace.revision,
    name: workspace.name,
    authors: workspace.authors,
    venue: workspace.venue,
    outputs,
    activeOutputId: active?.id ?? "",
    assets: workspace.assets.map((asset: any) => ({ ...asset, tableRows: asset.tableRows ?? undefined })),
    ingestFiles: [],
  }
}

export interface CompileWorkspaceOptions {
  cards?: Card[]
  output?: any
  expectedRevision?: number
  installPdf?: boolean
  timeoutMs?: number
  forceRecompile?: boolean
}

export interface CompileWorkspaceResult {
  ok: boolean
  cached?: boolean
  log: string
  revision?: number
  error?: {
    code: string
    message: string
    details?: string
  }
}

/**
 * Server-only helper to compile a workspace's active output to LaTeX/PDF.
 * Reused across the compile HTTP route and the DeerFlow autonomous fix runner.
 */
function computeCardsHash(cards: Card[]): string {
  const normalized = cards.map((c) => ({
    id: c.id,
    title: c.title || "",
    column: c.column,
    order: c.order,
    pattern: c.pattern,
    content: c.content || "",
  }))
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex")
}

export async function compileWorkspace(
  workspaceId: string,
  options: CompileWorkspaceOptions = {}
): Promise<CompileWorkspaceResult> {
  const { expectedRevision, installPdf = true, timeoutMs = 60_000, cards: overrideCards, output: overrideOutput } = options
  let stage = ""

  try {
    let project: Project
    const full = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        outputs: { include: { cards: true } },
        assets: true,
      },
    })

    if (!full) {
      const mock = sampleProjects.find((p) => p.id === workspaceId)
      if (mock) {
        project = JSON.parse(JSON.stringify(mock))
      } else {
        return {
          ok: false,
          log: "",
          error: { code: "WORKSPACE_NOT_FOUND", message: "Workspace not found" },
        }
      }
    } else {
      project = asProject(full)
    }

    if (expectedRevision !== undefined && full != null && full.revision !== expectedRevision) {
      return {
        ok: false,
        log: "",
        revision: full?.revision ?? project.revision,
        error: { code: "CONFLICT", message: "Workspace modified concurrently" },
      }
    }

    // When client specifies an output id (e.g. user switched to slides/paper), compile that output.
    const targetOutputId = overrideOutput?.id ?? project.activeOutputId
    const output = project.outputs.find((item) => item.id === targetOutputId) ?? project.outputs.find((item) => item.id === project.activeOutputId)
    if (!output) {
      return {
        ok: false,
        log: "",
        error: { code: "NO_OUTPUT", message: "No output is selected" },
      }
    }

    if (overrideOutput) {
      Object.assign(output, overrideOutput)
    }
    if (overrideCards && Array.isArray(overrideCards)) {
      output.cards = overrideCards
    }

    const currentCards = output.cards || []
    const currentCardsHash = computeCardsHash(currentCards)

    const targetDir = workspacePath(workspaceId)
    const targetPdf = path.join(targetDir, "main.pdf")
    const cacheMetaPath = path.join(targetDir, "compile-cache.json")

    // Cache check: if the compiled PDF already exists for the exact revision and output configuration, reuse it
    if (!options.forceRecompile) {
      try {
        const metaRaw = await fs.readFile(cacheMetaPath, "utf8")
        const meta = JSON.parse(metaRaw)
        if (
          meta.revision === (full?.revision ?? project.revision) &&
          meta.outputId === output.id &&
          meta.cardCount === currentCards.length &&
          meta.cardsHash === currentCardsHash &&
          meta.templateId === output.templateId &&
          meta.themeColor === (output.themeColor ?? "")
        ) {
          const pdfStat = await fs.stat(targetPdf)
          if (pdfStat.size > 0) {
            return {
              ok: true,
              cached: true,
              revision: full?.revision ?? project.revision,
              log: meta.log || "Using cached compilation (workspace unchanged).",
            }
          }
        }
      } catch {
        // Cache miss, proceed to compilation
      }
    }

    let tex = generateFullTemplate(project, output, workspaceId)
    stage = await fs.mkdtemp(path.join(os.tmpdir(), `posterapp-${workspaceId}-`))

    // Materialize remote figures (and figures shipped inside `public/`) so the
    // generated .tex only references files that exist in the staging directory.
    const remoteMapping = await materializeRemoteFigures(project, stage)
    tex = rewriteTexRemoteUrls(tex, remoteMapping)
    const publicMapping = await materializePublicFigures(project, stage)
    tex = rewriteTexRemoteUrls(tex, publicMapping)

    await fs.writeFile(path.join(stage, "main.tex"), tex, "utf8")

    // Bib source resolution
    const bibContent = resolveBibSource(full || { bibContent: (project as any).bibContent }, output.cards)
    if (bibContent.trim()) {
      await fs.writeFile(path.join(stage, "references.bib"), bibContent, "utf8")
    }

    // Copy assets, styles, logos
    const assets = path.join(WORKSPACES_ROOT, workspaceId, "assets")
    await fs.cp(assets, path.join(stage, "assets"), { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)

    const stylesDir = path.join(process.cwd(), "public", "latex-styles")
    await fs.cp(stylesDir, stage, { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)

    const workspaceStyles = path.join(WORKSPACES_ROOT, workspaceId)
    const wsFiles = await fs.readdir(workspaceStyles).catch(() => [] as string[])
    for (const f of wsFiles) {
      if (f.endsWith(".sty") || f.endsWith(".cls") || f.endsWith(".bst")) {
        await fs.copyFile(path.join(workspaceStyles, f), path.join(stage, f)).catch(() => undefined)
      }
    }

    const defaultLogos = path.join(process.cwd(), "public", "logos")
    await fs.cp(defaultLogos, path.join(stage, "logos"), { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)

    const workspaceLogos = path.join(WORKSPACES_ROOT, workspaceId, "logos")
    await fs.cp(workspaceLogos, path.join(stage, "logos"), { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)

    let log = ""
    const image = process.env.LATEX_COMPILER_IMAGE
    const hasCitations = tex.includes("\\cite") || tex.includes("\\bibliography") || tex.includes("\\addbibresource")
    const hasBibContent = Boolean(bibContent.trim())
    const needsBibtex = hasCitations && hasBibContent

    const buildCmd = needsBibtex
      ? "pdflatex -shell-restricted -interaction=nonstopmode main.tex && (bibtex main || true) && pdflatex -shell-restricted -interaction=nonstopmode main.tex && pdflatex -shell-restricted -interaction=nonstopmode -halt-on-error main.tex"
      : "pdflatex -shell-restricted -interaction=nonstopmode -halt-on-error main.tex"

    try {
      log = await runSandboxedLatex({ stage, buildCmd, timeoutMs, image })
    } catch (initialError: any) {
      const errorLog = initialError instanceof Error ? initialError.message : String(initialError)
      if (errorLog.includes("COMPILER_UNAVAILABLE")) {
        return {
          ok: false,
          log: safeLog(errorLog),
          revision: full?.revision ?? project.revision,
          error: {
            code: "COMPILER_UNAVAILABLE",
            message: "The LaTeX compiler is not available. Please ensure TeX Live (pdflatex) is installed or LATEX_COMPILER_IMAGE is configured.",
            details: safeLog(errorLog),
          },
        }
      }
      return {
        ok: false,
        log: safeLog(errorLog),
        revision: full?.revision ?? project.revision,
        error: {
          code: "COMPILE_FAILED",
          message: "Compilation failed",
          details: safeLog(errorLog),
        },
      }
    }

    // Install compiled PDF if requested
    if (installPdf) {
      const compiled = path.join(stage, "main.pdf")
      const targetDir = workspacePath(workspaceId)
      await fs.mkdir(targetDir, { recursive: true })

      const compileTimestamp = Date.now()
      let releaseLock: () => void = () => {}
      const prevLock = workspaceCompileLocks.get(workspaceId) || Promise.resolve()
      const currentLock = new Promise<void>((resolve) => { releaseLock = resolve })
      workspaceCompileLocks.set(workspaceId, prevLock.then(() => currentLock))

      await prevLock
      try {
        const targetPdf = path.join(targetDir, "main.pdf")
        const tempInstallPdf = path.join(targetDir, `main.${compileTimestamp}.tmp.pdf`)
        await fs.copyFile(compiled, tempInstallPdf)
        await fs.rename(tempInstallPdf, targetPdf)

        // Save compilation cache metadata
        await fs.writeFile(
          cacheMetaPath,
          JSON.stringify({
            revision: full?.revision ?? project.revision,
            outputId: output.id,
            cardCount: currentCards.length,
            cardsHash: currentCardsHash,
            templateId: output.templateId,
            themeColor: output.themeColor ?? "",
            timestamp: compileTimestamp,
            log: safeLog(log),
          }),
          "utf8"
        ).catch(() => undefined)
      } finally {
        releaseLock()
        if (workspaceCompileLocks.get(workspaceId) === currentLock) {
          workspaceCompileLocks.delete(workspaceId)
        }
      }
    }

    return {
      ok: true,
      revision: full?.revision ?? project.revision,
      log: safeLog(log),
    }
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : "Compiler failed"
    return {
      ok: false,
      log: safeLog(errorMsg),
      error: {
        code: "COMPILE_FAILED",
        message: "Compilation failed",
        details: safeLog(errorMsg),
      },
    }
  } finally {
    if (stage) {
      await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}
