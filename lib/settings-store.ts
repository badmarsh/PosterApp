"use client"

import { createStore, useStore } from "zustand"
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware"
import type { AiModelRole } from "@/lib/ai/models"
import type { ReviewLanguage } from "@/lib/ai/thesis-rubric"
import type { AiEndpointConfig } from "@/lib/ai/endpoints"

export type SettingsState = {
  defaultReviewLanguage: ReviewLanguage
  setDefaultReviewLanguage: (lang: ReviewLanguage) => void

  aiModelOverrides: Partial<Record<AiModelRole, string>>
  setAiModelOverride: (role: AiModelRole, model: string) => void
  setAllAiModelOverrides: (overrides: Partial<Record<AiModelRole, string>>) => void
  clearAiModelOverride: (role: AiModelRole) => void
  clearAllAiModelOverrides: () => void

  geminiApiKey: string
  setGeminiApiKey: (key: string) => void

  // OpenAI-compatible Endpoints
  endpoints: AiEndpointConfig[]
  activeEndpointId?: string
  setActiveEndpointId: (id: string | undefined) => void
  addEndpoint: (endpoint: Omit<AiEndpointConfig, "id">) => string
  updateEndpoint: (id: string, updates: Partial<AiEndpointConfig>) => void
  removeEndpoint: (id: string) => void
  setEndpoints: (endpoints: AiEndpointConfig[]) => void
  setEndpointModels: (id: string, models: string[]) => void
  isFetchingModels: Record<string, boolean>
  fetchModelsForEndpoint: (id: string) => Promise<string[]>
  fetchAllEndpointModels: () => Promise<void>
}

export const SETTINGS_STORAGE_KEY = "posterapp-settings"

/** No-op storage so persisting never touches localStorage during SSR. */
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export function createSettingsStore() {
  return createStore<SettingsState>()(
    persist(
      (set, get) => ({
        defaultReviewLanguage: "sk",
        setDefaultReviewLanguage: (lang) => set({ defaultReviewLanguage: lang }),

        aiModelOverrides: {},
        setAiModelOverride: (role, model) =>
          set((s) => ({
            aiModelOverrides: { ...s.aiModelOverrides, [role]: model },
          })),
        setAllAiModelOverrides: (overrides) =>
          set({ aiModelOverrides: overrides }),
        clearAiModelOverride: (role) =>
          set((s) => {
            const next = { ...s.aiModelOverrides }
            delete next[role]
            return { aiModelOverrides: next }
          }),
        clearAllAiModelOverrides: () => set({ aiModelOverrides: {} }),

        geminiApiKey: "",
        setGeminiApiKey: (key) => {
          set({ geminiApiKey: key })
          // If a gemini endpoint exists, update its key as well
          const { endpoints, updateEndpoint } = get()
          const geminiEp = endpoints.find(
            (e) => e.baseUrl.includes("generativelanguage.googleapis.com") || e.name.toLowerCase().includes("gemini")
          )
          if (geminiEp) {
            updateEndpoint(geminiEp.id, { apiKey: key })
          }
        },

        endpoints: [],
        activeEndpointId: undefined,
        setActiveEndpointId: (id) => set({ activeEndpointId: id }),

        addEndpoint: (endpoint) => {
          const id = `ep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
          const newEndpoint: AiEndpointConfig = {
            ...endpoint,
            id,
            enabled: endpoint.enabled !== false,
            models: endpoint.models || [],
            status: endpoint.status || "untested",
          }
          set((s) => {
            const nextEndpoints = [...s.endpoints, newEndpoint]
            const activeId = s.activeEndpointId || id
            // Persist to server in background
            syncEndpointsToServer(nextEndpoints)
            return { endpoints: nextEndpoints, activeEndpointId: activeId }
          })
          return id
        },

        updateEndpoint: (id, updates) => {
          set((s) => {
            const nextEndpoints = s.endpoints.map((e) =>
              e.id === id ? { ...e, ...updates } : e
            )
            syncEndpointsToServer(nextEndpoints)
            return { endpoints: nextEndpoints }
          })
        },

        removeEndpoint: (id) => {
          set((s) => {
            const nextEndpoints = s.endpoints.filter((e) => e.id !== id)
            const nextActiveId =
              s.activeEndpointId === id
                ? nextEndpoints[0]?.id
                : s.activeEndpointId
            syncEndpointsToServer(nextEndpoints)
            return { endpoints: nextEndpoints, activeEndpointId: nextActiveId }
          })
        },

        setEndpoints: (endpoints) => {
          set({ endpoints })
          syncEndpointsToServer(endpoints)
        },

        setEndpointModels: (id, models) => {
          set((s) => {
            const nextEndpoints = s.endpoints.map((e) =>
              e.id === id
                ? {
                    ...e,
                    models,
                    status: "connected" as const,
                    lastLoadedAt: new Date().toISOString(),
                    errorMessage: undefined,
                  }
                : e
            )
            syncEndpointsToServer(nextEndpoints)
            return { endpoints: nextEndpoints }
          })
        },

        isFetchingModels: {},

        fetchModelsForEndpoint: async (id: string): Promise<string[]> => {
          const endpoint = get().endpoints.find((e) => e.id === id)
          if (!endpoint || !endpoint.baseUrl) return []

          set((s) => ({
            isFetchingModels: { ...s.isFetchingModels, [id]: true },
          }))

          try {
            const res = await fetch("/api/ai/endpoints/models", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                baseUrl: endpoint.baseUrl,
                apiKey: endpoint.apiKey,
              }),
            })

            const data = await res.json()
            if (data.ok && Array.isArray(data.models)) {
              get().setEndpointModels(id, data.models)
              return data.models
            } else {
              get().updateEndpoint(id, {
                status: "error",
                errorMessage: data.error || `HTTP ${res.status}`,
              })
              return []
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err)
            get().updateEndpoint(id, {
              status: "error",
              errorMessage: errorMsg,
            })
            return []
          } finally {
            set((s) => {
              const next = { ...s.isFetchingModels }
              delete next[id]
              return { isFetchingModels: next }
            })
          }
        },

        fetchAllEndpointModels: async () => {
          const { endpoints, fetchModelsForEndpoint } = get()
          await Promise.all(
            endpoints
              .filter((e) => e.enabled !== false && Boolean(e.baseUrl?.trim()))
              .map((e) => fetchModelsForEndpoint(e.id))
          )
        },
      }),
      {
        name: SETTINGS_STORAGE_KEY,
        version: 2,
        storage: createJSONStorage(() =>
          typeof window !== "undefined" ? window.localStorage : noopStorage
        ),
        migrate: (persistedState: any, version: number) => {
          if (!persistedState || typeof persistedState !== "object") {
            return persistedState
          }
          if (version < 2) {
            persistedState.endpoints = persistedState.endpoints || []
            persistedState.activeEndpointId = persistedState.activeEndpointId || undefined
            persistedState.isFetchingModels = {}
          }
          return persistedState
        },
      }
    )
  )
}

// Background sync to server SystemSetting
function syncEndpointsToServer(endpoints: AiEndpointConfig[]) {
  if (typeof window === "undefined") return
  fetch("/api/ai/endpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoints }),
  }).catch((err) => {
    console.warn("[settings-store] Failed to sync endpoints to server:", err)
  })
}

// Singleton store for client usage
let clientStore: ReturnType<typeof createSettingsStore> | null = null

export function getSettingsStore() {
  if (!clientStore) {
    clientStore = createSettingsStore()
    // Hydrate endpoints from server if localStorage has no endpoints
    if (typeof window !== "undefined") {
      setTimeout(() => {
        const state = clientStore?.getState()
        if (state && (!state.endpoints || state.endpoints.length === 0)) {
          fetch("/api/ai/endpoints")
            .then((r) => r.json())
            .then((data) => {
              if (Array.isArray(data?.endpoints) && data.endpoints.length > 0) {
                clientStore?.getState().setEndpoints(data.endpoints)
              }
            })
            .catch(() => {})
        }
      }, 500)
    }
  }
  return clientStore
}

export function useSettings<T>(selector: (state: SettingsState) => T): T
export function useSettings(): SettingsState
export function useSettings<T>(selector?: (state: SettingsState) => T) {
  const store = getSettingsStore()
  return useStore(store, selector as (state: SettingsState) => T)
}

/**
 * Get the AI model overrides, configured endpoints, and optional API keys as headers for fetch requests.
 */
export function getAiModelOverrideHeaders(): Record<string, string> {
  const store = getSettingsStore()
  const state = store.getState()
  const headers: Record<string, string> = {}

  if (Object.keys(state.aiModelOverrides).length > 0) {
    headers["X-AI-Model-Override"] = JSON.stringify(state.aiModelOverrides)
  }
  if (state.geminiApiKey?.trim()) {
    headers["X-Gemini-Api-Key"] = state.geminiApiKey.trim()
  }

  const enabledEndpoints = (state.endpoints || []).filter(
    (e) => e.enabled !== false && Boolean(e.baseUrl?.trim())
  )

  if (enabledEndpoints.length > 0) {
    const activeEp =
      enabledEndpoints.find((e) => e.id === state.activeEndpointId) ||
      enabledEndpoints[0]

    if (activeEp?.baseUrl) {
      headers["X-AI-Base-Url"] = activeEp.baseUrl
      if (activeEp.apiKey?.trim()) {
        headers["X-AI-Api-Key"] = activeEp.apiKey.trim()
      }
    }

    const compactEndpoints = enabledEndpoints.map((e) => ({
      id: e.id,
      name: e.name,
      baseUrl: e.baseUrl,
      apiKey: e.apiKey,
      models: e.models,
    }))
    headers["X-AI-Endpoints"] = JSON.stringify(compactEndpoints)
  }

  return headers
}