import "server-only"
import { extractModelIdsFromResponse, normalizeEndpointBaseUrl } from "./endpoints"
import { safeFetch } from "@/lib/safe-fetch"

/**
 * Whether operators allow AI endpoints on loopback / private networks
 * (Ollama, LM Studio, vLLM on the instance's own host or LAN). Off by default:
 * the server must not be usable as a proxy into internal networks. Link-local
 * ranges and cloud metadata endpoints stay blocked even when this is enabled.
 */
export function allowPrivateAiEndpointHosts(): boolean {
  const value = process.env.AI_ENDPOINTS_ALLOW_PRIVATE_HOSTS?.trim().toLowerCase()
  return value === "true" || value === "1" || value === "yes"
}

/**
 * Server-side fetch to load models from an OpenAI-compatible endpoint.
 * Calling from the server avoids browser CORS / mixed-content restrictions.
 *
 * The request goes through the SSRF-safe fetch helper, so the URL and every
 * redirect hop are validated (including DNS resolution), and private hosts are
 * rejected unless `AI_ENDPOINTS_ALLOW_PRIVATE_HOSTS` is enabled.
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

  try {
    const res = await safeFetch(modelsUrl, {
      headers,
      signal,
      timeoutMs: 15_000,
      allowPrivateHosts: allowPrivateAiEndpointHosts(),
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
    let message = err instanceof Error ? err.message : String(err)
    if (/SSRF protection/.test(message) && !allowPrivateAiEndpointHosts()) {
      message +=
        ". Local or private AI endpoints require AI_ENDPOINTS_ALLOW_PRIVATE_HOSTS=true on the server."
    }
    return { ok: false, models: [], error: message }
  }
}
