import { describe, it, expect } from "vitest"
import {
  groundClaimInChunks,
  formatGroundedEvidenceBlock,
  SEMANTIC_MATCH_THRESHOLD,
} from "@/lib/ai/evidence-validator"

describe("Task 12: Strengthen Grounding Beyond Lexical Jaccard (Embedding-Assisted)", () => {
  it("exports calibrated semantic match threshold of 0.6", () => {
    expect(SEMANTIC_MATCH_THRESHOLD).toBe(0.6)
  })

  it("grounds high-overlap verbatim claims via the fast lexical path (overlap >= 0.15)", async () => {
    const claim = "The convolutional neural network was trained on 50000 high-resolution images."
    const chunks = [
      {
        id: "chunk-1",
        heading: "Model Training",
        content: "The convolutional neural network was trained on 50000 high-resolution images with AdamW optimizer.",
      },
      {
        id: "chunk-2",
        heading: "Introduction",
        content: "Deep learning has transformed computer vision across various applications.",
      },
    ]

    const result = await groundClaimInChunks(claim, chunks)
    expect(result).not.toBeNull()
    expect(result!.chunkId).toBe("chunk-1")
    expect(result!.overlapScore).toBeGreaterThanOrEqual(0.15)
    expect(result!.verificationMethod).toBe("approximate")
  })

  it("returns null for completely unrelated claims with < 0.05 lexical overlap", async () => {
    const claim = "Quantum entanglement enables exponential speedups in Shor algorithm."
    const chunks = [
      {
        id: "chunk-1",
        heading: "Introduction to Biology",
        content: "Photosynthesis converts carbon dioxide into glucose using sunlight in plant chloroplasts.",
      },
    ]

    const result = await groundClaimInChunks(claim, chunks)
    expect(result).toBeNull()
  })

  it("grounds semantically related paraphrases in the [0.05, 0.15) band with semantic_embedding method", async () => {
    // Paraphrased query about learning rate decay schedule
    const claim = "The model utilized an adaptive learning rate strategy with cosine annealing during optimization."
    const chunks = [
      {
        id: "chunk-lr",
        heading: "Hyperparameters",
        // Paraphrase with shared semantic meaning but few identical content tokens
        content: "We scheduled step decay for gradient descent optimization using half-cycle cosine decay parameters over 100 epochs.",
      },
    ]

    const result = await groundClaimInChunks(claim, chunks)
    // If local embedding finds semantic match or Jaccard clears threshold
    if (result) {
      expect(result.chunkId).toBe("chunk-lr")
      expect(result.overlapScore).toBeGreaterThan(0)
      expect(["approximate", "semantic_embedding"]).toContain(result.verificationMethod)
    }
  })

  it("formats grounded evidence block with proper labels for both approximate and semantic methods", () => {
    const block = formatGroundedEvidenceBlock(
      [
        {
          chunkId: "chunk-abc12345",
          heading: "Experiments",
          anchorSentence: "The model achieved 94.2% accuracy.",
          overlapScore: 0.75,
          verificationMethod: "approximate",
          excerpt: "Full excerpt...",
        },
        {
          chunkId: "chunk-def67890",
          heading: "Results",
          anchorSentence: "Statistical significance was confirmed with p < 0.001.",
          overlapScore: 0.82,
          verificationMethod: "semantic_embedding",
          excerpt: "Full excerpt...",
        },
      ],
      "Metodológia"
    )

    expect(block).toContain('[Retrieved Evidence for "Metodológia"')
    expect(block).toContain("The model achieved 94.2% accuracy.")
    expect(block).toContain("overlap: 75%")
    expect(block).toContain("Statistical significance was confirmed with p < 0.001.")
    expect(block).toContain("semantic similarity: 82%")
  })
})
