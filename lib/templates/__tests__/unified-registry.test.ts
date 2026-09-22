import { describe, it, expect } from "vitest"
import {
  getUnifiedTemplate,
  listUnifiedTemplates,
  unifiedTemplatesFor,
  scaffoldFor,
  scaffoldPatternIsValid,
} from "../unified-registry"
import { TEMPLATE_REGISTRY } from "@/lib/output-types"
import { ELITE_SHOWCASES, ALL_SHOWCASE_PROJECTS } from "@/lib/showcases-data"

/**
 * The unification contract: a template registered for the UI must also resolve
 * to a generator, carry preview art, and offer a valid seed scaffold — and the
 * demo workspaces must only ever reference registered templates.
 */
describe("unified registry", () => {
  it("mirrors the UI registry one-to-one", () => {
    expect(listUnifiedTemplates().map((t) => t.id).sort()).toEqual([...TEMPLATE_REGISTRY.map((t) => t.id)].sort())
  })

  it("every unified template yields a working generator for its output type", () => {
    for (const t of listUnifiedTemplates()) {
      const gen = t.createGenerator()
      expect(gen.outputType, `${t.id} generator output type`).toBe(t.outputType)
    }
  })

  it("every unified template has preview art and renders an SVG", () => {
    for (const t of listUnifiedTemplates()) {
      expect(t.previewArt, `${t.id} art`).toBeDefined()
      expect(t.renderPreview()).toMatch(/^<svg/)
    }
  })

  it("the new templates are present and bespoke", () => {
    expect(getUnifiedTemplate("aurora")?.hasBespokeArt).toBe(true)
    expect(getUnifiedTemplate("beamer-editorial")?.hasBespokeArt).toBe(true)
  })

  it.each(["poster", "slides", "paper", "thesis-review"] as const)(
    "default scaffold for %s only uses patterns legal for that type",
    (type) => {
      for (const card of scaffoldFor(type)) {
        expect(scaffoldPatternIsValid(type, card.pattern), `${type}:${card.pattern}`).toBe(true)
      }
    },
  )

  it("unifiedTemplatesFor filters correctly", () => {
    expect(unifiedTemplatesFor("slides").every((t) => t.outputType === "slides")).toBe(true)
    expect(unifiedTemplatesFor("slides").map((t) => t.id)).toContain("beamer-editorial")
  })
})

describe("demo workspaces reference only registered templates", () => {
  it("every showcase output templateId resolves to a unified template", () => {
    const missing: string[] = []
    for (const project of ALL_SHOWCASE_PROJECTS) {
      for (const out of project.outputs) {
        if (!getUnifiedTemplate(out.templateId)) missing.push(`${project.id}:${out.templateId}`)
      }
    }
    expect(missing, missing.join(", ")).toEqual([])
  })

  it("every elite showcase's declared outputs are all represented in its project", () => {
    for (const elite of ELITE_SHOWCASES) {
      const project = ALL_SHOWCASE_PROJECTS.find((p) => p.id === elite.id)
      if (!project) continue
      const types = new Set(project.outputs.map((o) => o.outputType))
      for (const want of elite.outputs) {
        expect(types.has(want), `${elite.id} missing output ${want}`).toBe(true)
      }
    }
  })
})
