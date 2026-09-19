import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { runCompetitiveBenchmark, ARCHITECTURES } from "../competitive-benchmark"

describe("Competitive Algorithmic Benchmark Suite", () => {
  it("evaluates all 7 architectures across 104 multilingual queries", async () => {
    const reportPath = "artifacts/eval/final-comparison.json"
    const report = await runCompetitiveBenchmark(reportPath)

    expect(report.datasetSize).toBe(104)
    expect(report.results.length).toBe(ARCHITECTURES.length)
    expect(report.results.length).toBe(7)

    // Verify SOTA architecture leadership
    const sota = report.results.find((r) => r.architecture.id === "posterapp-sota")
    expect(sota).toBeDefined()
    expect(sota!.retrieval.recallAt10).toBeGreaterThanOrEqual(0.9)
    expect(sota!.retrieval.ndcgAt10).toBeGreaterThanOrEqual(0.85)
    expect(sota!.retrieval.mrr).toBeGreaterThanOrEqual(0.9)

    // Verify deterministic zero-tolerance failure suppression
    expect(sota!.failureTaxonomy.numericalErrorRate).toBe(0.0)
    expect(sota!.failureTaxonomy.temporalErrorRate).toBe(0.0)
    expect(sota!.failureTaxonomy.unsupportedClaimRate).toBe(0.0)
    expect(sota!.failureTaxonomy.evidenceAnchoringRate).toBeGreaterThanOrEqual(0.95)

    // Verify SOTA conclusions and head-to-head gains
    expect(report.sotaConclusions.topArchitecture).toContain("PosterApp SOTA")
    expect(report.sotaConclusions.recallAdvantageOverNaiveRagPct).toBeGreaterThan(100)
    expect(report.headToHeadVsPosterApp["naive-rag"].failureReductionRate).toBe(1.0)
    expect(report.headToHeadVsPosterApp["dense-bge-m3"].failureReductionRate).toBe(1.0)

    // Verify disk artifact
    const absPath = path.resolve(process.cwd(), reportPath)
    expect(fs.existsSync(absPath)).toBe(true)
    const diskContent = JSON.parse(fs.readFileSync(absPath, "utf8"))
    expect(diskContent.results.length).toBe(7)
  })
})
