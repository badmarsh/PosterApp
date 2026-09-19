import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { computeNdcgAtK, runAblationMatrix, ABLATION_VARIANTS } from "../ablation-runner"

describe("Ablation Matrix and Retrieval Evaluation", () => {
  it("computes nDCG@10 correctly with relevant hits", () => {
    const chunks = [
      { id: "1", heading: "Metodika a experimenty" },
      { id: "2", heading: "Všeobecná časť" },
    ]
    const expected = ["metodika"]
    const ndcg = computeNdcgAtK(chunks, expected, 10)
    expect(ndcg).toBe(1.0)
  })

  it("penalizes later ranks in nDCG@10", () => {
    const chunksEarly = [
      { id: "1", heading: "Metodika" },
      { id: "2", heading: "Iné" },
    ]
    const chunksLate = [
      { id: "1", heading: "Iné" },
      { id: "2", heading: "Metodika" },
    ]
    const expected = ["metodika"]
    const ndcgEarly = computeNdcgAtK(chunksEarly, expected, 10)
    const ndcgLate = computeNdcgAtK(chunksLate, expected, 10)
    expect(ndcgEarly).toBeGreaterThan(ndcgLate)
  })

  it("runs the full 4-variant ablation matrix and generates retrieval-ablation.json", async () => {
    const artifactPath = "artifacts/eval/retrieval-ablation.json"
    const report = await runAblationMatrix(undefined, artifactPath)

    expect(report.variants.length).toBe(4)
    expect(report.datasetSize).toBeGreaterThanOrEqual(30)

    const fullFusion = report.variants.find((v) => v.variant === "full-fusion-expanded")
    expect(fullFusion).toBeDefined()
    expect(fullFusion?.meanRecallAt10).toBeGreaterThanOrEqual(0.8)

    // Check artifact file on disk
    const diskPath = path.resolve(process.cwd(), artifactPath)
    expect(fs.existsSync(diskPath)).toBe(true)
    const content = JSON.parse(fs.readFileSync(diskPath, "utf8"))
    expect(content.variants.length).toBe(4)
  })
})
