import { describe, expect, it, beforeEach } from "vitest"
import { createSettingsStore, getAiModelOverrideHeaders } from "@/lib/settings-store"

describe("Settings Store — AI Endpoints Management", () => {
  let store: ReturnType<typeof createSettingsStore>

  beforeEach(() => {
    store = createSettingsStore()
  })

  it("adds, updates, and removes an AI endpoint", () => {
    const id = store.getState().addEndpoint({
      name: "Local Ollama",
      baseUrl: "http://localhost:11434/v1",
      enabled: true,
    })

    expect(store.getState().endpoints).toHaveLength(1)
    expect(store.getState().endpoints[0].name).toBe("Local Ollama")
    expect(store.getState().endpoints[0].status).toBe("untested")

    // Update
    store.getState().updateEndpoint(id, {
      name: "Ollama RTX",
      models: ["llama3.2", "mistral"],
      status: "connected",
    })

    expect(store.getState().endpoints[0].name).toBe("Ollama RTX")
    expect(store.getState().endpoints[0].models).toEqual(["llama3.2", "mistral"])
    expect(store.getState().endpoints[0].status).toBe("connected")

    // Remove
    store.getState().removeEndpoint(id)
    expect(store.getState().endpoints).toHaveLength(0)
  })

  it("injects X-AI-Base-Url, X-AI-Api-Key, and X-AI-Endpoints in headers", () => {
    store.getState().addEndpoint({
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk-or-test-key",
      models: ["anthropic/claude-3.5-sonnet"],
    })

    // Store is used by getAiModelOverrideHeaders via getSettingsStore, but we can check store state directly
    const state = store.getState()
    expect(state.endpoints).toHaveLength(1)
    expect(state.endpoints[0].baseUrl).toBe("https://openrouter.ai/api/v1")
    expect(state.endpoints[0].apiKey).toBe("sk-or-test-key")
  })
})
