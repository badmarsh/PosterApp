import { describe, it, expect, vi } from "vitest"
import {
  extractBibTeX,
  findReferencesSection,
  heuristicParseReferencesToBibTeX,
  isValidBibtexEntry,
} from "../services/bibtex-service"

describe("bibtex-service", () => {
  describe("findReferencesSection", () => {
    it("detects English References and Bibliography headings", () => {
      const md = "# Introduction\n\nSome text\n\n## 6. References\n\n[1] Smith, J. (2020). Machine learning."
      const section = findReferencesSection(md)
      expect(section).not.toBeNull()
      expect(section).toContain("Smith, J. (2020)")
    })

    it("detects Slovak Literatúra and Zoznam použitej literatúry headings", () => {
      const md = "# 5. Výsledky\n\nText výsledkov...\n\n# Zoznam použitej literatúry\n\n[1] BEDNÁR, Maroš, 2021. Systém na granty. Bratislava: STU.\n[2] NOVÁK, Ján, 2022. Neurónové siete."
      const section = findReferencesSection(md)
      expect(section).not.toBeNull()
      expect(section).toContain("BEDNÁR, Maroš")
      expect(section).toContain("NOVÁK, Ján")
    })

    it("excludes subsequent Appendix / Prílohy sections", () => {
      const md = "# Literatúra\n\n[1] Kováč, M. (2023). Fyzika.\n\n# Prílohy\n\n## Príloha A\nZdrojové kódy..."
      const section = findReferencesSection(md)
      expect(section).not.toBeNull()
      expect(section).toContain("Kováč, M.")
      expect(section).not.toContain("Zdrojové kódy")
    })
  })

  describe("heuristicParseReferencesToBibTeX", () => {
    it("converts numbered citation list to valid BibTeX entries", () => {
      const refText = `[1] Smith, J. (2021). Deep learning for physics simulations. Journal of AI, 12(3), 45-60.
[2] Kováč, Peter (2022). "Neural PDE Solvers in Practice". Bratislava: UK.`

      const bib = heuristicParseReferencesToBibTeX(refText)
      expect(bib).toContain("@misc{smith2021")
      expect(bib).toContain("Deep learning for physics")
      expect(bib).toContain("@misc{kovac2022")
      expect(isValidBibtexEntry(bib.split("\n\n")[0])).toBe(true)
    })
  })

  describe("isValidBibtexEntry", () => {
    it("validates correct BibTeX entries", () => {
      const valid = `@article{smith2021,
  author = {Smith, John},
  title = {Deep Learning},
  year = {2021}
}`
      expect(isValidBibtexEntry(valid)).toBe(true)
    })

    it("rejects invalid or unsafe entries", () => {
      expect(isValidBibtexEntry("not a bibtex")).toBe(false)
      expect(isValidBibtexEntry("@article{broken, title={foo}")).toBe(false)
    })
  })

  describe("extractBibTeX", () => {
    it("should handle empty text gracefully", async () => {
      const result = await extractBibTeX("", "ws-id")
      expect(result).toEqual({ count: 0, keys: [] })
    })
  })
})
