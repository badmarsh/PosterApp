import fs from "fs/promises"
import path from "path"
import os from "os"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { generateFullTemplate } from "@/lib/latex"
import { resolveBibSource } from "@/lib/latex/bib-source"
import { materializeRemoteFigures, rewriteTexRemoteUrls } from "@/lib/latex/remote-assets"
import { WORKSPACES_ROOT, workspacePath } from "@/lib/workspace-files"
import { safeLog, runSandboxedLatex } from "@/lib/latex/compiler-runner"
import type { Card, Project } from "@/lib/poster-types"

/** Per-workspace mutex to guarantee serial, atomic PDF installation (B3) */
const workspaceCompileLocks = new Map<string, Promise<void>>()

function asProject(workspace: any): Project {
  // Deterministic ordering: Prisma relation order is unspecified, and the
  // "first output" fallback + active-output selection must not flicker
  // between identical compiles.
  const outputs = [...workspace.outputs]
    .sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)))
    .map((output: any) => ({
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

/**
 * Fingerprint of everything besides the cards that influences the compiled
 * PDF: the resolved BibTeX source and the on-disk assets (name, size, mtime).
 * The compile cache is only valid when cards/revision AND this fingerprint
 * match — previously a bibliography-only or image-only change reused a stale
 * cached PDF.
 */
async function computeContentFingerprint(bibContent: string, workspaceId: string): Promise<string> {
  const hash = crypto.createHash("sha256")
  hash.update("bib\0").update(bibContent)
  try {
    const dir = path.join(WORKSPACES_ROOT, workspaceId, "assets")
    const names = (await fs.readdir(dir)).sort()
    for (const name of names) {
      try {
        const st = await fs.stat(path.join(dir, name))
        if (st.isFile()) hash.update(`\0${name}:${st.size}:${Math.trunc(st.mtimeMs)}`)
      } catch {
        // file vanished mid-scan; ignore
      }
    }
  } catch {
    // assets dir may not exist yet
  }
  return hash.digest("hex")
}

export interface CompileWorkspaceOptions {
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
export async function compileWorkspace(
  workspaceId: string,
  options: CompileWorkspaceOptions = {}
): Promise<CompileWorkspaceResult> {
  const { expectedRevision, installPdf = true, timeoutMs = 60_000 } = options
  let stage = ""

  try {
    const full = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        outputs: { include: { cards: true } },
        assets: true,
      },
    })

    if (!full) {
      return {
        ok: false,
        log: "",
        error: { code: "WORKSPACE_NOT_FOUND", message: "Workspace not found" },
      }
    }

    if (expectedRevision !== undefined && full.revision !== expectedRevision) {
      return {
        ok: false,
        log: "",
        revision: full.revision,
        error: { code: "CONFLICT", message: "Workspace modified concurrently" },
      }
    }

    const project = asProject(full)
    const output = project.outputs.find((item) => item.id === project.activeOutputId)
    if (!output) {
      return {
        ok: false,
        log: "",
        error: { code: "NO_OUTPUT", message: "No output is selected" },
      }
    }

    const targetDir = workspacePath(workspaceId)
    const targetPdf = path.join(targetDir, "main.pdf")
    const cacheMetaPath = path.join(targetDir, "compile-cache.json")

    // Bib source and asset fingerprint must be resolved BEFORE the cache
    // check — they are part of what the cache validates.
    const bibContent = resolveBibSource(full, output.cards)
    const contentHash = await computeContentFingerprint(bibContent, workspaceId)

    // Cache check: if the compiled PDF already exists for the exact
    // revision + output configuration + bib/assets fingerprint, reuse it
    if (!options.forceRecompile) {
      try {
        const metaRaw = await fs.readFile(cacheMetaPath, "utf8")
        const meta = JSON.parse(metaRaw)
        if (
          meta.revision === full.revision &&
          meta.outputId === output.id &&
          meta.templateId === output.templateId &&
          meta.themeColor === (output.themeColor ?? "") &&
          meta.contentHash === contentHash
        ) {
          const pdfStat = await fs.stat(targetPdf)
          if (pdfStat.size > 0) {
            return {
              ok: true,
              cached: true,
              revision: full.revision,
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

    // Materialize remote figures and rewrite .tex
    const remoteMapping = await materializeRemoteFigures(project, stage)
    tex = rewriteTexRemoteUrls(tex, remoteMapping)

    await fs.writeFile(path.join(stage, "main.tex"), tex, "utf8")

    // Bib source already resolved above (needed for the cache fingerprint).
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
          revision: full.revision,
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
        revision: full.revision,
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
            revision: full.revision,
            outputId: output.id,
            templateId: output.templateId,
            themeColor: output.themeColor ?? "",
            contentHash,
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
      revision: full.revision,
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
