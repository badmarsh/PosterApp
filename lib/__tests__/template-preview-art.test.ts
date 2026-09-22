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

describe("template preview art", () => {
  it("every registered template renders a well-formed SVG", () => {
    for (const t of TEMPLATE_REGISTRY) {
      const svg = renderTemplatePreviewSvg(t.id, t.colors, 320, t)
      expect(svg, `${t.id} starts with <svg`).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/)
      expect(svg.endsWith("</svg>"), `${t.id} closes`).toBe(true)
      // viewBox must carry positive, finite dimensions.
      const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
      expect(vb, `${t.id} has a viewBox`).not.toBeNull()
      expect(Number(vb![1])).toBeGreaterThan(0)
      expect(Number(vb![2])).toBeGreaterThan(0)
      // No NaN/Infinity leaked into coordinates.
      expect(svg, `${t.id} has no NaN`).not.toContain("NaN")
      expect(svg, `${t.id} has no Infinity`).not.toContain("Infinity")
    }
  })

  it("slides are 16:9 and posters follow their board orientation", () => {
    for (const t of getTemplatesForType("slides")) {
      const vb = renderTemplatePreviewSvg(t.id, t.colors, 320, t).match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!
      const ratio = Number(vb[1]) / Number(vb[2])
      expect(ratio).toBeCloseTo(16 / 9, 1)
    }
    const portrait = renderTemplatePreviewSvg("minimal", TEMPLATE_REGISTRY[0].colors, 100, TEMPLATE_REGISTRY[0])
    const pVb = portrait.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!
    expect(Number(pVb[2])).toBeGreaterThan(Number(pVb[1])) // taller than wide

    const land = getTemplatesForType("poster").find((t) => t.id === "landscape")!
    const lVb = renderTemplatePreviewSvg("landscape", land.colors, 100, land).match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!
    expect(Number(lVb[1])).toBeGreaterThan(Number(lVb[2])) // wider than tall
  })

  it("the artwork uses the template's own palette", () => {
    const t = TEMPLATE_REGISTRY.find((x) => x.id === "aurora")!
    const svg = renderTemplatePreviewSvg(t.id, t.colors, 320, t)
    // aurora's first palette colour is teal #14B8A6
    expect(svg).toContain("#14B8A6")
  })

  it("new templates have bespoke (non-derived) art", () => {
    expect(hasBespokePreviewArt("aurora")).toBe(true)
    expect(hasBespokePreviewArt("beamer-editorial")).toBe(true)
    expect(hasBespokePreviewArt("atlas")).toBe(true)
  })

  it("derived art never throws for an unknown template", () => {
    const fake = { id: "made-up", outputType: "poster", layoutPreview: "poster-3col", colors: [] } as unknown as TemplateDef
    const svg = renderTemplatePreviewSvg("made-up", [], 320, fake)
    expect(svg).toMatch(/^<svg/)
    expect(getPreviewArt("made-up", fake)).toBeDefined()
  })

  it("paletteFrom falls back safely on empty palettes", () => {
    const p = paletteFrom([])
    expect(p.accent).toMatch(/^#/)
    expect(p.accent2).toMatch(/^#/)
  })
})

describe("generated preview assets exist on disk", () => {
  it("a .svg exists for every registered template", () => {
    for (const t of TEMPLATE_REGISTRY) {
      const file = path.join(PREVIEWS_DIR, `${t.id}.svg`)
      expect(fs.existsSync(file), `missing ${file} — run scripts/generate-template-previews.mjs`).toBe(true)
      const svg = fs.readFileSync(file, "utf8")
      expect(svg).toMatch(/^<svg/)
    }
  })

  it("the new templates ship matching assets", () => {
    expect(fs.existsSync(path.join(PREVIEWS_DIR, "aurora.svg"))).toBe(true)
    expect(fs.existsSync(path.join(PREVIEWS_DIR, "beamer-editorial.svg"))).toBe(true)
  })
})
