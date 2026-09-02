import * as fs from "fs"
import * as path from "path"
import { prisma } from "../lib/prisma"
import { generateCaption } from "../lib/services/vision-service"
import { WORKSPACES_ROOT } from "../lib/workspace-files"

async function run() {
  const workspaceId = "demo_mt6u6y7a"
  console.log(`[Captions] Starting batch caption generation for workspace: ${workspaceId}...`)

  const assets = await prisma.asset.findMany({
    where: { workspaceId },
    orderBy: { filename: "asc" },
  })

  console.log(`[Captions] Found ${assets.length} total assets in workspace.`)

  const assetsDir = path.join(WORKSPACES_ROOT, workspaceId, "assets")
  let updatedCount = 0
  let failedCount = 0

  // Process in small parallel batches of 3
  const BATCH_SIZE = 3
  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (asset) => {
        if (!asset.filename) return
        const filePath = path.join(assetsDir, asset.filename)
        if (!fs.existsSync(filePath)) {
          console.warn(`[Captions] Asset file not found on disk: ${asset.filename}`)
          return
        }

        try {
          const imgBuffer = fs.readFileSync(filePath)
          const base64Data = imgBuffer.toString("base64")
          const mimeType = asset.filename.endsWith(".png") ? "image/png" : "image/jpeg"
          const dataUrl = `data:${mimeType};base64,${base64Data}`

          const context = `Asset: ${asset.filename}, Kind: ${asset.kind}, Page: ${asset.page}`
          const capRes = await generateCaption(dataUrl, context)

          const newCaption = capRes.caption || capRes.name || (asset.kind === "table" ? "Table" : "Figure")
          const newSnippet = capRes.snippet || capRes.name || ""

          await prisma.asset.update({
            where: { id: asset.id },
            data: {
              caption: newCaption,
              snippet: newSnippet,
            },
          })

          console.log(`[Captions] ✓ ${asset.filename} -> "${newCaption}" | ${newSnippet.slice(0, 60)}...`)
          updatedCount++
        } catch (err) {
          console.error(`[Captions] ✗ Failed for ${asset.filename}:`, err)
          failedCount++
        }
      })
    )
    console.log(`[Captions] Progress: ${Math.min(i + BATCH_SIZE, assets.length)} / ${assets.length}`)
  }

  console.log(`\n[Captions] COMPLETE: Updated ${updatedCount} assets (${failedCount} failed).`)
}

run().catch((e) => {
  console.error("[Captions] Fatal error:", e)
  process.exit(1)
})
