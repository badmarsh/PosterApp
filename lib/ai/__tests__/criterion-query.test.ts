import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "fs"
import { buildCriterionRetrievalQuery } from "../criterion-query"
import { SK_ACADEMIC_RUBRIC_V1 } from "../rubric-engine"

// The regression must use saved neural query vectors, never network/model inference.
vi.mock("../local-embeddings", () => ({
  generateLocalEmbeddings: vi.fn(() => { throw new Error("Offline regression attempted to embed") }),
  generateLocalEmbedding: vi.fn(() => { throw new Error("Offline regression attempted to embed") }),
}))

const rewritten = ["analytical_execution", "discussion_relation", "limitations_future_work"]

describe("criterion retrieval queries", () => {
  it("rewrites only the three measured English criteria, not evaluation guidance", () => {
    for (const c of SK_ACADEMIC_RUBRIC_V1.criteria) {
      for (const lang of ["en", "sk", "cs"] as const) {
        const guidance = `${c.description[lang]} Caution: ${c.cautionGuidance[lang]}`
        const original = `${c.labels[lang]} ${guidance}`.slice(0, 300)
        const query = buildCriterionRetrievalQuery(c.id, c.labels[lang], guidance, lang)
        if (lang === "en" && rewritten.includes(c.id)) {
          expect(query).not.toBe(original)
          expect(query.length).toBeLessThanOrEqual(300)
          expect(query).not.toMatch(/STEM|Fyzika|ATLAS|JES|JER|0\.929|half of the maximum|hessian|geant4|will be later constructed/i)
        } else {
          expect(query).toBe(original)
        }
      }
    }
  })

  it("preserves legacy and unknown criterion queries and their length cap", () => {
    for (const id of ["methodology", "results", "originality_contribution", "unknown"]) {
      const guidance = "evidence ".repeat(50)
      expect(buildCriterionRetrievalQuery(id, "Label", guidance, "en"))
        .toBe(`Label ${guidance}`.slice(0, 300))
    }
  })

  it("reproduces both reports from unchanged passage and cached neural query vectors", async () => {
    const { scoreCriterionQueries } = await import("../../../scripts/score-pipeline-variants")
    for (const mode of ["comparison", "pipeline"] as const) {
      const report = await scoreCriterionQueries(mode, { cachedQueries: true, writeReport: false })
      const saved = JSON.parse(readFileSync(`artifacts/analysis-2/criterion-${mode}.json`, "utf8"))
      expect(report).toEqual(saved)
      expect(report.passageUnits).toBe(473)
      expect(report.fallbackCount).toBe(0)
      for (const condition of report.conditions) {
        expect(condition.baselineHit5).toBe(3)
        expect(condition.candidateHit5).toBe(condition.kind === "dense" ? 5 : 6)
        expect(condition.accepted).toBe(true)
        for (const id of report.protectedIds) {
          const row = condition.detail.find(d => d.id === id)!
          expect(row.candidateQuery).toBe(row.baselineQuery)
          expect(row.candidate).toEqual(row.baseline)
        }
        expect(condition.detail.find(d => d.id === "originality_contribution")!.candidate.hit5).toBe(false)
      }
    }
  })
})
