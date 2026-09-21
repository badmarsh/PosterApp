import { describe, it, expect } from "vitest"
import { ALL_SHOWCASE_PROJECTS, ELITE_SHOWCASES } from "@/lib/showcases-data"
import { generateFullTemplate } from "@/lib/latex/generator"
import { estimatePosterColumnOccupancy } from "@/lib/latex/validation"

describe("showcase poster column occupancy and generation", () => {
  it("keeps poster columns within 10% of the template budget and generates clean TeX", () => {
    const overflows: string[] = []
    for (const showcase of ALL_SHOWCASE_PROJECTS) {
      const posters = showcase.outputs.filter((o) => o.outputType === "poster")
      for (const output of posters) {
        const tex = generateFullTemplate(showcase, output, showcase.id)
        expect(tex).toContain("\\begin{document}")
        expect(tex).not.toMatch(/\\includegraphics(?:\[[^\]]*\])?\{\}/)

        const occ = estimatePosterColumnOccupancy(output.cards, output.templateId)
        for (const col of occ) {
          if (col.overflow > 0.1 * col.budget) {
            overflows.push(
              `${showcase.id} ${output.id} col ${col.column}: ${col.estimatedHeight}u / ${col.budget}u (+${col.overflow}u, ${(100 * col.overflow / col.budget).toFixed(1)}%)`,
            )
          }
        }
      }
    }
    expect(overflows, overflows.join("\n")).toEqual([])
  })

  it("keeps ELITE metadata within the showcase-card contract", () => {
    for (const elite of ELITE_SHOWCASES) {
      expect(elite.subtitle.length, elite.id).toBeLessThanOrEqual(180)
      expect(elite.highlights, elite.id).toHaveLength(3)
      expect(elite.tags.length, elite.id).toBeGreaterThanOrEqual(4)
      expect(elite.tags.length, elite.id).toBeLessThanOrEqual(6)
      for (const h of elite.highlights) {
        expect(h.label.length, `${elite.id} ${h.label}`).toBeLessThanOrEqual(40)
        expect(h.value, elite.id).toMatch(/[0-9]/)
      }
    }
  })
})
