import { describe, it, expect } from "vitest"
import { verifyClaim } from "../claim-verifier"

describe("Deterministic Claim Verifier", () => {
  it("verifies a supported factual claim with matching evidence chunks", () => {
    const claim = {
      claimKey: "claim-test-1",
      text: "The proposed transformer model achieves 94.2% accuracy on the benchmark.",
    }
    const chunks = [
      {
        id: "chunk-1",
        content: "Experimental results demonstrate that our proposed transformer model achieves 94.2% accuracy on the benchmark.",
        heading: "Results",
      },
    ]

    const result = verifyClaim(claim, chunks)
    expect(result.verdict).toBe("SUPPORTED")
    expect(result.supportingEvidenceIds).toContain("chunk-1")
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it("marks a claim as CONTRADICTED when numerical data conflicts with tables", () => {
    const claim = {
      claimKey: "claim-test-2",
      text: "Our model achieved accuracy = 98.2% on the benchmark dataset.",
    }
    const chunks = [
      {
        id: "chunk-1",
        content: "Our model achieved accuracy = 98.2% on the benchmark dataset.",
        heading: "Abstract",
      },
    ]
    const tables = [
      {
        chunkId: "table-chunk-1",
        content: "| Model | Accuracy |\n| Baseline | 91.0% |\n| Ours | accuracy = 88.1% |",
      },
    ]

    const result = verifyClaim(claim, chunks, { tables })
    expect(result.verdict).toBe("CONTRADICTED")
    expect(result.numericalDiscrepancies.length).toBeGreaterThan(0)
    expect(result.contradictingEvidenceIds).toContain("table-chunk-1")
  })

  it("marks a claim as CONTRADICTED when explicit counter-evidence is provided", () => {
    const claim = {
      claimKey: "claim-test-3",
      text: "The algorithm scales linearly with input size across all conditions.",
    }
    const chunks = [
      {
        id: "chunk-1",
        content: "We find that the algorithm scales linearly with input size across all conditions.",
        heading: "Discussion",
      },
      {
        id: "chunk-counter-1",
        content: "However, this scalability fails completely when input size exceeds 10,000 tokens due to quadratic memory bounds.",
        heading: "Limitations",
      },
    ]

    const result = verifyClaim(claim, chunks)
    expect(result.verdict).toBe("CONTRADICTED")
    expect(result.contradictingEvidenceIds).toContain("chunk-counter-1")
  })

  it("marks a claim as UNSUPPORTED when no corroborating chunks exist", () => {
    const claim = {
      claimKey: "claim-test-4",
      text: "Superconducting transition temperature increases under 50 GPa hydrostatic pressure.",
    }
    const chunks = [
      {
        id: "chunk-x",
        content: "We study general agricultural economics in 19th century Moravia.",
        heading: "Historical Context",
      },
    ]

    const result = verifyClaim(claim, chunks)
    expect(result.verdict).toBe("UNSUPPORTED")
    expect(result.supportingEvidenceIds.length).toBe(0)
  })
})
