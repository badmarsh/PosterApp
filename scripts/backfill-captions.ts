import { prisma } from "@/lib/prisma"
import fs from "fs"
import path from "path"
import { generateCaption } from "@/lib/services/vision-service"

async function backfillCaptions() {
  console.log("==========================================================")
  console.log("🔍 Scanning all workspace assets for missing captions...")
  console.log("==========================================================\n")

  const assets = await prisma.asset.findMany({
    include: {
      workspace: true,
    },
    orderBy: { id: "asc" },
  })

  console.log(`Found ${assets.length} total assets in database.`)

  const isGeneric = (cap?: string | null) => {
    if (!cap || !cap.trim()) return true
    const lower = cap.trim().toLowerCase()
    return (
      lower === "figure" ||
      lower === "table" ||
      lower === "image" ||
      lower === "untitled" ||
      lower === "n/a" ||
      lower.startsWith("figure ") ||
      lower.startsWith("table ")
    )
  }

  const { generateEquationCaption } = await import("@/lib/services/equation-service")

  const needsCaption = assets.filter((a) => {
    if (a.kind === "equation") {
      return isGeneric(a.caption) || !a.caption || a.caption.startsWith("Equation ")
    }
    // PDF assets cannot be captioned directly via vision model
    if (!a.filename || a.filename.toLowerCase().endsWith(".pdf")) return false
    return isGeneric(a.caption) || !a.snippet || !a.snippet.trim()
  })

  console.log(`Assets requiring caption generation: ${needsCaption.length}\n`)

  if (needsCaption.length === 0) {
    console.log("✅ All assets already have detailed captions!")
    await prisma.$disconnect()
    return
  }

  let updatedCount = 0
  for (let idx = 0; idx < needsCaption.length; idx++) {
    const asset = needsCaption[idx]
    const workspaceId = asset.workspaceId
    const filename = asset.filename

    console.log(`[${idx + 1}/${needsCaption.length}] Processing ${asset.kind} "${filename || asset.id}" in workspace "${workspaceId}"...`)

    // Load sources context if available
    let contextWindow = ""
    const sourcesDir = path.join(process.cwd(), "workspaces", workspaceId, "sources")
    if (fs.existsSync(sourcesDir)) {
      try {
        const sourceFiles = fs.readdirSync(sourcesDir).filter((f) => f.endsWith(".md"))
        for (const sf of sourceFiles) {
          const content = fs.readFileSync(path.join(sourcesDir, sf), "utf-8")
          const target = filename || (asset.snippet ? asset.snippet.slice(0, 30) : "")
          if (target) {
            const pos = content.indexOf(target)
            if (pos !== -1) {
              contextWindow = content.substring(
                Math.max(0, pos - 1000),
                Math.min(content.length, pos + 1000)
              )
              break
            }
          }
        }
      } catch (err) {
        console.warn("  Could not read sources:", err)
      }
    }

    try {
      if (asset.kind === "equation") {
        const formula = asset.snippet || asset.caption || ""
        const startTime = Date.now()
        const generated = await generateEquationCaption(formula, contextWindow)
        const elapsed = Date.now() - startTime

        if (generated.caption && !generated.caption.startsWith("Equation ")) {
          await prisma.asset.update({
            where: { id: asset.id },
            data: {
              caption: generated.caption,
              snippet: formula,
            },
          })
          updatedCount++
          console.log(`  ✅ Updated Equation in ${elapsed}ms:`)
          console.log(`     - Caption: "${generated.caption}"`)
          console.log(`     - Description: "${generated.description}"\n`)
        }
      } else if (filename) {
        const assetPath = path.join(process.cwd(), "workspaces", workspaceId, "assets", filename)
        if (!fs.existsSync(assetPath)) {
          console.warn(`  ⚠️ File not found on disk at: ${assetPath}`)
          continue
        }

        const fileBuffer = fs.readFileSync(assetPath)
        const base64 = fileBuffer.toString("base64")
        
        const startTime = Date.now()
        const generated = await generateCaption(base64, contextWindow)
        const elapsed = Date.now() - startTime

        const newCaption = generated.caption || generated.name || (asset.kind === "table" ? "Table" : "Figure")
        const newSnippet = generated.snippet || generated.name || ""

        if (newCaption && newCaption !== "Figure" && newCaption !== "Table") {
          await prisma.asset.update({
            where: { id: asset.id },
            data: {
              caption: newCaption,
              snippet: newSnippet,
            },
          })
          updatedCount++
          console.log(`  ✅ Updated ${asset.kind} in ${elapsed}ms:`)
          console.log(`     - Caption: "${newCaption}"`)
          console.log(`     - Snippet: "${newSnippet.slice(0, 100)}..."\n`)
        } else {
          console.warn(`  ⚠️ Vision model did not return a specific caption for ${filename}\n`)
        }
      }
    } catch (err) {
      console.error(`  ❌ Failed to generate caption for ${filename || asset.id}:`, err)
    }

    // Inter-asset pacing
    if (idx < needsCaption.length - 1) {
      await new Promise((r) => setTimeout(r, 600))
    }
  }

  console.log("==========================================================")
  console.log(`🎉 Backfill completed! Updated ${updatedCount}/${needsCaption.length} assets.`)
  console.log("==========================================================")

  await prisma.$disconnect()
}

backfillCaptions().catch(async (e) => {
  console.error("Backfill failed:", e)
  await prisma.$disconnect()
  process.exit(1)
})
