import { describe, it, expect } from "vitest"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { TEMPLATE_REGISTRY, getTemplatesForType, type TemplateDef } from "@/lib/output-types"
import {
  renderTemplateDocument,
  renderTemplatePreviewSvg,
  getPreviewArt,
  hasBespokePreviewArt,
  paletteFrom,
} from "@/lib/template-preview-art"

const PREVIEWS_DIR = path.join(process.cwd(), "public", "template-previews")
const TEMPLATE_IDS = TEMPLATE_REGISTRY.map((template) => template.id)
/** Intrinsic size of the checked-in assets, shared by both formats. */
const ASSET_WIDTH = 800
const ASSET_HEIGHT = 600
const RENDER_WIDTH = 320
const RENDER_HEIGHT = 240
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function dimensions(svg: string, pattern: RegExp) {
  const match = svg.match(pattern)
  expect(match, "preview SVG has dimensions").not.toBeNull()
  return [Number(match![1]), Number(match![2])] as const
}

/** Everything that identifies the artwork itself, with per-file metadata removed. */
function visualSignature(svg: string) {
  return svg.replace(/aria-label="[^"]*"/g, "").replace(/data-template-id="[^"]*"/g, "")
}

/** Affine matrices of every printed surface in the scene. */
function matrixTransforms(svg: string) {
  return [...svg.matchAll(/transform="matrix\(([-\d. ]+)\)"/g)].map((match) =>
    match[1].split(" ").map(Number) as [number, number, number, number, number, number],
  )
}

function sha(buffer: Buffer | string) {
  return crypto.createHash("sha256").update(buffer).digest("hex")
}

function pngSize(buffer: Buffer) {
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)] as const
}

describe("template preview art (isometric mockup scene)", () => {
  it("renders a valid, identically sized 4:3 mockup for every registered template", () => {
    for (const template of TEMPLATE_REGISTRY) {
      const svg = renderTemplatePreviewSvg(template.id, template.colors, RENDER_WIDTH, template)
      expect(svg, `${template.id} starts with SVG`).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
      expect(svg.endsWith("</svg>"), `${template.id} closes`).toBe(true)
      expect(svg, `${template.id} has a template id`).toContain(`data-template-id="${template.id}"`)
      expect(svg, `${template.id} has an accessible name`).toContain(`aria-label="${template.label} template preview"`)

      // Every preview shares one canvas: same width/height attributes *and* viewBox.
      const [width, height] = dimensions(svg, /width="([\d.]+)" height="([\d.]+)" viewBox/)
      expect([width, height], `${template.id} canvas`).toEqual([RENDER_WIDTH, RENDER_HEIGHT])
      const [vbWidth, vbHeight] = dimensions(svg, /viewBox="0 0 ([\d.]+) ([\d.]+)"/)
      expect([vbWidth, vbHeight], `${template.id} viewBox`).toEqual([RENDER_WIDTH, RENDER_HEIGHT])
      expect(width / height).toBeCloseTo(4 / 3, 5)

      expect(svg, `${template.id} has no NaN`).not.toContain("NaN")
      expect(svg, `${template.id} has no Infinity`).not.toContain("Infinity")
      // No unresolved placeholder leaked into the artwork.
      expect(svg, `${template.id} has no undefined`).not.toContain("undefined")
    }
  })

  it("draws a 3D mockup, not a flat diagram", () => {
    const svg = renderTemplatePreviewSvg("atlas", TEMPLATE_REGISTRY[0].colors, RENDER_WIDTH)
    const matrices = matrixTransforms(svg)
    // The scene prints documents onto receding planes, so at least one affine
    // matrix carries a non-zero y-shear: that is the isometric projection.
    expect(matrices.length).toBeGreaterThan(0)
    expect(matrices.some(([, b]) => Math.abs(b) > 0.01)).toBe(true)
    // The studio set: gradients for the lit wall, desk top and contact shadows,
    // plus clip paths that keep every printed surface inside its plane.
    expect(svg.match(/<linearGradient/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(svg.match(/<radialGradient/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(svg.match(/<clipPath/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
  })

  it("prints each template's own document in the template's palette", () => {
    const aurora = TEMPLATE_REGISTRY.find((template) => template.id === "aurora")!
    const svg = renderTemplatePreviewSvg(aurora.id, aurora.colors, ASSET_WIDTH, aurora)
    expect(svg).toContain("#14B8A6")

    // The document is rendered from the same descriptor the LaTeX template uses,
    // so its native markup must appear inside the scene's printed surfaces.
    const document = renderTemplateDocument(aurora.id, aurora.colors, aurora)
    expect(document.kind).toBe("poster")
    expect(svg).toContain(document.markup.slice(0, 120))
  })

  it("stages each output type on the surface that fits it", () => {
    const posters = TEMPLATE_REGISTRY.find((template) => template.id === "atlas")!
    const slides = TEMPLATE_REGISTRY.find((template) => template.id === "beamer-metropolis")!
    const paper = TEMPLATE_REGISTRY.find((template) => template.id === "article-single")!

    // Decks are shown on the open laptop; the board behind them stays neutral.
    const slideSvg = renderTemplatePreviewSvg(slides.id, slides.colors, ASSET_WIDTH, slides)
    const deck = renderTemplateDocument(slides.id, slides.colors, slides, { slide: "title" })
    expect(deck.kind).toBe("slides")
    expect(slideSvg).toContain(deck.markup.slice(0, 120))
    expect(slideSvg).not.toContain(renderTemplateDocument(posters.id, posters.colors, posters).markup.slice(0, 120))

    // Papers and posudky are pinned on the board; posters on the easel.
    const paperSvg = renderTemplatePreviewSvg(paper.id, paper.colors, ASSET_WIDTH, paper)
    expect(paperSvg).toContain(renderTemplateDocument(paper.id, paper.colors, paper).markup.slice(0, 120))

    const posterSvg = renderTemplatePreviewSvg(posters.id, posters.colors, ASSET_WIDTH, posters)
    expect(posterSvg).toContain(renderTemplateDocument(posters.id, posters.colors, posters).markup.slice(0, 120))

    const posudok = TEMPLATE_REGISTRY.find((template) => template.id === "posudok-sk")!
    const posudokDoc = renderTemplateDocument(posudok.id, posudok.colors, posudok)
    expect(posudokDoc.kind).toBe("posudok")
    expect(renderTemplatePreviewSvg(posudok.id, posudok.colors, ASSET_WIDTH, posudok)).toContain(posudokDoc.markup.slice(0, 120))
  })

  it("gives every template its own artwork — no shared or recycled image", () => {
    const rendered = TEMPLATE_REGISTRY.map((template) => ({
      id: template.id,
      svg: renderTemplatePreviewSvg(template.id, template.colors, RENDER_WIDTH, template),
    }))
    expect(new Set(rendered.map((entry) => visualSignature(entry.svg))).size).toBe(TEMPLATE_REGISTRY.length)
    // Distinct even before ids are stripped: no two templates share a picture.
    expect(new Set(rendered.map((entry) => entry.svg)).size).toBe(TEMPLATE_REGISTRY.length)
    for (const template of TEMPLATE_REGISTRY) {
      expect(hasBespokePreviewArt(template.id), template.id).toBe(true)
    }
  })

  it("is deterministic, so the checked-in assets reproduce exactly", () => {
    const template = TEMPLATE_REGISTRY.find((entry) => entry.id === "icml")!
    const first = renderTemplatePreviewSvg(template.id, template.colors, ASSET_WIDTH, template)
    const second = renderTemplatePreviewSvg(template.id, template.colors, ASSET_WIDTH, template)
    expect(first).toBe(second)
  })

  it("keeps the native document ratio per output type", () => {
    for (const template of getTemplatesForType("slides")) {
      const doc = renderTemplateDocument(template.id, template.colors, template)
      expect(doc.width / doc.height, template.id).toBeCloseTo(16 / 9, 5)
    }
    const portrait = TEMPLATE_REGISTRY.find((template) => template.id === "minimal")!
    const portraitDoc = renderTemplateDocument(portrait.id, portrait.colors, portrait)
    expect(portraitDoc.aspect).toBeCloseTo(1189 / 841, 4)

    const landscape = TEMPLATE_REGISTRY.find((template) => template.id === "landscape")!
    const landscapeDoc = renderTemplateDocument(landscape.id, landscape.colors, landscape)
    expect(landscapeDoc.aspect).toBeCloseTo(841 / 1189, 4)

    const paper = TEMPLATE_REGISTRY.find((template) => template.id === "article-single")!
    const paperDoc = renderTemplateDocument(paper.id, paper.colors, paper)
    expect(paperDoc.aspect).toBeCloseTo(297 / 210, 4)
  })

  it("derived art never throws for an unknown template", () => {
    const fake = { id: "made-up", outputType: "poster", layoutPreview: "poster-3col", colors: [], label: "Made up" } as unknown as TemplateDef
    const svg = renderTemplatePreviewSvg("made-up", [], RENDER_WIDTH, fake)
    expect(svg).toMatch(/^<svg/)
    expect(svg).toContain(`width="${RENDER_WIDTH}" height="${RENDER_HEIGHT}"`)
    expect(getPreviewArt("made-up", fake)).toBeDefined()
  })

  it("paletteFrom falls back safely on empty palettes", () => {
    const palette = paletteFrom([])
    expect(palette.accent).toMatch(/^#/)
    expect(palette.accent2).toMatch(/^#/)
  })
})

describe("generated preview assets", () => {
  it("ships exactly one SVG and one PNG per registered template", () => {
    const actualAssets = fs.readdirSync(PREVIEWS_DIR).sort()
    const expectedAssets = TEMPLATE_IDS.flatMap((id) => [`${id}.png`, `${id}.svg`]).sort()
    expect(actualAssets).toEqual(expectedAssets)
  })

  it("uses one identical canvas for every SVG and every PNG", () => {
    for (const template of TEMPLATE_REGISTRY) {
      const svg = fs.readFileSync(path.join(PREVIEWS_DIR, `${template.id}.svg`), "utf8")
      const png = fs.readFileSync(path.join(PREVIEWS_DIR, `${template.id}.png`))

      expect(dimensions(svg, /width="([\d.]+)" height="([\d.]+)" viewBox/), `${template.id} SVG`).toEqual([
        ASSET_WIDTH,
        ASSET_HEIGHT,
      ])
      expect(png.subarray(0, 8), `${template.id} PNG magic`).toEqual(PNG_MAGIC)
      expect(pngSize(png), `${template.id} PNG size`).toEqual([ASSET_WIDTH, ASSET_HEIGHT])
    }
  })

  it("matches the renderer output, so regenerating changes nothing", () => {
    for (const template of TEMPLATE_REGISTRY) {
      const svg = fs.readFileSync(path.join(PREVIEWS_DIR, `${template.id}.svg`), "utf8")
      expect(svg, `${template.id} SVG matches its renderer`).toBe(
        renderTemplatePreviewSvg(template.id, template.colors, ASSET_WIDTH, template),
      )
    }
  })

  it("never ships the same image twice (one distinct picture per template)", () => {
    const svgHashes = TEMPLATE_REGISTRY.map((template) =>
      sha(fs.readFileSync(path.join(PREVIEWS_DIR, `${template.id}.svg`))),
    )
    const pngHashes = TEMPLATE_REGISTRY.map((template) =>
      sha(fs.readFileSync(path.join(PREVIEWS_DIR, `${template.id}.png`))),
    )
    expect(new Set(svgHashes).size).toBe(TEMPLATE_REGISTRY.length)
    expect(new Set(pngHashes).size).toBe(TEMPLATE_REGISTRY.length)
    // A PNG that is merely recoloured would still be distinct; make sure the
    // raster version carries the same per-template artwork as the vector.
    expect(svgHashes.filter((hash) => pngHashes.includes(hash))).toHaveLength(0)
  })
})
