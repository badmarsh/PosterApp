/**
 * AI cost ledger: per-call token/cost accounting with a per-workspace daily
 * budget and a *soft stop*.
 *
 * - Pricing is best-effort (USD per 1M tokens; OpenRouter-compatible rough
 *   table keyed by model-name substring). Unknown models are priced at zero
 *   cost so accounting never crashes; token counts are always recorded.
 * - Budget is tracked per workspace *per UTC day* in-process (the same
 *   deployment model as the call ledger in telemetry.ts — no DB migration).
 * - The stop is SOFT: callers check `checkAiBudget()` before issuing a call
 *   and may choose to skip non-essential work (e.g. optional HyDE LLM,
 *   enrichment); the hard generation call still proceeds so a near-budget
 *   review never fails mid-way. Spending past the budget is recorded and
 *   surfaced in the RAG status panel.
 */

// ---------------------------------------------------------------------------
// Pricing table (USD per 1,000,000 tokens). Matched as case-insensitive
// substrings against the resolved model id; first match wins.
// ---------------------------------------------------------------------------

interface ModelPrice {
  match: string
  prompt: number // $/1M input tokens
  completion: number // $/1M output tokens
}

const PRICE_TABLE: ModelPrice[] = [
  { match: "gemini-3-pro", prompt: 1.25, completion: 5.0 },
  { match: "gemini-3.1-pro", prompt: 1.25, completion: 5.0 },
  { match: "gemini-3.7-flash", prompt: 0.3, completion: 1.2 },
  { match: "gemini-3-flash", prompt: 0.3, completion: 1.2 },
  { match: "gemini-2.5-flash", prompt: 0.3, completion: 2.5 },
  { match: "gemini-2.5-pro", prompt: 1.25, completion: 10.0 },
  { match: "qwen3-vl-plus", prompt: 0.4, completion: 1.2 },
  { match: "qwen3-vl-flash", prompt: 0.15, completion: 0.6 },
  { match: "qwen3-omni", prompt: 0.45, completion: 1.8 },
  { match: "qwen-vl-max", prompt: 2.0, completion: 6.0 },
  { match: "qwen-vl-plus", prompt: 0.8, completion: 2.0 },
  { match: "qwen-omni", prompt: 1.2, completion: 3.0 },
  { match: "gpt-image", prompt: 0.0, completion: 0.0 }, // billed differently; ignore
  { match: "gpt-5", prompt: 2.5, completion: 10.0 },
  { match: "gpt-4", prompt: 2.5, completion: 10.0 },
  { match: "claude-opus", prompt: 15.0, completion: 75.0 },
  { match: "claude-sonnet", prompt: 3.0, completion: 15.0 },
  { match: "claude-haiku", prompt: 0.8, completion: 4.0 },
  { match: "deepseek", prompt: 0.27, completion: 1.1 },
  { match: "llama", prompt: 0.2, completion: 0.6 },
]

export function estimateCallCostUsd(
  model: string,
  promptTokens: number | null,
  completionTokens: number | null
): number {
  if (!model) return 0
  const price = PRICE_TABLE.find((p) => model.toLowerCase().includes(p.match))
  if (!price) return 0
  const pCost = ((promptTokens ?? 0) / 1_000_000) * price.prompt
  const cCost = ((completionTokens ?? 0) / 1_000_000) * price.completion
  return Math.round((pCost + cCost) * 1_000_000) / 1_000_000
}

// ---------------------------------------------------------------------------
// Per-workspace daily spend
// ---------------------------------------------------------------------------

/** Default daily budget per workspace (USD). Override with AI_DAILY_BUDGET_USD. */
export const DEFAULT_DAILY_BUDGET_USD = Number(process.env.AI_DAILY_BUDGET_USD) || 2.0

interface DaySpend {
  day: string // YYYY-MM-DD (UTC)
  calls: number
  promptTokens: number
  completionTokens: number
  costUsd: number
}

const workspaceSpend = new Map<string, DaySpend>()
const globalSpend: DaySpend = { day: "", calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function rollover(entry: DaySpend): DaySpend {
  const day = today()
  if (entry.day !== day) {
    entry.day = day
    entry.calls = 0
    entry.promptTokens = 0
    entry.completionTokens = 0
    entry.costUsd = 0
  }
  return entry
}

/**
 * Record a completed AI call against a workspace (and the global total).
 * Safe to call with unknown token counts — cost degrades to 0.
 */
export function recordAiSpend(
  workspaceId: string | undefined | null,
  model: string,
  usage: { promptTokens?: number | null; completionTokens?: number | null; totalTokens?: number | null }
): number {
  const promptTokens = usage.promptTokens ?? 0
  const completionTokens = usage.completionTokens ?? 0
  const cost = estimateCallCostUsd(model, promptTokens, completionTokens)

  rollover(globalSpend)
  globalSpend.calls++
  globalSpend.promptTokens += promptTokens
  globalSpend.completionTokens += completionTokens
  globalSpend.costUsd += cost

  if (workspaceId) {
    let entry = workspaceSpend.get(workspaceId)
    if (!entry) {
      entry = { day: today(), calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 }
      workspaceSpend.set(workspaceId, entry)
    }
    rollover(entry)
    entry.calls++
    entry.promptTokens += promptTokens
    entry.completionTokens += completionTokens
    entry.costUsd += cost
  }
  return cost
}

export interface AiBudgetStatus {
  day: string
  budgetUsd: number
  spentUsd: number
  remainingUsd: number
  /** Soft-stop tripped: optional/enrichment calls should skip; essential calls may proceed. */
  overBudget: boolean
  /** Fraction of the budget spent [0, ~∞). */
  utilization: number
  calls: number
  promptTokens: number
  completionTokens: number
}

export function getAiBudgetStatus(workspaceId?: string | null): AiBudgetStatus {
  const budget = DEFAULT_DAILY_BUDGET_USD
  const entry = workspaceId ? workspaceSpend.get(workspaceId) : globalSpend
  const current = entry ? rollover({ ...entry }) : { day: today(), calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 }
  const spent = Math.round(current.costUsd * 10_000) / 10_000
  return {
    day: current.day,
    budgetUsd: budget,
    spentUsd: spent,
    remainingUsd: Math.max(0, Math.round((budget - spent) * 10_000) / 10_000),
    overBudget: spent >= budget,
    utilization: budget > 0 ? Math.round((spent / budget) * 1000) / 1000 : 0,
    calls: current.calls,
    promptTokens: current.promptTokens,
    completionTokens: current.completionTokens,
  }
}

/**
 * Soft budget gate. Returns `{ proceed, reason }`:
 *  - essential calls (the review generation itself) should call with
 *    `essential: true` and proceed regardless — the result is used for
 *    logging/surfacing.
 *  - optional calls (HyDE LLM, enrichment, extra fan-out) call with
 *    `essential: false` and should skip when `proceed === false`.
 */
export function checkAiBudget(
  workspaceId: string | undefined | null,
  opts: { essential?: boolean } = {}
): { proceed: boolean; status: AiBudgetStatus; reason?: string } {
  const status = getAiBudgetStatus(workspaceId)
  if (!status.overBudget) return { proceed: true, status }
  if (opts.essential) {
    return {
      proceed: true,
      status,
      reason: `Soft daily AI budget ($${status.budgetUsd.toFixed(2)}) already exceeded by $${(status.spentUsd - status.budgetUsd).toFixed(2)}; proceeding because the call is essential.`,
    }
  }
  return {
    proceed: false,
    status,
    reason: `Daily AI budget of $${status.budgetUsd.toFixed(2)} reached ($${status.spentUsd.toFixed(2)} spent). Non-essential AI call skipped.`,
  }
}

/** Test helper — clears all recorded spend. */
export function resetAiCostLedger(): void {
  workspaceSpend.clear()
  globalSpend.day = ""
  globalSpend.calls = 0
  globalSpend.promptTokens = 0
  globalSpend.completionTokens = 0
  globalSpend.costUsd = 0
}
