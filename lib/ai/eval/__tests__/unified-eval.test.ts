import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { runAllEvaluations } from "../unified-eval-runner"

describe("Unified Evaluation Suite (pnpm eval:all)", () => {
  it("executes all evaluations and generates all 8 required artifacts", async () => {
    const summary = await runAllEvaluations("artifacts/eval")

    expect(summary.goldenDatasetSize).toBeGreaterThanOrEqual(40)
    expect(summary.retrieval.recallAt10).toBeGreaterThanOrEqual(0.9)
    expect(summary.evidenceGrounding.supportedRate).toBe(1.0)
    expect(summary.novelty.temporalValidityCompliance).toBe(1.0)
    expect(summary.reviewQuality.adjudicationPassRate).toBe(1.0)
    expect(summary.competitiveBenchmark.architecturesEvaluated).toBe(7)
    expect(summary.competitiveBenchmark.topArchitecture).toContain("PosterApp SOTA")

    const requiredFiles = [
      "retrieval.json",
      "models.json",
      "rerankers.json",
      "retrieval-ablation.json",
      "novelty.json",
      "evidence.json",
      "review.json",
      "summary.json",
      "final-comparison.json",
    ]

    for (const file of requiredFiles) {
      const p = path.resolve(process.cwd(), "artifacts/eval", file)
      expect(fs.existsSync(p), `Artifact ${file} must exist on disk`).toBe(true)
      const content = JSON.parse(fs.readFileSync(p, "utf8"))
      expect(content).toBeDefined()
    }
  })
})
