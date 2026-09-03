"use client"

/**
 * Scopes the thesis-review Zustand store to a single output tab.
 *
 * Every thesis-review output (tab) must behave as an independent review
 * instance. The store itself is created per key (see getThesisReviewStore in
 * use-thesis-review-store.ts); this module wires components to the instance
 * that belongs to the currently active output via React context.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useStore } from "zustand"
import {
  getThesisReviewStore,
  useThesisReviewStore,
  type ThesisReviewState,
} from "./use-thesis-review-store"

type ThesisReviewStore = ReturnType<typeof getThesisReviewStore>

const ThesisReviewStoreContext = createContext<ThesisReviewStore | null>(null)

/**
 * Provides the review store belonging to `outputKey` (e.g. `${workspaceId}:${outputId}`).
 * Pass null to fall back to the default singleton store.
 */
export function ThesisReviewStoreProvider({
  outputKey,
  children,
}: {
  outputKey: string | null
  children: ReactNode
}) {
  const store = useMemo(
    () => outputKey ? getThesisReviewStore(outputKey) : useThesisReviewStore,
    [outputKey]
  )
  return (
    <ThesisReviewStoreContext.Provider value={store}>
      {children}
    </ThesisReviewStoreContext.Provider>
  )
}

/**
 * Like useThesisReviewStore but resolves the scoped instance of the current
 * output tab. Falls back to the default singleton when rendered outside a
 * ThesisReviewStoreProvider.
 */
export function useScopedThesisReviewStore<T>(
  selector: (state: ThesisReviewState) => T
): T
export function useScopedThesisReviewStore(): ThesisReviewState
export function useScopedThesisReviewStore<T>(
  selector?: (state: ThesisReviewState) => T
): unknown {
  const store = useContext(ThesisReviewStoreContext) ?? useThesisReviewStore
  return selector ? useStore(store, selector) : useStore(store)
}