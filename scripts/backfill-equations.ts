import fs from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"
import { WORKSPACES_ROOT } from "@/lib/workspace-files"

function extractEquationsFromMarkdown(mdContent: string) {
  const extracted: { formula: string; title: string }[] = []
  const seen = new Set<string>()

  const displayMathRegex = /\$\$([\s\S]+?)\$\$|\\begin\{(?:equation|align|gather|multline)\*?\}([\s\S]+?)\\end\{(?:equation|align|gather|multline)\*?\}/g
  let match
  let eqCount = 1

  while ((match = displayMathRegex.exec(mdContent)) !== null) {
    const rawFormula = (match[1] || match[2] || "").trim()
    if (rawFormula.length >= 3 && !seen.has(rawFormula)) {
      seen.add(rawFormula)
      extracted.push({
        formula: rawFormula,
        title: `Equation ${eqCount++}`,
      })
    }
  }

  return extracted
}

async function backfillEquations() {
  console.log("==========================================================")
  console.log("📐 BACKFILLING EQUATIONS FOR EXISTING WORKSPACE SOURCES")
  console.log("==========================================================\n")

  const workspaces = await prisma.workspace.findMany({
    include: {
      ingestFiles: true,
      assets: true,
    },
  })

  let totalBackfilled = 0

  for (const ws of workspaces) {
    const workspaceId = ws.id
    const sourcesDir = path.join(WORKSPACES_ROOT, workspaceId, "sources")
    if (!fs.existsSync(sourcesDir)) continue

    const existingEqFilenames = new Set(
      ws.assets.filter((a) => a.kind === "equation").map((a) => a.filename)
    )

    const sourceFiles = fs.readdirSync(sourcesDir).filter((f) => f.endsWith(".md"))
    for (const sf of sourceFiles) {
      const fileId = sf.replace(/\.md$/, "")
      const content = fs.readFileSync(path.join(sourcesDir, sf), "utf-8")
      const equations = extractEquationsFromMarkdown(content)

      if (equations.length === 0) continue

      const matchingFile = ws.ingestFiles.find((f) => f.id === fileId)
      const baseName = matchingFile
        ? path.basename(matchingFile.name, path.extname(matchingFile.name)).replace(/[^a-zA-Z0-9_-]/g, "_")
        : fileId

      let eqIndex = 1
      for (const eq of equations) {
        const filename = `${baseName}_equation_${eqIndex++}.tex`
        if (existingEqFilenames.has(filename)) continue

        await prisma.asset.create({
          data: {
            id: randomUUID(),
            workspaceId,
            fileId,
            filename,
            url: `/api/workspaces/${workspaceId}/assets/${filename}`,
            thumbnailUrl: `/api/workspaces/${workspaceId}/assets/${filename}`,
            kind: "equation",
            caption: eq.title || `Equation: ${eq.formula.slice(0, 40)}`,
            snippet: eq.formula,
            confidence: "high",
            page: 1,
          },
        })

        existingEqFilenames.add(filename)
        totalBackfilled++
        console.log(`  ➕ Added Equation: "${eq.formula.slice(0, 50)}..." to workspace "${workspaceId}"`)
      }
    }
  }

  console.log("\n==========================================================")
  console.log(`🎉 Backfilled ${totalBackfilled} equations across all workspaces!`)
  console.log("==========================================================")

  await prisma.$disconnect()
}

backfillEquations().catch(async (err) => {
  console.error("Failed to backfill equations:", err)
  await prisma.$disconnect()
  process.exit(1)
})
