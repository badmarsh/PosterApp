import fs from "fs"
import path from "path"
import { prisma } from "../lib/prisma"
import { Project } from "../lib/poster-types"

async function main() {
  const workspacesDir = path.join(process.cwd(), "workspaces")
  if (!fs.existsSync(workspacesDir)) {
    console.log("No workspaces directory found.")
    return
  }

  const dirs = fs.readdirSync(workspacesDir)
  for (const dir of dirs) {
    const wsPath = path.join(workspacesDir, dir)
    if (!fs.statSync(wsPath).isDirectory()) continue

    const projectFile = path.join(wsPath, "project.json")
    if (!fs.existsSync(projectFile)) continue

    console.log(`Migrating workspace: ${dir}`)
    const projectRaw = fs.readFileSync(projectFile, "utf-8")
    const project: Project = JSON.parse(projectRaw)

    // Also try to read bib
    let bibContent: string | null = null
    let bibKeys: string | null = null
    const bibFile = path.join(wsPath, "bib.json")
    if (fs.existsSync(bibFile)) {
      const bibRaw = fs.readFileSync(bibFile, "utf-8")
      const bibData = JSON.parse(bibRaw)
      bibContent = bibData.bib || ""
      bibKeys = JSON.stringify(bibData.keys || [])
    }

    // Upsert workspace
    await prisma.workspace.upsert({
      where: { id: project.id },
      update: {},
      create: {
        id: project.id,
        name: project.name || project.id,
        posterTitle: project.posterTitle || "Untitled",
        authors: project.authors || "",
        venue: project.venue || "",
        templateName: project.templateName || "minimal",
        bibContent,
        bibKeys,
      },
    })

    // Upsert cards
    for (const card of project.cards || []) {
      await prisma.card.upsert({
        where: { id: card.id },
        update: {},
        create: {
          id: card.id,
          workspaceId: project.id,
          title: card.title || "",
          column: card.column,
          order: card.order,
          pattern: card.pattern,
          content: card.content || "",
          table: card.table ? JSON.stringify(card.table) : null,
          figures: card.figures ? JSON.stringify(card.figures) : null,
          figureLayout: card.figureLayout || "single",
          sourceIds: card.sourceIds ? JSON.stringify(card.sourceIds) : null,
          heightBudget: card.heightBudget,
          validation: card.validation || "valid",
          generatedLatex: card.generatedLatex,
        },
      })
    }

    // Upsert assets
    for (const asset of project.assets || []) {
      await prisma.asset.upsert({
        where: { id: asset.id },
        update: {},
        create: {
          id: asset.id,
          workspaceId: project.id,
          fileId: asset.fileId,
          filename: asset.filename,
          url: asset.url,
          kind: asset.kind,
          page: asset.page,
          section: asset.section,
          bbox: asset.bbox,
          confidence: asset.confidence,
          heading: asset.heading,
          snippet: asset.snippet,
          thumbnailUrl: asset.thumbnailUrl,
          caption: asset.caption,
          tableRows: asset.tableRows ? JSON.stringify(asset.tableRows) : null,
          assignedCardId: asset.assignedCardId,
          assignedSlot: asset.assignedSlot,
        },
      })
    }

    // Upsert ingestFiles
    for (const file of project.ingestFiles || []) {
      await prisma.ingestFile.upsert({
        where: { id: file.id },
        update: {},
        create: {
          id: file.id,
          workspaceId: project.id,
          name: file.name,
          size: file.size,
          method: file.method,
          status: file.status,
          progress: file.progress,
          error: file.error,
        },
      })
    }

    console.log(`Migrated workspace ${project.id} with ${project.cards?.length || 0} cards and ${project.assets?.length || 0} assets.`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
