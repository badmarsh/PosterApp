"use client"

import { createStore, useStore } from "zustand"
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware"
import type { AiModelRole } from "@/lib/ai/models"
import type { ReviewLanguage } from "@/lib/ai/thesis-rubric"

export type SettingsState = {
  defaultReviewLanguage: ReviewLanguage
  setDefaultReviewLanguage: (lang: ReviewLanguage) => void

  aiModelOverrides: Partial<Record<AiModelRole, string>>
  setAiModelOverride: (role: AiModelRole, model: string) => void
  clearAiModelOverride: (role: AiModelRole) => void
  clearAllAiModelOverrides: () => void
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
      (set) => ({
        defaultReviewLanguage: "sk",
        setDefaultReviewLanguage: (lang) => set({ defaultReviewLanguage: lang }),

        aiModelOverrides: {},
        setAiModelOverride: (role, model) =>
          set((s) => ({
            aiModelOverrides: { ...s.aiModelOverrides, [role]: model },
          })),
        clearAiModelOverride: (role) =>
          set((s) => {
            const next = { ...s.aiModelOverrides }
            delete next[role]
            return { aiModelOverrides: next }
          }),
        clearAllAiModelOverrides: () => set({ aiModelOverrides: {} }),
      }),
      {
        name: SETTINGS_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() =>
          typeof window !== "undefined" ? window.localStorage : noopStorage
        ),
      }
    )
  )
}

// Singleton store for client usage
let clientStore: ReturnType<typeof createSettingsStore> | null = null

export function getSettingsStore() {
  if (!clientStore) clientStore = createSettingsStore()
  return clientStore
}

export function useSettings<T>(selector: (state: SettingsState) => T): T
export function useSettings(): SettingsState
export function useSettings<T>(selector?: (state: SettingsState) => T) {
  const store = getSettingsStore()
  return useStore(store, selector as (state: SettingsState) => T)
}

/**
 * Get the AI model overrides as headers for fetch requests.
 * Returns an empty object if no overrides are set.
 */
export function getAiModelOverrideHeaders(): Record<string, string> {
  const store = getSettingsStore()
  const overrides = store.getState().aiModelOverrides
  if (Object.keys(overrides).length === 0) return {}
  return { "X-AI-Model-Override": JSON.stringify(overrides) }
}