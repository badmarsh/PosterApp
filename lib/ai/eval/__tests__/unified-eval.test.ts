import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { runAllEvaluations } from "../unified-eval-runner"

describe("Unified Evaluation Suite (pnpm eval:all)", () => {
  it("executes all evaluations and generates all required artifacts", async () => {
    const summary = await runAllEvaluations("artifacts/eval")

    // Structural assertions: the runner completes without crashing and produces
    // a summary with all expected top-level fields.
    expect(summary.timestamp).toBeTruthy()
    expect(summary.goldenDatasetSize).toBeGreaterThanOrEqual(40)

    // Retrieval section: metrics exist and are in valid ranges
    expect(summary.retrieval).toBeDefined()
    expect(typeof summary.retrieval.recallAt10).toBe("number")
    expect(summary.retrieval.recallAt10).toBeGreaterThanOrEqual(0)
    expect(summary.retrieval.recallAt10).toBeLessThanOrEqual(1)
    expect(typeof summary.retrieval.ndcgAt10).toBe("number")
    expect(typeof summary.retrieval.mrr).toBe("number")

    // Models section: evaluated models are listed
    expect(summary.models).toBeDefined()
    expect(summary.models.evaluatedCount).toBeGreaterThan(0)
    expect(summary.models.recommendedEmbedding).toBeTruthy()

    // Evidence grounding: claims were evaluated
    expect(summary.evidenceGrounding).toBeDefined()
    expect(summary.evidenceGrounding.claimsEvaluated).toBeGreaterThan(0)
    expect(typeof summary.evidenceGrounding.supportedRate).toBe("number")

    // Novelty: temporal compliance tested
    expect(summary.novelty).toBeDefined()
    expect(typeof summary.novelty.temporalValidityCompliance).toBe("number")

    // Review quality: adjudication tested
    expect(summary.reviewQuality).toBeDefined()
    expect(typeof summary.reviewQuality.adjudicationPassRate).toBe("number")

    // Competitive benchmark: architectures evaluated
    expect(summary.competitiveBenchmark).toBeDefined()
    expect(summary.competitiveBenchmark.architecturesEvaluated).toBeGreaterThanOrEqual(7)
    expect(summary.competitiveBenchmark.topArchitecture).toBeTruthy()

    // Verify all required artifact files exist on disk
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
      // Every artifact must have a timestamp
      expect(content.timestamp).toBeTruthy()
    }
  })

  it("documented simulation honesty: final-comparison uses simulated retrieval", async () => {
    // The competitive benchmark (final-comparison.json) uses simulateRetrieval()
    // which is a hash-based deterministic simulator. This is NOT real measurement.
    // Real benchmarks require pnpm eval:real with actual PGlite/ONNX inference.
    // This test exists to document that distinction.
    const comparisonPath = path.resolve(process.cwd(), "artifacts/eval", "final-comparison.json")
    if (fs.existsSync(comparisonPath)) {
      const content = JSON.parse(fs.readFileSync(comparisonPath, "utf8"))
      // The artifact exists; its results are simulated (hash-based baseHitProb).
      // No specific metric values should be asserted as they are not real measurements.
      expect(content.results).toBeDefined()
      expect(content.results.length).toBeGreaterThanOrEqual(1)
    }
  })
})