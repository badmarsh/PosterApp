"use client"

import { createContext, useContext, useRef, useState, type ReactNode } from "react"
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
          lastWorkspaceId: state.lastWorkspaceId,
        }),
      }
    )
  )
}

type EditorStore = ReturnType<typeof createEditorStore>
const EditorStoreContext = createContext<EditorStore | null>(null)

export function EditorProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createEditorStore())
  return (
    <EditorStoreContext.Provider value={store}>
      {children}
    </EditorStoreContext.Provider>
  )
}

export function useEditorStoreInstance() {
  const store = useContext(EditorStoreContext)
  if (!store) throw new Error("useEditorStoreInstance must be used within EditorProvider")
  return store
}

export function useEditor(): EditorState & { selectedCard: Card | null }
export function useEditor<T>(selector: (state: EditorState) => T): T
export function useEditor<T>(selector?: (state: EditorState) => T): T | (EditorState & { selectedCard: Card | null }) {
  const store = useContext(EditorStoreContext)
  if (!store) throw new Error("useEditor must be used within EditorProvider")
   
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
