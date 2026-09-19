/**
 * Tests for the improve_poster autonomous build & fix loop (Phase 2).
 *
 * Strategy: the DeerFlow HTTP bridge (streamDeerRun) hits a real in-process
 * fixture server (so the SSE parsing path is exercised end-to-end), while the
 * heavy PosterApp-side deps (compileWorkspace, prisma, snapshots, run-store,
 * budget, db) are vi.mock'd so the loop's *orchestration* is tested in
 * isolation — no real pdflatex, no real DB.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    card: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    workspace: { update: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock("@/lib/latex/compile-workspace", () => ({
  compileWorkspace: vi.fn(),
}))

vi.mock("@/lib/agent-snapshot", () => ({
  createWorkspaceSnapshot: vi.fn().mockResolvedValue({ id: "snap-1" }),
}))

vi.mock("../context", () => ({
  buildDeerflowContext: vi.fn(),
  getWorkspaceAssetIds: vi.fn(),
  buildImprovePosterContext: vi.fn(),
  getWorkspaceCardIds: vi.fn(),
}))

vi.mock("../run-store", () => ({
  appendRunEvent: vi.fn(),
  createRunRecord: vi.fn(),
  getRunRecord: vi.fn(() => undefined),
  setRunController: vi.fn(),
  updateRunRecord: vi.fn(),
}))

vi.mock("../budget", () => ({
  recordDeerflowSpend: vi.fn(),
}))

vi.mock("../db", () => ({
  updateDeerflowRun: vi.fn().mockResolvedValue(true),
  markRunInterrupted: vi.fn(),
}))

import { compileWorkspace } from "@/lib/latex/compile-workspace"
import { createWorkspaceSnapshot } from "@/lib/agent-snapshot"
import { buildImprovePosterContext, getWorkspaceCardIds } from "../context"
import { prisma } from "@/lib/prisma"
import { updateDeerflowRun } from "../db"
import { executeDeerflowImproveLoop } from "../runner"
import {
  createImprovePosterFixture,
  improvePosterFrames,
  buildImprovePosterProposal,
} from "../../../tests/fixtures/deerflow-gateway.mjs"

const mockedCompile = vi.mocked(compileWorkspace)
const mockedSnapshot = vi.mocked(createWorkspaceSnapshot)
const mockedCardUpdate = vi.mocked(prisma.card.updateMany)
const mockedWorkspaceUpdate = vi.mocked(prisma.workspace.update)
const mockedCardIds = vi.mocked(getWorkspaceCardIds)
const mockedImproveContext = vi.mocked(buildImprovePosterContext)
const mockedUpdateRun = vi.mocked(updateDeerflowRun)

const WORKSPACE_ID = "ws-1"
const RUN_ID = "run-1"
const DEER_THREAD_ID = "deer-thread-1"
const CARD_ID = "card_1"

type Fixture = Awaited<ReturnType<typeof createImprovePosterFixture>>

function baseParams(maxIterations: number) {
  return {
    workspaceId: WORKSPACE_ID,
    userId: "user-1",
    deerThreadId: DEER_THREAD_ID,
    runId: RUN_ID,
    kind: "improve_poster" as const,
    input: { kind: "improve_poster" as const, language: "en" as const, maxIterations, confirmEstimate: true },
    costEstimateUsd: 0.18,
  }
}

function setupContextMocks() {
  mockedCardIds.mockResolvedValue(new Set([CARD_ID]))
  mockedImproveContext.mockResolvedValue({
    language: "en",
    cards: [{ id: CARD_ID, title: "Intro", content: "broken content", pattern: "bullets" }],
    templateId: "atlas",
    outputType: "poster",
    truncated: false,
  })
}

describe("executeDeerflowImproveLoop", () => {
  let fixture: Fixture

  beforeEach(async () => {
    vi.clearAllMocks()
    setupContextMocks()
    // Default: every compile fails. Individual tests override with Once sequence.
    mockedCompile.mockResolvedValue({ ok: false, log: "! Undefined control sequence" })

    fixture = createImprovePosterFixture({ cardId: CARD_ID })
    await fixture.start()
    process.env.DEERFLOW_URL = fixture.url
    process.env.DEERFLOW_SERVICE_TOKEN = "test-token"
    process.env.DEERFLOW_ENABLED = "1"
  })

  afterEach(async () => {
    await fixture.stop()
    delete process.env.DEERFLOW_URL
    delete process.env.DEERFLOW_SERVICE_TOKEN
    delete process.env.DEERFLOW_ENABLED
  })

  it("patches cards, takes one snapshot, and marks done+clean when recompile succeeds", async () => {
    // Initial compile fails, recompile after patches succeeds.
    mockedCompile
      .mockResolvedValueOnce({ ok: false, log: "! Missing $ inserted" })
      .mockResolvedValueOnce({ ok: true, log: "clean" })

    await executeDeerflowImproveLoop(baseParams(3))

    // One iteration ran (clean on second compile → early stop).
    expect(mockedSnapshot).toHaveBeenCalledTimes(1)
    expect(mockedCardUpdate).toHaveBeenCalledTimes(1)
    expect(mockedWorkspaceUpdate).toHaveBeenCalledTimes(1)
    // Card patch carried safe Markdown content (no unsafe LaTeX) and cleared generatedLatex.
    const patchCall = mockedCardUpdate.mock.calls[0][0] as {
      where: { id: string }
      data: { content: string; generatedLatex: string | null }
    }
    expect(patchCall.where.id).toBe(CARD_ID)
    expect(patchCall.data.content).toContain("Fixed")
    expect(patchCall.data.generatedLatex).toBeNull()
    // Final DB write marks the run done with a clean-compile proposal.
    expect(mockedUpdateRun).toHaveBeenCalledWith(
      RUN_ID,
      WORKSPACE_ID,
      expect.objectContaining({
        status: "done",
        phase: "finished",
        proposal: expect.objectContaining({ cleanCompile: true }),
      })
    )
    expect(mockedCompile).toHaveBeenCalledTimes(2)
  })

  it("stops at maxIterations when compilation never becomes clean", async () => {
    // Always-failing compile (default mock), 2 iterations.
    fixture.resetCalls()
    // Provide distinct frames per iteration (per-call fixture serves callFrames[i]).
    const perCall = [
      improvePosterFrames(buildImprovePosterProposal({ cardId: CARD_ID, iterationCount: 1 })),
      improvePosterFrames(buildImprovePosterProposal({ cardId: CARD_ID, iterationCount: 1 })),
    ]
    await fixture.stop()
    fixture = createImprovePosterFixture({ callFrames: perCall })
    await fixture.start()
    process.env.DEERFLOW_URL = fixture.url

    await executeDeerflowImproveLoop(baseParams(2))

    // Two full iterations → two snapshots, two patch batches.
    expect(mockedSnapshot).toHaveBeenCalledTimes(2)
    expect(mockedCardUpdate).toHaveBeenCalledTimes(2)
    expect(mockedWorkspaceUpdate).toHaveBeenCalledTimes(2)
    expect(mockedUpdateRun).toHaveBeenCalledWith(
      RUN_ID,
      WORKSPACE_ID,
      expect.objectContaining({
        status: "done",
        proposal: expect.objectContaining({ cleanCompile: false }),
      })
    )
    expect(fixture.callCount).toBe(2)
  })

  it("breaks early without snapshot when the agent proposes zero patches", async () => {
    // Proposal with no patches.
    const emptyProposal = {
      version: "improve-poster-v1",
      iterations: [{ iterationIndex: 0, patches: [], compileLog: "", diagnosis: "nothing to fix" }],
      summary: "no patches",
      cleanCompile: false,
      meta: {},
    }
    await fixture.stop()
    fixture = createImprovePosterFixture({ callFrames: [improvePosterFrames(emptyProposal)] })
    await fixture.start()
    process.env.DEERFLOW_URL = fixture.url

    await executeDeerflowImproveLoop(baseParams(3))

    expect(mockedSnapshot).not.toHaveBeenCalled()
    expect(mockedCardUpdate).not.toHaveBeenCalled()
    // Run still finalizes as done (not failed) with cleanCompile=false.
    expect(mockedUpdateRun).toHaveBeenCalledWith(
      RUN_ID,
      WORKSPACE_ID,
      expect.objectContaining({ status: "done" })
    )
  })
})
