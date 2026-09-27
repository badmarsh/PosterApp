import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "fs"
import { buildCriterionRetrievalQuery, supportsCalibrationEvidenceQueries } from "../criterion-query"
import { SK_ACADEMIC_RUBRIC_V1 } from "../rubric-engine"

// The regression must use saved neural query vectors, never network/model inference.
vi.mock("../local-embeddings", () => ({
  generateLocalEmbeddings: vi.fn(() => { throw new Error("Offline regression attempted to embed") }),
  generateLocalEmbedding: vi.fn(() => { throw new Error("Offline regression attempted to embed") }),
}))

const rewritten = ["methodology_rigor", "analytical_execution", "discussion_relation", "limitations_future_work"]

describe("criterion retrieval queries", () => {
  it("rewrites only the four measured English criteria, not evaluation guidance", () => {
    for (const c of SK_ACADEMIC_RUBRIC_V1.criteria) {
      for (const lang of ["en", "sk", "cs"] as const) {
        const guidance = `${c.description[lang]} Caution: ${c.cautionGuidance[lang]}`
        const original = `${c.labels[lang]} ${guidance}`.slice(0, 300)
        const query = buildCriterionRetrievalQuery(c.id, c.labels[lang], guidance, lang, { thesisTitle: "JES and JER from hadronic W bosons" })
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
    for (const id of ["methodology", "results", "originality_contribution", "unknown", "constructor", "__proto__", "toString"]) {
      const guidance = "evidence ".repeat(50)
      expect(buildCriterionRetrievalQuery(id, "Label", guidance, "en", { thesisTitle: "Jet energy scale calibration" }))
        .toBe(`Label ${guidance}`.slice(0, 300))
    }
  })

  it.each([
    "Jet energy scale calibration at a collider",
    "Jet energy resolution measurement",
    "JES and JER from hadronic W bosons",
    "JER and JES calibration",
  ])("recognizes an explicit calibration title: %s", (thesisTitle) => {
    expect(supportsCalibrationEvidenceQueries({ thesisTitle })).toBe(true)
  })

  it("does not impose statistical/calibration vocabulary on unknown or other disciplines", () => {
    for (const metadata of [undefined, {}, { thesisTitle: "Analysis_2" },
      { thesisTitle: "Interview study of teachers' experiences" },
      { thesisTitle: "Statistical analysis of survey results" },
      { thesisTitle: "Qualitative history of jet energy scale calibration" },
      { thesisTitle: "Interviews with researchers about jet energy calibration" },
      { department: "Physics", thesisTitle: "A study of education" },
      { department: "Physics" }, { thesisTitle: "Medieval atlas interpretation" }]) {
      for (const id of rewritten) {
        expect(buildCriterionRetrievalQuery(id, "Label", "Guidance", "en", metadata)).toBe("Label Guidance")
      }
    }
  })

  it("reproduces all reports from unchanged passage and cached neural query vectors", async () => {
    const { scoreCriterionQueries } = await import("../../../scripts/score-pipeline-variants")
    for (const mode of ["comparison", "pipeline", "criterion-aware"] as const) {
      const report = await scoreCriterionQueries(mode, { cachedQueries: true, writeReport: false })
      const reportName = mode === "criterion-aware" ? "criterion-aware" : `criterion-${mode}`
      const saved = JSON.parse(readFileSync(`artifacts/analysis-2/${reportName}.json`, "utf8"))
      expect(report).toEqual(saved)
      expect(report.passageUnits).toBe(473)
      expect(report.fallbackCount).toBe(0)
      for (const condition of report.conditions) {
        expect(condition.baselineHit5).toBe(3)
        expect(condition.candidateHit5).toBe(condition.kind === "dense" ? 5 : 6)
        expect(condition.accepted).toBe(true)
        for (const id of report.protectedIds) {
          const row = condition.detail.find(d => d.id === id)!
          expect(row.candidate.hit5).toBe(true)
          if (id !== "methodology_rigor") {
            expect(row.candidateQuery).toBe(row.baselineQuery)
            expect(row.candidate).toEqual(row.baseline)
          }
        }
        if (mode === "criterion-aware") {
          expect(condition.previousCandidateHit5).toBe(5)
          expect(condition.detail.find(d => d.id === "methodology_rigor")!.baseline.hit5).toBe(false)
          expect(condition.detail.find(d => d.id === "analytical_execution")!.baseline.hit5).toBe(true)
          expect(condition.detail.find(d => d.id === "analytical_execution")!.candidateRoute?.profiles).toContain("methodology")
        }
        expect(condition.detail.find(d => d.id === "originality_contribution")!.candidate.hit5).toBe(false)
      }
    }
  })
})
