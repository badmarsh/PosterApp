import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { TEMPLATE_REGISTRY, getTemplatesForType, type TemplateDef } from "@/lib/output-types"
import {
  renderTemplatePreviewSvg,
  getPreviewArt,
  hasBespokePreviewArt,
  paletteFrom,
} from "@/lib/template-preview-art"

const PREVIEWS_DIR = path.join(process.cwd(), "public", "template-previews")
const TEMPLATE_IDS = TEMPLATE_REGISTRY.map((template) => template.id)

function dimensions(svg: string, pattern: RegExp) {
  const match = svg.match(pattern)
  expect(match, "preview SVG has dimensions").not.toBeNull()
  return [Number(match![1]), Number(match![2])] as const
}

function visualSignature(svg: string) {
  return svg.replace(/aria-label="[^"]*"/g, "").replace(/data-template-id="[^"]*"/g, "")
}

describe("template preview art", () => {
  it("renders a valid, consistently sized 4:3 SVG frame for every registered template", () => {
    for (const template of TEMPLATE_REGISTRY) {
      const svg = renderTemplatePreviewSvg(template.id, template.colors, 320, template)
      expect(svg, `${template.id} starts with SVG`).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/)
      expect(svg.endsWith("</svg>"), `${template.id} closes`).toBe(true)
      expect(svg, `${template.id} has a template id`).toContain(`data-template-id="${template.id}"`)

      const [frameWidth, frameHeight] = dimensions(svg, /viewBox="0 0 ([\d.]+) ([\d.]+)"/)
      expect(frameWidth).toBe(320)
      expect(frameWidth / frameHeight).toBeCloseTo(4 / 3, 5)
      expect(svg, `${template.id} has no NaN`).not.toContain("NaN")
      expect(svg, `${template.id} has no Infinity`).not.toContain("Infinity")
    }
  })

  it("fits each native document ratio inside the shared frame without stretching", () => {
    const nativeViewBox = /<svg x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+" viewBox="0 0 ([\d.]+) ([\d.]+)"/
    for (const template of getTemplatesForType("slides")) {
      const [width, height] = dimensions(renderTemplatePreviewSvg(template.id, template.colors, 320, template), nativeViewBox)
      expect(width / height, template.id).toBeCloseTo(16 / 9, 2)
    }

    const portrait = TEMPLATE_REGISTRY.find((template) => template.id === "minimal")!
    const [portraitWidth, portraitHeight] = dimensions(renderTemplatePreviewSvg(portrait.id, portrait.colors, 320, portrait), nativeViewBox)
    expect(portraitHeight).toBeGreaterThan(portraitWidth)

    const landscape = TEMPLATE_REGISTRY.find((template) => template.id === "landscape")!
    const [landscapeWidth, landscapeHeight] = dimensions(renderTemplatePreviewSvg(landscape.id, landscape.colors, 320, landscape), nativeViewBox)
    expect(landscapeWidth).toBeGreaterThan(landscapeHeight)

    const paper = TEMPLATE_REGISTRY.find((template) => template.id === "article-single")!
    const [paperWidth, paperHeight] = dimensions(renderTemplatePreviewSvg(paper.id, paper.colors, 320, paper), nativeViewBox)
    expect(paperHeight / paperWidth).toBeCloseTo(297 / 210, 2)
  })

  it("uses the template palette and an individual visual treatment", () => {
    const aurora = TEMPLATE_REGISTRY.find((template) => template.id === "aurora")!
    expect(renderTemplatePreviewSvg(aurora.id, aurora.colors, 320, aurora)).toContain("#14B8A6")

    const signatures = TEMPLATE_REGISTRY.map((template) =>
      visualSignature(renderTemplatePreviewSvg(template.id, template.colors, 320, template)),
    )
    expect(new Set(signatures).size).toBe(TEMPLATE_REGISTRY.length)
    for (const template of TEMPLATE_REGISTRY) {
      expect(hasBespokePreviewArt(template.id), template.id).toBe(true)
    }
  })

  it("derived art never throws for an unknown template", () => {
    const fake = { id: "made-up", outputType: "poster", layoutPreview: "poster-3col", colors: [] } as unknown as TemplateDef
    const svg = renderTemplatePreviewSvg("made-up", [], 320, fake)
    expect(svg).toMatch(/^<svg/)
    expect(getPreviewArt("made-up", fake)).toBeDefined()
  })

  it("paletteFrom falls back safely on empty palettes", () => {
    const palette = paletteFrom([])
    expect(palette.accent).toMatch(/^#/)
    expect(palette.accent2).toMatch(/^#/)
  })
})

describe("generated preview assets", () => {
  it("ships exactly one SVG and one 640 × 480 PNG per registered template", () => {
    const actualAssets = fs.readdirSync(PREVIEWS_DIR).sort()
    const expectedAssets = TEMPLATE_IDS.flatMap((id) => [`${id}.png`, `${id}.svg`]).sort()
    expect(actualAssets).toEqual(expectedAssets)

    for (const template of TEMPLATE_REGISTRY) {
      const svgPath = path.join(PREVIEWS_DIR, `${template.id}.svg`)
      const pngPath = path.join(PREVIEWS_DIR, `${template.id}.png`)
      const svg = fs.readFileSync(svgPath, "utf8")
      const png = fs.readFileSync(pngPath)
      expect(svg, `${template.id} SVG matches its art renderer`).toBe(renderTemplatePreviewSvg(template.id, template.colors, 320, template))
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      expect(png.readUInt32BE(16), `${template.id} PNG width`).toBe(640)
      expect(png.readUInt32BE(20), `${template.id} PNG height`).toBe(480)
    }
  })
})
