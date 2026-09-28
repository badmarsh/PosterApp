/**
 * Offline regression contract for the held-out golden retrieval evaluation.
 *
 * Replays the saved report from committed chunk/query text plus cached neural
 * vectors. Embedding calls are mocked to throw: this test must never touch a
 * model or the network. The metrics pin harness behavior against the committed
 * golden-v2 judgments; they do NOT establish real retrieval quality.
 */
import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "fs"
import { buildCriterionRetrievalQuery, supportsCalibrationEvidenceQueries } from "../../criterion-query"
import { SK_ACADEMIC_RUBRIC_V1 } from "../../rubric-engine"

vi.mock("../../local-embeddings", () => ({
  generateLocalEmbeddings: vi.fn(() => { throw new Error("Offline regression attempted to embed") }),
  generateLocalEmbedding: vi.fn(() => { throw new Error("Offline regression attempted to embed") }),
}))

const rewritten = ["methodology_rigor", "analytical_execution", "discussion_relation", "limitations_future_work"]

describe("held-out golden retrieval evaluation", () => {
  it("replays the saved report from cached vectors without embedding", async () => {
    const { runHeldoutGoldenEval } = await import("../heldout-golden-retrieval")
    const { report, labelAudit } = await runHeldoutGoldenEval({ cachedVectors: true, writeArtifacts: false })
    const saved = JSON.parse(readFileSync("artifacts/eval/heldout-golden/report.json", "utf8"))
    expect(report).toEqual(saved)

    expect(report.model).toBe("Xenova/paraphrase-multilingual-MiniLM-L12-v2")
    expect(report.dimensions).toBe(384)
    expect(report.fallbackCount).toBe(0)
    expect(report.queryCount).toBe(100)

    const byBinding = new Map(report.bindings.map((b) => [b.binding, b]))
    expect(byBinding.get("chunk-markdown")!.chunkUnits).toBe(273)
    expect(byBinding.get("split-for-eval")!.chunkUnits).toBe(117)
    expect(byBinding.get("split-for-eval")!.judgedChunksMissing).toBe(1)

    for (const b of report.bindings) {
      const byName = new Map(b.conditions.map((c) => [c.name, c]))
      for (const c of b.conditions) {
        // Non-vacuous measurement: the ranking stack does retrieve judged chunks.
        expect(c.macro.ndcg10).toBeGreaterThan(0)
        expect(c.macro.mrr).toBeGreaterThan(0)
        expect(c.macro.hit10).toBeGreaterThan(0.2)
      }
      // Real pgvector distances reproduce the in-memory cosine ranking exactly
      // at this scale (no ANN index): the offline dense leg is not diverging.
      expect(byName.get("dense-pglite")!.macro).toEqual(byName.get("dense-memory")!.macro)
      // Hybrid: real ts_rank execution stays close to the substring proxy on
      // these documents — small divergence allowed, direction and scale hold.
      const proxy = byName.get("hybrid-memory-proxy")!.macro
      const real = byName.get("hybrid-pglite")!.macro
      expect(Math.abs(real.ndcg10 - proxy.ndcg10)).toBeLessThanOrEqual(0.04)
      expect(Math.abs(real.hit5 - proxy.hit5)).toBeLessThanOrEqual(0.06)
      // Hybrid retrieval beats dense-only under both engines.
      for (const hybrid of ["hybrid-memory-proxy", "hybrid-pglite"]) {
        expect(byName.get(hybrid)!.macro.ndcg10).toBeGreaterThan(byName.get("dense-memory")!.macro.ndcg10)
      }
    }

    // Label provenance findings are part of the contract: the committed
    // judgments are not verified human ground truth and their chunk binding is
    // mixed. If these change, the labels changed — re-audit before trusting
    // any metric movement.
    expect(report.labelAudit.templatedVerificationRows).toBe(189)
    expect(report.labelAudit.gradeConflicts).toBe(0)
    expect(report.labelAudit.rationaleBindingPreference["split-for-eval"])
      .toBeGreaterThan(report.labelAudit.rationaleBindingPreference["chunk-markdown"])
    const savedAudit = JSON.parse(readFileSync("artifacts/eval/heldout-golden/label-audit.json", "utf8"))
    expect(labelAudit).toEqual(savedAudit)
    expect(labelAudit.rows.length).toBe(836)
  }, 300_000)

  it("does not broaden the calibration scope to the held-out titles", () => {
    const heldOutTitles = [
      "Attention Is All You Need",
      "BERT: Pre-training of Deep Bidirectional Transformers",
      "A Survey of Large Language Models",
      "Are LLMs Worse Than Humans at Following Prompts?",
    ]
    for (const thesisTitle of heldOutTitles) {
      expect(supportsCalibrationEvidenceQueries({ thesisTitle })).toBe(false)
      for (const id of rewritten) {
        const c = SK_ACADEMIC_RUBRIC_V1.criteria.find((x) => x.id === id)!
        const guidance = `${c.description.en} Caution: ${c.cautionGuidance.en}`
        expect(buildCriterionRetrievalQuery(id, c.labels.en, guidance, "en", { thesisTitle }))
          .toBe(`${c.labels.en} ${guidance}`.slice(0, 300))
      }
    }
    // Guard: the jet-calibration rewrite itself must survive this test file.
    expect(supportsCalibrationEvidenceQueries({ thesisTitle: "JES and JER from hadronic W bosons" })).toBe(true)
  })
})
