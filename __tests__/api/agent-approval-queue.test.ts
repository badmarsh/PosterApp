import { describe, it, expect, beforeEach, vi } from "vitest"
import { applyAgentChange, rejectAgentChange } from "@/lib/agent-changes/apply"
import { executeAgentTool } from "@/lib/agent-tools/executor"
import { createWorkspaceSnapshot } from "@/lib/agent-snapshot"
import type { AgentContext } from "@/lib/agent-auth"

const { mockPrisma, mockRequireWorkspaceEditor } = vi.hoisted(() => {
  const prismaObj: any = {
    agentPendingChange: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    card: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    output: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    asset: {
      create: vi.fn(),
    },
    agentToolCallLog: {
      create: vi.fn(),
    },
    workspaceSnapshot: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => {
      if (typeof cb === "function") {
        return cb(prismaObj)
      }
      return Promise.all(cb)
    }),
  }
  return {
    mockPrisma: prismaObj,
    mockRequireWorkspaceEditor: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/auth", () => ({
  requireWorkspaceEditor: (...args: any[]) => mockRequireWorkspaceEditor(...args),
  auth: vi.fn().mockResolvedValue({ userId: "user_human" }),
  requireWorkspaceAccess: vi.fn().mockResolvedValue({ role: "owner" }),
}))

// Mock rate limiting
vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}))

// Mock agent auth workspace access check
vi.mock("@/lib/agent-auth", async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    requireAgentWorkspaceAccess: vi.fn().mockResolvedValue({
      id: "ws_test",
      userId: "user_owner",
      members: [{ role: "editor" }],
    }),
  }
})

describe("Phase 3 Approval Queue — Core Invariants (§9.2, §17)", () => {
  const mockAgentContext: AgentContext = {
    apiKeyId: "key_agent_1",
    userId: "user_owner",
    workspaceId: "ws_test",
    scopes: ["*"],
    restrictCardIds: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireWorkspaceEditor.mockResolvedValue({ userId: "user_human", role: "editor" })
    mockPrisma.workspace.update.mockResolvedValue({ id: "ws_test", revision: 2 })
    mockPrisma.workspaceSnapshot.findMany.mockResolvedValue([])
    mockPrisma.agentPendingChange.update.mockResolvedValue({})
  })

  it("1. cards.update NEVER writes directly to Card rows; enqueues AgentPendingChange", async () => {
    const expiresAt = new Date(Date.now() + 7 * 86_400_000)
    mockPrisma.card.findUnique.mockResolvedValue({
      id: "card_1",
      title: "Original Title",
      content: "Original Content",
      output: { workspaceId: "ws_test" },
    })

    mockPrisma.agentPendingChange.create.mockResolvedValue({
      id: "change_123",
      workspaceId: "ws_test",
      apiKeyId: "key_agent_1",
      toolName: "posterapp.cards.update",
      status: "pending",
      expiresAt,
    })

    const result = await executeAgentTool(mockAgentContext, "posterapp.cards.update", {
      workspaceId: "ws_test",
      cardId: "card_1",
      title: "New Proposed Title",
      rationale: "Optimizing title clarity",
    })

    // Assert cards.update did NOT call card.update directly
    expect(mockPrisma.card.update).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.data as any).status).toBe("pending")
      expect((result.data as any).changeId).toBe("change_123")
    }

    // Check that AgentPendingChange was created
    expect(mockPrisma.agentPendingChange.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "ws_test",
          toolName: "posterapp.cards.update",
          status: "pending",
          targetId: "card_1",
        }),
      })
    )

    // Audit log should NOT have approved=true on initial propose
    expect(mockPrisma.agentToolCallLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approved: false,
          toolName: "posterapp.cards.update",
          changeId: "change_123",
        }),
      })
    )
  })

  it("2. Conflict detection: approving after card was edited by human returns CONFLICT (§9.2 Step 5)", async () => {
    const proposalDate = new Date("2026-09-04T05:00:00.000Z")
    const humanEditDate = new Date("2026-09-04T05:15:00.000Z") // 15 mins later

    mockPrisma.agentPendingChange.findUnique.mockResolvedValue({
      id: "change_conflict",
      workspaceId: "ws_test",
      apiKeyId: "key_agent_1",
      toolName: "posterapp.cards.update",
      status: "pending",
      createdAt: proposalDate,
      expiresAt: new Date("2026-09-11T05:00:00.000Z"),
      payload: {
        workspaceId: "ws_test",
        cardId: "card_1",
        title: "Agent Title",
      },
    })

    mockPrisma.card.findUnique.mockResolvedValue({
      id: "card_1",
      title: "Human Edited Title",
      content: "Human Content",
      updatedAt: humanEditDate, // Human edit is AFTER proposal
      output: { workspaceId: "ws_test" },
    })

    const applyRes = await applyAgentChange("change_conflict", "user_human")

    expect(applyRes.ok).toBe(false)
    if (!applyRes.ok) {
      expect(applyRes.code).toBe("CONFLICT")
      expect((applyRes as any).currentCard.title).toBe("Human Edited Title")
      expect((applyRes as any).proposed.title).toBe("Agent Title")
    }

    // Mutation must NOT have occurred
    expect(mockPrisma.card.update).not.toHaveBeenCalled()
  })

  it("3. Force rebase bypasses conflict and applies mutation", async () => {
    const proposalDate = new Date("2026-09-04T05:00:00.000Z")
    const humanEditDate = new Date("2026-09-04T05:15:00.000Z")

    mockPrisma.agentPendingChange.findUnique.mockResolvedValue({
      id: "change_conflict",
      workspaceId: "ws_test",
      apiKeyId: "key_agent_1",
      toolName: "posterapp.cards.update",
      status: "pending",
      createdAt: proposalDate,
      expiresAt: new Date("2026-09-11T05:00:00.000Z"),
      payload: {
        workspaceId: "ws_test",
        cardId: "card_1",
        title: "Agent Overriding Title",
      },
      apiKey: { name: "Test Agent" },
    })

    mockPrisma.card.findUnique.mockResolvedValue({
      id: "card_1",
      title: "Human Edited Title",
      content: "Human Content",
      updatedAt: humanEditDate,
      output: { workspaceId: "ws_test" },
    })

    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: "ws_test",
      revision: 1,
      updatedAt: humanEditDate,
    })

    mockPrisma.workspaceSnapshot.create.mockResolvedValue({
      id: "snap_agent_rebase",
      workspaceId: "ws_test",
      source: "agent",
    })

    mockPrisma.card.update.mockResolvedValue({
      id: "card_1",
      title: "Agent Overriding Title",
      updatedAt: new Date(),
    })

    const applyRes = await applyAgentChange("change_conflict", "user_human", { forceRebase: true })

    expect(applyRes.ok).toBe(true)
    expect(mockPrisma.card.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "card_1" },
        data: expect.objectContaining({ title: "Agent Overriding Title" }),
      })
    )
  })

  it("4. Removing approver from workspace makes approve return 403 Forbidden (§9.2 Step 3)", async () => {
    mockPrisma.agentPendingChange.findUnique.mockResolvedValue({
      id: "change_auth_test",
      workspaceId: "ws_test",
      apiKeyId: "key_agent_1",
      toolName: "posterapp.cards.update",
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      payload: { workspaceId: "ws_test", cardId: "card_1", title: "New Title" },
      apiKey: { name: "Agent" },
    })

    // Simulate approver removed from workspace (throws 403 Response or error)
    mockRequireWorkspaceEditor.mockRejectedValueOnce(
      new Error("Access forbidden: You are not an editor of this workspace")
    )

    const applyRes = await applyAgentChange("change_auth_test", "user_removed_collaborator")

    expect(applyRes.ok).toBe(false)
    if (!applyRes.ok) {
      expect(applyRes.code).toBe("FORBIDDEN")
    }

    // Nothing was modified
    expect(mockPrisma.card.update).not.toHaveBeenCalled()
  })

  it("5. approved:true appears in audit log ONLY for applied changes (§9.2 Step 9 / §17)", async () => {
    mockPrisma.agentPendingChange.findUnique.mockResolvedValue({
      id: "change_apply_audit",
      workspaceId: "ws_test",
      apiKeyId: "key_agent_1",
      toolName: "posterapp.cards.update",
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      payload: {
        workspaceId: "ws_test",
        cardId: "card_1",
        title: "Final Approved Title",
      },
      apiKey: { name: "Agent" },
    })

    mockPrisma.card.findUnique.mockResolvedValue({
      id: "card_1",
      title: "Previous Title",
      updatedAt: new Date(Date.now() - 60_000),
      output: { workspaceId: "ws_test" },
    })

    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: "ws_test",
      revision: 1,
      updatedAt: new Date(Date.now() - 60_000),
    })

    mockPrisma.workspaceSnapshot.create.mockResolvedValue({
      id: "snap_agent_audit",
      workspaceId: "ws_test",
      source: "agent",
    })

    mockPrisma.card.update.mockResolvedValue({
      id: "card_1",
      title: "Final Approved Title",
      updatedAt: new Date(),
    })

    const applyRes = await applyAgentChange("change_apply_audit", "user_human")
    expect(applyRes.ok).toBe(true)

    // Verify approved: true was logged in AgentToolCallLog
    expect(mockPrisma.agentToolCallLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approved: true,
          toolName: "posterapp.cards.update",
          changeId: "change_apply_audit",
          workspaceId: "ws_test",
        }),
      })
    )
  })

  it("6. Rejection updates status to rejected and records decidedById", async () => {
    mockPrisma.agentPendingChange.findUnique.mockResolvedValue({
      id: "change_to_reject",
      workspaceId: "ws_test",
      status: "pending",
    })

    const rejectRes = await rejectAgentChange("change_to_reject", "user_human", "Does not fit poster tone")

    expect(rejectRes.ok).toBe(true)
    expect(mockPrisma.agentPendingChange.update).toHaveBeenCalledWith({
      where: { id: "change_to_reject" },
      data: expect.objectContaining({
        status: "rejected",
        decidedById: "user_human",
        error: "Does not fit poster tone",
      }),
    })
  })

  it("7. Expired change proposals return EXPIRED and transition status", async () => {
    const expiredDate = new Date(Date.now() - 1000) // 1 second ago

    mockPrisma.agentPendingChange.findUnique.mockResolvedValue({
      id: "change_expired",
      workspaceId: "ws_test",
      status: "pending",
      expiresAt: expiredDate,
    })

    const applyRes = await applyAgentChange("change_expired", "user_human")

    expect(applyRes.ok).toBe(false)
    if (!applyRes.ok) {
      expect(applyRes.code).toBe("EXPIRED")
    }

    expect(mockPrisma.agentPendingChange.update).toHaveBeenCalledWith({
      where: { id: "change_expired" },
      data: expect.objectContaining({ status: "expired" }),
    })
  })

  it("8. Snapshot coalescing within 60s without human edits reuses existing snapshot (§10)", async () => {
    const recentDate = new Date(Date.now() - 30_000) // 30s ago
    const olderWorkspaceDate = new Date(Date.now() - 40_000) // human edit was 40s ago

    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: "ws_test",
      revision: 3,
      updatedAt: olderWorkspaceDate,
    })

    mockPrisma.workspaceSnapshot.findFirst.mockResolvedValue({
      id: "snap_recent_agent",
      workspaceId: "ws_test",
      source: "agent",
      savedAt: recentDate,
    })

    const snap = await createWorkspaceSnapshot("ws_test", "agent:ablation-test", { source: "agent" })

    expect(snap.id).toBe("snap_recent_agent")
    // Should NOT have created a new snapshot
    expect(mockPrisma.workspaceSnapshot.create).not.toHaveBeenCalled()
  })

  it("9. posterapp.bibliography.add applies BibTeX update and bumps revision", async () => {
    mockPrisma.agentPendingChange.findUnique.mockResolvedValue({
      id: "change_bib_add",
      workspaceId: "ws_test",
      apiKeyId: "key_agent_1",
      toolName: "posterapp.bibliography.add",
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      payload: {
        workspaceId: "ws_test",
        title: "Quantum Attention Mechanism",
        authors: ["A. Einstein", "N. Bohr"],
        year: 2026,
        doi: "10.1038/s41586-026-0001",
      },
      apiKey: { name: "Research Agent" },
    })

    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: "ws_test",
      revision: 5,
      bibContent: "@article{orig2025,\n  title={Original}\n}",
      updatedAt: new Date(Date.now() - 100_000),
    })

    mockPrisma.workspaceSnapshot.create.mockResolvedValue({
      id: "snap_bib_agent",
      workspaceId: "ws_test",
      source: "agent",
    })

    const applyRes = await applyAgentChange("change_bib_add", "user_human")

    expect(applyRes.ok).toBe(true)
    expect(mockPrisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ws_test" },
        data: expect.objectContaining({
          bibContent: expect.stringContaining("Quantum Attention Mechanism"),
          revision: { increment: 1 },
        }),
      })
    )
  })

  it("10. Eviction policy evicts source:'agent' before source:'human' and preserves latest of each (§10)", async () => {
    const baseTime = Date.now()

    // 22 snapshots total (2 over MAX_SNAPSHOTS of 20):
    // Snap 0 (latest human, t = 22) -> MUST PROTECT
    // Snap 1 (latest agent, t = 21) -> MUST PROTECT
    // Snaps 2..15: human snapshots (older)
    // Snaps 16..21: agent snapshots (older)
    const snaps = [
      { id: "snap_h_latest", source: "human", savedAt: new Date(baseTime + 22000) },
      { id: "snap_a_latest", source: "agent", savedAt: new Date(baseTime + 21000) },
      { id: "snap_h_2", source: "human", savedAt: new Date(baseTime + 20000) },
      { id: "snap_h_3", source: "human", savedAt: new Date(baseTime + 19000) },
      { id: "snap_h_4", source: "human", savedAt: new Date(baseTime + 18000) },
      { id: "snap_h_5", source: "human", savedAt: new Date(baseTime + 17000) },
      { id: "snap_h_6", source: "human", savedAt: new Date(baseTime + 16000) },
      { id: "snap_h_7", source: "human", savedAt: new Date(baseTime + 15000) },
      { id: "snap_h_8", source: "human", savedAt: new Date(baseTime + 14000) },
      { id: "snap_h_9", source: "human", savedAt: new Date(baseTime + 13000) },
      { id: "snap_h_10", source: "human", savedAt: new Date(baseTime + 12000) },
      { id: "snap_h_11", source: "human", savedAt: new Date(baseTime + 11000) },
      { id: "snap_h_12", source: "human", savedAt: new Date(baseTime + 10000) },
      { id: "snap_h_13", source: "human", savedAt: new Date(baseTime + 9000) },
      { id: "snap_h_14", source: "human", savedAt: new Date(baseTime + 8000) },
      { id: "snap_h_15", source: "human", savedAt: new Date(baseTime + 7000) },
      { id: "snap_a_old_1", source: "agent", savedAt: new Date(baseTime + 6000) },
      { id: "snap_a_old_2", source: "agent", savedAt: new Date(baseTime + 5000) },
      { id: "snap_a_old_3", source: "agent", savedAt: new Date(baseTime + 4000) },
      { id: "snap_a_old_4", source: "agent", savedAt: new Date(baseTime + 3000) },
      { id: "snap_a_old_5", source: "agent", savedAt: new Date(baseTime + 2000) },
    ]

    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: "ws_test",
      revision: 10,
      updatedAt: new Date(baseTime + 30000), // after all snapshots
    })

    mockPrisma.workspaceSnapshot.findFirst.mockResolvedValue(null)
    mockPrisma.workspaceSnapshot.create.mockResolvedValue({
      id: "snap_new_agent",
      workspaceId: "ws_test",
      source: "agent",
    })
    mockPrisma.workspaceSnapshot.findMany.mockResolvedValue(snaps)

    await createWorkspaceSnapshot("ws_test", "agent:new-test", { source: "agent" })

    // 21 items in snaps > 20, so 1 item must be evicted.
    // The candidate list should pick oldest agent snapshot (snap_a_old_5)
    expect(mockPrisma.workspaceSnapshot.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["snap_a_old_5"]) } },
    })

    // Neither latest human nor latest agent should be evicted
    expect(mockPrisma.workspaceSnapshot.deleteMany).not.toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["snap_h_latest"]) } },
    })
    expect(mockPrisma.workspaceSnapshot.deleteMany).not.toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["snap_a_latest"]) } },
    })
  })
})
