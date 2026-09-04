/**
 * DeerFlow run budget + cost ledger (server-only).
 *
 * Mirrors the soft-budget pattern of lib/ai/cost-ledger.ts but tracks DeerFlow
 * spend separately so agent runs do not silently consume the single-shot AI
 * daily budget. Everything is in-process per UTC day — same deployment model
 * as the AI ledger (documented there); no DB migration required.
 */
import "server-only"
import { getDeerflowConfig } from "./config"
import { DeerflowBudgetExceededError } from "./errors"

export type DeerflowDepth = "fast" | "standard" | "deep"

/** Heuristic cost/length model per depth. Calibrate after real runs. */
export interface DeerflowDepthEstimate {
  minutes: number
  usd: number
  description: string
}

export const DEPTH_ESTIMATES: Record<DeerflowDepth, DeerflowDepthEstimate> = {
  fast: { minutes: 5, usd: 0.08, description: "Quick overview (~5 min, ~$0.08)" },
  standard: { minutes: 15, usd: 0.25, description: "Balanced research (~15 min, ~$0.25)" },
  deep: { minutes: 30, usd: 0.6, description: "Deep multi-source research (~30 min, ~$0.60)" },
}

export function estimateDeerflowRun(depth: DeerflowDepth): DeerflowDepthEstimate {
  return DEPTH_ESTIMATES[depth] ?? DEPTH_ESTIMATES.standard
}

// ---------------------------------------------------------------------------
// Per-workspace daily ledger
// ---------------------------------------------------------------------------

interface DaySpend {
  day: string
  runs: number
  costUsd: number
}

const workspaceSpend = new Map<string, DaySpend>()

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function rollover(entry: DaySpend): DaySpend {
  const day = today()
  if (entry.day !== day) {
    entry.day = day
    entry.runs = 0
    entry.costUsd = 0
  }
  return entry
}

function entryFor(workspaceId: string): DaySpend {
  let entry = workspaceSpend.get(workspaceId)
  if (!entry) {
    entry = { day: today(), runs: 0, costUsd: 0 }
    workspaceSpend.set(workspaceId, entry)
  }
  return rollover(entry)
}

/** Records estimated spend against a workspace (USD). */
export function recordDeerflowSpend(workspaceId: string, usd: number): number {
  const entry = entryFor(workspaceId)
  entry.costUsd = Math.round((entry.costUsd + Math.max(0, usd)) * 10_000) / 10_000
  entry.runs += 1
  return entry.costUsd
}

export interface DeerflowBudgetStatus {
  day: string
  budgetUsd: number
  spentUsd: number
  remainingUsd: number
  overBudget: boolean
  utilization: number
  runs: number
}

export function getDeerflowBudgetStatus(workspaceId: string): DeerflowBudgetStatus {
  const { dailyBudgetUsd } = getDeerflowConfig()
  const entry = entryFor(workspaceId)
  const spent = Math.round(entry.costUsd * 10_000) / 10_000
  return {
    day: entry.day,
    budgetUsd: dailyBudgetUsd,
    spentUsd: spent,
    remainingUsd: Math.max(0, Math.round((dailyBudgetUsd - spent) * 10_000) / 10_000),
    overBudget: spent >= dailyBudgetUsd,
    utilization: dailyBudgetUsd > 0 ? Math.round((spent / dailyBudgetUsd) * 1000) / 1000 : 0,
    runs: entry.runs,
  }
}

/** Hard gate — DeerFlow runs are never "essential", they always stop at the cap. */
export function assertDeerflowBudget(workspaceId: string): DeerflowBudgetStatus {
  const status = getDeerflowBudgetStatus(workspaceId)
  if (status.overBudget) {
    throw new DeerflowBudgetExceededError(
      `Daily DeerFlow budget of $${status.budgetUsd.toFixed(2)} reached ($${status.spentUsd.toFixed(2)} spent).`
    )
  }
  return status
}

/** Test helper — clears the DeerFlow ledger. */
export function resetDeerflowLedger(): void {
  workspaceSpend.clear()
}
