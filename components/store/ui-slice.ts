import type { EditorSlice, UiSlice } from "./types"
import type { AgentEvent } from "@/lib/poster-types"
import { apiFetch } from "@/lib/api-fetch"
import { notify } from "@/lib/notify"
import { safeRandomUUID } from "@/lib/utils"
import type { UiLanguage } from "@/lib/i18n/ui"
import { isDemoProject } from "@/lib/mock-data"
import { getDeterministicSummary } from "@/lib/latex/log-parser"
import { setWorkspaceLocalHistory, clearWorkspaceLocalHistory } from "@/lib/workspace-history"

/** Upper bounds so the event feed / chat history (persisted on every save) stay small. */
const MAX_AGENT_EVENTS = 200
const MAX_CHAT_MESSAGES = 200
const tail = <T,>(arr: T[], n: number) => (arr.length > n ? arr.slice(arr.length - n) : arr)

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
  language: "sk",
  setLanguage: (language: UiLanguage) => set({ language }),
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
  setChatMessages: (messages) => set({ chatMessages: tail(messages, MAX_CHAT_MESSAGES) }),

  historyVersion: 0,

  hydrateUi: (events, messages) => {
    const nextEvents = Array.isArray(events) ? events : []
    const nextMessages = Array.isArray(messages) ? messages : []
    set({
      agentEvents: tail(nextEvents, MAX_AGENT_EVENTS),
      chatMessages: tail(nextMessages, MAX_CHAT_MESSAGES) as any,
      historyVersion: (get().historyVersion || 0) + 1,
    })
  },

  clearHistory: async () => {
    const project = get().project
    const isDemo = isDemoProject(project.id)
    const initialEvent = makeEvent({
      kind: "info",
      status: "done",
      title: "History cleared",
      detail: "Operation history and chat messages were reset.",
    })

    set({
      agentEvents: [initialEvent],
      chatMessages: [],
      historyVersion: (get().historyVersion || 0) + 1,
    })

    if (project.id) {
      clearWorkspaceLocalHistory(project.id)
      setWorkspaceLocalHistory(project.id, [initialEvent], [])
    }

    if (!isDemo && project.id) {
      try {
        await apiFetch(`/api/workspaces/${project.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentEvents: [initialEvent],
            chatMessages: [],
          }),
        })
      } catch (err) {
        console.warn("[clearHistory] Failed to save cleared history to server:", err)
      }
    }
  },

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
  lastCompiledRevision: null,
  lastCompiledOutputId: null,

  autoCompile: false,
  setAutoCompile: (v) => set({ autoCompile: v }),
  compactMode: false,
  setCompactMode: (v) => set({ compactMode: v }),
  lastCompileFormat: "poster",
  setLastCompileFormat: (format) => set({ lastCompileFormat: format }),
  layoutCheckEnabled: true,
  setLayoutCheckEnabled: (v) => set({ layoutCheckEnabled: v }),
  compileAutoFixEnabled: true,
  setCompileAutoFixEnabled: (v) => set({ compileAutoFixEnabled: v }),
  compileOnCmdEnter: true,
  setCompileOnCmdEnter: (v) => set({ compileOnCmdEnter: v }),
  agentPanelOpenOnLoad: true,
  setAgentPanelOpenOnLoad: (v) => set({ agentPanelOpenOnLoad: v }),
  structurePanelOpenOnLoad: true,
  setStructurePanelOpenOnLoad: (v) => set({ structurePanelOpenOnLoad: v }),
  inspectorDefaultTab: "pdf",
  setInspectorDefaultTab: (tab) => set({ inspectorDefaultTab: tab }),
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
  isWorkspaceSelectorOpen: false,
  workspaceSelectorCreating: false,
  openWorkspaceSelector: (createMode = false) => set({
    isWorkspaceSelectorOpen: true,
    workspaceSelectorCreating: Boolean(createMode),
  }),
  closeWorkspaceSelector: () => set({
    isWorkspaceSelectorOpen: false,
    workspaceSelectorCreating: false,
  }),
  scannerImage: null,
  setScannerImage: (img) => set({ scannerImage: img }),
  openScannerWithImage: (img) => set({ scannerImage: img, isScannerOpen: true }),

  pushEvent: (e) => {
    const ev = makeEvent(e)
    set((s) => {
      s.agentEvents.push(ev)
      // Keep the feed (and the persisted payload) bounded.
      if (s.agentEvents.length > MAX_AGENT_EVENTS) {
        s.agentEvents.splice(0, s.agentEvents.length - MAX_AGENT_EVENTS)
      }
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

    const project = get().project
    const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId) || project.outputs?.[0]
    if (!activeOutput) return
    const effectiveFormat = format || activeOutput.outputType || "poster"
    const capturedWorkspaceId = project.id
    const currentRevision = project.revision

    // Cache check: as long as user hasn't changed anything (not dirty),
    // we already have pdfData, compile was OK, and revision/output match, skip recompilation.
    if (
      !get().isDirty &&
      get().pdfData !== null &&
      get().compileOk === true &&
      get().lastCompiledRevision === currentRevision &&
      get().lastCompiledOutputId === activeOutput.id
    ) {
      return
    }

    set((s) => { s.compiling = true })
    
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
          body: JSON.stringify({
            // Always send the current cards so the server compiles what the editor shows,
            // not a potentially stale DB or cache snapshot.
            cards: activeOutput.cards,
            output: { id: activeOutput.id, outputType: activeOutput.outputType, templateId: (activeOutput as any).templateId, themeColor: (activeOutput as any).themeColor, reviewMeta: activeOutput.reviewMeta ?? undefined },
            // Force recompile for demo projects (saves are no-ops there) and when the
            // user has unsaved changes that were just flushed by saveProject() above.
            forceRecompile: isDemoProject(project.id),
          }),
        })
        if (!res.ok && res.status !== 422) {
          const rawText = await res.text().catch(() => "")
          let formattedError = `HTTP ${res.status}: ${rawText}`
          try {
            const parsed = JSON.parse(rawText)
            if (parsed?.error?.message) {
              formattedError = parsed.error.message
            } else if (parsed?.error && typeof parsed.error === "string") {
              formattedError = parsed.error
            }
          } catch {}
          throw new Error(formattedError)
        }
        const data: { ok: boolean; log: string; summary?: string } = await res.json()

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
            set((s) => {
              s.pdfData = new Uint8Array(buf)
              s.lastCompiledRevision = revision ?? null
              s.lastCompiledOutputId = activeOutput.id
            })
          }
          get().updateEvent(evId, {
            status: "done",
            title: "Compile succeeded",
            detail: (data as any).cached ? "Cached preview ready." : "PDF ready for preview.",
          })
          
          // Background VLM Layout Check
          if (get().layoutCheckEnabled && get().lastReviewedRevision !== revision) {
            const vlmEv = get().pushEvent({ kind: "info", status: "running", title: `VLM Layout Check running...` })
            apiFetch(`/api/workspaces/${project.id}/review-layout?revision=${revision}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cards: activeOutput.cards, output: activeOutput }) })
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
                  const category = w.targetType === "logo" || /logo/i.test(w.cardTitle)
                    ? "Header / Logo"
                    : w.cardId
                    ? `Card: ${shortTitle}`
                    : `Layout: ${shortTitle}`
                  return {
                    severity: "warning" as const,
                    category,
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
                get().updateEvent(vlmEv, { kind: "info", status: "done", title: `Layout Inspection Passed`, detail: "No visual overflows or asset defects detected." })
                set((s) => { s.layoutWarnings = [] })
             }
              set((s) => { s.lastReviewedRevision = revision ?? null })
            }).catch(err => {
                 get().updateEvent(vlmEv, { status: "error", title: `VLM Layout Check failed`, detail: String(err) })
            })
          }

          break; // Exit loop on success
        } else {
          const isDemo = isDemoProject(project.id)
          const errorSummary = data.summary || (data.log ? getDeterministicSummary(data.log, activeOutput.cards) : "Compilation failed.")

          if (attempts < MAX_ATTEMPTS && get().compileAutoFixEnabled) {
            get().updateEvent(evId, { detail: `Attempt ${attempts}/${MAX_ATTEMPTS} failed. Requesting LLM autofix...` })
            let autofixData: { fixes?: Array<{ id: string; content: string }>; explanation?: string } | null = null
            try {
              const autofixRes = await apiFetch(`/api/workspaces/${project.id}/autofix-compile?revision=${revision}`, {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ log: data.log, cards: activeOutput.cards }),
              })
              if (autofixRes.ok) {
                autofixData = await autofixRes.json()
              } else {
                const errText = await autofixRes.text().catch(() => "")
                console.warn(`[compile] LLM autofix HTTP ${autofixRes.status}: ${errText}`)
              }
            } catch (afErr) {
              console.warn("[compile] LLM autofix request failed:", afErr)
            }
            const fixes: Array<{ id: string; content: string }> = Array.isArray(autofixData?.fixes) ? autofixData.fixes : []
            if (fixes.length > 0) {
               const snapshot = fixes
                 .map((f) => {
                   const card = activeOutput.cards.find((c) => c.id === f.id)
                   return card ? { cardId: card.id, content: card.content } : null
                 })
                 .filter((x): x is { cardId: string; content: string } => x !== null)
               const alreadyIdentical = fixes.every((f) => activeOutput.cards.find((c) => c.id === f.id)?.content === f.content)
               if (alreadyIdentical) {
                 const finalSummary = autofixData?.explanation || errorSummary
                 get().updateEvent(evId, { status: "error", title: "Compile failed", detail: finalSummary })
                 notify.error("Compile failed", { description: finalSummary })
                 if (!isDemo) {
                   get().setPendingAiPrompt(`The LaTeX compilation failed: ${finalSummary}\n\nPlease analyze this error and provide a fix using the <fix>...</fix> tag for the relevant card.`)
                 }
                 break
               }
               fixes.forEach((f) => get().updateCard(f.id, { content: f.content }))
               get().updateEvent(evId, {
                 status: "running",
                 title: `Compile failed — applied ${fixes.length} autofix patch${fixes.length === 1 ? "" : "es"}, retrying`,
                 detail: `${autofixData?.explanation || "AI patched the Markdown that produced invalid LaTeX."} (attempt ${attempts}/${MAX_ATTEMPTS})`,
                 fixes,
                 fixesApplied: true,
                 undoMany: snapshot,
               })
               continue
            } else {
               const finalSummary = autofixData?.explanation || errorSummary
               get().updateEvent(evId, { status: "error", title: "Compile failed", detail: finalSummary })
               notify.error("Compile failed", { description: finalSummary })
               if (!isDemo) {
                 get().setPendingAiPrompt(`The LaTeX compilation failed: ${finalSummary}\n\nPlease analyze this error and provide a fix using the <fix>...</fix> tag for the relevant card.`)
               }
               break;
            }
          } else {
            get().updateEvent(evId, {
              status: "error",
              title: get().compileAutoFixEnabled
                ? `Compile failed after ${MAX_ATTEMPTS} attempts`
                : "Compile failed",
              detail: errorSummary,
            })
            notify.error("Compile failed", {
              description: errorSummary,
            })
            if (!isDemo) {
              get().setPendingAiPrompt(`The LaTeX compilation failed${get().compileAutoFixEnabled ? " after multiple attempts" : ""}: ${errorSummary}\n\nPlease analyze this error and provide a fix using the <fix>...</fix> tag for the relevant card.`)
            }
          }
        }
      }
    } catch (err) {
      set((s) => {
        s.compileLog = String(err)
        s.compileOk = false
      })
      get().updateEvent(evId, { status: "error", title: "Compile error", detail: String(err) })
      notify.error("Compile error", { description: err instanceof Error ? err.message : String(err) })
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
