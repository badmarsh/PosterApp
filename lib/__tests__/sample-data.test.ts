import { describe, it, expect } from "vitest"
import {
  SAMPLE_EQUATIONS,
  SAMPLE_TABLE_PRESETS,
  SAMPLE_TABLE_ASSETS,
  formatMarkdownTable,
} from "../sample-data"
import katex from "katex"

describe("Sample Data - Equations & Tables", () => {
  describe("5 Sample Equations", () => {
    it("provides exactly 5 sample equations", () => {
      expect(SAMPLE_EQUATIONS).toHaveLength(5)
    })

    it("ensures each sample equation has required fields and valid KaTeX syntax", () => {
      for (const eq of SAMPLE_EQUATIONS) {
        expect(eq.id).toBeDefined()
        expect(eq.key).toMatch(/^eq:[a-z0-9_]+$/)
        expect(eq.name).toBeTruthy()
        expect(eq.formula).toBeTruthy()
        expect(eq.description).toBeTruthy()

        // Valid KaTeX syntax check
        expect(() => {
          katex.renderToString(eq.formula, { throwOnError: true })
        }).not.toThrow()
      }
    })

    it("covers the 5 intended mathematical formulations", () => {
      const keys = SAMPLE_EQUATIONS.map((e) => e.key)
      expect(keys).toContain("eq:elbo_variational")
      expect(keys).toContain("eq:attention_transformer")
      expect(keys).toContain("eq:euler_lagrange")
      expect(keys).toContain("eq:cross_entropy")
      expect(keys).toContain("eq:bellman_optimality")
    })
  })

  describe("5 Sample Tables", () => {
    it("provides exactly 5 sample table presets and assets", () => {
      expect(SAMPLE_TABLE_PRESETS).toHaveLength(5)
      expect(SAMPLE_TABLE_ASSETS).toHaveLength(5)
    })

    it("ensures each table preset has consistent row and column dimensions", () => {
      for (const table of SAMPLE_TABLE_PRESETS) {
        expect(table.id).toBeDefined()
        expect(table.name).toBeTruthy()
        expect(table.caption).toBeTruthy()
        expect(table.rows.length).toBeGreaterThan(1) // Header + at least one data row

        const colCount = table.rows[0].length
        expect(colCount).toBeGreaterThan(1)

        for (const row of table.rows) {
          expect(row.length).toBe(colCount)
          for (const cell of row) {
            expect(typeof cell).toBe("string")
            expect(cell.trim().length).toBeGreaterThan(0)
          }
        }
      }
    })

    it("covers the 5 intended scientific table categories", () => {
      const ids = SAMPLE_TABLE_PRESETS.map((t) => t.id)
      expect(ids).toContain("table_sample_benchmark")
      expect(ids).toContain("table_sample_complexity")
      expect(ids).toContain("table_sample_ablation")
      expect(ids).toContain("table_sample_hyperparams")
      expect(ids).toContain("table_sample_dataset")
    })

    it("converts sample table rows to formatted GitHub-flavored Markdown", () => {
      const benchmarkTable = SAMPLE_TABLE_PRESETS.find((t) => t.id === "table_sample_benchmark")!
      const md = formatMarkdownTable(benchmarkTable.rows, true)

      expect(md).toContain("| Task | DDPG Baseline | SAC Baseline | DreamerV3 | Ours (Latent Dyn.) |")
      expect(md).toContain("| --- | --- | --- | --- | --- |")
      expect(md).toContain("| Push | 82.4% | 89.1% | 91.5% | 96.8% ± 0.4% |")
    })

    it("handles edge cases in formatMarkdownTable safely", () => {
      expect(formatMarkdownTable([])).toBe("")
      expect(formatMarkdownTable([["Single Cell"]])).toContain("| Single Cell |")
    })
  })
})
