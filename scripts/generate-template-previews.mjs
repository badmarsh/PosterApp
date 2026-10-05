#!/usr/bin/env node
/**
 * Generate `public/template-previews/<templateId>.svg` (+ 960 × 720 `.png`)
 * for every template in the registry. Every preview is an isometric mockup of
 * the template's own document, on a shared 4:3 canvas.
 *
 *   pnpm exec tsx scripts/generate-template-previews.mjs
 *   node scripts/generate-template-previews.mjs            (via the tsx shim below)
 *
 * The artwork is produced by `lib/template-preview-art.ts` from each
 * template's own palette and geometry — and prints a demo workspace's documents
 * onto the scene: its poster on the easel board, its slides on the laptop and
 * its paper on the desk (`lib/template-demo-content.ts`). Re-running this after
 * a palette or demo-workspace change refreshes every mockup. PNGs are optional — they need `sharp`, which
 * is already a dependency — and are skipped with a warning if it cannot load.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

// The art module is TypeScript; load it through tsx/esbuild if available.
async function loadArt() {
  try {
    return await import("../lib/template-preview-art.ts")
  } catch {
    return await import("@/lib/template-preview-art")
  }
}

const { TEMPLATE_REGISTRY } = await import("../lib/output-types.ts")
const art = await loadArt()

// The demo documents each preview prints: a demo workspace's poster, slides and
// paper, flattened for the artwork by lib/template-demo-content.ts.
const { templateDemoScene } = await import("../lib/template-demo-content.ts")

const OUT_DIR = path.join(ROOT, "public", "template-previews")
fs.mkdirSync(OUT_DIR, { recursive: true })

let sharpMod = null
try {
  sharpMod = (await import("sharp")).default
} catch (err) {
  console.warn(`[template-previews] sharp unavailable (${err.message}); writing SVG only`)
}

// One intrinsic size for both formats keeps the SVG and PNG canvases identical
// and gives the raster version enough resolution for 2× picker thumbnails.
const PREVIEW_WIDTH = 800

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"))
const wantPng = !process.argv.includes("--no-png")

const targets = TEMPLATE_REGISTRY.filter((t) => (only.length ? only.includes(t.id) : true))

let written = 0
for (const t of targets) {
  const demo = templateDemoScene(t.id)
  const svg = art.renderTemplatePreviewSvg(t.id, t.colors, PREVIEW_WIDTH, t, demo ?? {})
  const svgPath = path.join(OUT_DIR, `${t.id}.svg`)
  fs.writeFileSync(svgPath, svg, "utf8")
  written++

  if (wantPng && sharpMod) {
    try {
      await sharpMod(Buffer.from(svg, "utf8"), { density: 96 })
        .resize({ width: PREVIEW_WIDTH, height: Math.round(PREVIEW_WIDTH * 0.75), fit: "fill" })
        // The scene is flat vector artwork, so a palette PNG is ~60% smaller than
        // truecolour without visible loss at picker sizes.
        .png({ compressionLevel: 9, palette: true, quality: 80, effort: 8 })
        .toFile(path.join(OUT_DIR, `${t.id}.png`))
    } catch (err) {
      console.warn(`[template-previews] png failed for ${t.id}: ${err.message}`)
    }
  }
}

console.log(`[template-previews] wrote ${written} previews to ${path.relative(ROOT, OUT_DIR)}`)
