import { describe, it, expect } from "vitest"
import { logRetrievalTrace } from "../trace-logger"

describe("Retrieval Trace Logger", () => {
  it("runs without uncaught exceptions and safely handles environments without database connection", async () => {
    const traceId = await logRetrievalTrace({
      workspaceId: "ws-mock-trace",
      reviewId: "rev-mock-1",
      criterion: "methodology_rigor",
      queryCategory: "methodology",
      query: "neural network architectures",
      route: "dense+lexical+drift",
      candidateCounts: { dense: 10, lexical: 8, graph: 4 },
      ranking: [
        { id: "c-1", fusedScore: 0.94, source: "dense" },
        { id: "c-2", fusedScore: 0.88, source: "lexical" },
      ],
      selectedEvidenceIds: ["c-1", "c-2"],
      graphNodeIds: ["node-1"],
      stageLatencyMs: { retrieval: 25, rerank: 15 },
      totalLatencyMs: 40,
    })

    // Returns either created id or null on graceful fallback
    expect(traceId === null || typeof traceId === "string").toBe(true)
  })
})
