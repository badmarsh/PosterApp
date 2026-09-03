import { ZodSchema } from "zod"
import { AIProviderError, AIValidationError } from "./errors"
import { parseAiJson } from "@/lib/ai-helpers"
import {
  recordAiUsage,
  isCircuitOpen,
  reportCircuitFailure,
  reportCircuitSuccess,
  AICircuitOpenError,
} from "./telemetry"
import { recordAiSpend, checkAiBudget } from "./cost-ledger"

interface AIClientOptions<T> {
  model: string;
  role?: string;
  apiUrl?: string;
  apiKey?: string;
  systemPrompt?: string;
  userPrompt: string | any[];
  schema: ZodSchema<T>;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  /** Mutable bag that is filled in with the provider source after the operation completes. */
  provenance?: { source?: AIProviderSource };
  /** Workspace that should be billed for this call (daily soft budget + cost ledger). */
  workspaceId?: string;
  /**
   * Mark non-essential calls (HyDE LLM, enrichment, extra fan-out). When the
   * workspace's daily soft budget is already exceeded these are skipped with
   * AIBudgetExceededError instead of being sent. Essential calls (the review
   * generation itself) always proceed so a near-budget review never fails.
   */
  optional?: boolean;
}

/** Thrown when a non-essential AI call is skipped because the daily soft budget is exhausted. */
export class AIBudgetExceededError extends Error {
  constructor(public readonly status: ReturnType<typeof checkAiBudget>["status"]) {
    super(`Daily AI soft budget exceeded (${status.spentUsd.toFixed(2)}/${status.budgetUsd.toFixed(2)} USD); optional call skipped`)
    this.name = "AIBudgetExceededError"
  }
}

const MAX_AI_FETCH_ATTEMPTS = 3
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504])
// Starting value; needs empirical tuning against the largest thesis-review payloads.
export const DEFAULT_AI_MAX_TOKENS = 8192
/** Upper bound on a single provider round-trip so hung upstreams never pin a worker. */
export const DEFAULT_AI_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 180_000

/** Combine the caller's signal (if any) with a hard per-request timeout. */
function withDefaultTimeout(signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(DEFAULT_AI_TIMEOUT_MS)
  if (!signal) return timeoutSignal
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeoutSignal])
  return signal
}

type AIRequestOptions = Omit<AIClientOptions<any>, "schema">

function resolveProvider(options: Pick<AIRequestOptions, "role" | "model" | "apiUrl" | "apiKey">) {
  const isVision = options.role === "vision" || options.model.includes("omni") || options.model.includes("vl")
  const apiUrl = options.apiUrl || (isVision && process.env.AI_VISION_API_URL ? process.env.AI_VISION_API_URL : process.env.AI_API_URL)
  const apiKey = options.apiKey || (isVision && process.env.AI_VISION_API_KEY ? process.env.AI_VISION_API_KEY : process.env.AI_API_KEY)

  if (!apiUrl || !apiKey) {
    throw new Error("AI API configuration missing (AI_API_URL or AI_API_KEY)")
  }

  return { apiUrl, apiKey }
}

function retryDelayMs(response: Response | null, attempt: number): number {
  if (response?.status === 429) {
    const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10)
    // Cap Retry-After to 30 seconds — a hostile upstream cannot stall the client.
    const baseDelay = Number.isNaN(retryAfter) ? 1500 * attempt : Math.min(retryAfter, 30) * 1000
    return baseDelay + Math.random() * 300
  }

  if (response) return 1000 * attempt + Math.random() * 300
  return 500 * attempt + Math.random() * 200
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetries(
  apiUrl: string,
  init: RequestInit,
  signal?: AbortSignal
): Promise<Response> {
  let lastNetworkError: unknown

  for (let attempt = 1; attempt <= MAX_AI_FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(apiUrl, { ...init, signal })
      if (response.ok || !RETRYABLE_STATUS_CODES.has(response.status) || attempt === MAX_AI_FETCH_ATTEMPTS) {
        return response
      }

      await wait(retryDelayMs(response, attempt))
    } catch (error) {
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) throw error
      lastNetworkError = error

      if (attempt < MAX_AI_FETCH_ATTEMPTS) {
        await wait(retryDelayMs(null, attempt))
      }
    }
  }

  throw lastNetworkError instanceof Error
    ? lastNetworkError
    : new Error("AI request failed after retries")
}

function buildMessages(options: AIRequestOptions, expandPromptMessages = false): any[] {
  const messages: any[] = []
  if (options.systemPrompt) messages.push({ role: "system", content: options.systemPrompt })
  if (expandPromptMessages && Array.isArray(options.userPrompt)) {
    messages.push(...options.userPrompt)
  } else {
    messages.push({ role: "user", content: options.userPrompt })
  }
  return messages
}

/**
 * Default sampling temperatures. Structured (JSON-schema) calls are grounded
 * extraction/generation tasks and default to 0.2; free-text (chat) keeps 0.7.
 * Every caller may still override explicitly.
 */
export const DEFAULT_STRUCTURED_TEMPERATURE = 0.2
export const DEFAULT_TEXT_TEMPERATURE = 0.7

function buildPayload(options: AIRequestOptions, messages: any[], requireJson: boolean) {
  return {
    model: options.model,
    messages,
    ...(requireJson ? { response_format: { type: "json_object" } } : {}),
    temperature: options.temperature ?? (requireJson ? DEFAULT_STRUCTURED_TEMPERATURE : DEFAULT_TEXT_TEMPERATURE),
    max_tokens: options.maxTokens ?? DEFAULT_AI_MAX_TOKENS,
  }
}

async function requestCompletion(
  operationName: string,
  options: AIRequestOptions,
  apiUrl: string,
  apiKey: string,
  payload: Record<string, unknown>
): Promise<{ content: string; truncated: boolean }> {
  if (isCircuitOpen(apiUrl)) {
    throw new AICircuitOpenError(apiUrl)
  }

  // Per-workspace daily soft budget. Optional calls (HyDE, enrichment) are
  // skipped once the budget is spent; essential calls proceed and the
  // overspend is surfaced through the RAG status panel.
  const gate = checkAiBudget(options.workspaceId, { essential: !options.optional })
  if (!gate.proceed) {
    console.warn(`[AI ${operationName}] ${gate.reason}`)
    throw new AIBudgetExceededError(gate.status)
  }
  if (gate.reason) {
    console.warn(`[AI ${operationName}] ${gate.reason}`)
  }

  const startTime = Date.now()
  const providerSource: AIProviderSource = apiUrl === process.env.AI_API_URL_FALLBACK ? "fallback-provider" : "primary"
  let response: Response
  try {
    response = await fetchWithRetries(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }, withDefaultTimeout(options.signal))
  } catch (err) {
    const durationMs = Date.now() - startTime
    // Timeouts and network errors count toward the breaker; caller aborts don't.
    if (!(err instanceof Error && err.name === "AbortError")) reportCircuitFailure(apiUrl)
    recordAiUsage({ at: new Date().toISOString(), operation: operationName, model: options.model, provider: providerSource, apiUrl, promptTokens: null, completionTokens: null, totalTokens: null, durationMs, ok: false })
    throw err
  }
  const durationMs = Date.now() - startTime

  if (!response.ok) {
    console.error(`[AI ${operationName}] Provider failed: HTTP ${response.status} (${durationMs}ms)`)
    if (response.status >= 500 || response.status === 429) reportCircuitFailure(apiUrl)
    recordAiUsage({ at: new Date().toISOString(), operation: operationName, model: options.model, provider: providerSource, apiUrl, promptTokens: null, completionTokens: null, totalTokens: null, durationMs, ok: false, status: response.status })
    throw new AIProviderError(response.status, `AI API failed: HTTP ${response.status}`)
  }

  const data = await response.json()
  reportCircuitSuccess(apiUrl)
  recordAiUsage({
    at: new Date().toISOString(),
    operation: operationName,
    model: options.model,
    provider: providerSource,
    apiUrl,
    promptTokens: data.usage?.prompt_tokens ?? null,
    completionTokens: data.usage?.completion_tokens ?? null,
    totalTokens: data.usage?.total_tokens ?? null,
    durationMs,
    ok: true,
    status: response.status,
    workspaceId: options.workspaceId,
    costUsd: recordAiSpend(options.workspaceId, options.model, {
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
      totalTokens: data.usage?.total_tokens ?? null,
    }),
  })
  console.log(`[AI ${operationName}] Success. Model: ${options.model}, Duration: ${durationMs}ms, Tokens: ${data.usage?.total_tokens ?? "unknown"}`)

  if (!data.choices?.length) {
    throw new Error("AI returned no choices — possible rate limit or safety block")
  }

  const content = data.choices[0].message?.content
  if (!content) throw new Error("Empty response from AI")
  // Return the content together with the truncation flag — callers need the
  // content itself to decide on a repair, so we must not throw here.
  return { content, truncated: data.choices[0].finish_reason === "length" }
}

function validateStructuredContent<T>(content: string, schema: ZodSchema<T>): T {
  const { data: parsed, error } = parseAiJson(content)
  if (error) throw new AIValidationError("AI returned malformed JSON")

  const validationResult = schema.safeParse(parsed)
  if (!validationResult.success) {
    console.error("[AI] Schema validation failed", validationResult.error.format())
    throw new AIValidationError(`AI returned JSON that does not match the expected schema: ${validationResult.error.message}`)
  }

  return validationResult.data
}

function buildRepairPayload(
  options: AIRequestOptions,
  messages: any[],
  invalidContent: string,
  validationError: AIValidationError
) {
  // Bump max_tokens by 1.5× for the repair attempt — truncation is often the root cause.
  const repairOptions = {
    ...options,
    maxTokens: Math.ceil((options.maxTokens ?? DEFAULT_AI_MAX_TOKENS) * 1.5),
  }
  // Only the tail of the invalid response is useful for a repair (that is
  // where truncation / the broken token lives); sending the whole thing back
  // on an 80k-char thesis prompt doubles the cost of the most expensive call.
  const REPAIR_CONTENT_TAIL = 4_000
  const trimmedContent = invalidContent.length > REPAIR_CONTENT_TAIL
    ? `[…${invalidContent.length - REPAIR_CONTENT_TAIL} chars omitted…]${invalidContent.slice(-REPAIR_CONTENT_TAIL)}`
    : invalidContent
  const trimmedError = validationError.message.slice(0, 1_500)
  return buildPayload(repairOptions, [
    ...messages,
    { role: "assistant", content: trimmedContent },
    {
      role: "user",
      content: `Your preceding response is invalid. Return only a corrected, COMPLETE JSON object that satisfies the requested schema (do not truncate). Validation error: ${trimmedError}`,
    },
  ], true)
}

export type AIProviderSource = "primary" | "fallback-provider"

let lastServedProvider: AIProviderSource = "primary"

export function getLastServedProvider(): AIProviderSource {
  return lastServedProvider
}

function resolveFallbackProvider(): { apiUrl: string; apiKey: string } | null {
  const apiUrl = process.env.AI_API_URL_FALLBACK
  const apiKey = process.env.AI_API_KEY_FALLBACK || process.env.AI_API_KEY
  if (!apiUrl || !apiKey) {
    return null
  }
  return { apiUrl, apiKey }
}

function recordProviderSource(
  options: AIRequestOptions,
  source: AIProviderSource
): void {
  lastServedProvider = source
  if (options.provenance) options.provenance.source = source
}

async function executeWithProviderFallback<R>(
  operationName: string,
  options: AIRequestOptions,
  operationFn: (apiUrl: string, apiKey: string) => Promise<R>
): Promise<R> {
  const { apiUrl: primaryUrl, apiKey: primaryKey } = resolveProvider(options)
  const fallback = resolveFallbackProvider()

  try {
    const result = await operationFn(primaryUrl, primaryKey)
    recordProviderSource(options, "primary")
    return result
  } catch (primaryError) {
    if (primaryError instanceof Error && primaryError.name === "AbortError") {
      throw primaryError
    }

    // Do NOT retry 4xx client errors (400, 401, 403, 404, 422) on fallback, except 429.
    // Also do NOT retry validation errors — the schema/prompt is the issue, not the provider.
    const isLocalFailure =
      primaryError instanceof AIProviderError &&
      primaryError.status >= 400 &&
      primaryError.status < 500 &&
      primaryError.status !== 429

    // AIValidationError: schema mismatch or truncated response — same problem on any provider.
    if (!fallback || isLocalFailure || primaryError instanceof AIValidationError) {
      throw primaryError
    }
    // AICircuitOpenError on the primary is exactly the case failover is for — fall through.

    console.warn(
      `[AI ${operationName}] Primary provider (${primaryUrl}) failed: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}. Attempting fallback provider (${fallback.apiUrl})...`
    )

    try {
      const result = await operationFn(fallback.apiUrl, fallback.apiKey)
      recordProviderSource(options, "fallback-provider")
      console.warn(`[AI client] Primary provider failed; succeeded via fallback provider ${fallback.apiUrl}`)
      return result
    } catch (fallbackError) {
      if (fallbackError instanceof Error && fallbackError.name === "AbortError") {
        throw fallbackError
      }
      console.error(
        `[AI ${operationName}] Fallback provider (${fallback.apiUrl}) also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
      )
      throw new AggregateError(
        [primaryError, fallbackError],
        `AI operation failed on both providers. Primary: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}. Fallback: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
      )
    }
  }
}

/**
 * Shared boundary for interacting with the AI provider.
 * Normalizes requests, enforces schemas, retries transient failures, and repairs one malformed response.
 */
export async function generateAIResponse<T>(
  operationName: string,
  options: AIClientOptions<T>
): Promise<T> {
  const messages = buildMessages(options)
  const payload = buildPayload(options, messages, true)

  return executeWithProviderFallback(operationName, options, async (apiUrl, apiKey) => {
    let content: string | null = null

    try {
      const completion = await requestCompletion(operationName, options, apiUrl, apiKey, payload)
      content = completion.content
      if (completion.truncated) {
        throw new AIValidationError("AI response was truncated (finish_reason=length); returned JSON is likely incomplete")
      }
      return validateStructuredContent(content, options.schema)
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn(`[AI ${operationName}] Request aborted`)
        throw error
      }

      if (!(error instanceof AIValidationError) || content === null) {
        if (error instanceof AIProviderError || error instanceof AICircuitOpenError) throw error
        console.error(`[AI ${operationName}] Unhandled error:`, error instanceof Error ? error.message : String(error))
        throw new Error(`AI operation failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      }

      try {
        const repairPayload = buildRepairPayload(options, messages, content, error)
        const repaired = await requestCompletion(operationName, options, apiUrl, apiKey, repairPayload)
        if (repaired.truncated) throw new AIValidationError("AI response was truncated (finish_reason=length); returned JSON is likely incomplete")
        return validateStructuredContent(repaired.content, options.schema)
      } catch (repairError) {
        if (repairError instanceof Error && repairError.name === "AbortError") throw repairError
        if (repairError instanceof AIProviderError || repairError instanceof AIValidationError) throw repairError
        throw new Error(`AI operation failed: ${repairError instanceof Error ? repairError.message : "Unknown error"}`)
      }
    }
  })
}

/** Appended to free-text completions cut off by max_tokens so UIs can warn / disable "apply". */
export const TEXT_TRUNCATION_MARKER = "[response truncated — output limit reached]"

export async function generateAITextResponse(
  operationName: string,
  options: Omit<AIClientOptions<any>, "schema">
): Promise<string> {
  const messages = buildMessages(options, true)
  const payload = buildPayload(options, messages, false)

  return executeWithProviderFallback(operationName, options, async (apiUrl, apiKey) => {
    try {
      const completion = await requestCompletion(operationName, options, apiUrl, apiKey, payload)
      if (completion.truncated) {
        console.warn(`[AI ${operationName}] Response truncated (finish_reason=length)`)
        return `${completion.content}\n\n${TEXT_TRUNCATION_MARKER}`
      }
      return completion.content
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn(`[AI ${operationName}] Request aborted`)
        throw error
      }
      if (error instanceof AIProviderError || error instanceof AICircuitOpenError) throw error
      console.error(`[AI ${operationName}] Unhandled error:`, error instanceof Error ? error.message : String(error))
      throw new Error(`AI operation failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  })
}
