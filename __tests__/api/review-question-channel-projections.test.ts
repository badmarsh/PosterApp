import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * The two review question channels must stay separated for machine consumers
 * too. Both the canonical agent tool (`posterapp.review.latest`) and the REST
 * projection behind `/api/agent/workspaces/[id]/review/latest` publish the same
 * shape, so a paper/grant review exposes author questions and a thesis review
 * exposes defence questions — never the other way round, and never both.
 */

const THESIS_ONLY = "THESIS DEFENCE QUESTION — MUST NOT LEAK"
const AUTHOR_ONLY = "AUTHOR QUESTION — MUST NOT LEAK"

let currentReview: Record<string, unknown>

function reviewFor(kind: "thesis" | "paper" | "grant") {
  return {
    id: "rev-1",
    reviewKind: kind,
    status: "draft",
    suggestedGrade: null,
    finalGrade: null,
    recommendation: "Major revision",
    defenseQuestions: JSON.stringify([kind === "thesis" ? "How does the optimizer interact with batch size?" : THESIS_ONLY]),
    questionsForAuthors: JSON.stringify([kind === "thesis" ? AUTHOR_ONLY : "How was the sample size determined?"]),
    findings: JSON.stringify([{ id: "f-1" }]),
    createdAt: new Date("2026-10-05T10:00:00Z"),
  }
}

vi.mock("@/lib/agent-auth", () => ({
  AgentAuthError: class AgentAuthError extends Error {},
  verifyAgentKey: vi.fn().mockResolvedValue({ apiKeyId: "key-1", userId: "user-1", scopes: ["review:run"] }),
  requireScope: vi.fn(),
  requireAgentWorkspaceAccess: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/agent-audit", () => ({
  logToolCall: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    thesisReview: {
      findFirst: vi.fn().mockImplementation(async () => currentReview),
    },
    workspace: {
      findUnique: vi.fn().mockImplementation(async () => ({
        id: "ws-1",
        bibContent: "@article{smith2020, title={Prior work}}",
        outputs: [{ id: "out-1", isActive: true, cards: [] }],
        thesisReviews: [currentReview],
      })),
    },
  },
}))

const { AGENT_TOOLS } = await import("@/lib/agent-tools/registry")
const { GET } = await import("@/app/api/agent/workspaces/[id]/review/latest/route")

const latestTool = AGENT_TOOLS.find((tool) => tool.id === "posterapp.review.latest")!

async function callTool() {
  return latestTool.handler(
    { apiKeyId: "key-1", scopes: ["review:run"], workspaceId: "ws-1" } as never,
    { workspaceId: "ws-1" },
  ) as Promise<{ review: Record<string, unknown> }>
}

async function callRoute() {
  const response = await GET(
    new Request("http://localhost/api/agent/workspaces/ws-1/review/latest") as never,
    { params: Promise.resolve({ id: "ws-1" }) },
  )
  return response.json() as Promise<{ latestThesisReview: Record<string, unknown> | null }>
}

describe("agent review projections keep question channels separate", () => {
  beforeEach(() => {
    currentReview = reviewFor("paper")
  })

  it("exposes author questions — and no defence questions — for a paper review", async () => {
    const toolResult = await callTool()
    expect(toolResult.review.questionsForAuthors).toEqual(["How was the sample size determined?"])
    expect(toolResult.review.defenseQuestions).toBeNull()
    expect(JSON.stringify(toolResult)).not.toContain(THESIS_ONLY)

    const routePayload = await callRoute()
    expect(routePayload.latestThesisReview?.questionsForAuthors).toEqual(["How was the sample size determined?"])
    expect(routePayload.latestThesisReview?.defenseQuestions).toBeNull()
    expect(JSON.stringify(routePayload)).not.toContain(THESIS_ONLY)
  })

  it("exposes defence questions — and no author questions — for a thesis review", async () => {
    currentReview = reviewFor("thesis")

    const toolResult = await callTool()
    expect(toolResult.review.defenseQuestions).toEqual(["How does the optimizer interact with batch size?"])
    expect(toolResult.review.questionsForAuthors).toBeNull()
    expect(JSON.stringify(toolResult)).not.toContain(AUTHOR_ONLY)

    const routePayload = await callRoute()
    expect(routePayload.latestThesisReview?.defenseQuestions).toEqual(["How does the optimizer interact with batch size?"])
    expect(routePayload.latestThesisReview?.questionsForAuthors).toBeNull()
    expect(JSON.stringify(routePayload)).not.toContain(AUTHOR_ONLY)
  })

  it("treats grant reviews like paper reviews", async () => {
    currentReview = reviewFor("grant")

    const toolResult = await callTool()
    expect(toolResult.review.questionsForAuthors).toEqual(["How was the sample size determined?"])
    expect(toolResult.review.defenseQuestions).toBeNull()

    const routePayload = await callRoute()
    expect(routePayload.latestThesisReview?.questionsForAuthors).toEqual(["How was the sample size determined?"])
    expect(routePayload.latestThesisReview?.defenseQuestions).toBeNull()
  })
})
