/**
 * AI provider telemetry: per-call token/latency ledger and a per-endpoint
 * circuit breaker. In-process only (no DB migration required); the ledger is
 * bounded and exposed through the rag-stats route for the RAG status panel.
 */

export interface AiUsageRecord {
  at: string
  operation: string
  model: string
  provider: "primary" | "fallback-provider"
  apiUrl: string
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  durationMs: number
  ok: boolean
  status?: number
  /** Billed workspace (when known) — drives per-workspace daily budget reporting. */
  workspaceId?: string
  /** Estimated cost in USD (0 for unknown models). */
  costUsd?: number
}

const LEDGER_MAX = 2_000
const ledger: AiUsageRecord[] = []
const totals = {
  calls: 0,
  failures: 0,
  promptTokens: 0,
  completionTokens: 0,
  costUsd: 0,
  byOperation: new Map<string, { calls: number; totalTokens: number; durationMs: number; failures: number; costUsd: number }>(),
  // Per-model health stats feed the dynamic provider/model selection
  // (provider health model): rolling latency, failure rate and cost.
  byModel: new Map<string, { calls: number; failures: number; durationMs: number; totalTokens: number; costUsd: number; lastOkAt: number | null; lastFailureAt: number | null }>(),
}

export function recordAiUsage(rec: AiUsageRecord): void {
  ledger.push(rec)
  if (ledger.length > LEDGER_MAX) ledger.splice(0, ledger.length - LEDGER_MAX)
  totals.calls++
  if (!rec.ok) totals.failures++
  totals.promptTokens += rec.promptTokens ?? 0
  totals.completionTokens += rec.completionTokens ?? 0
  totals.costUsd += rec.costUsd ?? 0

  const op = totals.byOperation.get(rec.operation) ?? { calls: 0, totalTokens: 0, durationMs: 0, failures: 0, costUsd: 0 }
  op.calls++
  op.totalTokens += rec.totalTokens ?? 0
  op.durationMs += rec.durationMs
  op.failures += rec.ok ? 0 : 1
  op.costUsd += rec.costUsd ?? 0
  totals.byOperation.set(rec.operation, op)

  const model = totals.byModel.get(rec.model) ?? { calls: 0, failures: 0, durationMs: 0, totalTokens: 0, costUsd: 0, lastOkAt: null, lastFailureAt: null }
  model.calls++
  model.durationMs += rec.durationMs
  model.totalTokens += rec.totalTokens ?? 0
  model.costUsd += rec.costUsd ?? 0
  if (rec.ok) model.lastOkAt = Date.parse(rec.at)
  else {
    model.failures++
    model.lastFailureAt = Date.parse(rec.at)
  }
  totals.byModel.set(rec.model, model)
}

export function getAiUsageSummary(windowMs = 60 * 60 * 1000) {
  const since = Date.now() - windowMs
  const recent = ledger.filter((r) => Date.parse(r.at) >= since)
  const recentTokens = recent.reduce((a, r) => a + (r.totalTokens ?? 0), 0)
  const recentCost = recent.reduce((a, r) => a + (r.costUsd ?? 0), 0)
  return {
    totalCalls: totals.calls,
    totalFailures: totals.failures,
    totalPromptTokens: totals.promptTokens,
    totalCompletionTokens: totals.completionTokens,
    totalCostUsd: Math.round(totals.costUsd * 10_000) / 10_000,
    lastHour: { calls: recent.length, totalTokens: recentTokens, costUsd: Math.round(recentCost * 10_000) / 10_000 },
    byOperation: Object.fromEntries(totals.byOperation),
    byModel: Object.fromEntries(
      Array.from(totals.byModel.entries()).map(([model, m]) => [
        model,
        {
          calls: m.calls,
          failures: m.failures,
          failureRate: m.calls > 0 ? Math.round((m.failures / m.calls) * 1000) / 1000 : 0,
          avgDurationMs: m.calls > 0 ? Math.round(m.durationMs / m.calls) : 0,
          totalTokens: m.totalTokens,
          costUsd: Math.round(m.costUsd * 10_000) / 10_000,
          lastOkAt: m.lastOkAt ? new Date(m.lastOkAt).toISOString() : null,
          lastFailureAt: m.lastFailureAt ? new Date(m.lastFailureAt).toISOString() : null,
        },
      ])
    ),
    breakers: Object.fromEntries(
      Array.from(breakers.entries()).map(([k, b]) => [k, { state: b.state, failures: b.failures, openedAt: b.openedAt }])
    ),
  }
}

/**
 * Provider health model: ranks candidate models by observed reliability and
 * latency. Used to dynamically pick the primary thesis/vision model instead
 * of a static chain. Models with no local telemetry keep their configured
 * order (score 0.5 neutral); failing models sink to the bottom.
 */
export function rankModelsByHealth(candidates: string[]): string[] {
  const scored = candidates.map((model) => {
    const m = totals.byModel.get(model)
    if (!m || m.calls === 0) return { model, score: 0.5 }
    const failureRate = m.failures / m.calls
    const avgMs = m.durationMs / m.calls
    // Latency term: 60s avg ≈ 0.5 penalty, capped.
    const latencyTerm = Math.min(0.5, avgMs / 120_000)
    // Recently failed (last 5 min) and never since → strong penalty.
    const recentlyFailed =
      m.lastFailureAt && (!m.lastOkAt || m.lastFailureAt > m.lastOkAt) && Date.now() - m.lastFailureAt < 5 * 60_000
    const score = 1 - failureRate * 0.6 - latencyTerm - (recentlyFailed ? 0.3 : 0)
    return { model, score }
  })
  return scored.sort((a, b) => b.score - a.score).map((s) => s.model)
}

/** Test helper. */
export function resetAiTelemetry(): void {
  ledger.length = 0
  totals.calls = 0
  totals.failures = 0
  totals.promptTokens = 0
  totals.completionTokens = 0
  totals.costUsd = 0
  totals.byOperation.clear()
  totals.byModel.clear()
  breakers.clear()
}

// ---------------------------------------------------------------------------
// Circuit breaker (per provider apiUrl)
// ---------------------------------------------------------------------------

export const BREAKER_FAILURE_THRESHOLD = Number(process.env.AI_BREAKER_FAILURES) || 3
export const BREAKER_WINDOW_MS = Number(process.env.AI_BREAKER_WINDOW_MS) || 60_000
export const BREAKER_OPEN_MS = Number(process.env.AI_BREAKER_OPEN_MS) || 30_000

interface BreakerState {
  state: "closed" | "open" | "half-open"
  failures: number
  firstFailureAt: number
  openedAt: number | null
}

const breakers = new Map<string, BreakerState>()

function getBreaker(key: string): BreakerState {
  let b = breakers.get(key)
  if (!b) {
    b = { state: "closed", failures: 0, firstFailureAt: 0, openedAt: null }
    breakers.set(key, b)
  }
  return b
}

/** Returns true if calls to this endpoint should be skipped right now. */
export function isCircuitOpen(key: string, now = Date.now()): boolean {
  const b = getBreaker(key)
  if (b.state === "open") {
    if (b.openedAt !== null && now - b.openedAt >= BREAKER_OPEN_MS) {
      b.state = "half-open" // allow one trial request
      return false
    }
    return true
  }
  return false
}

/** Record a transport-level failure (5xx / timeout / network). 4xx must NOT be reported here. */
export function reportCircuitFailure(key: string, now = Date.now()): void {
  const b = getBreaker(key)
  if (b.state === "half-open") {
    b.state = "open"
    b.openedAt = now
    return
  }
  if (now - b.firstFailureAt > BREAKER_WINDOW_MS) {
    b.failures = 0
    b.firstFailureAt = now
  }
  b.failures++
  if (b.failures >= BREAKER_FAILURE_THRESHOLD) {
    b.state = "open"
    b.openedAt = now
  }
}

export function reportCircuitSuccess(key: string): void {
  const b = getBreaker(key)
  b.state = "closed"
  b.failures = 0
  b.openedAt = null
}

export class AICircuitOpenError extends Error {
  constructor(public readonly apiUrl: string) {
    super(`AI provider circuit is open for ${apiUrl} (recent consecutive failures); skipping`)
    this.name = "AICircuitOpenError"
  }
}
