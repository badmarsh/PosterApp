import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceAccess } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import JSZip from "jszip"
import fs from "node:fs/promises"
import path from "node:path"
import { safeJsonParse } from "@/lib/db-helpers"
import type { Project, OutputConfig } from "@/lib/poster-types"
import { resolveOutputMetadata } from "@/lib/poster-types"
import { generateFullTemplate } from "@/lib/latex"

function parseDbCard(c: any) {
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
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        outputs: {
          include: {
            cards: { orderBy: { order: "asc" } },
          },
        },
        assets: true,
      },
    })

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const activeOutputRecord =
      workspace.outputs.find((o) => o.isActive) || workspace.outputs[0]

    if (!activeOutputRecord) {
      return NextResponse.json({ error: "No active output found" }, { status: 400 })
    }

    // Construct Project object
    const project: Project = {
      id: workspace.id,
      revision: workspace.revision,
      name: workspace.name,
      posterTitle: activeOutputRecord.title ?? workspace.name,
      authors: workspace.authors,
      venue: workspace.venue,
      logoUrl: workspace.logoUrl,
      secondaryLogoUrl: workspace.secondaryLogoUrl,
      templateName: activeOutputRecord.templateId,
      activeOutputId: activeOutputRecord.id,
      assets: workspace.assets.map((a: any) => ({
        id: a.id,
        filename: a.filename || "",
        url: a.url || "",
        caption: a.caption || "",
        type: a.type || "figure",
        fileId: a.fileId || "",
        kind: a.type || "figure",
        page: a.page || 1,
        confidence: a.confidence || 1.0,
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
        cards: out.cards.map(parseDbCard),
      })),
    }

    const activeOutputConfig: OutputConfig =
      project.outputs.find((o) => o.id === project.activeOutputId) || project.outputs[0]

    // Generate main.tex
    const mainTex = generateFullTemplate(project, activeOutputConfig, workspaceId)
    const bibContent = workspace.bibContent || ""

    // Create ZIP archive
    const zip = new JSZip()
    zip.file("main.tex", mainTex)
    zip.file("references.bib", bibContent)

    // Read and bundle assets
    const assetsFolder = zip.folder("assets")
    const assetsDiskDir = path.join(process.cwd(), "workspaces", workspaceId, "assets")

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

    const safeName = (workspace.name || "posterapp_project")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .slice(0, 40)

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}_latex_package.zip"`,
      },
    })
  } catch (err: unknown) {
    console.error("Export zip error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate export package" },
      { status: 500 }
    )
  }
}
