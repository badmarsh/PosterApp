/**
 * DeerFlow HTTP bridge (server-only).
 *
 * Talks to the DeerFlow sidecar over the LangGraph-compatible API behind
 * the unified nginx proxy. Two properties matter:
 *
 * 1. The base URL is operator-configured (`DEERFLOW_URL`), never user input.
 *    Paths are constructed server-side and checked to stay on the same origin
 *    so a crafted path cannot redirect the bridge to an arbitrary host.
 * 2. No secrets are ever passed to the sidecar *into* a run payload — see
 *    lib/deerflow/prompts.ts. The service token only goes in the Authorization
 *    header of bridge requests.
 */
import "server-only"
import { getDeerflowConfig } from "./config"
import {
  DeerflowAuthError,
  DeerflowNotFoundError,
  DeerflowProtocolError,
  DeerflowRateLimitedError,
  DeerflowTimeoutError,
  DeerflowUnavailableError,
  DeerflowValidationError,
} from "./errors"
import { parseSseStream, type SseEvent } from "./sse"

/** Response of `POST /api/langgraph/threads`. */
export interface DeerThread {
  thread_id: string
  created_at?: string
  metadata?: Record<string, unknown>
}

export interface RunInput {
  messages: Array<{ type: "human" | "ai"; content: Array<{ type: "text"; text: string }> }>
}

export interface StartRunPayload {
  assistant_id?: string
  input: RunInput
  stream_mode?: Array<"values" | "messages-tuple" | "custom" | "updates">
  stream_subgraphs?: boolean
  config?: {
    recursion_limit?: number
    configurable?: Record<string, unknown>
  }
  context?: Record<string, unknown>
}

export interface StreamRunOptions {
  timeoutMs?: number
  signal?: AbortSignal
  onEvent?: (event: SseEvent) => void
}

export const DEERFLOW_MEDIA_TYPE = "text/event-stream"

/**
 * Ensures `path` resolves to the same origin as the configured DeerFlow base
 * URL. Rejects absolute URLs to other origins outright.
 */
export function assertBridgePath(baseUrl: string, path: string): string {
  if (!path.startsWith("/")) {
    throw new DeerflowValidationError("DeerFlow bridge paths must be origin-relative")
  }
  let base: URL
  let resolved: URL
  try {
    base = new URL(baseUrl)
    resolved = new URL(path, base)
  } catch {
    throw new DeerflowValidationError("Invalid DeerFlow URL")
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new DeerflowValidationError("DeerFlow URL must use http(s)")
  }
  if (resolved.origin !== base.origin) {
    throw new DeerflowValidationError("DeerFlow bridge path escapes the configured origin")
  }
  // Disallow embedded credentials / unusual ports changes (origin already covers ports).
  if (base.username || base.password || resolved.username || resolved.password) {
    throw new DeerflowValidationError("DeerFlow URL must not contain credentials")
  }
  return path
}

interface BridgeResponse {
  status: number
  json?: unknown
  body?: ReadableStream<Uint8Array> | null
  headers: Headers
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === "AbortError"
    : err instanceof Error && err.name === "AbortError"
}

async function bridgeRequest(
  method: "GET" | "POST" | "DELETE",
  path: string,
  opts: {
    body?: unknown
    timeoutMs?: number
    signal?: AbortSignal
    acceptEventStream?: boolean
  } = {}
): Promise<BridgeResponse> {
  const config = getDeerflowConfig()
  const safePath = assertBridgePath(config.baseUrl, path)
  const timeoutMs = opts.timeoutMs ?? Math.min(config.runTimeoutMs, 120_000)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const signals = [controller.signal]
  if (opts.signal) signals.push(opts.signal)
  const signal =
    typeof AbortSignal.any === "function"
      ? AbortSignal.any(signals)
      : controller.signal

  let res: Response
  try {
    res = await fetch(`${config.baseUrl}${safePath}`, {
      method,
      headers: {
        Accept: opts.acceptEventStream ? DEERFLOW_MEDIA_TYPE : "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(config.serviceToken ? { Authorization: `Bearer ${config.serviceToken}` } : {}),
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      signal,
    })
  } catch (err) {
    if (isAbortError(err)) {
      throw new DeerflowTimeoutError()
    }
    throw new DeerflowUnavailableError()
  } finally {
    clearTimeout(timeout)
  }

  // 4xx/5xx mapping: body may be JSON with a message; keep it bounded.
  if (res.status === 401 || res.status === 403) throw new DeerflowAuthError()
  if (res.status === 404) throw new DeerflowNotFoundError()
  if (res.status === 429) throw new DeerflowRateLimitedError()
  if (res.status >= 500) throw new DeerflowUnavailableError(`DeerFlow returned HTTP ${res.status}`)
  if (!res.ok) throw new DeerflowProtocolError(`DeerFlow returned HTTP ${res.status}`)

  let json: unknown
  if (!opts.acceptEventStream && res.status !== 204) {
    json = await res.json().catch(() => {
      throw new DeerflowProtocolError("DeerFlow returned a non-JSON response")
    })
  }

  return {
    status: res.status,
    body: res.body,
    headers: res.headers,
    json,
  }
}

const THREAD_ID_RE = /^[A-Za-z0-9._-]{1,128}$/

function assertThreadId(threadId: string): void {
  if (!THREAD_ID_RE.test(threadId)) {
    throw new DeerflowValidationError("Invalid DeerFlow thread id")
  }
}

/** Creates a conversation thread on the sidecar. */
export async function createDeerThread(metadata: Record<string, unknown> = {}): Promise<DeerThread> {
  const res = await bridgeRequest("POST", "/api/langgraph/threads", {
    body: { metadata },
    timeoutMs: 30_000,
  })
  const json = res.json as Partial<DeerThread>
  if (!json || typeof json.thread_id !== "string" || !json.thread_id) {
    throw new DeerflowProtocolError("DeerFlow thread response missing thread_id")
  }
  return json as DeerThread
}

/**
 * Starts a run and streams SSE events. Consume via `for await`.
 * Throws the DeerFlow error taxonomy on transport/protocol failures.
 */
export async function* streamDeerRun(
  threadId: string,
  payload: StartRunPayload,
  options: StreamRunOptions = {}
): AsyncGenerator<SseEvent> {
  assertThreadId(threadId)
  const { timeoutMs = getDeerflowConfig().runTimeoutMs, signal, onEvent } = options
  const res = await bridgeRequest("POST", `/api/langgraph/threads/${threadId}/runs/stream`, {
    body: payload,
    signal,
    timeoutMs,
    acceptEventStream: true,
  })
  if (!res.body) {
    throw new DeerflowProtocolError("DeerFlow returned an empty stream")
  }
  for await (const event of parseSseStream(res.body, { signal, maxEventBytes: 512 * 1024 })) {
    onEvent?.(event)
    yield event
  }
}

/** Deletes the local thread data on the sidecar (best-effort, Gateway endpoint). */
export async function deleteDeerThread(threadId: string): Promise<void> {
  assertThreadId(threadId)
  try {
    await bridgeRequest("DELETE", `/api/threads/${threadId}`, { timeoutMs: 15_000 })
  } catch (err) {
    // Deletion is best-effort cleanup; a missing thread is not an error.
    if (err instanceof DeerflowNotFoundError) return
    throw err
  }
}
