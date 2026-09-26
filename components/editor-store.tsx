"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createStore, useStore } from "zustand"
import { immer } from "zustand/middleware/immer"
import { persist } from "zustand/middleware"
import type { Card, Project } from "@/lib/poster-types"

import type { EditorState } from "./store/types"
import { createProjectSlice } from "./store/project-slice"
import { createIngestionSlice } from "./store/ingestion-slice"
import { createBibSlice } from "./store/bib-slice"
import { createEquationSlice } from "./store/equation-slice"
import { createUiSlice } from "./store/ui-slice"

import { jobQueue } from "@/lib/job-queue"

/**
 * Create an editor store.
 *
 * `initialProject` seeds the store's *initial* state (not a later `setState`),
 * which matters because React's `useSyncExternalStore` reads the initial
 * snapshot during server rendering — a seeded project must be visible to the
 * very first render, not only after hydration. Used by the canvas tests and by
 * preview surfaces that render a workspace they have not loaded yet.
 */
export function createEditorStore(initialProject?: Project | null) {
  return createStore<EditorState>()(
    persist(
      immer((set, get, store) => {
        const projectSlice = createProjectSlice(set, get, store)
        if (initialProject) {
          const clone = JSON.parse(JSON.stringify(initialProject)) as Project
          if (!clone.outputs?.some((o) => o.id === clone.activeOutputId)) {
            clone.activeOutputId = clone.outputs?.[0]?.id ?? clone.activeOutputId
          }
          projectSlice.project = clone
          projectSlice.selectedCardId = null
          projectSlice.isDirty = false
        }
        return {
        ...projectSlice,
        ...createIngestionSlice(set, get, store),
        ...createBibSlice(set, get, store),
        ...createEquationSlice(set, get, store),
        ...createUiSlice(set, get, store),
        }
      }),
      {
        name: "posterapp-editor-storage",
        version: 1,
        migrate: (state) => state,
        partialize: (state) => ({
          selectedCardId: state.selectedCardId,
          lastWorkspaceId: state.lastWorkspaceId,
          autoCompile: state.autoCompile,
          compactMode: state.compactMode,
          layoutCheckEnabled: state.layoutCheckEnabled,
          compileAutoFixEnabled: state.compileAutoFixEnabled,
          compileOnCmdEnter: state.compileOnCmdEnter,
          agentPanelOpenOnLoad: state.agentPanelOpenOnLoad,
          structurePanelOpenOnLoad: state.structurePanelOpenOnLoad,
          inspectorDefaultTab: state.inspectorDefaultTab,
          language: state.language,
        }),
      }
    )
  )
}

type EditorStore = ReturnType<typeof createEditorStore>
const EditorStoreContext = createContext<EditorStore | null>(null)

/**
 * Provider props.
 *
 * `initialProject` seeds the store before the first render — used by the
 * showcase/preview surfaces and by the canvas tests, which need a workspace of
 * a specific output type (a posudok, a paper, …) rather than the default demo.
 * The project is deep-cloned so a seeded render can never mutate the caller's
 * object, and `activeOutputId` is honoured when it points at a real output.
 */
export function EditorProvider({ children, initialProject }: { children: ReactNode; initialProject?: Project | null }) {
  // useState's lazy initializer runs exactly once per mounted provider and does
  // not touch refs during render (react-hooks/refs).
  const [store] = useState(() => createEditorStore(initialProject ?? null))

  useEffect(() => {
    if (typeof window !== "undefined" && jobQueue?.subscribe) {
      const unsub = jobQueue.subscribe((jobs) => {
        store.setState({ jobs })
      })
      return unsub
    }
  }, [store])

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

const defaultEditorSelector = (state: EditorState) => state

export function useEditor(): EditorState & { selectedCard: Card | null }
export function useEditor<T>(selector: (state: EditorState) => T): T
export function useEditor<T>(selector?: (state: EditorState) => T): T | (EditorState & { selectedCard: Card | null }) {
  const store = useContext(EditorStoreContext)
  if (!store) throw new Error("useEditor must be used within EditorProvider")
   
  const state = useStore(store, (selector ?? defaultEditorSelector) as (state: EditorState) => T)
  if (!selector) {
    const fullState = state as unknown as EditorState
    return {
      ...fullState,
      get selectedCard() {
        const activeOutput = fullState.project.outputs?.find((o) => o.id === fullState.project.activeOutputId)
        return activeOutput?.cards.find((c) => c.id === fullState.selectedCardId) ?? null
      },
    }
  }
  return state as T | (EditorState & { selectedCard: Card | null })
}
