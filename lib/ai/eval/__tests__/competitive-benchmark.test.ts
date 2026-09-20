import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { runCompetitiveBenchmark, ARCHITECTURES } from "../competitive-benchmark"

describe("Competitive Algorithmic Benchmark Suite", () => {
  it("evaluates all 7 architectures and produces a valid artifact", async () => {
    const reportPath = "artifacts/eval/final-comparison.json"
    const report = await runCompetitiveBenchmark(reportPath)

    // Structural assertions: the benchmark runs without crashing and produces
    // the expected number of architecture results.
    expect(report.datasetSize).toBeGreaterThanOrEqual(40)
    expect(report.results.length).toBe(ARCHITECTURES.length)
    expect(report.results.length).toBe(7)

    // Verify each architecture has the required structure
    for (const result of report.results) {
      expect(result.architecture).toBeDefined()
      expect(result.architecture.id).toBeTruthy()
      expect(result.architecture.displayName).toBeTruthy()
      expect(result.architecture.family).toBeTruthy()

      // Retrieval metrics must be present and in valid ranges
      expect(result.retrieval).toBeDefined()
      expect(typeof result.retrieval.recallAt5).toBe("number")
      expect(typeof result.retrieval.recallAt10).toBe("number")
      expect(typeof result.retrieval.recallAt20).toBe("number")
      expect(typeof result.retrieval.ndcgAt10).toBe("number")
      expect(typeof result.retrieval.mrr).toBe("number")
      expect(result.retrieval.recallAt10).toBeGreaterThanOrEqual(0)
      expect(result.retrieval.recallAt10).toBeLessThanOrEqual(1)

      // Latency metrics must be present
      expect(result.latency).toBeDefined()
      expect(typeof result.latency.meanMs).toBe("number")
      expect(result.latency.meanMs).toBeGreaterThanOrEqual(0)

      // Failure taxonomy must be present
      expect(result.failureTaxonomy).toBeDefined()
      expect(typeof result.failureTaxonomy.retrievalMissRate).toBe("number")
      expect(typeof result.failureTaxonomy.numericalErrorRate).toBe("number")
      expect(typeof result.failureTaxonomy.evidenceAnchoringRate).toBe("number")
    }

    // Verify SOTA architecture exists
    const sota = report.results.find((r) => r.architecture.id === "posterapp-sota")
    expect(sota).toBeDefined()

    // Verify head-to-head comparison structure
    expect(report.headToHeadVsPosterApp).toBeDefined()
    for (const archId of Object.keys(report.headToHeadVsPosterApp)) {
      expect(typeof report.headToHeadVsPosterApp[archId].recallDelta).toBe("number")
      expect(typeof report.headToHeadVsPosterApp[archId].ndcgDelta).toBe("number")
    }

    // Verify SOTA conclusions structure
    expect(report.sotaConclusions).toBeDefined()
    expect(typeof report.sotaConclusions.topArchitecture).toBe("string")
    expect(typeof report.sotaConclusions.recallAdvantageOverNaiveRagPct).toBe("number")

    // Verify the artifact was written to disk
    const absPath = path.resolve(process.cwd(), reportPath)
    expect(fs.existsSync(absPath)).toBe(true)
    const diskContent = JSON.parse(fs.readFileSync(absPath, "utf8"))
    expect(diskContent.results.length).toBe(7)
  })

  it("uses simulated methodology honestly (not empirical)", () => {
    // The competitive benchmark uses simulateRetrieval(), which is hash-based.
    // This test documents that fact. The benchmark file itself should declare
    // methodology: simulated in its output, and no test should assert specific
    // metric values as if they were real measurements.
    expect(ARCHITECTURES.length).toBe(7)
    expect(ARCHITECTURES.map((a) => a.id)).toContain("posterapp-sota")
    expect(ARCHITECTURES.map((a) => a.id)).toContain("naive-rag")
  })
})