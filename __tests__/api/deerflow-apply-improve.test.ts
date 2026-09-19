/**
 * Tests for POST /api/workspaces/[id]/deerflow/runs/[runId]/apply-improve
 *
 * Validates the human confirmation route for improve_poster runs:
 *  - Auth, rate-limit, and run-status guards
 *  - Re-validation of the stored proposal against current card ids
 *  - Return value shape (appliedPatches, totalIterations, cleanCompile, skipped*)
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireWorkspaceEditor: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: vi.fn(async () => ({ allowed: true, retryAfterMs: 0 })),
}))

vi.mock("@/lib/deerflow/db", () => ({
  findRunForWorkspace: vi.fn(),
}))

vi.mock("@/lib/deerflow/context", () => ({
  getWorkspaceCardIds: vi.fn(async () => new Set(["card_1", "card_2"])),
}))

vi.mock("@/lib/agent-snapshot", () => ({
  createWorkspaceSnapshot: vi.fn(async () => ({ id: "snap-final" })),
}))

vi.mock("@/lib/deerflow/guard", () => ({
  toDeerflowResponse: vi.fn(() => null),
}))

import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { findRunForWorkspace } from "@/lib/deerflow/db"
import { getWorkspaceCardIds } from "@/lib/deerflow/context"
import { createWorkspaceSnapshot } from "@/lib/agent-snapshot"
import { POST } from "@/app/api/workspaces/[id]/deerflow/runs/[runId]/apply-improve/route"
import { NextRequest } from "next/server"

const mockAuth = vi.mocked(requireWorkspaceEditor)
const mockRateLimit = vi.mocked(rateLimitAsync)
const mockFindRun = vi.mocked(findRunForWorkspace)
const mockCardIds = vi.mocked(getWorkspaceCardIds)
const mockSnapshot = vi.mocked(createWorkspaceSnapshot)

function makeParams(id: string, runId: string) {
  return { params: Promise.resolve({ id, runId }) }
}

function makeRequest() {
  return new NextRequest("http://localhost/api/workspaces/ws-1/deerflow/runs/run-1/apply-improve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
}

const VALID_PROPOSAL = {
  version: "improve-poster-v1",
  iterations: [
    {
      iterationIndex: 0,
      patches: [
        { id: "card_1", content: "**Fixed** intro", rationale: "repaired math" },
        { id: "card_2", content: "Updated results", rationale: "fixed table" },
      ],
      compileLog: "! Missing $ inserted",
      diagnosis: "Unclosed math",
    },
  ],
  summary: "Two patches applied",
  cleanCompile: true,
  meta: {},
}

describe("POST /api/workspaces/[id]/deerflow/runs/[runId]/apply-improve", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", workspace: { deerflowEnabled: true } } as any)
    mockRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
    mockFindRun.mockResolvedValue({
      id: "run-1",
      workspaceId: "ws-1",
      userId: "user-1",
      deerThreadId: "deer-1",
      kind: "improve_poster",
      status: "done",
      phase: "finished",
      proposal: VALID_PROPOSAL,
      error: null,
      costEstimateUsd: 0.18,
      startedAt: new Date(),
      finishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    mockCardIds.mockResolvedValue(new Set(["card_1", "card_2"]))
  })

  it("returns 400 for invalid run id", async () => {
    const req = makeRequest()
    const res = await POST(req, makeParams("ws-1", "bad!id"))
    expect(res.status).toBe(400)
  })

  it("returns 404 when run not found", async () => {
    mockFindRun.mockResolvedValueOnce(null)
    const req = makeRequest()
    const res = await POST(req, makeParams("ws-1", "run-1"))
    expect(res.status).toBe(404)
  })

  it("returns 409 when run has not completed", async () => {
    mockFindRun.mockResolvedValueOnce({
      ...mockFindRun.mockResolvedValue.prototype,
      id: "run-1",
      workspaceId: "ws-1",
      kind: "improve_poster",
      status: "running",
      phase: "compiling",
    } as any)
    const req = makeRequest()
    const res = await POST(req, makeParams("ws-1", "run-1"))
    expect(res.status).toBe(409)
  })

  it("returns 400 when run kind is not improve_poster", async () => {
    mockFindRun.mockResolvedValueOnce({
      id: "run-1",
      workspaceId: "ws-1",
      kind: "poster_research",
      status: "done",
      phase: "finished",
      proposal: null,
    } as any)
    const req = makeRequest()
    const res = await POST(req, makeParams("ws-1", "run-1"))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/improve_poster/)
  })

  it("returns 422 when stored proposal fails re-validation", async () => {
    // Proposal with unknown top-level key smuggled in after the run finished.
    mockFindRun.mockResolvedValueOnce({
      id: "run-1",
      workspaceId: "ws-1",
      kind: "improve_poster",
      status: "done",
      phase: "finished",
      proposal: { ...VALID_PROPOSAL, secret_key: "leaked" },
    } as any)
    const req = makeRequest()
    const res = await POST(req, makeParams("ws-1", "run-1"))
    expect(res.status).toBe(422)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterMs: 30000 })
    const req = makeRequest()
    const res = await POST(req, makeParams("ws-1", "run-1"))
    expect(res.status).toBe(429)
  })

  it("returns 200 with counts for a valid improve_poster run", async () => {
    const req = makeRequest()
    const res = await POST(req, makeParams("ws-1", "run-1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.appliedPatches).toBe(2)
    expect(body.totalIterations).toBe(1)
    expect(body.cleanCompile).toBe(true)
    expect(body.skippedUnsafe).toBe(0)
    expect(body.skippedUnknown).toBe(0)
    expect(mockSnapshot).toHaveBeenCalledTimes(1)
  })

  it("counts skipped unsafe patches from the proposal", async () => {
    const proposalWithUnsafe = {
      ...VALID_PROPOSAL,
      iterations: [
        {
          iterationIndex: 0,
          patches: [
            { id: "card_1", content: "Safe content", rationale: "ok" },
            { id: "card_2", content: "\\write18{rm -rf /}", rationale: "evil" },
          ],
          compileLog: "",
          diagnosis: "",
        },
      ],
    }
    mockFindRun.mockResolvedValueOnce({
      id: "run-1",
      workspaceId: "ws-1",
      kind: "improve_poster",
      status: "done",
      phase: "finished",
      proposal: proposalWithUnsafe,
    } as any)

    const req = makeRequest()
    const res = await POST(req, makeParams("ws-1", "run-1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.appliedPatches).toBe(1) // only the safe patch
    expect(body.skippedUnsafe).toBe(1)
  })
})
