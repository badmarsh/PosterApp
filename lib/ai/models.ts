/**
 * Centralized model defaults and timeout configuration for all AI operations.
 */

import { rankModelsByHealth } from "./telemetry"

export const DEFAULT_AI_MODELS = {
  default: "gemini-2.5-flash",
  generation: "gemini-2.5-flash",
  structure: "gemini-2.5-flash",
  convert: "gemini-2.5-flash",
  shrink: "gemini-2.5-flash",
  review: "gemini-2.5-flash",
  reviewLayout: "gemini-2.5-flash",
  vision: "gemini-2.5-flash",
  ocr: "gemini-2.5-flash",
  chat: "gemini-2.5-flash",
  bibtex: "gemini-2.5-flash",
  labeler: "gemini-2.5-flash",
  autofix: "gemini-2.5-flash",
  thesis: "gemini-2.5-flash",
} as const

export type AiModelRole = keyof typeof DEFAULT_AI_MODELS

export const AI_TIMEOUTS = {
  vision: 60_000,
  ocr: 90_000,
  bibtex: 45_000,
  labeler: 45_000,
  structure: 60_000,
  shrink: 120_000,
  generation: 180_000,
  review: 180_000,
  chat: 180_000,
  thesis: 210_000,
} as const

export const DEFAULT_FALLBACK_VISION_MODELS: readonly string[] = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "qwen3-vl-flash",
  "qwen3-vl-plus",
  "qwen-omni-turbo",
  "qwen3-omni-flash",
  "qwen-vl-max",
  "qwen-vl-plus",
  "qwen3-vl-235b-a22b-instruct",
] as const

/** Max models tried per image (override with AI_VISION_MAX_CHAIN). */
export const MAX_VISION_CHAIN = Math.max(1, Number(process.env.AI_VISION_MAX_CHAIN) || 3)
/** Shared wall-clock deadline for the whole vision fallback chain per image. */
export const VISION_CHAIN_DEADLINE_MS = Number(process.env.AI_VISION_CHAIN_DEADLINE_MS) || 90_000

export function getVisionModelChain(): string[] {
  const primary = process.env.AI_VISION_MODEL || DEFAULT_AI_MODELS.vision
  const envFallbacks = process.env.AI_VISION_FALLBACK_MODELS
    ? process.env.AI_VISION_FALLBACK_MODELS.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_FALLBACK_VISION_MODELS

  // Unique ordered chain starting with primary. Capped at MAX_VISION_CHAIN so a
  // dead provider cannot stall captioning for 10 models × attempts × timeout per image.
  const unique = Array.from(new Set([primary, ...envFallbacks])).slice(0, MAX_VISION_CHAIN)

  // Provider health model: re-order the chain by observed failure rate /
  // latency (breaker + ledger). Unobserved models stay in configured order.
  // Disable with AI_MODEL_HEALTH_ROUTING=false.
  if (process.env.AI_MODEL_HEALTH_ROUTING === "false") return unique
  try {
    return rankModelsByHealth(unique)
  } catch {
    return unique
  }
}

/**
 * Header name for AI model overrides sent from client to server.
 * Format: JSON-encoded Partial<Record<AiModelRole, string>>
 */
export const AI_MODEL_OVERRIDE_HEADER = "X-AI-Model-Override"

/** Only roles that exist in DEFAULT_AI_MODELS are valid override targets. */
const VALID_AI_ROLES = Object.keys(DEFAULT_AI_MODELS) as AiModelRole[]

/** Model names must be ASCII, start with a letter/digit, and be ≤ 128 chars. */
const AI_MODEL_OVERRIDE_VALUE_RE = /^[A-Za-z0-9][A-Za-z0-9._:\-]{0,127}$/

/**
 * Parse and validate AI model overrides from request headers.
 * - Unknown roles are silently dropped.
 * - Non-string values (e.g. `{"chat": 123}`) are dropped.
 * - Values that fail the model-name format check are dropped.
 * Returns empty object if header is missing or entirely invalid.
 */
export function parseAiModelOverrides(headers: Headers): Partial<Record<AiModelRole, string>> {
  const headerValue = headers.get(AI_MODEL_OVERRIDE_HEADER)
  if (!headerValue) return {}
  try {
    const parsed: unknown = JSON.parse(headerValue)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const result: Partial<Record<AiModelRole, string>> = {}
    for (const role of VALID_AI_ROLES) {
      const value = (parsed as Record<string, unknown>)[role]
      if (typeof value === "string" && AI_MODEL_OVERRIDE_VALUE_RE.test(value)) {
        result[role] = value
      }
    }
    return result
  } catch {
    return {}
  }
}

export const AI_API_KEY_HEADER = "X-Gemini-Api-Key"
export const AI_CUSTOM_KEY_HEADER = "X-AI-Api-Key"
export const AI_BASE_URL_HEADER = "X-AI-Base-Url"
export const AI_ENDPOINTS_HEADER = "X-AI-Endpoints"

/**
 * Parse client-supplied Gemini or custom AI API key from request headers.
 */
export function parseAiApiKey(headers: Headers): string | undefined {
  const geminiKey = headers.get("x-gemini-api-key")?.trim()
  if (geminiKey) return geminiKey
  const customKey = headers.get("x-ai-api-key")?.trim()
  if (customKey) return customKey
  return undefined
}

/**
 * Parse client-supplied AI base URL from request headers.
 */
export function parseAiBaseUrl(headers: Headers): string | undefined {
  const baseUrl = headers.get("x-ai-base-url")?.trim()
  return baseUrl || undefined
}

/**
 * Parse client-supplied AI endpoints configuration from request headers.
 */
export function parseAiEndpointsHeader(headers: Headers): Array<{
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  enabled?: boolean
  models?: string[]
}> {
  const raw = headers.get("x-ai-endpoints")
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return []
}

/**
 * Resolve the matching AI endpoint (base URL and API key) from request headers.
 * If model is specified, matches the endpoint that contains that model.
 */
export function parseAiEndpoint(
  headers: Headers,
  model?: string
): { apiUrl?: string; apiKey?: string } {
  const endpoints = parseAiEndpointsHeader(headers)
  if (model && endpoints.length > 0) {
    const matching = endpoints.find(
      (e) => e.enabled !== false && Array.isArray(e.models) && e.models.includes(model)
    )
    if (matching?.baseUrl) {
      return {
        apiUrl: matching.baseUrl,
        apiKey: matching.apiKey,
      }
    }
  }

  const baseUrl = parseAiBaseUrl(headers) || endpoints[0]?.baseUrl
  const apiKey = parseAiApiKey(headers) || endpoints[0]?.apiKey

  return { apiUrl: baseUrl, apiKey }
}

/**
 * Resolve AI model for a given role, checking for user overrides first.
 * If overrides are provided, they take precedence over env vars.
 * Non-string override values are safely ignored.
 */
export function resolveAiModelWithOverrides(
  role: AiModelRole,
  overrides: Partial<Record<AiModelRole, string>>
): string {
  const override = overrides[role]
  if (typeof override === "string" && override) return override

  // If a primary default override is configured, inherit it for general text-based tasks
  // or multimodal tasks if the default model supports multimodal vision (e.g. gemini-*, vl, omni)
  if (role !== "default" && typeof overrides.default === "string" && overrides.default) {
    const isMultimodal = role === "vision" || role === "ocr" || role === "reviewLayout"
    const defaultSupportsMultimodal =
      overrides.default.startsWith("gemini-") ||
      overrides.default.includes("vl") ||
      overrides.default.includes("omni")
    if (!isMultimodal || defaultSupportsMultimodal) {
      return overrides.default
    }
  }

  return resolveAiModel(role)
}

export function resolveAiModel(role: AiModelRole = "default"): string {
  switch (role) {
    case "vision":
      return process.env.AI_VISION_MODEL || DEFAULT_AI_MODELS.vision
    case "ocr":
      return process.env.AI_OCR_MODEL || process.env.AI_VISION_MODEL || DEFAULT_AI_MODELS.ocr
    case "generation":
      return process.env.AI_GENERATION_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.generation
    case "structure":
      return process.env.AI_STRUCTURE_MODEL || process.env.AI_GENERATION_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.structure
    case "convert":
      return process.env.AI_CONVERT_MODEL || process.env.AI_GENERATION_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.convert
    case "shrink":
      return process.env.AI_SHRINK_MODEL || process.env.AI_GENERATION_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.shrink
    case "review":
      return process.env.AI_REVIEW_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.review
    case "reviewLayout":
      return process.env.AI_REVIEW_LAYOUT_MODEL || process.env.AI_VISION_MODEL || process.env.AI_REVIEW_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.reviewLayout
    case "chat":
      return process.env.AI_CHAT_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.chat
    case "bibtex":
      return process.env.AI_BIBTEX_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.bibtex
    case "labeler":
      return process.env.AI_LABELER_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.labeler
    case "autofix":
      return process.env.AI_AUTOFIX_MODEL || process.env.AI_REVIEW_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.autofix
    case "thesis":
      return process.env.AI_THESIS_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.thesis
    default:
      return process.env.AI_MODEL || DEFAULT_AI_MODELS.default
  }
}



