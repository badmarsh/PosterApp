"use client"

import { createContext, useContext, useRef, type ReactNode } from "react"
import { createStore, useStore } from "zustand"
import { immer } from "zustand/middleware/immer"
import { persist } from "zustand/middleware"
import { toast } from "sonner"
import {
  generateLatexForCard,
  levelFromMessages,
  validateCard,
  estimateHeight,
  COLUMN_BUDGET,
} from "@/lib/latex"
import { sampleProject } from "@/lib/mock-data"
import type {
  AgentEvent,
  Card,
  ColumnIndex,
  Project,
  ValidationLevel,
} from "@/lib/poster-types"
import {
  detectMethod,
  initialAssets,
  initialIngestFiles,
  initialParseLog,
  syntheticAssetsForFile,
  type AssignSlot,
  type ExtractedAsset,
  type IngestFile,
  type ParseLogEntry,
} from "@/lib/ingestion"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let eventSeq = 0
function makeEvent(e: Omit<AgentEvent, "id" | "ts">): AgentEvent {
  eventSeq += 1
  return {
    ...e,
    id: `evt_${Date.now()}_${eventSeq}`,
    ts: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  }
}

let logSeq = 0
function makeLog(level: ParseLogEntry["level"], message: string): ParseLogEntry {
  logSeq += 1
  return {
    id: `plog_${Date.now()}_${logSeq}`,
    ts: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    level,
    message,
  }
}

// ---------------------------------------------------------------------------
// Store state & actions interface
// ---------------------------------------------------------------------------

export interface EditorState {
  // Project
  project: Project
  selectedCardId: string | null
  selectedCard: Card | null
  agentEvents: AgentEvent[]
  generatingId: string | null
  isSwitchingProject: boolean
  busy: boolean
  columnCount: number

  // Ingestion
  ingestionOpen: boolean
  parseLog: ParseLogEntry[]
  bibContent: string
  bibKeys: string[]

  // Actions — project
  switchProject: (id: string) => Promise<void>
  getStatus: (card: Card) => ValidationLevel
  selectCard: (id: string | null) => void
  updateProject: (patch: Partial<Omit<Project, "id" | "cards">>) => void
  updateCard: (id: string, patch: Partial<Card>) => void
  addCard: (column: ColumnIndex) => void
  deleteCard: (id: string) => void
  reorderCard: (id: string, dir: -1 | 1) => void
  moveColumn: (id: string, column: ColumnIndex) => void
  validateCardAction: (id: string) => void
  generateCardAction: (id: string) => void
  autoFillCardAction: (id: string) => Promise<void>
  aiReview: () => Promise<void>
  newProject: () => void
  duplicateProject: () => void

  // Actions — ingestion
  openIngestion: () => void
  closeIngestion: () => void
  uploadFiles: (files: File[]) => void
  retryFile: (id: string) => void
  removeFile: (id: string) => void
  applyFigureOp: (assetId: string, op: string) => Promise<void>
  promoteAsset: (assetId: string, cardId: string, slot: AssignSlot) => void
  unassignAsset: (assetId: string) => void
  discardAsset: (assetId: string) => void

  // Actions — bib
  fetchBib: (projectId: string) => Promise<void>
  updateBib: (projectId: string, bib: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

function createEditorStore() {
  return createStore<EditorState>()(
    persist(
      immer((set, get) => {
        // Internal helpers that don't need to be public
        function pushEvent(e: Omit<AgentEvent, "id" | "ts">) {
        set((s) => { s.agentEvents.push(makeEvent(e)) })
      }
      function pushLog(level: ParseLogEntry["level"], message: string) {
        set((s) => { s.parseLog.push(makeLog(level, message)) })
      }

      function advanceFile(fileId: string) {
        // queued → parsing
        window.setTimeout(() => {
          set((s) => {
            const f = s.project.ingestFiles.find((f) => f.id === fileId)
            if (f) { f.status = "parsing"; f.progress = 40 }
          })
        }, 500)
        // parsing → done
        window.setTimeout(() => {
          set((s) => {
            const file = s.project.ingestFiles.find((f) => f.id === fileId)
            if (file) {
              const produced = syntheticAssetsForFile(file)
              s.project.assets.push(...produced)
              s.parseLog.push(makeLog(
                "info",
                `${file.name} → ${file.method} extracted ${produced.length} assets`,
              ))
              file.status = "done"
              file.progress = 100
            }
          })
        }, 1700)
      }

      return {
        // --- initial state ---
        project: sampleProject,
        selectedCardId: null,
        get selectedCard() {
          const s = get()
          return s.project.cards.find((c) => c.id === s.selectedCardId) ?? null
        },
        agentEvents: [
          makeEvent({
            kind: "info",
            status: "done",
            title: "Editor ready",
            detail: "Loading workspace…",
          }),
        ],
        generatingId: null,
        isSwitchingProject: false,
        get busy() {
          const s = get()
          return s.isSwitchingProject || s.generatingId !== null
        },
        columnCount: 3,
        ingestionOpen: false,
        parseLog: initialParseLog,
        bibContent: "",
        bibKeys: [],

        // --- project actions ---
        switchProject: async (id) => {
          const { project, isSwitchingProject } = get()
          if (id === project.id || isSwitchingProject) return
          set((s) => { s.isSwitchingProject = true; s.selectedCardId = null })
          try {
            const res = await fetch(`/api/workspaces/${id}`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data: Project = await res.json()
            set((s) => {
              s.project = { ...data, assets: data.assets || [], ingestFiles: data.ingestFiles || [] }
              s.isSwitchingProject = false
              s.agentEvents = [makeEvent({
                kind: "info",
                status: "done",
                title: "Workspace loaded",
                detail: `${data.cards.length} cards · ${data.templateName}`,
              })]
            })
            get().fetchBib(id)
          } catch (err) {
            set((s) => { s.isSwitchingProject = false })
            pushEvent({ kind: "info", status: "error", title: "Failed to load workspace", detail: String(err) })
            toast.error("Failed to load workspace")
          }
        },

        getStatus: (card) => {
          if (get().generatingId === card.id) return "generating"
          return levelFromMessages(validateCard(card))
        },

        updateProject: (patch) => set((s) => {
          Object.assign(s.project, patch)
        }),

        selectCard: (id) => set((s) => { s.selectedCardId = id }),

        updateCard: (id, patch) => set((s) => {
          const card = s.project.cards.find((c) => c.id === id)
          if (card) Object.assign(card, patch)
        }),

        addCard: (column) => set((s) => {
          const inCol = s.project.cards.filter((c) => c.column === column)
          const id = `blk_new_${Date.now().toString(36)}`
          s.project.cards.push({
            id,
            title: "Untitled card",
            column,
            order: inCol.length,
            pattern: "bullets",
            content: "- New finding",
            table: { hasHeader: true, caption: "", rows: [] },
            figures: [],
            figureLayout: "single",
            sourceIds: [],
            heightBudget: null,
            validation: "warning",
          })
          s.selectedCardId = id
          toast.success(`Added card to column ${column}`)
        }),

        deleteCard: (id) => set((s) => {
          s.project.cards = s.project.cards.filter((c) => c.id !== id)
          if (s.selectedCardId === id) s.selectedCardId = null
          toast.success(`Deleted ${id}`)
        }),

        reorderCard: (id, dir) => set((s) => {
          const card = s.project.cards.find((c) => c.id === id)
          if (!card) return
          const col = s.project.cards
            .filter((c) => c.column === card.column)
            .sort((a, b) => a.order - b.order)
          const idx = col.findIndex((c) => c.id === id)
          const swapIdx = idx + dir
          if (swapIdx < 0 || swapIdx >= col.length) return
          const aOrder = col[idx].order
          const bOrder = col[swapIdx].order
          const a = s.project.cards.find((c) => c.id === col[idx].id)!
          const b = s.project.cards.find((c) => c.id === col[swapIdx].id)!
          a.order = bOrder
          b.order = aOrder
        }),

        moveColumn: (id, column) => set((s) => {
          const card = s.project.cards.find((c) => c.id === id)
          if (!card) return
          card.column = column
          card.order = s.project.cards.filter((c) => c.column === column && c.id !== id).length
        }),

        validateCardAction: (id) => {
          const card = get().project.cards.find((c) => c.id === id)
          if (!card) return
          pushEvent({ kind: "validate", status: "running", title: `Validating — ${id}` })
          const msgs = validateCard(card)
          const level = levelFromMessages(msgs)
          window.setTimeout(() => {
            pushEvent({
              kind: "validate",
              status: level === "invalid" ? "error" : level === "warning" ? "warning" : "done",
              title: level === "valid"
                ? `Validation passed — ${id}`
                : `Validation found ${msgs.length} issue${msgs.length === 1 ? "" : "s"} — ${id}`,
              detail: msgs.length
                ? msgs.map((m) => `${m.field}: ${m.message}`).join(" · ")
                : "Card input is well-formed.",
            })
          }, 400)
        },

        generateCardAction: (id) => {
          const card = get().project.cards.find((c) => c.id === id)
          if (!card) return
          const msgs = validateCard(card)
          if (levelFromMessages(msgs) === "invalid") {
            pushEvent({ kind: "generate", status: "error", title: `Generation blocked — ${id}`, detail: "Fix input errors first." })
            toast.error("Cannot generate: card has input errors.")
            return
          }
          set((s) => { s.generatingId = id })
          pushEvent({ kind: "generate", status: "running", title: `Generating LaTeX — ${id}`, detail: `${card.pattern} pattern` })
          window.setTimeout(() => {
            const latex = generateLatexForCard(card, get().project.id)
            set((s) => {
              const c = s.project.cards.find((c) => c.id === id)
              if (c) c.generatedLatex = latex
              if (s.generatingId === id) s.generatingId = null
            })
            pushEvent({
              kind: "generate", status: "done",
              title: `LaTeX ready — ${id}`,
              detail: `${latex.split("\n").length} lines generated.`,
            })
            toast.success(`Generated LaTeX for ${id}`)
          }, 800)
        },

        autoFillCardAction: async (id) => {
          const card = get().project.cards.find((c) => c.id === id)
          if (!card) return

          // Calculate available text budget
          const otherCards = get().project.cards.filter(c => c.column === card.column && c.id !== card.id)
          const otherHeights = otherCards.reduce((acc, c) => acc + estimateHeight(c), 0)
          const remainingBudget = Math.max(0, COLUMN_BUDGET - otherHeights)
          
          const targetHeight = card.heightBudget || remainingBudget
          
          // Card's height overhead without text
          const clone = { ...card, content: "" }
          const baseHeight = estimateHeight(clone)
          
          const textBudgetUnits = targetHeight - baseHeight
          // roughly 14u per 60 characters
          const characterLimit = Math.max(50, Math.floor(textBudgetUnits * (60 / 14)))

          set((s) => { s.generatingId = id })
          pushEvent({ kind: "generate", status: "running", title: `Auto-filling content — ${id}`, detail: `Reading workspace sources with Gemini (Target limit: ${characterLimit} chars)` })
          toast.info("Auto-filling card...")

          try {
            const workspaceId = get().project.id
            const res = await fetch(`/api/workspaces/${workspaceId}/cards/${id}/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                topic: card.title || "Introduction",
                assets: get().project.assets,
                sourceIds: card.sourceIds,
                characterLimit,
              })
            })

            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              throw new Error(err.error || `HTTP ${res.status}`)
            }

            const data = await res.json()
            set((s) => {
              const c = s.project.cards.find((c) => c.id === id)
              if (c) {
                // Update title if Gemini suggested one
                if (data.title) {
                  c.title = data.title
                }
                // Update content as markdown bullets
                if (data.bullets && Array.isArray(data.bullets)) {
                  c.content = data.bullets.map((b: string) => `* ${b}`).join("\n\n")
                }
                
                // Update figures if recommended
                if (data.assignedAssets && Array.isArray(data.assignedAssets)) {
                  c.figures = [] // clear existing
                  data.assignedAssets?.forEach((assignment: any) => {
                    const assetId = assignment.assetId
                    if (assetId) {
                      const asset = s.project.assets.find(a => a.id === assetId)
                      if (asset) {
                        c.figures.push({ id: asset.id, url: asset.url || asset.thumbnailUrl || "", caption: asset.caption || "" })
                      }
                    }
                  })
                }
              }
              if (s.generatingId === id) s.generatingId = null
            })

            pushEvent({
              kind: "generate", status: "done",
              title: `Auto-fill complete — ${id}`,
              detail: `Filled ${data.bullets?.length || 0} bullets.`,
            })
            toast.success("Card auto-filled successfully")

            // Optionally, automatically trigger LaTeX generation now that content is filled
            get().generateCardAction(id)
            
          } catch (err: any) {
            set((s) => { if (s.generatingId === id) s.generatingId = null })
            pushEvent({ kind: "generate", status: "error", title: `Auto-fill failed — ${id}`, detail: String(err) })
            toast.error(err.message || "Failed to auto-fill card")
          }
        },

        aiReview: async () => {
          pushEvent({ kind: "verify", status: "running", title: "AI Poster review" })
          try {
            const proj = get().project
            const res = await fetch(`/api/workspaces/${proj.id}/review`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(proj)
            })
            if (!res.ok) throw new Error("Verification failed")
            
            const data = await res.json()
            const tips = data.tips || []
            if (tips.length > 0) {
              pushEvent({ kind: "verify", status: "warning", title: "Review Complete", detail: tips.join("\n\n") })
            } else {
              pushEvent({ kind: "verify", status: "done", title: "Review Complete", detail: "Looking good! No major issues found." })
            }
          } catch (e: any) {
            pushEvent({ kind: "verify", status: "error", title: "Review Failed", detail: e.message })
            toast.error("Failed to run AI verification.")
          }
        },

        newProject: () => toast.info("New project — coming soon"),
        duplicateProject: () => toast.info(`Duplicated "${get().project.name}" — coming soon`),

        // --- ingestion actions ---
        openIngestion: () => set((s) => { s.ingestionOpen = true }),
        closeIngestion: () => set((s) => { s.ingestionOpen = false }),

        uploadFiles: (files) => {
          if (!files.length) return
          const created: IngestFile[] = files.map((f) => ({
            id: `file_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            name: f.name,
            size: f.size,
            method: detectMethod(f.name),
            status: "parsing" as const,
            progress: 10,
          }))
          set((s) => { s.project.ingestFiles.unshift(...created) })
          
          files.forEach(async (f, i) => {
            const fileMeta = created[i]
            pushLog("info", `Parsing ${f.name} via MinerU backend.`)
            try {
              const formData = new FormData()
              formData.append("file", f)
              formData.append("fileId", fileMeta.id)
              
              // Pass existing asset filenames so the backend skips expensive vision model re-processing
              const existingFilenames = get().project.assets.map((a: any) => a.filename)
              formData.append("existingAssets", JSON.stringify(existingFilenames))

              const workspaceId = get().project.id
              const res = await fetch(`/api/ingestion/parse?workspaceId=${workspaceId}`, {
                method: "POST",
                body: formData
              })
              
              if (!res.ok) {
                 const errData = await res.json().catch(() => ({}))
                 throw new Error(errData.detail || errData.error || `HTTP ${res.status}`)
              }
              const data = await res.json()
              const produced = data.assets || []
              
              set((s) => {
                const ingestFile = s.project.ingestFiles.find(x => x.id === fileMeta.id)
                if (ingestFile) {
                  ingestFile.status = "done"
                  ingestFile.progress = 100
                }
                const typedAssets = produced.map((a: any) => ({
                  ...a, 
                  fileId: fileMeta.id, 
                  confidence: "high"
                }))
                
                // Deduplicate assets by filename so re-parsing doesn't create duplicates
                const newAssets = typedAssets.filter((newAsset: any) => 
                  !s.project.assets.some((existing: any) => existing.filename === newAsset.filename)
                )
                
                s.project.assets.push(...newAssets)
              })
              pushLog("info", `${f.name} parsed successfully. ${produced.length} assets extracted.`)
              toast.success(`Parsed ${f.name}`)
            } catch (err) {
              set((s) => {
                const ingestFile = s.project.ingestFiles.find(x => x.id === fileMeta.id)
                if (ingestFile) {
                  ingestFile.status = "failed"
                  ingestFile.progress = 100
                  ingestFile.error = String(err)
                }
              })
              pushLog("error", `Failed to parse ${f.name}: ${String(err)}`)
              toast.error(`Failed to parse ${f.name}`)
            }
          })
          toast.info(`Uploading ${created.length} file${created.length === 1 ? "" : "s"}...`)
        },

        retryFile: (id) => {
          set((s) => {
            const f = s.project.ingestFiles.find((f) => f.id === id)
            if (f) { f.status = "queued"; f.progress = 0; f.error = undefined }
          })
          pushLog("info", `Retrying parse for file ${id}.`)
          advanceFile(id)
        },

        removeFile: (id) => set((s) => {
          s.project.ingestFiles = s.project.ingestFiles.filter((f) => f.id !== id)
          s.project.assets = s.project.assets.filter((a) => a.fileId !== id)
        }),

        applyFigureOp: async (assetId, op) => {
          pushLog("info", `Applied "${op}" to ${assetId} via image pipeline.`)
          await new Promise((r) => window.setTimeout(r, 900))
          set((s) => {
            const a = s.project.assets.find((a) => a.id === assetId)
            if (a && a.confidence === "low") a.confidence = "medium"
          })
        },

        promoteAsset: (assetId, cardId, slot) => {
          const asset = get().project.assets.find((a) => a.id === assetId)
          if (!asset) return
          set((s) => {
            const card = s.project.cards.find((c) => c.id === cardId)
            if (!card) return
            if (slot === "bullets" && asset.snippet) {
              const prefix = card.content.trim() ? "\n" : ""
              card.content = card.content + prefix + "- " + asset.snippet
            } else if ((slot === "figure1" || slot === "figure2") && asset.thumbnailUrl) {
              const idx = slot === "figure1" ? 0 : 1
              card.figures[idx] = {
                id: `fig_${assetId}`,
                url: asset.thumbnailUrl,
                caption: asset.caption ?? "",
              }
              card.figureLayout = card.figures.filter(Boolean).length > 1 ? "two-up" : "single"
            } else if (slot === "table" && asset.tableRows) {
              card.table = {
                hasHeader: true,
                caption: asset.caption ?? card.table.caption,
                rows: asset.tableRows,
              }
            }
            const a = s.project.assets.find((a) => a.id === assetId)
            if (a) { a.assignedCardId = cardId; a.assignedSlot = slot }
          })
          pushEvent({ kind: "info", status: "done", title: `Asset promoted — ${cardId}`, detail: `${asset.kind} → ${cardId} (${slot})` })
          toast.success(`Promoted to ${cardId}`)
        },

        unassignAsset: (assetId) => set((s) => {
          const a = s.project.assets.find((a) => a.id === assetId)
          if (a) { a.assignedCardId = undefined; a.assignedSlot = undefined }
        }),

        discardAsset: (assetId) => set((s) => {
          s.project.assets = s.project.assets.filter((a) => a.id !== assetId)
          toast.success("Asset discarded")
        }),

        // --- bib actions ---
        fetchBib: async (projectId) => {
          try {
            const res = await fetch(`/api/workspaces/${projectId}/bib`)
            if (res.ok) {
              const data = await res.json()
              set((s) => {
                s.bibContent = data.bib ?? ""
                s.bibKeys = data.keys ?? []
              })
            } else {
              set((s) => { s.bibContent = ""; s.bibKeys = [] })
            }
          } catch (err) {
            set((s) => { s.bibContent = ""; s.bibKeys = [] })
          }
        },

        updateBib: async (projectId, bib) => {
          set((s) => { s.bibContent = bib })
          try {
            const res = await fetch(`/api/workspaces/${projectId}/bib`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bib })
            })
            if (res.ok) {
              const data = await res.json()
              set((s) => { s.bibKeys = data.keys ?? [] })
            }
          } catch (err) {
            toast.error("Failed to save bibliography")
          }
        },
      }
    }),
    {
      name: "posterapp-editor-storage",
      // Optionally exclude things from persisting if needed
      partialize: (state) => ({
        ...state,
        // we can exclude transient state like `parseLog` or `ingestionOpen` if we wanted, 
        // but persisting everything is fine for this use case.
      }),
    }
  )
)
}

// ---------------------------------------------------------------------------
// Context — store-per-provider pattern (safe for SSR + concurrent mode)
// ---------------------------------------------------------------------------

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

/**
 * useEditor — subscribe to only the slices you need.
 * Each component re-renders only when its selected slice changes.
 *
 * Usage:
 *   const project = useEditor((s) => s.project)
 *   const { updateCard, selectCard } = useEditor((s) => ({ updateCard: s.updateCard, selectCard: s.selectCard }))
 *
 * For backwards compatibility, calling useEditor() with no selector returns
 * the full state object (same as before, but now with granular subscriptions possible).
 */
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
