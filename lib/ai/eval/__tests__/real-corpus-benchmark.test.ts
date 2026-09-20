import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import {
  runRealCorpusBenchmark,
  computeRecallAtK,
  computeNdcgAtK,
  computeMrr,
} from "../real-corpus-benchmark"

describe("Real Corpus Benchmark Framework", () => {
  it("produces a valid report even when no corpus or golden judgments exist", async () => {
    const report = await runRealCorpusBenchmark(
      "data/eval/corpus-nonexistent",
      "data/eval/golden-v2-nonexistent",
      "artifacts/eval/real-test"
    )

    // Report structure assertions
    expect(report.timestamp).toBeTruthy()
    expect(report.methodology).toBe("empirical")
    expect(report.methodologyNote).toBeTruthy()
    expect(report.goldenSetSize).toBe(0)
    expect(report.limitations.length).toBeGreaterThan(0)
    expect(report.limitations[0]).toContain("No golden judgments")

    // All architectures listed but not executed
    expect(report.architectures.length).toBe(6)
    for (const arch of report.architectures) {
      expect(arch.status).toBe("not-executed")
      expect(arch.methodology).toBe("not-executed")
      expect(arch.reason).toBeTruthy()
      expect(arch.queriesEvaluated).toBe(0)
    }

    // Comparison structure exists
    expect(report.comparison.posterappVsBaseline.bm25).toBeDefined()
    expect(report.comparison.posterappVsBaseline.naiveRag).toBeDefined()

    // Artifact written to disk
    const artifactPath = path.resolve(process.cwd(), "artifacts/eval/real-test", "real-benchmark-report.json")
    expect(fs.existsSync(artifactPath)).toBe(true)
  })

  it("computes recall correctly", () => {
    const judgments = [
      { queryId: "q1", chunkId: "a", grade: 3 as const, annotatorId: "t", date: "", rationale: "" },
      { queryId: "q1", chunkId: "b", grade: 2 as const, annotatorId: "t", date: "", rationale: "" },
      { queryId: "q1", chunkId: "c", grade: 0 as const, annotatorId: "t", date: "", rationale: "" },
    ]

    // Perfect retrieval: [a, b, ...]
    expect(computeRecallAtK(["a", "b", "c"], judgments, 2)).toBe(1.0)
    // Partial retrieval: [a, c, ...] — only 'a' is relevant in top-2
    expect(computeRecallAtK(["a", "c", "b"], judgments, 2)).toBe(0.5)
    // No relevant in top-K
    expect(computeRecallAtK(["c", "d", "e"], judgments, 2)).toBe(0)
    // Vacuously true when no relevant items
    expect(computeRecallAtK(["x"], [{ queryId: "q1", chunkId: "x", grade: 0 as const, annotatorId: "t", date: "", rationale: "" }], 1)).toBe(1.0)
  })

  it("computes nDCG correctly", () => {
    const judgments = new Map([["a", 3], ["b", 2], ["c", 1]])

    // Perfect ranking: highest grade first
    expect(computeNdcgAtK(["a", "b", "c"], judgments, 3)).toBe(1.0)
    // Imperfect ranking
    const ndcg = computeNdcgAtK(["c", "b", "a"], judgments, 3)
    expect(ndcg).toBeLessThan(1.0)
    expect(ndcg).toBeGreaterThan(0)
    // Empty judgments
    expect(computeNdcgAtK(["a"], new Map(), 5)).toBe(1.0)
  })

  it("computes MRR correctly", () => {
    const relevant = new Set(["a", "b"])

    expect(computeMrr(["a", "c", "d"], relevant)).toBe(1.0)
    expect(computeMrr(["c", "a", "d"], relevant)).toBe(0.5)
    expect(computeMrr(["c", "d", "a"], relevant)).toBeCloseTo(1 / 3)
    expect(computeMrr(["x", "y", "z"], relevant)).toBe(0)
  })
})