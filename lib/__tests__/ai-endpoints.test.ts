import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  normalizeEndpointBaseUrl,
  normalizeChatCompletionsUrl,
  extractModelIdsFromResponse,
  resolveEndpointForModel,
  type AiEndpointConfig,
} from "@/lib/ai/endpoints"
import { fetchModelsFromEndpoint } from "@/lib/ai/model-discovery"
import { parseAiEndpointsHeader, parseAiEndpoint, parseAiBaseUrl } from "@/lib/ai/models"

// Model discovery resolves hostnames through node:dns; stub it so tests never
// touch the network and can simulate a public name that resolves internally.
const dnsLookup = vi.hoisted(() => vi.fn())
vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => dnsLookup(...args),
}))

const lookupTable: Record<string, { address: string; family: number }[]> = {
  localhost: [{ address: "127.0.0.1", family: 4 }],
  "api.openai.com": [{ address: "104.18.6.12", family: 4 }],
}

describe("AI Endpoints Module", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    dnsLookup.mockReset()
    dnsLookup.mockImplementation(async (host: string) => {
      const entry = lookupTable[host]
      if (!entry) throw new Error(`getaddrinfo ENOTFOUND ${host}`)
      return entry
    })
    delete process.env.AI_ENDPOINTS_ALLOW_PRIVATE_HOSTS
  })

  describe("URL Normalization", () => {
    it("normalizes base URLs by removing trailing slashes and /chat/completions", () => {
      expect(normalizeEndpointBaseUrl("http://localhost:11434/v1/")).toBe("http://localhost:11434/v1")
      expect(normalizeEndpointBaseUrl("https://openrouter.ai/api/v1/chat/completions")).toBe(
        "https://openrouter.ai/api/v1"
      )
      expect(normalizeEndpointBaseUrl("https://api.openai.com/v1///")).toBe("https://api.openai.com/v1")
    })

    it("normalizes chat completions URL", () => {
      expect(normalizeChatCompletionsUrl("http://localhost:11434/v1")).toBe(
        "http://localhost:11434/v1/chat/completions"
      )
      expect(normalizeChatCompletionsUrl("https://openrouter.ai/api/v1/chat/completions")).toBe(
        "https://openrouter.ai/api/v1/chat/completions"
      )
    })
  })

  describe("extractModelIdsFromResponse", () => {
    it("extracts and sorts model IDs from OpenAI format", () => {
      const payload = {
        object: "list",
        data: [
          { id: "gpt-4o", object: "model" },
          { id: "anthropic/claude-3.5-sonnet", object: "model" },
          { id: "gpt-4o-mini", object: "model" },
        ],
      }
      const models = extractModelIdsFromResponse(payload)
      expect(models).toEqual(["anthropic/claude-3.5-sonnet", "gpt-4o", "gpt-4o-mini"])
    })

    it("extracts model IDs from Ollama or Gemini format", () => {
      const payload = {
        models: [
          { name: "models/gemini-2.5-flash" },
          { name: "models/gemini-3.8-flash" },
          { id: "llama3.2:latest" },
        ],
      }
      const models = extractModelIdsFromResponse(payload)
      expect(models).toEqual(["gemini-2.5-flash", "gemini-3.8-flash", "llama3.2:latest"])
    })

    it("returns empty array on invalid or empty response", () => {
      expect(extractModelIdsFromResponse(null)).toEqual([])
      expect(extractModelIdsFromResponse({})).toEqual([])
      expect(extractModelIdsFromResponse({ data: [] })).toEqual([])
    })
  })

  describe("resolveEndpointForModel", () => {
    const endpoints: AiEndpointConfig[] = [
      {
        id: "ep-ollama",
        name: "Local Ollama",
        baseUrl: "http://localhost:11434/v1",
        enabled: true,
        models: ["llama3.2", "qwen2.5-coder"],
      },
      {
        id: "ep-openrouter",
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk-or-test",
        enabled: true,
        models: ["anthropic/claude-3.5-sonnet", "deepseek/deepseek-r1"],
      },
    ]

    it("resolves the endpoint that contains the model in its loaded models list", () => {
      const ep1 = resolveEndpointForModel("qwen2.5-coder", endpoints)
      expect(ep1?.id).toBe("ep-ollama")
      expect(ep1?.baseUrl).toBe("http://localhost:11434/v1")

      const ep2 = resolveEndpointForModel("deepseek/deepseek-r1", endpoints)
      expect(ep2?.id).toBe("ep-openrouter")
      expect(ep2?.apiKey).toBe("sk-or-test")
    })

    it("falls back to the first enabled endpoint if model is not found in any list", () => {
      const fallback = resolveEndpointForModel("unlisted-model-v1", endpoints)
      expect(fallback?.id).toBe("ep-ollama")
    })

    it("ignores disabled endpoints", () => {
      const withDisabled: AiEndpointConfig[] = [
        { ...endpoints[0], enabled: false },
        endpoints[1],
      ]
      const ep = resolveEndpointForModel("llama3.2", withDisabled)
      expect(ep?.id).toBe("ep-openrouter")
    })
  })

  describe("fetchModelsFromEndpoint", () => {
    it("fetches and parses models successfully from a local endpoint when private hosts are allowed", async () => {
      process.env.AI_ENDPOINTS_ALLOW_PRIVATE_HOSTS = "true"
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: "model-alpha" }, { id: "model-beta" }],
          }),
          { status: 200 }
        )
      )
      vi.stubGlobal("fetch", fetchMock)

      const result = await fetchModelsFromEndpoint("http://localhost:11434/v1", "test-key")
      expect(result.ok).toBe(true)
      expect(result.models).toEqual(["model-alpha", "model-beta"])
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:11434/v1/models",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-key",
          }),
        })
      )
    })

    it("handles HTTP error response gracefully", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Invalid API key" } }), { status: 401 })
      )
      vi.stubGlobal("fetch", fetchMock)

      const result = await fetchModelsFromEndpoint("https://api.openai.com/v1", "bad-key")
      expect(result.ok).toBe(false)
      expect(result.error).toContain("Invalid API key")
      expect(result.models).toEqual([])
    })

    it("refuses private and loopback endpoints by default (SSRF protection)", async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)

      const result = await fetchModelsFromEndpoint("http://localhost:11434/v1", "test-key")

      expect(result.ok).toBe(false)
      expect(result.models).toEqual([])
      expect(result.error).toContain("SSRF protection")
      // The actionable hint tells the operator which switch to flip.
      expect(result.error).toContain("AI_ENDPOINTS_ALLOW_PRIVATE_HOSTS")
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("never fetches cloud metadata addresses, even with private hosts allowed", async () => {
      process.env.AI_ENDPOINTS_ALLOW_PRIVATE_HOSTS = "true"
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)

      for (const target of [
        "http://169.254.169.254/v1",
        "http://metadata.google.internal/v1",
        "http://[fe80::1]/v1",
      ]) {
        const result = await fetchModelsFromEndpoint(target, "test-key")
        expect(result.ok).toBe(false)
        expect(result.error).toContain("SSRF protection")
      }
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("blocks a public hostname that resolves to an internal address", async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      dnsLookup.mockResolvedValue([{ address: "10.0.0.9", family: 4 }])

      const result = await fetchModelsFromEndpoint("https://intranet-proxy.example.com/v1", "test-key")

      expect(result.ok).toBe(false)
      expect(result.error).toContain("SSRF protection")
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("does not follow a redirect into a blocked address", async () => {
      process.env.AI_ENDPOINTS_ALLOW_PRIVATE_HOSTS = "true"
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, { status: 302, headers: { location: "http://169.254.169.254/v1/models" } })
        )
      vi.stubGlobal("fetch", fetchMock)

      const result = await fetchModelsFromEndpoint("https://api.openai.com/v1", "test-key")

      expect(result.ok).toBe(false)
      expect(result.error).toContain("SSRF protection")
      // Only the initial public request was attempted; the metadata hop was not.
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(String(fetchMock.mock.calls[0][0])).toContain("api.openai.com")
    })

    it("requires redirects to be followed manually so a public host cannot bounce internally", async () => {
      process.env.AI_ENDPOINTS_ALLOW_PRIVATE_HOSTS = "true"
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "model-x" }] }), { status: 200 })
      )
      vi.stubGlobal("fetch", fetchMock)

      const result = await fetchModelsFromEndpoint("https://api.openai.com/v1", "test-key")

      expect(result.ok).toBe(true)
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.openai.com/v1/models",
        expect.objectContaining({ redirect: "manual" })
      )
    })
  })

  describe("Header Parsing in models.ts", () => {
    it("parses X-AI-Endpoints header and routes based on model", () => {
      const endpoints = [
        { id: "ep1", name: "Ollama", baseUrl: "http://localhost:11434/v1", models: ["llama3.2"] },
        { id: "ep2", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", apiKey: "sk-or-123", models: ["claude-3.5-sonnet"] },
      ]

      const headers = new Headers({
        "x-ai-endpoints": JSON.stringify(endpoints),
        "x-ai-base-url": "http://localhost:11434/v1",
      })

      const parsedEndpoints = parseAiEndpointsHeader(headers)
      expect(parsedEndpoints).toHaveLength(2)

      const resolvedClaude = parseAiEndpoint(headers, "claude-3.5-sonnet")
      expect(resolvedClaude.apiUrl).toBe("https://openrouter.ai/api/v1")
      expect(resolvedClaude.apiKey).toBe("sk-or-123")

      const resolvedLlama = parseAiEndpoint(headers, "llama3.2")
      expect(resolvedLlama.apiUrl).toBe("http://localhost:11434/v1")

      const resolvedFallback = parseAiEndpoint(headers, "unknown-model")
      expect(resolvedFallback.apiUrl).toBe("http://localhost:11434/v1")
    })
  })
})
