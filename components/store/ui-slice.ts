import type { EditorSlice, UiSlice } from "./types"
import type { AgentEvent } from "@/lib/poster-types"
import { generateFullTemplate } from "@/lib/latex"
import { apiFetch } from "@/lib/api-fetch"

function makeEvent(e: Omit<AgentEvent, "id" | "ts">): AgentEvent {
  return {
    ...e,
    id: crypto.randomUUID(),
    ts: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  }
}

export const createUiSlice: EditorSlice<UiSlice> = (set, get) => ({
  agentEvents: [
    {
      id: "init",
      ts: Date.now(),
      kind: "info",
      status: "done",
      title: "Editor ready",
      detail: "Loading workspace…",
    },
  ],
  generatingId: null,

  chatMessages: [],
  setChatMessages: (messages) => set({ chatMessages: messages }),

  hydrateUi: (events, messages) => set({ 
    agentEvents: events.length > 0 ? events : get().agentEvents, 
    chatMessages: messages 
  }),

  inspectorTab: "basics",
  setInspectorTab: (tab) => set({ inspectorTab: tab }),

  pendingAiPrompt: null,
  setPendingAiPrompt: (prompt) => set({ pendingAiPrompt: prompt }),

  // Compile state
  compiling: false,
  pdfData: null,
  compileLog: null,
  compileOk: null,

  autoCompile: false,
  setAutoCompile: (v) => set({ autoCompile: v }),
  lastCompileFormat: "poster",
  setLastCompileFormat: (format) => set({ lastCompileFormat: format }),

  pushEvent: (e) => {
    const ev = makeEvent(e)
    set((s) => {
      s.agentEvents.push(ev)
    })
    return ev.id
  },

  updateEvent: (id, patch) => {
    set((s) => {
      const ev = s.agentEvents.find(e => e.id === id)
      if (ev) {
        Object.assign(ev, patch)
      }
    })
  },

  compileProject: async (format = "poster") => {
    if (get().compiling) return
    set((s) => { s.compiling = true })
    const evId = get().pushEvent({ kind: "generate", status: "running", title: `Compiling ${format} with pdflatex…` })

    try {
      const project = get().project
      const tex = generateFullTemplate(project, project.id, format)
      const res = await apiFetch(`/api/workspaces/${project.id}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tex }),
      })
      const data: { ok: boolean; log: string } = await res.json()

      set((s) => {
        s.compileLog = data.log ?? ""
        s.compileOk = data.ok
      })

      if (data.ok) {
        // Fetch the PDF as binary for react-pdf rendering
        const pdfRes = await apiFetch(`/api/workspaces/${project.id}/pdf?t=${Date.now()}`)
        if (pdfRes.ok) {
          const buf = await pdfRes.arrayBuffer()
          set((s) => { s.pdfData = new Uint8Array(buf) })
        }
        get().updateEvent(evId, { status: "done", title: "Compile succeeded", detail: "PDF ready for preview." })
      } else {
        get().updateEvent(evId, { status: "error", title: "Compile failed", detail: (data.log ?? "").slice(0, 200) })
      }
    } catch (err) {
      set((s) => {
        s.compileLog = String(err)
        s.compileOk = false
      })
      get().updateEvent(evId, { status: "error", title: "Compile error", detail: String(err) })
    } finally {
      set((s) => { s.compiling = false })
    }
  },
})
