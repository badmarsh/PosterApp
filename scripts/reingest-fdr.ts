import * as fs from "fs"
import * as path from "path"
import { prisma } from "../lib/prisma"
import { extractBibTeX } from "../lib/services/bibtex-service"
import { generateCaption } from "../lib/services/vision-service"

async function run() {
  const workspaceId = "demo_mt6u6y7a"
  const parsedDir = "C:\\Users\\marek\\Documents\\Robco PhD\\poster4\\ParsedResults\\FDR-Radiation-Divider\\hybrid_auto"
  const mdPath = path.join(parsedDir, "FDR-Radiation-Divider.md")
  const middlePath = path.join(parsedDir, "FDR-Radiation-Divider_middle.json")
  const imagesDir = path.join(parsedDir, "images")

  console.log(`[Reingest] Starting reingestion for FDR-Radiation-Divider into workspace ${workspaceId}...`)

  if (!fs.existsSync(mdPath) || !fs.existsSync(middlePath)) {
    throw new Error(`Parsed results not found at ${parsedDir}`)
  }

  let mdContent = fs.readFileSync(mdPath, "utf-8")
  const middleJson = JSON.parse(fs.readFileSync(middlePath, "utf-8"))

  const basename = "FDR-Radiation-Divider"

  // 1. Map tables and pages from middle_json
  const tableMap = new Map<string, string[][]>()
  const pageMap = new Map<string, number>()

  let pageNum = 1
  for (const p of middleJson.pdf_info || []) {
    const searchImagePaths = (obj: any) => {
      if (!obj) return
      if (typeof obj === "object") {
        if (obj.image_path) {
          pageMap.set(obj.image_path, pageNum)
        }
        if (obj.type === "table" && obj.html && obj.image_path) {
          const rows: string[][] = []
          const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
          let trMatch
          while ((trMatch = trRegex.exec(obj.html)) !== null) {
            const cells: string[] = []
            const tdRegex = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi
            let tdMatch
            while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
              cells.push(tdMatch[2].replace(/<[^>]+>/g, "").trim())
            }
            if (cells.length > 0) rows.push(cells)
          }
          tableMap.set(obj.image_path, rows)
        }
        for (const key of Object.keys(obj)) {
          searchImagePaths(obj[key])
        }
      }
    }
    searchImagePaths(p)
    pageNum++
  }

  // 2. Process images & tables
  const destAssetsDir = path.join(process.cwd(), "workspaces", workspaceId, "assets")
  if (!fs.existsSync(destAssetsDir)) fs.mkdirSync(destAssetsDir, { recursive: true })

  const destSourcesDir = path.join(process.cwd(), "workspaces", workspaceId, "sources")
  if (!fs.existsSync(destSourcesDir)) fs.mkdirSync(destSourcesDir, { recursive: true })

  const imageFiles = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : []
  console.log(`[Reingest] Found ${imageFiles.length} images to process.`)

  let figureIndex = 1
  let tableIndex = 1
  const renamedAssets: Array<{
    oldFilename: string
    newFilename: string
    kind: "figure" | "table"
    tableData?: string[][]
    page: number
    filePath: string
  }> = []

  for (const imgFile of imageFiles) {
    const ext = path.extname(imgFile) || ".jpg"
    const normName = imgFile
    let newFilename = ""
    let kind: "figure" | "table" = "figure"
    let tableData: string[][] | undefined

    if (tableMap.has(normName)) {
      kind = "table"
      newFilename = `${basename}_table_${tableIndex++}${ext}`
      tableData = tableMap.get(normName)
      pageMap.set(newFilename, pageMap.get(normName) || 1)

      // Inject table into markdown
      let mdTable = "\n\n"
      if (tableData) {
        for (let i = 0; i < tableData.length; i++) {
          mdTable += "| " + tableData[i].map((c) => c.replace(/\|/g, "-")).join(" | ") + " |\n"
          if (i === 0) {
            mdTable += "| " + tableData[i].map(() => "---").join(" | ") + " |\n"
          }
        }
      }
      mdTable += "\n"

      const imgRegex = new RegExp(`\\!\\[.*\\]\\(` + imgFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + `\\)`, "g")
      if (imgRegex.test(mdContent)) {
        mdContent = mdContent.replace(imgRegex, `![](${newFilename})${mdTable}`)
      } else {
        mdContent = mdContent.split(imgFile).join(newFilename + '")\n' + mdTable + '\n[comment]: <> ("')
      }
    } else {
      kind = "figure"
      newFilename = `${basename}_figure_${figureIndex++}${ext}`
      pageMap.set(newFilename, pageMap.get(normName) || 1)
      mdContent = mdContent.split(imgFile).join(newFilename)
    }

    const srcPath = path.join(imagesDir, imgFile)
    const dstPath = path.join(destAssetsDir, newFilename)
    fs.copyFileSync(srcPath, dstPath)

    renamedAssets.push({
      oldFilename: imgFile,
      newFilename,
      kind,
      tableData,
      page: pageMap.get(normName) || 1,
      filePath: dstPath,
    })
  }

  // 3. Save markdown to sources
  const fileId = "file_fdr_radiation_divider"
  const sourceMdPath = path.join(destSourcesDir, `${fileId}.md`)
  fs.writeFileSync(sourceMdPath, mdContent)
  console.log(`[Reingest] Saved source markdown to ${sourceMdPath}`)

  // 4. Extract BibTeX
  console.log(`[Reingest] Extracting BibTeX references...`)
  try {
    await extractBibTeX(mdContent, workspaceId)
    console.log(`[Reingest] BibTeX extraction complete.`)
  } catch (err) {
    console.error(`[Reingest] BibTeX extraction non-fatal error:`, err)
  }

  // 5. Generate Vision Captions using updated JSON contract
  console.log(`[Reingest] Generating captions for ${renamedAssets.length} assets...`)
  const MAX_CAPTIONS = 40
  const assetsToCaption = renamedAssets.slice(0, MAX_CAPTIONS)

  const processedAssets: Array<any> = []

  // Run captions in batches of 4
  const BATCH_SIZE = 4
  for (let i = 0; i < assetsToCaption.length; i += BATCH_SIZE) {
    const batch = assetsToCaption.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async (asset) => {
        let caption = asset.kind === "figure" ? "Figure" : "Table"
        let snippet = ""

        try {
          const imgBuffer = fs.readFileSync(asset.filePath)
          const base64Data = imgBuffer.toString("base64")
          const mimeType = asset.filePath.endsWith(".png") ? "image/png" : "image/jpeg"
          const dataUrl = `data:${mimeType};base64,${base64Data}`

          const capRes = await generateCaption(dataUrl, `Asset from ${basename} (Page ${asset.page})`)
          if (capRes.caption) caption = capRes.caption
          else if (capRes.name) caption = capRes.name
          if (capRes.snippet) snippet = capRes.snippet
        } catch (e) {
          console.warn(`[Reingest] Caption failed for ${asset.newFilename}:`, e)
        }

        return {
          id: crypto.randomUUID(),
          workspaceId,
          filename: asset.newFilename,
          url: `/api/workspaces/${workspaceId}/assets/${asset.newFilename}`,
          thumbnailUrl: `/api/workspaces/${workspaceId}/assets/${asset.newFilename}`,
          kind: asset.kind,
          caption,
          snippet,
          tableRows: asset.tableData ? JSON.stringify(asset.tableData) : null,
          page: asset.page,
          fileId,
          confidence: "high",
        }
      })
    )
    processedAssets.push(...results)
    console.log(`[Reingest] Processed ${processedAssets.length}/${assetsToCaption.length} captions...`)
  }

  // 6. Persist to Database (Delete existing FDR assets and re-insert)
  console.log(`[Reingest] Persisting ${processedAssets.length} assets to PostgreSQL...`)
  await prisma.asset.deleteMany({
    where: {
      workspaceId,
      filename: { startsWith: `${basename}_` },
    },
  })

  await prisma.asset.createMany({
    data: processedAssets,
  })

  console.log(`[Reingest] SUCCESS! Reingested ${processedAssets.length} assets for FDR-Radiation-Divider into ${workspaceId}.`)
}

run().catch((e) => {
  console.error("[Reingest] Fatal error:", e)
  process.exit(1)
})
