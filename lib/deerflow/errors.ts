/**
 * DeerFlow bridge error taxonomy.
 *
 * Every bridge failure maps to one of these so route handlers can translate
 * it into a `safeApiError` shape without leaking internals or stack traces.
 */
import "server-only"

export type DeerflowErrorCode =
  | "DEERFLOW_DISABLED"
  | "DEERFLOW_DISABLED_WORKSPACE"
  | "DEERFLOW_UNAVAILABLE"
  | "DEERFLOW_AUTH"
  | "DEERFLOW_TIMEOUT"
  | "DEERFLOW_RATE_LIMITED"
  | "DEERFLOW_BUDGET_EXCEEDED"
  | "DEERFLOW_NEEDS_CONFIRMATION"
  | "DEERFLOW_NOT_FOUND"
  | "DEERFLOW_PROTOCOL"
  | "DEERFLOW_OUTPUT_UNPARSEABLE"
  | "DEERFLOW_VALIDATION"

export class DeerflowError extends Error {
  constructor(
    message: string,
    public readonly code: DeerflowErrorCode,
    public readonly status = 500,
    public readonly retryable = false
  ) {
    super(message)
    this.name = "DeerflowError"
  }
}

export class DeerflowDisabledError extends DeerflowError {
  constructor(public readonly workspaceScoped = false) {
    super(
      workspaceScoped
        ? "DeerFlow is disabled for this workspace"
        : "DeerFlow integration is disabled on this server",
      workspaceScoped ? "DEERFLOW_DISABLED_WORKSPACE" : "DEERFLOW_DISABLED",
      503
    )
  }
}

export class DeerflowUnavailableError extends DeerflowError {
  constructor(message = "DeerFlow service is offline or unreachable") {
    super(message, "DEERFLOW_UNAVAILABLE", 503, true)
  }
}

export class DeerflowAuthError extends DeerflowError {
  constructor(message = "DeerFlow rejected the service credentials") {
    super(message, "DEERFLOW_AUTH", 502)
  }
}

export class DeerflowTimeoutError extends DeerflowError {
  constructor(message = "DeerFlow run timed out") {
    super(message, "DEERFLOW_TIMEOUT", 504, true)
  }
}

export class DeerflowRateLimitedError extends DeerflowError {
  constructor(message = "DeerFlow is rate limiting this request") {
    super(message, "DEERFLOW_RATE_LIMITED", 429, true)
  }
}

export class DeerflowBudgetExceededError extends DeerflowError {
  constructor(message = "Daily DeerFlow budget exceeded for this workspace") {
    super(message, "DEERFLOW_BUDGET_EXCEEDED", 429)
  }
}

export class DeerflowNotFoundError extends DeerflowError {
  constructor(message = "DeerFlow resource not found") {
    super(message, "DEERFLOW_NOT_FOUND", 404)
  }
}

export class DeerflowProtocolError extends DeerflowError {
  constructor(message = "Invalid DeerFlow protocol response") {
    super(message, "DEERFLOW_PROTOCOL", 502)
  }
}

export class DeerflowOutputUnparseableError extends DeerflowError {
  constructor(message = "DeerFlow finished without a parseable proposal") {
    super(message, "DEERFLOW_OUTPUT_UNPARSEABLE", 422)
  }
}

export class DeerflowValidationError extends DeerflowError {
  constructor(message = "Invalid DeerFlow request") {
    super(message, "DEERFLOW_VALIDATION", 400)
  }
}

/** True when the error is safe to present to the user verbatim. */
export function isDeerflowError(err: unknown): err is DeerflowError {
  return err instanceof DeerflowError
}
