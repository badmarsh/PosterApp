/**
 * Shared guards + error mapping for DeerFlow API routes (server-only).
 */
import "server-only"
import { isDeerflowEnabled } from "./config"
import { createDeerThread } from "./client"
import { DeerflowDisabledError, isDeerflowError } from "./errors"
import { upsertDeerflowThread, findDeerflowThread, type DeerflowThreadRow } from "./db"
import { safeApiError } from "@/lib/security"

/** Enables the integration AND the workspace flag; throws DeerflowDisabledError otherwise. */
export function assertDeerflowAvailable(workspace: { deerflowEnabled: boolean }): void {
  if (!isDeerflowEnabled()) {
    throw new DeerflowDisabledError(false)
  }
  if (!workspace.deerflowEnabled) {
    throw new DeerflowDisabledError(true)
  }
}

/**
 * Creates (or reuses) the sidecar thread + DB mapping for a workspace/kind.
 * A new sidecar thread is created per run; an existing mapping is reused only
 * when it is still idle after a previous create.
 */
export async function ensureDeerflowThread(params: {
  workspaceId: string
  userId: string
  kind: string
}): Promise<DeerflowThreadRow> {
  const existing = await findDeerflowThread(params.workspaceId, params.kind)
  if (existing && existing.status === "idle" && existing.phase === null) {
    return existing
  }
  const deer = await createDeerThread({
    source: "posterapp",
    workspaceId: params.workspaceId,
    kind: params.kind,
  })
  return upsertDeerflowThread({
    workspaceId: params.workspaceId,
    userId: params.userId,
    deerThreadId: deer.thread_id,
    kind: params.kind,
  })
}

/** Maps a thrown DeerflowError to a safe JSON Response; null when not the right type. */
export function toDeerflowResponse(err: unknown): Response | null {
  if (!isDeerflowError(err)) return null
  return safeApiError(err.message, err.status, err.code)
}
