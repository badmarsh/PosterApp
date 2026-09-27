/**
 * Shared HTTP plumbing for the academic provider clients
 * (OpenAlex, Crossref, Semantic Scholar, arXiv, Tavily).
 *
 * Every outbound call must be bounded by BOTH the caller's signal (request abort,
 * audit budget) AND a per-provider timeout — a long-lived caller signal must never
 * replace the timeout, otherwise one hung provider stalls the whole fan-out
 * (audit finding AR-02).
 */

export type AcademicProvider = "openalex" | "crossref" | "semanticscholar" | "arxiv" | "tavily"

/** Per-provider timeouts in ms. Mutable so tests can shorten them. */
export const ACADEMIC_TIMEOUTS_MS: Record<AcademicProvider, number> = {
  openalex: 6_000,
  crossref: 6_000,
  semanticscholar: 10_000,
  arxiv: 10_000,
  tavily: 8_000,
}

/** Status of one provider inside a fan-out call. */
export type ProviderStatus = "ok" | "empty" | "error" | "timeout" | "rate_limited" | "skipped"

export interface ProviderOutcome<T> {
  items: T[]
  status: ProviderStatus
  statusCode?: number
  latencyMs: number
  error?: string
}

/**
 * Combine the caller's signal with a per-provider timeout. Works with `AbortSignal.any`
 * (Node ≥ 20.3) and degrades to a manual controller elsewhere.
 */
export function boundedSignal(caller: AbortSignal | undefined | null, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  if (!caller) return timeout
  if (typeof AbortSignal.any === "function") return AbortSignal.any([caller, timeout])
  const ctrl = new AbortController()
  const forward = (s: AbortSignal) => () => ctrl.abort(s.reason)
  if (caller.aborted) ctrl.abort(caller.reason)
  else caller.addEventListener("abort", forward(caller), { once: true })
  timeout.addEventListener("abort", forward(timeout), { once: true })
  return ctrl.signal
}

export function isAbortLike(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name
  return name === "AbortError" || name === "TimeoutError"
}

/**
 * Sleep that resolves `true` when the delay elapsed and `false` when `signal` aborted first.
 * Never rejects, never leaks the timer.
 */
export function abortableDelay(ms: number, signal?: AbortSignal | null): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false)
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      resolve(false)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve(true)
    }, ms)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

/** Map a thrown fetch error to a provider status. */
export function statusFromError(err: unknown): ProviderStatus {
  return isAbortLike(err) ? "timeout" : "error"
}

/** Map an HTTP status to a provider status (for non-2xx responses). */
export function statusFromHttp(code: number): ProviderStatus {
  return code === 429 ? "rate_limited" : "error"
}
