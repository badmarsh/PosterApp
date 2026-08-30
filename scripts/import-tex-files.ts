import * as fs from "fs"
import * as path from "path"
import { randomUUID } from "crypto"
import { prisma } from "../lib/prisma"
import { ingestDocumentChunks } from "../lib/ai/document-chunker"

const TMP_DIR = path.join(process.cwd(), "tmp")
const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

// ---------------------------------------------------------------------------
// LaTeX text normalization and cleaning helpers
// ---------------------------------------------------------------------------
function cleanLatexAccents(text: string): string {
  return text
    .replace(/\\'{o}/g, "ó").replace(/\\'o/g, "ó")
    .replace(/\\'{a}/g, "á").replace(/\\'a/g, "á")
    .replace(/\\'{e}/g, "é").replace(/\\'e/g, "é")
    .replace(/\\'{i}/g, "í").replace(/\\'i/g, "í")
    .replace(/\\'{u}/g, "ú").replace(/\\'u/g, "ú")
    .replace(/\\'{y}/g, "ý").replace(/\\'y/g, "ý")
    .replace(/\\v{s}/g, "š").replace(/\\v\s*s/g, "š")
    .replace(/\\v{c}/g, "č").replace(/\\v\s*c/g, "č")
    .replace(/\\v{z}/g, "ž").replace(/\\v\s*z/g, "ž")
    .replace(/\\v{t}/g, "ť").replace(/\\v\s*t/g, "ť")
    .replace(/\\v{d}/g, "ď").replace(/\\v\s*d/g, "ď")
    .replace(/\\v{l}/g, "ľ").replace(/\\v\s*l/g, "ľ")
    .replace(/\\v{n}/g, "ň").replace(/\\v\s*n/g, "ň")
    .replace(/\\v{r}/g, "ř").replace(/\\v\s*r/g, "ř")
    .replace(/\\"{a}/g, "ä").replace(/\\"a/g, "ä")
    .replace(/\\"{o}/g, "ö").replace(/\\"o/g, "ö")
    .replace(/\\"{u}/g, "ü").replace(/\\"u/g, "ü")
    .replace(/\\r{u}/g, "ů").replace(/\\r\s*u/g, "ů")
    .replace(/\\c{c}/g, "ç").replace(/\\c\s*c/g, "ç")
    .replace(/\\`{a}/g, "à").replace(/\\`a/g, "à")
    .replace(/\\`{e}/g, "è").replace(/\\`e/g, "è")
}

function convertTexToMarkdown(rawTex: string): string {
  let text = rawTex.replace(/\r\n/g, "\n")
  text = cleanLatexAccents(text)

  // Remove TeX comments (lines starting with %)
  text = text.replace(/^[ \t]*%.*$/gm, "")

  // Extract / convert Title
  let title = ""
  const titleMatch = text.match(/\\title(?:\[.*?\])?\{([\s\S]*?)\}/)
  if (titleMatch) {
    title = titleMatch[1]
      .replace(/\\boldmath\s*/g, "")
      .replace(/\\parbox\{.*?\}\{/g, "")
      .replace(/\\centering\s*/g, "")
      .replace(/\\huge\s*/g, "")
      .replace(/\\large\s*/g, "")
      .replace(/\\vspace\{.*?\}/g, "")
      .replace(/\\\\(?:\[.*?\])?/g, " ")
      .replace(/[{}]/g, "")
      .trim()
  }

  // Extract / convert Author
  let author = ""
  const authorMatch = text.match(/\\author(?:\[.*?\])?(?:<.*?>)?\{([\s\S]*?)\}/)
  if (authorMatch) {
    author = authorMatch[1]
      .replace(/\\Large\s*/g, "")
      .replace(/\\normalsize\s*/g, "")
      .replace(/\\large\s*/g, "")
      .replace(/\\small\s*/g, "")
      .replace(/\\scriptsize\s*/g, "")
      .replace(/\\and\s*/g, ", ")
      .replace(/\\\\(?:\[.*?\])?/g, " ")
      .replace(/\\vspace\{.*?\}/g, "")
      .replace(/[{}]/g, "")
      .trim()
  }

  // Extract / convert Abstract
  let abstract = ""
  const abstractMatch = text.match(/\\abstract\{([\s\S]*?)\}/)
  if (abstractMatch) {
    abstract = abstractMatch[1].trim()
  }

  let mdLines: string[] = []

  if (title) {
    mdLines.push(`# ${title}\n`)
  }
  if (author) {
    mdLines.push(`**Authors:** ${author}\n`)
  }
  if (abstract) {
    mdLines.push(`## Abstract\n\n${abstract}\n`)
  }

  // Convert sections, subsections, frames, blocks
  // Remove document wrappers and preamble
  const docStart = text.indexOf("\\begin{document}")
  const bodyText = docStart !== -1 ? text.slice(docStart + "\\begin{document}".length) : text

  // Process frames / blocks / sections
  let formattedBody = bodyText
    .replace(/\\section\*?\{([\s\S]*?)\}/g, "\n\n## $1\n\n")
    .replace(/\\subsection\*?\{([\s\S]*?)\}/g, "\n\n### $1\n\n")
    .replace(/\\subsubsection\*?\{([\s\S]*?)\}/g, "\n\n#### $1\n\n")
    .replace(/\\begin\{frame\}(?:\[.*?\])?\{([\s\S]*?)\}/g, "\n\n## $1\n\n")
    .replace(/\\block\{([\s\S]*?)\}\{/g, "\n\n## $1\n\n")
    .replace(/\\begin\{itemize\}/g, "")
    .replace(/\\end\{itemize\}/g, "\n")
    .replace(/\\begin\{enumerate\}/g, "")
    .replace(/\\end\{enumerate\}/g, "\n")
    .replace(/\\tightitems/g, "")
    .replace(/\\looseitems/g, "")
    .replace(/\\item\s+/g, "* ")
    .replace(/\\textbf\{([\s\S]*?)\}/g, "**$1**")
    .replace(/\\textit\{([\s\S]*?)\}/g, "*$1*")
    .replace(/\\emph\{([\s\S]*?)\}/g, "*$1*")
    .replace(/\\underline\{([\s\S]*?)\}/g, "_$1_")
    .replace(/\\cite\{([\s\S]*?)\}/g, "[$1]")
    .replace(/\\ref\{([\s\S]*?)\}/g, "Ref. $1")
    .replace(/\\eqref\{([\s\S]*?)\}/g, "Eq. ($1)")
    .replace(/\\label\{.*?\}/g, "")
    .replace(/\\begin\{equation\*?\}/g, "\n$$\n")
    .replace(/\\end\{equation\*?\}/g, "\n$$\n")
    .replace(/\\begin\{aligned\}/g, "")
    .replace(/\\end\{aligned\}/g, "")
    .replace(/\\begin\{center\}/g, "")
    .replace(/\\end\{center\}/g, "")
    .replace(/\\begin\{columns\}/g, "")
    .replace(/\\end\{columns\}/g, "")
    .replace(/\\column\{.*?\}/g, "")
    .replace(/\\begin\{minipage\}\{.*?\}/g, "")
    .replace(/\\end\{minipage\}/g, "")
    .replace(/\\hfill/g, " ")
    .replace(/\\vspace\*?\{.*?\}/g, "")
    .replace(/\\hspace\*?\{.*?\}/g, "")
    .replace(/\\captiontext\{([\s\S]*?)\}/g, "\n*Caption: $1*\n")
    .replace(/\\caption\{([\s\S]*?)\}/g, "\n*Caption: $1*\n")
    .replace(/\\includegraphics(?:\[.*?\])?\{([\s\S]*?)\}/g, "\n![Figure]($1)\n")
    .replace(/\\end\{frame\}/g, "\n")
    .replace(/\\end\{document\}/g, "")
    .replace(/\\maketitle/g, "")
    .replace(/\\flushbottom/g, "")
    .replace(/\\linenumbers/g, "")
    .replace(/\\,/g, " ")
    .replace(/\\%/g, "%")
    .replace(/\\\$/g, "$")
    .replace(/\\&/g, "&")
    .replace(/\\_/g, "_")
    .replace(/\\#/g, "#")
    .replace(/~/g, " ")

  // Clean excessive blank lines
  formattedBody = formattedBody.replace(/\n{3,}/g, "\n\n").trim()
  mdLines.push(formattedBody)

  return mdLines.join("\n")
}

// ---------------------------------------------------------------------------
// File mappings and destination configurations
// ---------------------------------------------------------------------------
interface TexImportConfig {
  sourceFilename: string
  fileId: string
  displayName: string
  workspaceId: string
  workspaceName: string
  authors: string
  venue: string
}

const IMPORT_FILES: TexImportConfig[] = [
  {
    sourceFilename: "Charged particle correlations with ATLAS.tex",
    fileId: "file_charged_particle_correlations",
    displayName: "Charged particle correlations with ATLAS.tex",
    workspaceId: "prj_atlas_studies",
    workspaceName: "ATLAS Detector & Physics Studies",
    authors: "Róbert Astaloš (Comenius University Bratislava), on behalf of the ATLAS Collaboration",
    venue: "ICHEP 2022 -- XLI International Conference on High Energy Physics",
  },
  {
    sourceFilename: "Performance and calibration of the ATLAS Tile Calorimeter (1).tex",
    fileId: "file_tilecal_performance_icnfp",
    displayName: "Performance and calibration of the ATLAS Tile Calorimeter (ICNFP).tex",
    workspaceId: "prj_atlas_studies",
    workspaceName: "ATLAS Detector & Physics Studies",
    authors: "Tadeáš Petrú (Charles University), on behalf of the ATLAS Collaboration",
    venue: "XIII International Conference on New Frontiers in Physics (ICNFP 2024)",
  },
  {
    sourceFilename: "skeleton.tex",
    fileId: "file_tilecal_calibration_dis",
    displayName: "Performance and calibration of the ATLAS Tile Calorimeter (DIS2025).tex",
    workspaceId: "prj_atlas_studies",
    workspaceName: "ATLAS Detector & Physics Studies",
    authors: "Róbert Astaloš (Comenius University Bratislava), on behalf of the ATLAS Collaboration",
    venue: "XXXII International Workshop on Deep Inelastic Scattering (DIS2025)",
  },
  {
    sourceFilename: "irradiation_poster.tex",
    fileId: "file_irradiation_poster",
    displayName: "Irradiation Studies of ATLAS TileCal (Poster).tex",
    workspaceId: "prj_irradiation",
    workspaceName: "ATLAS TileCal HL-LHC Irradiation",
    authors: "Róbert Astaloš (Comenius University Bratislava), on behalf of the ATLAS Tile Calorimeter System",
    venue: "International Workshops on Radiation Imaging Detectors (IWORID 2026)",
  },
  {
    sourceFilename: "irradiation_proceedings.tex",
    fileId: "file_irradiation_proceedings",
    displayName: "Irradiation Studies of ATLAS TileCal (Proceedings).tex",
    workspaceId: "prj_irradiation",
    workspaceName: "ATLAS TileCal HL-LHC Irradiation",
    authors: "Róbert Astaloš (Comenius University Bratislava), on behalf of the ATLAS Tile Calorimeter System",
    venue: "Journal of Instrumentation (JINST / IWORID 2026)",
  },
  {
    sourceFilename: "irradiation_template.tex",
    fileId: "file_irradiation_template",
    displayName: "JINST Proceedings Template.tex",
    workspaceId: "prj_irradiation",
    workspaceName: "ATLAS TileCal HL-LHC Irradiation",
    authors: "ATLAS TileCal System",
    venue: "JINST / SISSA",
  },
]

async function main() {
  console.log("=== Starting TeX files import from tmp/ ===")

  // 1. Verify and copy images from tmp to workspaces assets
  const tmpFiles = fs.readdirSync(TMP_DIR)
  const imageExtensions = [".png", ".jpg", ".jpeg", ".pdf"]
  const imageFiles = tmpFiles.filter((f) => imageExtensions.includes(path.extname(f).toLowerCase()))

  console.log(`Found ${imageFiles.length} image files in tmp/`)

  const targetWorkspaces = ["prj_atlas_studies", "prj_irradiation"]

  for (const wsId of targetWorkspaces) {
    const wsAssetsDir = path.join(WORKSPACES_DIR, wsId, "assets")
    const wsSourcesDir = path.join(WORKSPACES_DIR, wsId, "sources")
    if (!fs.existsSync(wsAssetsDir)) fs.mkdirSync(wsAssetsDir, { recursive: true })
    if (!fs.existsSync(wsSourcesDir)) fs.mkdirSync(wsSourcesDir, { recursive: true })

    // Copy tmp images to workspace assets
    for (const img of imageFiles) {
      const src = path.join(TMP_DIR, img)
      const dst = path.join(wsAssetsDir, img)
      if (!fs.existsSync(dst)) {
        fs.copyFileSync(src, dst)
      }
    }
  }

  // 2. Process each TeX file
  for (const item of IMPORT_FILES) {
    const srcPath = path.join(TMP_DIR, item.sourceFilename)
    if (!fs.existsSync(srcPath)) {
      console.warn(`[SKIP] File not found: ${srcPath}`)
      continue
    }

    console.log(`\nProcessing: ${item.sourceFilename} -> Workspace: ${item.workspaceId}`)
    const texContent = fs.readFileSync(srcPath, "utf8")
    const stats = fs.statSync(srcPath)
    const markdownContent = convertTexToMarkdown(texContent)

    // Ensure workspace exists in DB
    await prisma.workspace.upsert({
      where: { id: item.workspaceId },
      update: {
        name: item.workspaceName,
        authors: item.authors,
        venue: item.venue,
      },
      create: {
        id: item.workspaceId,
        name: item.workspaceName,
        authors: item.authors,
        venue: item.venue,
        userId: "unauthenticated",
      },
    })

    // Write Markdown to workspaces/<wsId>/sources/<fileId>.md
    const sourcesDir = path.join(WORKSPACES_DIR, item.workspaceId, "sources")
    const mdPath = path.join(sourcesDir, `${item.fileId}.md`)
    fs.writeFileSync(mdPath, markdownContent, "utf8")
    console.log(`  ✓ Saved Markdown source: ${mdPath} (${markdownContent.length} chars)`)

    // Create or update IngestFile record in Prisma
    await prisma.ingestFile.upsert({
      where: { id: item.fileId },
      update: {
        name: item.displayName,
        size: stats.size,
        method: "tex",
        status: "completed",
        progress: 100,
        dismissed: false,
      },
      create: {
        id: item.fileId,
        workspaceId: item.workspaceId,
        name: item.displayName,
        size: stats.size,
        method: "tex",
        status: "completed",
        progress: 100,
        dismissed: false,
      },
    })
    console.log(`  ✓ Registered IngestFile: ${item.fileId}`)

    // Ingest into pgvector DocumentChunk table with embeddings
    try {
      console.log(`  Embedding & chunking for pgvector...`)
      const { chunksCreated, skipped } = await ingestDocumentChunks(
        item.workspaceId,
        item.fileId,
        markdownContent
      )
      console.log(`  ✓ DocumentChunk: ${chunksCreated} chunks indexed, ${skipped} skipped`)
    } catch (err) {
      console.error(`  ✗ Vector chunking error:`, err)
    }
  }

  // 3. Register all Asset records in DB for both workspaces
  for (const wsId of targetWorkspaces) {
    const wsAssetsDir = path.join(WORKSPACES_DIR, wsId, "assets")
    if (fs.existsSync(wsAssetsDir)) {
      await prisma.asset.deleteMany({ where: { workspaceId: wsId } })
      const assetFiles = fs.readdirSync(wsAssetsDir)
      for (const filename of assetFiles) {
        const ext = path.extname(filename).toLowerCase()
        if (![".png", ".jpg", ".jpeg", ".pdf"].includes(ext)) continue
        const isTable = filename.toLowerCase().includes("table")
        const kind = isTable ? "table" : "figure"

        await prisma.asset.create({
          data: {
            id: `ast_${randomUUID()}`,
            workspaceId: wsId,
            fileId: "imported_assets",
            filename,
            url: `/api/workspaces/${wsId}/assets/${filename}`,
            thumbnailUrl: `/api/workspaces/${wsId}/assets/${filename}`,
            kind,
            page: 1,
            confidence: "high",
            caption: filename.replace(/_/g, " ").replace(/\.[^/.]+$/, ""),
          },
        })
      }
      console.log(`✓ Synchronized assets for ${wsId}`)
    }
  }

  // 4. Clean up any dummy/single-card temporary outputs from prj_correlations / previous runs
  try {
    await prisma.output.deleteMany({
      where: {
        id: { in: [
          "imported_charged_particle_correlations_with_atlas_tex",
          "imported_performance_and_calibration_of_the_atlas_til",
          "imported_skeleton_tex",
          "imported_irradiation_poster_tex",
          "imported_irradiation_proceedings_tex",
          "imported_irradiation_template_tex"
        ]}
      }
    })
    console.log("✓ Cleaned up raw imported dummy outputs")
  } catch (err) {
    // Ignore if not present
  }

  // 5. Query final stats
  const totalChunks = await prisma.documentChunk.count()
  const totalAssets = await prisma.asset.count()
  const totalIngestFiles = await prisma.ingestFile.count()
  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: targetWorkspaces } },
    include: {
      outputs: { include: { cards: true } },
      ingestFiles: true,
      documentChunks: true,
    }
  })

  console.log("\n=== Import Complete Summary ===")
  console.log(`Total DocumentChunks across DB: ${totalChunks}`)
  console.log(`Total Assets in DB: ${totalAssets}`)
  console.log(`Total IngestFiles in DB: ${totalIngestFiles}`)
  for (const ws of workspaces) {
    console.log(`\nWorkspace: [${ws.id}] ${ws.name}`)
    console.log(`  - IngestFiles: ${ws.ingestFiles.length}`)
    console.log(`  - DocumentChunks (pgvector): ${ws.documentChunks.length}`)
    console.log(`  - Outputs: ${ws.outputs.length}`)
    for (const out of ws.outputs) {
      console.log(`    * [${out.outputType}] ${out.title} (${out.cards.length} cards)`)
    }
  }
}

main()
  .catch((err) => {
    console.error("Import failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
