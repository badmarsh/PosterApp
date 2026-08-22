"use client"

import { createContext, useContext, useRef, type ReactNode } from "react"
import { createStore, useStore } from "zustand"
import { immer } from "zustand/middleware/immer"
import { persist } from "zustand/middleware"
import type { Card } from "@/lib/poster-types"

import type { EditorState } from "./store/types"
import { createProjectSlice } from "./store/project-slice"
import { createIngestionSlice } from "./store/ingestion-slice"
import { createBibSlice } from "./store/bib-slice"
import { createUiSlice } from "./store/ui-slice"

export function createEditorStore() {
  return createStore<EditorState>()(
    persist(
      immer((set, get, store) => ({
        ...createProjectSlice(set, get, store),
        ...createIngestionSlice(set, get, store),
        ...createBibSlice(set, get, store),
        ...createUiSlice(set, get, store),
      })),
      {
        name: "posterapp-editor-storage",
        version: 1,
        partialize: (state) => ({
          selectedCardId: state.selectedCardId,
        }),
      }
    )
  )
}

type EditorStore = ReturnType<typeof createEditorStore>
const EditorStoreContext = createContext<EditorStore | null>(null)

export function EditorProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<EditorStore | null>(null)
  if (!storeRef.current) storeRef.current = createEditorStore()
  return (
    <EditorStoreContext.Provider value={storeRef.current}>
      {children}
    </EditorStoreContext.Provider>
  )
}

export function useEditor(): EditorState & { selectedCard: Card | null }
export function useEditor<T>(selector: (state: EditorState) => T): T
export function useEditor<T>(selector?: (state: EditorState) => T): T | (EditorState & { selectedCard: Card | null }) {
  const store = useContext(EditorStoreContext)
  if (!store) throw new Error("useEditor must be used within EditorProvider")
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const state = useStore(store, selector ?? ((s) => s as unknown as T))
  if (!selector) {
    const fullState = state as EditorState
    return {
      ...fullState,
      get selectedCard() {
        return fullState.project.cards.find((c) => c.id === fullState.selectedCardId) ?? null
      },
    }
  }
  return state as T | (EditorState & { selectedCard: Card | null })
}
