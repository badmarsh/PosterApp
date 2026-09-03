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
}

const LEDGER_MAX = 2_000
const ledger: AiUsageRecord[] = []
const totals = {
  calls: 0,
  failures: 0,
  promptTokens: 0,
  completionTokens: 0,
  byOperation: new Map<string, { calls: number; totalTokens: number; durationMs: number }>(),
}

export function recordAiUsage(rec: AiUsageRecord): void {
  ledger.push(rec)
  if (ledger.length > LEDGER_MAX) ledger.splice(0, ledger.length - LEDGER_MAX)
  totals.calls++
  if (!rec.ok) totals.failures++
  totals.promptTokens += rec.promptTokens ?? 0
  totals.completionTokens += rec.completionTokens ?? 0
  const op = totals.byOperation.get(rec.operation) ?? { calls: 0, totalTokens: 0, durationMs: 0 }
  op.calls++
  op.totalTokens += rec.totalTokens ?? 0
  op.durationMs += rec.durationMs
  totals.byOperation.set(rec.operation, op)
}

export function getAiUsageSummary(windowMs = 60 * 60 * 1000) {
  const since = Date.now() - windowMs
  const recent = ledger.filter((r) => Date.parse(r.at) >= since)
  const recentTokens = recent.reduce((a, r) => a + (r.totalTokens ?? 0), 0)
  return {
    totalCalls: totals.calls,
    totalFailures: totals.failures,
    totalPromptTokens: totals.promptTokens,
    totalCompletionTokens: totals.completionTokens,
    lastHour: { calls: recent.length, totalTokens: recentTokens },
    byOperation: Object.fromEntries(totals.byOperation),
    breakers: Object.fromEntries(
      Array.from(breakers.entries()).map(([k, b]) => [k, { state: b.state, failures: b.failures, openedAt: b.openedAt }])
    ),
  }
}

/** Test helper. */
export function resetAiTelemetry(): void {
  ledger.length = 0
  totals.calls = 0
  totals.failures = 0
  totals.promptTokens = 0
  totals.completionTokens = 0
  totals.byOperation.clear()
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
