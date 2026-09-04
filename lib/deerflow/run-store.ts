/**
 * In-memory live state for DeerFlow runs (server-only).
 *
 * The DB row is the durable source of truth (status/proposal); this store
 * carries the transient progress stream so the SSE passthrough route can
 * replay buffered events after a client reconnects. Entries expire after
 * `RUN_TTL_MS` and never grow beyond `MAX_EVENTS_PER_RUN`.
 */
import "server-only"
import type { DeerflowRunStatus } from "./db"
import type { PosterResearchProposal } from "./contracts"

export type RunPhase = "planning" | "researching" | "synthesizing" | "writing" | "finished"

export interface RunLogEvent {
  ts: string
  type: "log" | "progress" | "phase" | "tool"
  message: string
}

export interface RunRecord {
  runId: string
  workspaceId: string
  userId: string
  deerThreadId: string
  kind: string
  status: DeerflowRunStatus
  phase: RunPhase
  events: RunLogEvent[]
  proposal: PosterResearchProposal | null
  error: { message: string; code: string } | null
  costEstimateUsd: number
  startedAt: number
  updatedAt: number
  controller: AbortController | null
}

const MAX_EVENTS_PER_RUN = 200
const RUN_TTL_MS = 6 * 60 * 60 * 1000

const runs = new Map<string, RunRecord>()
const subscribers = new Map<string, Set<(record: RunRecord) => void>>()

function notify(record: RunRecord): void {
  record.updatedAt = Date.now()
  const set = subscribers.get(record.runId)
  if (set) {
    for (const cb of set) {
      try {
        cb(record)
      } catch {
        // A subscriber must never break the run loop.
      }
    }
  }
}

function prune(): void {
  const now = Date.now()
  for (const [id, record] of runs) {
    if (now - record.updatedAt > RUN_TTL_MS) {
      runs.delete(id)
      subscribers.delete(id)
    }
  }
}

export function createRunRecord(init: {
  runId: string
  workspaceId: string
  userId: string
  deerThreadId: string
  kind: string
  costEstimateUsd: number
}): RunRecord {
  prune()
  const record: RunRecord = {
    ...init,
    status: "queued",
    phase: "planning",
    events: [],
    proposal: null,
    error: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    controller: null,
  }
  runs.set(record.runId, record)
  appendRunEvent(record.runId, { type: "log", message: "Run queued" })
  return record
}

export function getRunRecord(runId: string): RunRecord | undefined {
  prune()
  return runs.get(runId)
}

export function setRunController(runId: string, controller: AbortController): void {
  const record = runs.get(runId)
  if (record) {
    record.controller = controller
    notify(record)
  }
}

export function updateRunRecord(
  runId: string,
  patch: Partial<Pick<RunRecord, "status" | "phase" | "proposal" | "error">>
): void {
  const record = runs.get(runId)
  if (!record) return
  Object.assign(record, patch)
  notify(record)
}

export function appendRunEvent(runId: string, event: Omit<RunLogEvent, "ts">): void {
  const record = runs.get(runId)
  if (!record) return
  record.events.push({ ts: new Date().toISOString(), ...event })
  if (record.events.length > MAX_EVENTS_PER_RUN) {
    record.events.splice(0, record.events.length - MAX_EVENTS_PER_RUN)
  }
  notify(record)
}

/** Aborts the run's upstream fetch (best-effort). Returns true when a live run was found. */
export function cancelRunRecord(runId: string): boolean {
  const record = runs.get(runId)
  if (!record || (record.status !== "running" && record.status !== "queued")) return false
  record.controller?.abort()
  record.status = "cancelled"
  notify(record)
  return true
}

export function subscribeRun(
  runId: string,
  callback: (record: RunRecord) => void
): () => void {
  let set = subscribers.get(runId)
  if (!set) {
    set = new Set()
    subscribers.set(runId, set)
  }
  set.add(callback)
  return () => {
    set?.delete(callback)
  }
}

/** Test helper. */
export function resetRunStore(): void {
  runs.clear()
  subscribers.clear()
}
