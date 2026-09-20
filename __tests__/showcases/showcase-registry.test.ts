import { describe, it, expect } from "vitest"
import { ALL_SHOWCASE_PROJECTS, SHOWCASE_CATEGORIES, DEMO_WORKSPACE_IDS, getShowcaseById } from "@/lib/showcases-data"
import { sampleProjects, isDemoProject, DEMO_PROJECT_ID } from "@/lib/mock-data"
import { generateFullTemplate } from "@/lib/latex/generator"
import { TEMPLATE_REGISTRY } from "@/lib/output-types"

describe("Showcase Registry & LaTeX Generation", () => {
  it("exports all 11 landmark showcases with rich metadata", () => {
    expect(ALL_SHOWCASE_PROJECTS.length).toBe(11)
    const expectedIds = [
      "atlas-bose-einstein-correlations",
      "quantum-supremacy-sycamore",
      "alphafold-protein-folding",
      "posudok-diplomovka-ai",
      "attention-is-all-you-need",
      "resnet-deep-residual-learning",
      "bert-pre-training",
      "gans-goodfellow-2014",
      "vla-autonomous-surgery",
      "neural-wavefunction-superconductors",
      "cas13-panviral-immunity",
    ]
    for (const expectedId of expectedIds) {
      const showcase = ALL_SHOWCASE_PROJECTS.find((p) => p.id === expectedId)
      expect(showcase, `Showcase ${expectedId} must exist`).toBeDefined()
      expect(showcase!.outputs.length).toBeGreaterThanOrEqual(1)
      expect(showcase!.authors).toBeTruthy()
      expect(showcase!.venue).toBeTruthy()
      expect(showcase!.posterTitle).toBeTruthy()
    }
  })

  it("integrates all showcases into sampleProjects in mock-data", () => {
    expect(sampleProjects.length).toBe(12) // 1 default demo + 11 showcases
    expect(sampleProjects[0].id).toBe(DEMO_PROJECT_ID)
    for (const showcase of ALL_SHOWCASE_PROJECTS) {
      expect(sampleProjects.some((p) => p.id === showcase.id)).toBe(true)
    }
  })

  it("correctly flags all showcase IDs and demo IDs as demo projects", () => {
    expect(isDemoProject(DEMO_PROJECT_ID)).toBe(true)
    expect(isDemoProject("demo_xyz123")).toBe(true)
    for (const id of DEMO_WORKSPACE_IDS) {
      expect(isDemoProject(id)).toBe(true)
    }
    expect(isDemoProject("my-custom-private-workspace")).toBe(false)
  })

  it("ensures every showcase output uses a valid template registered in TEMPLATE_REGISTRY", () => {
    const registeredTemplateIds = TEMPLATE_REGISTRY.map((t) => t.id)
    for (const showcase of ALL_SHOWCASE_PROJECTS) {
      for (const output of showcase.outputs) {
        expect(
          registeredTemplateIds,
          `Template ${output.templateId} in ${showcase.id} must be registered in TEMPLATE_REGISTRY`
        ).toContain(output.templateId)
      }
    }
  })

  it("generates clean, non-empty LaTeX for every showcase active output", () => {
    for (const showcase of ALL_SHOWCASE_PROJECTS) {
      const active = showcase.outputs.find((o) => o.id === showcase.activeOutputId) || showcase.outputs[0]
      expect(active).toBeDefined()
      const tex = generateFullTemplate(showcase, active, showcase.id)
      expect(tex).toBeTruthy()
      expect(tex.length).toBeGreaterThan(1000)
      expect(tex).toContain("\\begin{document}")
      expect(tex).toContain("\\end{document}")
      // Ensure no raw unescaped unclosed math displays
      expect(tex).not.toContain("${title}\\[2mm]")
    }
  })

  it("retrieves showcases by ID via getShowcaseById helper", () => {
    const atlas = getShowcaseById("atlas-bose-einstein-correlations")
    expect(atlas).toBeDefined()
    expect(atlas?.templateName).toBe("atlas")
    expect(atlas?.logoUrl).toContain("atlas_transparent.png")
    expect(atlas?.secondaryLogoUrl).toContain("uk_logo.png")

    const sycamore = getShowcaseById("quantum-supremacy-sycamore")
    expect(sycamore).toBeDefined()
    expect(sycamore?.templateName).toBe("betterposter")

    const nonexistent = getShowcaseById("nonexistent_id")
    expect(nonexistent).toBeUndefined()
  })

  it("covers all major scientific categories", () => {
    const categoryIds = SHOWCASE_CATEGORIES.map((c) => c.id)
    expect(categoryIds).toContain("all")
    expect(categoryIds).toContain("ai-foundations")
    expect(categoryIds).toContain("physics")
    expect(categoryIds).toContain("quantum")
    expect(categoryIds).toContain("biology")
    expect(categoryIds).toContain("thesis-review")
  })

  it("enforces strict card_ prefix for every card across all outputs and demo projects", () => {
    const allProjects = [...sampleProjects, ...ALL_SHOWCASE_PROJECTS]
    for (const project of allProjects) {
      for (const output of project.outputs) {
        for (const card of output.cards) {
          expect(
            card.id.startsWith("card_"),
            "Card ID " + card.id + " in project " + project.id + " (output " + output.id + ") must start with card_"
          ).toBe(true)
        }
      }
    }
  })
})
