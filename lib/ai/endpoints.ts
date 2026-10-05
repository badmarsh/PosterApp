/**
 * OpenAI-compatible AI endpoint helpers.
 *
 * This module is shared by client components (URL validation/normalisation) and
 * server code (model discovery), so it deliberately contains no database
 * access. Persistence and credential ownership live in `lib/ai/endpoint-store.ts`.
 *
 * Ownership in one line: endpoints (and the API keys inside them) belong to the
 * user who configured them, are stored per user, and are never shared with other
 * accounts. The legacy instance-wide row is an administrator-managed default.
 */

export interface AiEndpointConfig {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  enabled?: boolean
  models?: string[]
  lastLoadedAt?: string
  status?: "connected" | "error" | "untested"
  errorMessage?: string
}

export interface LoadedAiModel {
  id: string
  name?: string
  endpointId: string
  endpointName: string
  baseUrl: string
}

/**
 * Normalizes an OpenAI-compatible base URL.
 * Strips trailing slashes and /chat/completions if entered by user.
 */
export function normalizeEndpointBaseUrl(url: string): string {
  let trimmed = url.trim().replace(/\/+$/, "")
  if (trimmed.endsWith("/chat/completions")) {
    trimmed = trimmed.replace(/\/chat\/completions$/, "")
  }
  return trimmed
}

/** Accept only credential-free HTTP(S) URLs before sending them to the server. */
export function isValidEndpointBaseUrl(value: string): boolean {
  try {
    const url = new URL(normalizeEndpointBaseUrl(value))
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

/**
 * Normalizes a base URL to full chat completions URL (/chat/completions).
 */
export function normalizeChatCompletionsUrl(url: string): string {
  const base = normalizeEndpointBaseUrl(url)
  if (base.endsWith("/chat/completions")) return base
  return `${base}/chat/completions`
}

/**
 * Parses model IDs from an OpenAI/Ollama/Gemini models endpoint response.
 */
export function extractModelIdsFromResponse(data: unknown): string[] {
  if (!data || typeof data !== "object") return []
  const res = data as Record<string, unknown>
  const ids: string[] = []

  // OpenAI format: { data: [ { id: "model-name" }, ... ] }
  if (Array.isArray(res.data)) {
    for (const item of res.data) {
      if (typeof item === "string" && item.trim()) {
        ids.push(item.trim())
      } else if (item && typeof item === "object" && typeof (item as any).id === "string" && (item as any).id.trim()) {
        ids.push((item as any).id.trim())
      }
    }
  }

  // Ollama or Gemini format: { models: [ { name: "..." }, ... ] }
  if (Array.isArray(res.models)) {
    for (const item of res.models) {
      if (typeof item === "string" && item.trim()) {
        ids.push(item.trim().replace(/^models\//, ""))
      } else if (item && typeof item === "object") {
        const anyItem = item as Record<string, unknown>
        if (typeof anyItem.name === "string" && anyItem.name.trim()) {
          ids.push(anyItem.name.trim().replace(/^models\//, ""))
        } else if (typeof anyItem.id === "string" && anyItem.id.trim()) {
          ids.push(anyItem.id.trim().replace(/^models\//, ""))
        }
      }
    }
  }

  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
}

/**
 * Resolves the matching endpoint configuration for a requested model from a list of endpoints.
 * First checks if any endpoint's loaded models list includes the model.
 * Falls back to the first enabled endpoint.
 */
export function resolveEndpointForModel(
  model: string,
  endpoints: AiEndpointConfig[]
): AiEndpointConfig | undefined {
  const enabled = endpoints.filter((e) => e.enabled !== false && Boolean(e.baseUrl?.trim()))
  if (enabled.length === 0) return undefined

  // Find endpoint that loaded this model
  const matching = enabled.find((e) => Array.isArray(e.models) && e.models.includes(model))
  if (matching) return matching

  // Fallback to first enabled endpoint
  return enabled[0]
}
