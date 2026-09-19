import { describe, it, expect, vi } from "vitest"
import { retrieveDriftGraphContext } from "../graph-drift-retrieval"
import { prisma } from "@/lib/prisma"

// Mock the Prisma module (the established pattern in this repo — see
// __tests__/api/*). The previous version used vi.spyOn on the real client,
// which requires a generated query engine binary; without it (offline CI,
// engine-less sandboxes) merely touching `prisma.graphNode` throws
// "@prisma/client did not initialize yet". The DRIFT algorithm itself is pure
// over the nodes/edges it is fed, so a module mock exercises exactly the same
// code path.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    graphNode: {
      findMany: vi.fn(),
    },
    graphEdge: {
      findMany: vi.fn(),
    },
  },
}))

describe("DRIFT-style Iterative Graph Retrieval", () => {
  it("stops within iteration bounds and logs convergence step gains", async () => {
    const mockNodes = [
      { id: "n1", workspaceId: "ws-1", documentId: "d1", label: "Model", name: "Transformer", description: "Architecture" },
      { id: "n2", workspaceId: "ws-1", documentId: "d1", label: "Component", name: "Attention", description: "Mechanism" },
      { id: "n3", workspaceId: "ws-1", documentId: "d1", label: "Dataset", name: "CERN LHC", description: "Physics data" },
      { id: "n4", workspaceId: "ws-1", documentId: "d1", label: "Metric", name: "Accuracy", description: "Evaluation" },
    ]
    const mockEdges = [
      { id: "e1", workspaceId: "ws-1", documentId: "d1", sourceId: "n1", targetId: "n2", relation: "USES", evidence: null },
      { id: "e2", workspaceId: "ws-1", documentId: "d1", sourceId: "n1", targetId: "n3", relation: "EVALUATED_ON", evidence: null },
      { id: "e3", workspaceId: "ws-1", documentId: "d1", sourceId: "n3", targetId: "n4", relation: "MEASURED_BY", evidence: null },
    ]

    vi.mocked(prisma.graphNode.findMany).mockResolvedValueOnce(mockNodes as any)
    vi.mocked(prisma.graphEdge.findMany).mockResolvedValueOnce(mockEdges as any)

    const res = await retrieveDriftGraphContext("ws-1", "Transformer attention model", {
      maxIterations: 3,
      maxNodes: 10,
    })

    expect(res.iterationsExecuted).toBeGreaterThanOrEqual(1)
    expect(res.iterationsExecuted).toBeLessThanOrEqual(3)
    expect(res.expandedNodes.length).toBeGreaterThanOrEqual(2)
    expect(res.history.length).toBe(res.iterationsExecuted)
    expect(res.serializedSummary).toContain("DRIFT Iterative Graph Reasoning")
  })

  it("handles empty knowledge graphs gracefully", async () => {
    vi.mocked(prisma.graphNode.findMany).mockResolvedValueOnce([])

    const res = await retrieveDriftGraphContext("ws-empty", "any query")
    expect(res.expandedNodes.length).toBe(0)
    expect(res.iterationsExecuted).toBe(0)
    expect(res.serializedSummary).toBe("")
  })
})
