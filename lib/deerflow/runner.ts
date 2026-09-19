/**
 * Background execution of DeerFlow runs (server-only).
 *
 * Supports two run kinds:
 *  1. `poster_research` — multi-source deep research producing draft sections & citations
 *  2. `improve_poster` — autonomous multi-iteration compile feedback & card patching loop
 */
import "server-only"
import { prisma } from "@/lib/prisma"
import { getDeerflowConfig } from "./config"
import { streamDeerRun } from "./client"
import { compileWorkspace } from "@/lib/latex/compile-workspace"
import { createWorkspaceSnapshot } from "@/lib/agent-snapshot"
import {
  buildDeerflowContext,
  getWorkspaceAssetIds,
  buildImprovePosterContext,
  getWorkspaceCardIds,
} from "./context"
import {
  extractProposalJsonCandidate,
  normalizeProposal,
  extractImprovePosterJsonCandidate,
  normalizeImprovePosterProposal,
  IMPROVE_POSTER_PROPOSAL_VERSION,
  type DeerflowPosterResearchInput,
  type DeerflowImprovePosterInput,
  type ImprovePosterProposal,
  type ImprovePosterIteration,
  type CardPatch,
} from "./contracts"
import { buildDeerflowRunPayload, buildImprovePosterPayload } from "./prompts"
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
  input: DeerflowPosterResearchInput
  costEstimateUsd: number
}

export interface LaunchImprovePosterParams {
  workspaceId: string
  userId: string
  deerThreadId: string
  runId: string
  kind: "improve_poster"
  input: DeerflowImprovePosterInput
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

  // Finalize
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

  // Failure / cancellation
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

/**
 * Executes the autonomous build & fix loop (Phase 2: improve_poster).
 * Iterates compilation, AI diagnosis, card patching, and snapshot rollback.
 */
export async function executeDeerflowImproveLoop(params: LaunchImprovePosterParams): Promise<void> {
  const { runId, workspaceId, deerThreadId, input, costEstimateUsd } = params
  const config = getDeerflowConfig()
  const maxIterations = input.maxIterations ?? 3
  const deadlineMs = Math.min(config.runTimeoutMs, maxIterations * 6 * 60_000)
  const controller = new AbortController()
  setRunController(runId, controller)
  const startTime = Date.now()

  updateRunRecord(runId, { status: "running", phase: "compiling" })
  await updateDeerflowRun(runId, workspaceId, {
    status: "running",
    phase: "compiling",
    startedAt: new Date(),
    error: null,
  })

  const deadlineTimer = setTimeout(() => controller.abort(), deadlineMs)
  appendRunEvent(runId, {
    type: "log",
    message: `Starting autonomous improve loop (max ${maxIterations} iteration(s))`,
  })

  let cleanCompile = false
  let failureMessage: string | null = null
  let failureCode: string | null = null
  const accumulatedIterations: ImprovePosterIteration[] = []
  let previousPatches: CardPatch[] = []

  try {
    // 1. Initial compile
    appendRunEvent(runId, { type: "phase", message: "Compiling initial poster" })
    const initialCompile = await compileWorkspace(workspaceId, { installPdf: false })
    let currentCompileLog = initialCompile.log || (initialCompile.error ? initialCompile.error.message : "")
    cleanCompile = initialCompile.ok

    if (cleanCompile) {
      appendRunEvent(runId, { type: "log", message: "Initial poster already compiles cleanly" })
    } else {
      appendRunEvent(runId, {
        type: "log",
        message: `Initial compilation had errors/warnings (${currentCompileLog.slice(0, 100)}...)`,
      })
    }

    // Loop through iterations
    for (let iter = 0; iter < maxIterations; iter++) {
      if (controller.signal.aborted) break
      if (cleanCompile && iter > 0) break

      updateRunRecord(runId, { phase: "patching" })
      appendRunEvent(runId, {
        type: "phase",
        message: `Iteration ${iter + 1}/${maxIterations}: Requesting fixes from DeerFlow`,
      })

      const context = await buildImprovePosterContext({
        workspaceId,
        language: input.language,
      })

      const payload = buildImprovePosterPayload(
        input,
        context,
        currentCompileLog,
        iter,
        previousPatches
      )

      let iterCandidateRaw: unknown = undefined
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
          const candidate = extractImprovePosterJsonCandidate(obj.value ?? obj)
          if (candidate) {
            iterCandidateRaw = candidate
          }
          continue
        }

        if (eventKind === "custom" && parsed) {
          const value = (parsed as unknown as Record<string, unknown>).value
          const text = typeof value === "string" ? value : JSON.stringify(value)
          appendRunEvent(runId, {
            type: "tool",
            message: text.slice(0, MAX_LOG_CHARS),
          })
          continue
        }

        if (eventKind === "error") {
          failureMessage = `DeerFlow reported: ${sse.data.slice(0, 300)}`
          failureCode = "DEERFLOW_ERROR"
          break
        }
      }

      if (controller.signal.aborted || failureMessage) break

      // Normalize candidate
      const allowedCardIds = await getWorkspaceCardIds(workspaceId)
      const normalized = normalizeImprovePosterProposal(iterCandidateRaw, { allowedCardIds })

      if (!normalized.ok) {
        appendRunEvent(runId, {
          type: "log",
          message: `Iteration ${iter + 1}: proposal parsing warning (${normalized.issues[0]?.message})`,
        })
        break
      }

      const proposal = normalized.proposal
      const currentIterData =
        proposal.iterations.find((i) => i.iterationIndex === iter) ??
        proposal.iterations[proposal.iterations.length - 1] ??
        {
          iterationIndex: iter,
          patches: [],
          compileLog: currentCompileLog.slice(0, 500),
          diagnosis: proposal.summary || "No specific diagnosis provided",
        }

      accumulatedIterations.push(currentIterData)

      if (!currentIterData.patches || currentIterData.patches.length === 0) {
        appendRunEvent(runId, {
          type: "log",
          message: `Iteration ${iter + 1}: Agent proposed 0 patches`,
        })
        break
      }

      // Snapshot before applying patches
      try {
        await createWorkspaceSnapshot(
          workspaceId,
          `deerflow-improve-iter-${iter + 1}`,
          { source: "agent", coalesceWindowMs: 30_000 }
        )
      } catch (snapErr) {
        console.warn("[deerflow improve] snapshot error:", snapErr)
      }

      // Apply patches
      for (const patch of currentIterData.patches) {
        await prisma.card.updateMany({
          where: { id: patch.id, output: { workspaceId } },
          data: { content: patch.content, generatedLatex: null },
        })
        appendRunEvent(runId, {
          type: "tool",
          message: `Patched card ${patch.id}: ${patch.rationale.slice(0, 120)}`,
        })
      }

      previousPatches = currentIterData.patches

      // Bump revision
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { revision: { increment: 1 } },
      })

      // Re-compile
      updateRunRecord(runId, { phase: "compiling" })
      appendRunEvent(runId, {
        type: "phase",
        message: `Iteration ${iter + 1}: Re-compiling poster`,
      })
      const recompile = await compileWorkspace(workspaceId, { installPdf: true })
      currentCompileLog = recompile.log || (recompile.error ? recompile.error.message : "")
      cleanCompile = recompile.ok

      recordDeerflowSpend(workspaceId, Math.round((costEstimateUsd / maxIterations) * 100) / 100)

      if (cleanCompile) {
        appendRunEvent(runId, {
          type: "log",
          message: `Iteration ${iter + 1}: Compilation succeeded cleanly!`,
        })
        break
      } else {
        appendRunEvent(runId, {
          type: "log",
          message: `Iteration ${iter + 1}: Compilation still reported issues`,
        })
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during improve loop"
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

  // Finalize run
  const finishedCleanly = !controller.signal.aborted && failureMessage === null
  if (finishedCleanly) {
    const finalProposal: ImprovePosterProposal = {
      version: IMPROVE_POSTER_PROPOSAL_VERSION,
      iterations: accumulatedIterations,
      summary: cleanCompile
        ? `Clean compilation achieved in ${accumulatedIterations.length} iteration(s).`
        : `Completed ${accumulatedIterations.length} iteration(s).`,
      cleanCompile,
      meta: {
        estimatedUsd: costEstimateUsd,
        elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
      },
    }

    await updateDeerflowRun(runId, workspaceId, {
      status: "done",
      phase: "finished",
      proposal: finalProposal,
      finishedAt: new Date(),
      error: null,
    })
    updateRunRecord(runId, { status: "done", phase: "finished", proposal: finalProposal })
    appendRunEvent(runId, { type: "log", message: "Improve poster loop finished" })
    return
  }

  // Failure / cancellation
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
}

/** Kept for the cancel path: true when the record exists and is live. */
export function isRunLive(runId: string): boolean {
  const record = getRunRecord(runId)
  return Boolean(record && (record.status === "running" || record.status === "queued"))
}
