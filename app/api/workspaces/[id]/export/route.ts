import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceAccess } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import JSZip from "jszip"
import fs from "node:fs/promises"
import path from "node:path"
import { safeJsonParse } from "@/lib/db-helpers"
import { type Project, type OutputConfig, type Card, resolveOutputMetadata } from "@/lib/poster-types"
import type { ExtractedAsset } from "@/lib/ingestion"
import { generateFullTemplate } from "@/lib/latex"
import { resolveBibSource } from "@/lib/latex/bib-source"
import { materializeRemoteFigures, rewriteTexRemoteUrls } from "@/lib/latex/remote-assets"
import os from "node:os"
import { WORKSPACES_ROOT } from "@/lib/workspace-files"
import { safeContentDisposition, sanitizeFilename } from "@/lib/security"

function parseDbCard(c: { table?: unknown; figures?: unknown; sourceIds?: unknown } & Record<string, unknown>) {
  const defaultTable = { hasHeader: true, caption: "", rows: [] }
  return {
    ...c,
    table: typeof c.table === "string" ? safeJsonParse(c.table, defaultTable) : (c.table ?? defaultTable),
    figures: typeof c.figures === "string" ? safeJsonParse(c.figures, []) : (c.figures ?? []),
    sourceIds: typeof c.sourceIds === "string" ? safeJsonParse(c.sourceIds, []) : (c.sourceIds ?? []),
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  try {
    await requireWorkspaceAccess(workspaceId)

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        outputs: {
          include: {
            cards: true,
          },
        },
        assets: true,
      },
    })

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    // Convert to Project shape
    const project: Project = {
      id: workspace.id,
      revision: workspace.revision,
      name: workspace.name,
      posterTitle: workspace.name,
      authors: workspace.authors,
      venue: workspace.venue,
      logoUrl: workspace.logoUrl,
      secondaryLogoUrl: workspace.secondaryLogoUrl,
      templateName: "",
      activeOutputId: workspace.outputs.find((o) => o.isActive)?.id || workspace.outputs[0]?.id || "",
      assets: workspace.assets.map((a) => ({
        id: a.id,
        filename: a.filename || "asset",
        url: a.url || "",
        thumbnailUrl: a.thumbnailUrl || a.url || "",
        caption: a.caption || "",
        fileId: a.fileId || "",
        kind: (a.kind || "figure") as ExtractedAsset["kind"],
        page: a.page || 1,
        confidence: (a.confidence || "high") as ExtractedAsset["confidence"],
      })),
      ingestFiles: [],
      outputs: workspace.outputs.map((out) => ({
        id: out.id,
        outputType: out.outputType as any,
        templateId: out.templateId,
        title: out.title,
        authors: out.authors,
        venue: out.venue,
        logoUrl: out.logoUrl,
        secondaryLogoUrl: out.secondaryLogoUrl,
        themeColor: out.themeColor,
        cards: out.cards.map((c) => parseDbCard(c) as unknown as Card),
      })),
    }

    const activeOutputConfig: OutputConfig =
      project.outputs.find((o) => o.id === project.activeOutputId) || project.outputs[0]

    // Generate main.tex
    const mainTex = generateFullTemplate(project, activeOutputConfig, workspaceId)
    // Shared bibliography resolution (B4)
    const bibContent = resolveBibSource(workspace, activeOutputConfig.cards)

    // Create ZIP archive
    const zip = new JSZip()

    // pdflatex cannot fetch http(s) URLs — download remote figures into a temp
    // stage and rewrite the .tex to reference them as local files.
    const remoteStage = await fs.mkdtemp(path.join(os.tmpdir(), "posterapp-export-"))
    let exportTex = mainTex
    try {
      const remoteMapping = await materializeRemoteFigures(project, remoteStage)
      exportTex = rewriteTexRemoteUrls(exportTex, remoteMapping)
      zip.file("main.tex", exportTex)
      zip.file("references.bib", bibContent)

      // Read and bundle assets
      const assetsFolder = zip.folder("assets")
      for (const [, relative] of remoteMapping) {
        const data = await fs.readFile(path.join(remoteStage, relative))
        assetsFolder?.file(relative.replace(/^assets[\\/]/, ""), data)
      }
      const assetsDiskDir = path.join(WORKSPACES_ROOT, workspaceId, "assets")

      try {
        const filesOnDisk = await fs.readdir(assetsDiskDir)
        for (const file of filesOnDisk) {
          try {
            const filePath = path.join(assetsDiskDir, file)
            const stat = await fs.stat(filePath)
            if (stat.isFile()) {
              const data = await fs.readFile(filePath)
              assetsFolder?.file(file, data)
            }
          } catch (fileErr) {
            console.warn(`Could not add asset ${file} to export zip:`, fileErr)
          }
        }
      } catch {
        // assets dir may not exist yet if empty
      }
    } finally {
      await fs.rm(remoteStage, { recursive: true, force: true })
    }

    // Add README.md
    const meta = resolveOutputMetadata(project)
    const readmeContent = `# ${meta.title || workspace.name}

Exported from PosterApp on ${new Date().toISOString().split("T")[0]}.

## Files:
- \`main.tex\` — Full LaTeX document configured for ${activeOutputConfig.outputType} (${activeOutputConfig.templateId})
- \`references.bib\` — BibTeX citation library
- \`assets/\` — High-resolution figures, logos, and QR codes

## Local Compilation (LaTeX / pdflatex):
\`\`\`bash
pdflatex -interaction=nonstopmode main.tex
bibtex main
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex
\`\`\`

## Overleaf Import:
1. Go to Overleaf -> **New Project** -> **Upload Project**.
2. Select this downloaded \`.zip\` file.
`
    zip.file("README.md", readmeContent)

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })

    const safeName = sanitizeFilename(workspace.name || "posterapp_project", "posterapp_project")
    const exportFilename = `${safeName}_latex_package.zip`

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": safeContentDisposition(exportFilename, "attachment"),
      },
    })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    console.error("Export zip error:", err)
    return NextResponse.json(
      { error: "Failed to generate export package" },
      { status: 500 }
    )
  }
}
