import type { EditorSlice, UiSlice } from "./types"
import type { AgentEvent } from "@/lib/poster-types"
import { apiFetch } from "@/lib/api-fetch"
import { safeRandomUUID } from "@/lib/utils"

function makeEvent(e: Omit<AgentEvent, "id" | "ts" | "createdAt">): AgentEvent {
  return {
    ...e,
    id: safeRandomUUID(),
    createdAt: Date.now(),
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
  generatingIds: [],
  isAiStreaming: false,
  setIsAiStreaming: (v) => set({ isAiStreaming: v }),

  chatMessages: [],
  setChatMessages: (messages) => set({ chatMessages: messages }),

  hydrateUi: (events, messages) => set({ 
    agentEvents: events.length > 0 ? events : get().agentEvents, 
    chatMessages: messages 
  }),

  inspectorTab: "basics",
  isInspectorOpen: true,
  isHeaderUnlocked: false,
  setHeaderUnlocked: (v) => set({ isHeaderUnlocked: v }),
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
  lastReviewedRevision: null,
  setLastReviewedRevision: (r) => set({ lastReviewedRevision: r }),
  
  collaborators: [],
  setCollaborators: (c) => set({ collaborators: c }),
  collabEnabled: false,
  setCollabEnabled: (v) => set({ collabEnabled: v }),
  yjsStatus: "disconnected",
  setYjsStatus: (s) => set({ yjsStatus: s }),

  isHistoryOpen: false,
  setIsHistoryOpen: (v) => set({ isHistoryOpen: v }),
  isActionsOpen: false,
  setIsActionsOpen: (v) => set({ isActionsOpen: v }),
  isScannerOpen: false,
  setIsScannerOpen: (v) => set({ isScannerOpen: v }),
  isAcademicSearchOpen: false,
  setIsAcademicSearchOpen: (v) => set({ isAcademicSearchOpen: v }),
  scannerImage: null,
  setScannerImage: (img) => set({ scannerImage: img }),
  openScannerWithImage: (img) => set({ scannerImage: img, isScannerOpen: true }),

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
        
        // Ensure changes are flushed before compiling for revision safety
        if (get().isDirty) {
          get().updateEvent(evId, { detail: `Attempt ${attempts}/${MAX_ATTEMPTS}: Saving workspace...` })
          await get().saveProject()
        }
        const revision = get().project.revision

        get().updateEvent(evId, { detail: `Attempt ${attempts}/${MAX_ATTEMPTS}: Compiling...` })
        
        const res = await apiFetch(`/api/workspaces/${project.id}/compile?revision=${revision}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        if (!res.ok && res.status !== 422) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`)
        const data: { ok: boolean; log: string } = await res.json()

        if (get().project.id !== capturedWorkspaceId) {
          get().updateEvent(evId, { status: "error", title: "Canceled", detail: "Workspace changed during compilation." })
          return
        }

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
          if (get().lastReviewedRevision !== revision) {
            const vlmEv = get().pushEvent({ kind: "info", status: "running", title: `VLM Layout Check running...` })
            apiFetch(`/api/workspaces/${project.id}/review-layout?revision=${revision}`, { method: "POST" })
            .then(async res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`)
              return res.json()
            })
            .then(vlmData => {
              if (get().project.revision !== revision) return // Ignore stale response
              const isFalseWarning = (w: any) => {
                const text = `${w?.issue || ""} ${w?.recommendation || ""}`.toLowerCase()
                return (
                  /no\s+(significant\s+)?(issue|overflow|problem|warning|defect|error)/i.test(text) ||
                  /^(none|clean|ok|n\/a|all\s+good)[\.\s]*$/i.test(w?.issue?.trim() || "") ||
                  /^(none|n\/a|clean|ok)[\.\s]*$/i.test(w?.recommendation?.trim() || "")
                )
              }
              const realWarnings = (vlmData.warnings || []).filter((w: any) => !isFalseWarning(w))

              if (realWarnings.length > 0) {
                 const vlmTips = realWarnings.map((w: any) => {
                   const rawTitle = w.cardTitle || "Card"
                   const cleanCardTitle = rawTitle.replace(/^(\d+\.?\s*|card:\s*|table\s*\d+:?\s*|figure\s*\d+:?\s*)/i, "").trim() || rawTitle
                   const shortTitle = cleanCardTitle.length > 28 ? cleanCardTitle.slice(0, 27) + "…" : cleanCardTitle
                   return {
                     severity: "warning" as const,
                     category: `Card: ${shortTitle}`,
                     cardId: w.cardId,
                     issue: w.issue,
                     recommendation: w.recommendation,
                     message: `${w.issue} — ${w.recommendation}`,
                   }
                 })
                 get().updateEvent(vlmEv, {
                   kind: "review",
                   status: "done",
                   title: `Layout Inspection`,
                   detail: `${realWarnings.length} layout issue${realWarnings.length === 1 ? "" : "s"} detected`,
                   tips: vlmTips
                 })
                 set((s) => { s.layoutWarnings = realWarnings })
              } else {
                 get().updateEvent(vlmEv, { kind: "info", status: "done", title: `Layout Inspection Passed`, detail: "No visual overflows detected." })
                 set((s) => { s.layoutWarnings = [] })
              }
              set((s) => { s.lastReviewedRevision = revision ?? null })
            }).catch(err => {
                 get().updateEvent(vlmEv, { status: "error", title: `VLM Layout Check failed`, detail: String(err) })
            })
          }

          break; // Exit loop on success
        } else {
          if (attempts < MAX_ATTEMPTS) {
            get().updateEvent(evId, { detail: `Attempt ${attempts} failed. Requesting LLM autofix...` })
            const autofixRes = await apiFetch(`/api/workspaces/${project.id}/autofix-compile?revision=${revision}`, {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ log: data.log, cards: activeOutput.cards }),
            })
            if (!autofixRes.ok) throw new Error(`HTTP ${autofixRes.status}: ${await autofixRes.text().catch(() => "")}`)
            const autofixData = await autofixRes.json()
            if (autofixData.fixes && Array.isArray(autofixData.fixes) && autofixData.fixes.length > 0) {
               const explanation = autofixData.explanation
                 ? `${autofixData.explanation} Click 'Apply Fixes' below.`
                 : "The AI generated a fix for the compile error. Click 'Apply Fixes' below."
               get().updateEvent(evId, {
                 status: "warning",
                 title: "Compile failed — Autofix ready",
                 detail: explanation,
                 fixes: autofixData.fixes,
               })
               break;
            } else {
               get().updateEvent(evId, { status: "error", title: "Compile failed", detail: "LLM autofix could not provide a fix." })
               get().setPendingAiPrompt(`The LaTeX compilation failed with the following error. Please analyze it, explain the issue, and provide a fix using the <fix>...</fix> tag for the relevant card.\n\n\`\`\`log\n${data.log}\n\`\`\``)
               break;
            }
          } else {
            get().updateEvent(evId, { status: "error", title: "Compile failed", detail: (data.log ?? "").slice(0, 200) })
            get().setPendingAiPrompt(`The LaTeX compilation failed after multiple attempts. Please analyze this error log, explain the issue, and provide a fix using the <fix>...</fix> tag for the relevant card.\n\n\`\`\`log\n${data.log}\n\`\`\``)
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
