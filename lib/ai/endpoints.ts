/**
 * OpenAI-compatible AI endpoints management.
 * Endpoints are configured strictly in Settings -> AI Models and persisted in SystemSetting DB & localStorage.
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

let cachedEndpoints: { data: AiEndpointConfig[]; expiresAt: number } | null = null
const CACHE_TTL_MS = 5_000

export function invalidateAiEndpointsCache(): void {
  cachedEndpoints = null
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
 * Server-side fetch to load models from an OpenAI-compatible endpoint.
 * Calling from the server avoids browser CORS / mixed-content restrictions.
 */
export async function fetchModelsFromEndpoint(
  baseUrl: string,
  apiKey?: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; models: string[]; error?: string }> {
  const normalizedBase = normalizeEndpointBaseUrl(baseUrl)
  const modelsUrl = `${normalizedBase}/models`

  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  if (apiKey?.trim()) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`
  }

  const timeoutSignal = AbortSignal.timeout(15_000)
  const effectiveSignal = signal
    ? typeof AbortSignal.any === "function"
      ? AbortSignal.any([signal, timeoutSignal])
      : signal
    : timeoutSignal

  try {
    const res = await fetch(modelsUrl, {
      method: "GET",
      headers,
      signal: effectiveSignal,
    })

    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const errJson = await res.json()
        message = errJson?.error?.message || errJson?.message || message
      } catch {
        try {
          message = (await res.text()).slice(0, 200) || message
        } catch {}
      }
      return { ok: false, models: [], error: message }
    }

    const data = await res.json()
    const models = extractModelIdsFromResponse(data)
    return { ok: true, models }
  } catch (err: unknown) {
    return {
      ok: false,
      models: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Loads stored AI endpoints from the database SystemSetting table.
 */
export async function getStoredAiEndpoints(skipCache = false): Promise<AiEndpointConfig[]> {
  const now = Date.now()
  if (!skipCache && cachedEndpoints && cachedEndpoints.expiresAt > now) {
    return cachedEndpoints.data
  }

  try {
    const { prisma } = await import("@/lib/prisma")
    if (!prisma?.systemSetting) return []
    const row = await prisma.systemSetting.findUnique({
      where: { key: "ai_endpoints" },
    })
    if (row?.value) {
      const parsed = JSON.parse(row.value)
      if (Array.isArray(parsed)) {
        cachedEndpoints = { data: parsed, expiresAt: now + CACHE_TTL_MS }
        return parsed
      }
    }
  } catch (err) {
    console.warn("[ai-endpoints] Failed to load endpoints from DB:", err)
  }

  return []
}

/**
 * Persists AI endpoints to the database SystemSetting table.
 */
export async function setStoredAiEndpoints(endpoints: AiEndpointConfig[]): Promise<void> {
  const { prisma } = await import("@/lib/prisma")
  if (!prisma?.systemSetting) return
  await prisma.systemSetting.upsert({
    where: { key: "ai_endpoints" },
    create: {
      key: "ai_endpoints",
      value: JSON.stringify(endpoints),
    },
    update: {
      value: JSON.stringify(endpoints),
    },
  })
  cachedEndpoints = { data: endpoints, expiresAt: Date.now() + CACHE_TTL_MS }
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
