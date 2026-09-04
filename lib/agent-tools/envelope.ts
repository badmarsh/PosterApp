export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "TOOL_NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "PENDING_APPROVAL"
  | "EXPIRED"
  | "INTERNAL"

export type EnvelopeOk<T> = {
  ok: true
  data: T
  meta: {
    tool: string
    durationMs: number
  }
}

export type EnvelopeErr = {
  ok: false
  error: {
    code: ErrorCode
    message: string
    retryable: boolean
    retryAfterMs?: number
    details?: unknown
  }
}

export type Envelope<T = unknown> = EnvelopeOk<T> | EnvelopeErr

export function okEnvelope<T>(data: T, tool: string, durationMs: number): EnvelopeOk<T> {
  return {
    ok: true,
    data,
    meta: {
      tool,
      durationMs,
    },
  }
}

export function errorEnvelope(
  code: ErrorCode,
  message: string,
  opts?: { retryAfterMs?: number; details?: unknown }
): EnvelopeErr {
  const retryable = code === "RATE_LIMITED" || code === "INTERNAL"
  return {
    ok: false,
    error: {
      code,
      message,
      retryable,
      ...(opts?.retryAfterMs !== undefined ? { retryAfterMs: opts.retryAfterMs } : {}),
      ...(opts?.details !== undefined ? { details: opts.details } : {}),
    },
  }
}
