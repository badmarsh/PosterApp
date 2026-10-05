"use client"

import { createStore, useStore } from "zustand"
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware"
import type { AiModelRole } from "@/lib/ai/models"
import type { ReviewLanguage } from "@/lib/ai/thesis-rubric"
import { isValidEndpointBaseUrl, normalizeEndpointBaseUrl, type AiEndpointConfig } from "@/lib/ai/endpoints"

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
  endpointSyncStatus: "idle" | "loading" | "syncing" | "load-error" | "error"
  endpointSyncError: string | null
  retryEndpointSync: () => Promise<void>
  hydrateServerEndpoints: () => Promise<void>
}

export const SETTINGS_STORAGE_KEY = "posterapp-settings"

/** No-op storage so persisting never touches localStorage during SSR. */
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

let endpointSyncQueue: Promise<void> = Promise.resolve()
let endpointConfigurationTouched = false

function getResponseError(data: any, status: number): string {
  if (typeof data?.error === "string") return data.error
  if (typeof data?.error?.message === "string") return data.error.message
  return `HTTP ${status}`
}

function isStoredEndpoint(value: unknown): value is AiEndpointConfig {
  if (!value || typeof value !== "object") return false
  const endpoint = value as Record<string, unknown>
  return typeof endpoint.id === "string"
    && typeof endpoint.name === "string"
    && typeof endpoint.baseUrl === "string"
    && isValidEndpointBaseUrl(endpoint.baseUrl)
    && (endpoint.apiKey === undefined || typeof endpoint.apiKey === "string")
    && (endpoint.enabled === undefined || typeof endpoint.enabled === "boolean")
    && (endpoint.models === undefined || (Array.isArray(endpoint.models) && endpoint.models.every((model) => typeof model === "string")))
    && (endpoint.status === undefined || ["connected", "error", "untested"].includes(String(endpoint.status)))
}

function syncEndpointsToServer(endpoints: AiEndpointConfig[]): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()

  const operation = endpointSyncQueue.catch(() => undefined).then(async () => {
    const response = await fetch("/api/ai/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoints }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok !== true) {
      throw new Error(getResponseError(data, response.status))
    }
  })
  endpointSyncQueue = operation
  return operation
}

/** Persisting an empty list is part of Reset all settings. */
export function clearStoredAiEndpoints(): Promise<void> {
  endpointConfigurationTouched = true
  return syncEndpointsToServer([])
}

export function createSettingsStore() {
  return createStore<SettingsState>()(
    persist(
      (set, get) => {
        const persistEndpointUpdate = async (endpoints: AiEndpointConfig[]) => {
          endpointConfigurationTouched = true
          set({ endpointSyncStatus: "syncing", endpointSyncError: null })
          try {
            await syncEndpointsToServer(endpoints)
            set({ endpointSyncStatus: "idle", endpointSyncError: null })
          } catch (error) {
            set({
              endpointSyncStatus: "error",
              endpointSyncError: error instanceof Error ? error.message : String(error),
            })
          }
        }

        const hydrateServerEndpoints = async () => {
          if (endpointConfigurationTouched || get().endpoints.length > 0) return
          set({ endpointSyncStatus: "loading", endpointSyncError: null })
          try {
            const response = await fetch("/api/ai/endpoints")
            const data = await response.json().catch(() => null)
            if (!response.ok) throw new Error(getResponseError(data, response.status))
            if (!Array.isArray(data?.endpoints) || !data.endpoints.every(isStoredEndpoint)) {
              throw new Error("Invalid endpoints response")
            }
            if (endpointConfigurationTouched || get().endpoints.length > 0) {
              set({ endpointSyncStatus: "idle", endpointSyncError: null })
              return
            }

            const endpoints: AiEndpointConfig[] = (data.endpoints as AiEndpointConfig[]).map((endpoint) => ({
              ...endpoint,
              baseUrl: normalizeEndpointBaseUrl(endpoint.baseUrl),
            }))
            const activeEndpointId = endpoints.some((endpoint: AiEndpointConfig) => endpoint.id === get().activeEndpointId)
              ? get().activeEndpointId
              : endpoints.find((endpoint: AiEndpointConfig) => endpoint.enabled !== false)?.id
            set({ endpoints, activeEndpointId, endpointSyncStatus: "idle", endpointSyncError: null })
          } catch (error) {
            if (endpointConfigurationTouched) return
            set({
              endpointSyncStatus: "load-error",
              endpointSyncError: error instanceof Error ? error.message : String(error),
            })
          }
        }

        return ({
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
          const { endpoints, activeEndpointId } = get()
          const nextEndpoints = [...endpoints, newEndpoint]
          set({ endpoints: nextEndpoints, activeEndpointId: activeEndpointId || id })
          void persistEndpointUpdate(nextEndpoints)
          return id
        },

        updateEndpoint: (id, updates) => {
          const nextEndpoints = get().endpoints.map((endpoint) =>
            endpoint.id === id ? { ...endpoint, ...updates } : endpoint
          )
          set({ endpoints: nextEndpoints })
          void persistEndpointUpdate(nextEndpoints)
        },

        removeEndpoint: (id) => {
          const { endpoints, activeEndpointId } = get()
          const nextEndpoints = endpoints.filter((endpoint) => endpoint.id !== id)
          const nextActiveId = activeEndpointId === id ? nextEndpoints[0]?.id : activeEndpointId
          set({ endpoints: nextEndpoints, activeEndpointId: nextActiveId })
          void persistEndpointUpdate(nextEndpoints)
        },

        setEndpoints: (endpoints) => {
          set({ endpoints })
          void persistEndpointUpdate(endpoints)
        },

        setEndpointModels: (id, models) => {
          const nextEndpoints = get().endpoints.map((endpoint) =>
            endpoint.id === id
              ? {
                  ...endpoint,
                  models,
                  status: "connected" as const,
                  lastLoadedAt: new Date().toISOString(),
                  errorMessage: undefined,
                }
              : endpoint
          )
          set({ endpoints: nextEndpoints })
          void persistEndpointUpdate(nextEndpoints)
        },

        isFetchingModels: {},
        endpointSyncStatus: "idle",
        endpointSyncError: null,
        retryEndpointSync: async () => {
          if (get().endpointSyncStatus === "load-error" && !endpointConfigurationTouched && get().endpoints.length === 0) {
            await hydrateServerEndpoints()
            return
          }
          await persistEndpointUpdate(get().endpoints)
        },
        hydrateServerEndpoints,

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
            if (res.ok && data?.ok === true && Array.isArray(data.models)) {
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
      })
      },
      {
        name: SETTINGS_STORAGE_KEY,
        version: 3,
        storage: createJSONStorage(() =>
          typeof window !== "undefined" ? window.localStorage : noopStorage
        ),
        partialize: (state) => ({
          defaultReviewLanguage: state.defaultReviewLanguage,
          aiModelOverrides: state.aiModelOverrides,
          geminiApiKey: state.geminiApiKey,
          endpoints: state.endpoints,
          activeEndpointId: state.activeEndpointId,
        }),
        migrate: (persistedState: any, version: number) => {
          if (!persistedState || typeof persistedState !== "object") {
            return persistedState
          }
          if (version < 2) {
            persistedState.endpoints = persistedState.endpoints || []
            persistedState.activeEndpointId = persistedState.activeEndpointId || undefined
          }
          if (version < 3) {
            delete persistedState.isFetchingModels
            delete persistedState.endpointSyncStatus
            delete persistedState.endpointSyncError
          }
          return persistedState
        },
      }
    )
  )
}

// Singleton store for client usage
let clientStore: ReturnType<typeof createSettingsStore> | null = null

export function getSettingsStore() {
  if (!clientStore) {
    clientStore = createSettingsStore()
    // Hydrate server-persisted endpoints without writing them back. A local
    // change always wins if it happens while this request is in flight.
    if (typeof window !== "undefined") {
      setTimeout(() => {
        const state = clientStore?.getState()
        if (state) void state.hydrateServerEndpoints()
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