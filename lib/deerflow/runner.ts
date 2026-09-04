/**
 * Background execution of a DeerFlow research run (server-only).
 *
 * Long-running by design (minutes). The HTTP handler only enqueues; the run
 * executes on the Node process and pushes progress into the in-memory
 * run-store + DB. The final DeerFlow JSON is normalized against the
 * workspace's actual asset ids BEFORE anything is stored, and only a
 * validated proposal ever reaches the UI apply flow.
 */
import "server-only"
import { getDeerflowConfig } from "./config"
import { streamDeerRun } from "./client"
import { buildDeerflowContext, getWorkspaceAssetIds } from "./context"
import {
  extractProposalJsonCandidate,
  normalizeProposal,
  type DeerflowStartRunInput,
} from "./contracts"
import { buildDeerflowRunPayload } from "./prompts"
import {
  appendRunEvent,
  createRunRecord,
  getRunRecord,
  setRunController,
  updateRunRecord,
} from "./run-store"
import { recordDeerflowSpend } from "./budget"
import { updateDeerflowRun, type DeerflowRunStatus } from "./db"
import { DeerflowOutputUnparseableError } from "./errors"
export { markRunInterrupted } from "./db"

export interface LaunchResearchParams {
  workspaceId: string
  userId: string
  deerThreadId: string
  runId: string
  kind: string
  input: DeerflowStartRunInput
  costEstimateUsd: number
}

const MAX_LOG_CHARS = 500

interface SsePayload {
  event?: string
  data: unknown
}

function classifyPhase(text: string): "planning" | "researching" | "synthesizing" | "writing" | null {
  const t = text.toLowerCase()
  if (/plan|rubric|preflight|outline/.test(t)) return "planning"
  if (/search|crawl|tool|investigat|source/.test(t)) return "researching"
  if (/synthes|compare|aggregat|commun/.test(t)) return "synthesizing"
  if (/writ|draft|compos|summar|final/.test(t)) return "writing"
  return null
}

/** Runs one DeerFlow research run to completion. Never throws — failures are stored. */
export async function executeDeerflowResearch(params: LaunchResearchParams): Promise<void> {
  const { runId, workspaceId, deerThreadId, input, costEstimateUsd } = params
  const config = getDeerflowConfig()
  const maxMinutes = input.maxMinutes ?? (input.depth === "fast" ? 5 : input.depth === "deep" ? 30 : 15)
  const deadlineMs = Math.min(config.runTimeoutMs, maxMinutes * 60_000)
  const controller = new AbortController()
  setRunController(runId, controller)
  updateRunRecord(runId, { status: "running", phase: "planning" })
  await updateDeerflowRun(runId, workspaceId, {
    status: "running",
    phase: "planning",
    startedAt: new Date(),
    error: null,
  })

  const deadlineTimer = setTimeout(() => controller.abort(), deadlineMs)

  let pendingRaw: unknown
  let finishedCleanly = false
  let failureMessage: string | null = null
  let failureCode: string | null = null

  try {
    const context = await buildDeerflowContext({
      workspaceId,
      language: input.language,
      includeAssets: input.includeAssets,
    })
    const payload = buildDeerflowRunPayload(input, context)
    appendRunEvent(runId, {
      type: "log",
      message: `Contacting DeerFlow (${context.sources.length} source file(s), ${context.cards.length} existing card(s))`,
    })

    for await (const sse of streamDeerRun(deerThreadId, payload, { signal: controller.signal })) {
      if (controller.signal.aborted) break
      let parsed: SsePayload | null = null
      try {
        parsed = JSON.parse(sse.data) as SsePayload
      } catch {
        parsed = null
      }
      const eventKind = sse.event === "" ? (parsed?.event ?? "") : sse.event

      if (eventKind === "values" && parsed) {
        const obj = parsed as unknown as Record<string, unknown>
        const candidate = extractProposalJsonCandidate(obj.value ?? obj)
        if (candidate) {
          pendingRaw = candidate
          updateRunRecord(runId, { phase: "writing" })
          appendRunEvent(runId, { type: "phase", message: "Synthesizing proposal" })
        } else {
          appendRunEvent(runId, { type: "progress", message: "Agent progress update" })
        }
        continue
      }

      if (eventKind === "custom" && parsed) {
        const value = (parsed as unknown as Record<string, unknown>).value
        const text = typeof value === "string" ? value : JSON.stringify(value)
        const phase = classifyPhase(text)
        if (phase) updateRunRecord(runId, { phase })
        appendRunEvent(runId, {
          type: phase ? "phase" : "tool",
          message: text.slice(0, MAX_LOG_CHARS),
        })
        continue
      }

      if (eventKind === "messages-tuple") {
        // Token deltas; count them as progress without storing every frame.
        continue
      }

      if (eventKind === "error") {
        failureMessage = `DeerFlow reported: ${sse.data.slice(0, 300)}`
        failureCode = "DEERFLOW_ERROR"
        break
      }

      if (eventKind === "done") {
        appendRunEvent(runId, { type: "log", message: "DeerFlow stream finished" })
        continue
      }

      // Any other frame — keep as an opaque log line, bounded.
      if (sse.data) {
        appendRunEvent(runId, { type: "log", message: sse.data.slice(0, MAX_LOG_CHARS) })
      }
    }

    finishedCleanly = !controller.signal.aborted && failureMessage === null
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown DeerFlow failure"
    if (controller.signal.aborted) {
      failureMessage = "Run aborted"
      failureCode = "DEERFLOW_ABORTED"
    } else {
      failureMessage = message.slice(0, 400)
      failureCode = "DEERFLOW_RUN_FAILED"
    }
  } finally {
    clearTimeout(deadlineTimer)
  }

  // -------------------------------------------------------------------------
  // Finalize: normalize the proposal against the workspace asset whitelist.
  // -------------------------------------------------------------------------
  if (finishedCleanly && pendingRaw !== undefined) {
    try {
      const allowedAssetIds = await getWorkspaceAssetIds(workspaceId)
      const normalized = normalizeProposal(pendingRaw, { allowedAssetIds })
      if (normalized.ok) {
        if (normalized.rejected.unknownAssets.length > 0) {
          console.warn("[deerflow] proposal referenced non-workspace/duplicate assets:", normalized.rejected.unknownAssets)
        }
        await updateDeerflowRun(runId, workspaceId, {
          status: "done",
          phase: "finished",
          proposal: normalized.proposal,
          finishedAt: new Date(),
          error: null,
        })
        updateRunRecord(runId, { status: "done", phase: "finished", proposal: normalized.proposal })
        appendRunEvent(runId, { type: "log", message: "Proposal ready for review" })
        recordDeerflowSpend(workspaceId, costEstimateUsd)
        return
      }
      failureMessage = `Proposal validation failed: ${normalized.issues
        .slice(0, 5)
        .map((i) => `${i.path}: ${i.message}`)
        .join("; ")}`
      failureCode = "DEERFLOW_PROPOSAL_INVALID"
    } catch (err) {
      failureMessage = err instanceof Error ? err.message : "Proposal normalization failed"
      failureCode = "DEERFLOW_PROPOSAL_INVALID"
    }
  } else if (finishedCleanly) {
    failureMessage = new DeerflowOutputUnparseableError().message
    failureCode = "DEERFLOW_OUTPUT_UNPARSEABLE"
  }

  // Failure / cancellation path.
  const status: DeerflowRunStatus = failureCode === "DEERFLOW_ABORTED" ? "cancelled" : "failed"
  const wasCancelled = status === "cancelled"
  await updateDeerflowRun(runId, workspaceId, {
    status,
    phase: null,
    error: failureMessage,
    finishedAt: new Date(),
  })
  updateRunRecord(runId, {
    status,
    error: failureMessage ? { message: failureMessage, code: failureCode ?? "DEERFLOW_RUN_FAILED" } : null,
  })
  appendRunEvent(runId, {
    type: "log",
    message: wasCancelled ? "Run cancelled" : `Run failed: ${failureMessage ?? "unknown error"}`,
  })
  if (!wasCancelled) recordDeerflowSpend(workspaceId, Math.round(costEstimateUsd * 50) / 100)
}

/** Kept for the cancel path: true when the record exists and is live. */
export function isRunLive(runId: string): boolean {
  const record = getRunRecord(runId)
  return Boolean(record && (record.status === "running" || record.status === "queued"))
}
