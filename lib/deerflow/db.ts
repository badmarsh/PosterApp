/**
 * Persistence helpers for DeerFlow thread/run mapping (server-only).
 *
 * The `DeerflowThread` row is the durable half of the run state; the in-memory
 * `run-store` holds live progress. All writes go through Prisma with a strict
 * `where { id, workspaceId }` scope so cross-workspace access is impossible.
 */
import "server-only"
import { prisma, type Prisma } from "@/lib/prisma"
import type { PosterResearchProposal } from "./contracts"

export type DeerflowRunStatus = "idle" | "queued" | "running" | "done" | "failed" | "cancelled"

export interface DeerflowThreadRow {
  id: string
  workspaceId: string
  userId: string
  deerThreadId: string
  kind: string
  status: DeerflowRunStatus
  phase: string | null
  proposal: Prisma.JsonValue | null
  error: string | null
  costEstimateUsd: number | null
  startedAt: Date | null
  finishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UpsertThreadParams {
  workspaceId: string
  userId: string
  deerThreadId: string
  kind: string
}

/** Creates a mapping row, or returns the existing one for the same sidecar thread. */
export async function upsertDeerflowThread(params: UpsertThreadParams): Promise<DeerflowThreadRow> {
  return prisma.deerflowThread.upsert({
    where: { deerThreadId: params.deerThreadId },
    create: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      deerThreadId: params.deerThreadId,
      kind: params.kind,
      status: "idle",
    },
    update: {}, // never move an existing thread to another workspace
  }) as Promise<DeerflowThreadRow>
}

/** Finds the most recent thread for a workspace + kind. */
export async function findDeerflowThread(
  workspaceId: string,
  kind: string
): Promise<DeerflowThreadRow | null> {
  return (await prisma.deerflowThread.findFirst({
    where: { workspaceId, kind },
    orderBy: { createdAt: "desc" },
  })) as DeerflowThreadRow | null
}

/** Fetches a run row scoped to its workspace (run id = DeerflowThread.id). */
export async function findRunForWorkspace(
  runId: string,
  workspaceId: string
): Promise<DeerflowThreadRow | null> {
  return (await prisma.deerflowThread.findFirst({
    where: { id: runId, workspaceId },
  })) as DeerflowThreadRow | null
}

export interface UpdateRunFields {
  status?: DeerflowRunStatus
  phase?: string | null
  proposal?: PosterResearchProposal | null
  error?: string | null
  costEstimateUsd?: number | null
  startedAt?: Date | null
  finishedAt?: Date | null
}

/** Updates a run row scoped to its workspace; returns true when a row matched. */
export async function updateDeerflowRun(
  runId: string,
  workspaceId: string,
  fields: UpdateRunFields
): Promise<boolean> {
  const data: Prisma.DeerflowThreadUpdateInput = {}
  if (fields.status !== undefined) data.status = fields.status
  if (fields.phase !== undefined) data.phase = fields.phase
  if (fields.proposal !== undefined) {
    data.proposal =
      fields.proposal === null ? null : (fields.proposal as unknown as Prisma.InputJsonValue)
  }
  if (fields.error !== undefined) data.error = fields.error
  if (fields.costEstimateUsd !== undefined) data.costEstimateUsd = fields.costEstimateUsd
  if (fields.startedAt !== undefined) data.startedAt = fields.startedAt
  if (fields.finishedAt !== undefined) data.finishedAt = fields.finishedAt

  const result = await prisma.deerflowThread.updateMany({
    where: { id: runId, workspaceId },
    data,
  })
  return result.count === 1
}

/** Deletes a run row (hard) scoped to its workspace. */
export async function deleteDeerflowRun(runId: string, workspaceId: string): Promise<boolean> {
  const result = await prisma.deerflowThread.deleteMany({
    where: { id: runId, workspaceId },
  })
  return result.count === 1
}

/** Marks a run failed when the process restarted while it was running. */
export async function markRunInterrupted(runId: string, workspaceId: string): Promise<boolean> {
  return updateDeerflowRun(runId, workspaceId, {
    status: "failed",
    phase: null,
    error: "Run was interrupted (server restarted). Start a new run.",
    finishedAt: new Date(),
  })
}
