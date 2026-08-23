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
      ts: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
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
  isInspectorOpen: true,
  showLatexSource: false,
  toggleLatexSource: () => set((s) => { s.showLatexSource = !s.showLatexSource }),
  lastWorkspaceId: null,
  setLastWorkspaceId: (id) => set({ lastWorkspaceId: id }),
  toggleInspector: () => set((s) => { s.isInspectorOpen = !s.isInspectorOpen }),
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
  layoutWarnings: [],
  
  collaborators: [],
  setCollaborators: (c) => set({ collaborators: c }),
  yjsStatus: "disconnected",
  setYjsStatus: (s) => set({ yjsStatus: s }),

  isHistoryOpen: false,
  setIsHistoryOpen: (v) => set({ isHistoryOpen: v }),

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

  compileProject: async (format) => {
    if (get().compiling) return
    set((s) => { s.compiling = true })
    const activeOutput = get().project.outputs?.find(o => o.id === get().project.activeOutputId)
    const effectiveFormat = format || activeOutput?.outputType || "poster"
    const capturedWorkspaceId = get().project.id
    
    const evId = get().pushEvent({ kind: "generate", status: "running", title: `Compiling ${effectiveFormat} with pdflatex…` })

    let attempts = 0
    const MAX_ATTEMPTS = 3

    try {
      while (attempts < MAX_ATTEMPTS) {
        attempts++
        const project = get().project
        const activeOutput = project.outputs?.find(o => o.id === project.activeOutputId) || project.outputs?.[0]
        if (!activeOutput) throw new Error("No active output config")
        const tex = generateFullTemplate(project, activeOutput, project.id)
        
        get().updateEvent(evId, { detail: `Attempt ${attempts}/${MAX_ATTEMPTS}: Compiling...` })
        
        const res = await apiFetch(`/api/workspaces/${project.id}/compile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tex }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`)
        const data: { ok: boolean; log: string } = await res.json()

        if (get().project.id !== capturedWorkspaceId) return

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
          
          // Background VLM Layout Check
          const vlmEv = get().pushEvent({ kind: "info", status: "running", title: `VLM Layout Check running...` })
          apiFetch(`/api/workspaces/${project.id}/review-layout`, { method: "POST" })
            .then(async res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`)
              return res.json()
            })
            .then(vlmData => {
              if (vlmData.warnings && vlmData.warnings.length > 0) {
                 get().updateEvent(vlmEv, { kind: "review", status: "done", title: `VLM found layout issues`, detail: `${vlmData.warnings.length} layout issue(s) detected.` })
                 set((s) => { s.layoutWarnings = vlmData.warnings })
              } else {
                 get().updateEvent(vlmEv, { kind: "info", status: "done", title: `VLM Layout Check passed!`, detail: "No overflow or overlapping issues detected." })
                 set((s) => { s.layoutWarnings = [] })
              }
            }).catch(err => {
                 get().updateEvent(vlmEv, { status: "error", title: `VLM Layout Check failed`, detail: String(err) })
            })

          break; // Exit loop on success
        } else {
          if (attempts < MAX_ATTEMPTS) {
            get().updateEvent(evId, { detail: `Attempt ${attempts} failed. Requesting LLM autofix...` })
            const autofixRes = await apiFetch(`/api/workspaces/${project.id}/autofix-compile`, {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ log: data.log, cards: activeOutput.cards }),
            })
            if (!autofixRes.ok) throw new Error(`HTTP ${autofixRes.status}: ${await autofixRes.text().catch(() => "")}`)
            const autofixData = await autofixRes.json()
            if (autofixData.fixes && Array.isArray(autofixData.fixes) && autofixData.fixes.length > 0) {
               autofixData.fixes.forEach((fix: any) => {
                 get().updateCard(fix.id, { content: fix.content })
               })
               // Short pause to let state settle
               await new Promise(r => setTimeout(r, 100))
            } else {
               get().updateEvent(evId, { status: "error", title: "Compile failed", detail: "LLM autofix could not provide a fix." })
               break;
            }
          } else {
            get().updateEvent(evId, { status: "error", title: "Compile failed", detail: (data.log ?? "").slice(0, 200) })
          }
        }
      }
    } catch (err) {
      set((s) => {
        s.compileLog = String(err)
        s.compileOk = false
      })
      get().updateEvent(evId, { status: "error", title: "Compile error", detail: String(err) })
    } finally {
      if (get().project.id === capturedWorkspaceId) {
        set((s) => { s.compiling = false })
      }
    }
  },

  jobs: [],
  cancelJob: (id) => {
    import("@/lib/job-queue").then(m => m.jobQueue.cancel(id))
  },
})
