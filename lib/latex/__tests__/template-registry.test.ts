import { describe, it, expect } from "vitest"
import { TEMPLATE_REGISTRY, getTemplatesForType, type TemplateDef } from "@/lib/output-types"
import { getGenerator } from "@/lib/latex/generator"
import type { Card, Project } from "@/lib/poster-types"

/**
 * Guards the registry <-> generator contract. Every template offered in the
 * UI must actually produce a document; a registry entry with no generator
 * branch silently falls through to the default template, which is worse than
 * an error because the user gets the wrong venue format without being told.
 */

function makeCard(patch: Partial<Card> = {}): Card {
  return {
    id: "card_1",
    title: "Section",
    column: 1,
    order: 0,
    pattern: "section",
    content: "Body text.",
    table: { hasHeader: true, caption: "", rows: [] },
    figures: [],
    figureLayout: "single",
    sourceIds: [],
    heightBudget: null,
    validation: "valid",
    ...patch,
  }
}

function projectFor(t: TemplateDef, cards: Card[]): Project {
  return {
    id: "prj_1",
    revision: 1,
    name: "Test Project",
    authors: "Jane Roe",
    venue: "Venue 2026",
    activeOutputId: "out_1",
    outputs: [{ id: "out_1", outputType: t.outputType, templateId: t.id, title: "Doc Title", cards }],
    assets: [],
    ingestFiles: [],
  }
}

describe("Template registry", () => {
  it("has unique template ids", () => {
    const ids = TEMPLATE_REGISTRY.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(TEMPLATE_REGISTRY.map((t) => [t.id, t] as const))(
    "%s produces a compilable-looking document",
    (_id, t) => {
      const cards = [makeCard()]
      const gen = getGenerator(t.outputType, t.id)
      const tex = gen.generateDocument(projectFor(t, cards), {
        id: "out_1", outputType: t.outputType, templateId: t.id, title: "Doc Title", cards,
      } as never)

      expect(tex).toContain("\\documentclass")
      expect(tex).toContain("\\begin{document}")
      expect(tex).toContain("\\end{document}")
      // Braces must balance, or the compile aborts.
      const open = (tex.match(/(?<!\\)\{/g) ?? []).length
      const close = (tex.match(/(?<!\\)\}/g) ?? []).length
      expect(close).toBe(open)
    }
  )

  it("every paper template resolves to a distinct preamble", () => {
    const cards = [makeCard()]
    const seen = new Map<string, string>()
    for (const t of getTemplatesForType("paper")) {
      const gen = getGenerator("paper", t.id)
      const tex = gen.generateDocument(projectFor(t, cards), {
        id: "out_1", outputType: "paper", templateId: t.id, title: "Doc Title", cards,
      } as never)
      const preamble = tex.slice(0, tex.indexOf("\\begin{document}"))
      const clash = [...seen.entries()].find(([, p]) => p === preamble)
      expect(clash, `${t.id} produced the same preamble as ${clash?.[0]}`).toBeUndefined()
      seen.set(t.id, preamble)
    }
  })

  it("requiresClass only names classes not vendored in public/latex-styles", () => {
    // jinstpub.sty / pos.sty / JHEP.bst are vendored and copied into the
    // staging dir at compile time, so they must NOT be declared as missing.
    const vendored = ["jinstpub", "pos.sty", "JHEP.bst"]
    for (const t of TEMPLATE_REGISTRY) {
      for (const req of t.requiresClass ?? []) {
        expect(vendored, `${t.id} declares vendored ${req}`).not.toContain(req)
      }
    }
  })
})
