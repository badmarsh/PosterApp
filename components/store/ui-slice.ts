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
    makeEvent({
      kind: "info",
      status: "done",
      title: "Editor ready",
      detail: "Loading workspace…",
    }),
  ],
  generatingId: null,

  // Compile state
  compiling: false,
  pdfData: null,
  compileLog: null,
  compileOk: null,

  pushEvent: (e) => {
    set((s) => {
      s.agentEvents.push(makeEvent(e))
    })
  },

  compileProject: async () => {
    if (get().compiling) return
    set((s) => { s.compiling = true })
    get().pushEvent({ kind: "generate", status: "running", title: "Compiling poster with pdflatex…" })

    try {
      const project = get().project
      const tex = generateFullTemplate(project, project.id)
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
        get().pushEvent({ kind: "generate", status: "done", title: "Compile succeeded", detail: "PDF ready for preview." })
      } else {
        get().pushEvent({ kind: "generate", status: "error", title: "Compile failed", detail: (data.log ?? "").slice(0, 200) })
      }
    } catch (err) {
      set((s) => {
        s.compileLog = String(err)
        s.compileOk = false
      })
      get().pushEvent({ kind: "generate", status: "error", title: "Compile error", detail: String(err) })
    } finally {
      set((s) => { s.compiling = false })
    }
  },
})
