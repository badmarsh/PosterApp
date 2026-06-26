"use client"

import { createContext, useContext, useRef, type ReactNode } from "react"
import { createStore, useStore } from "zustand"
import { immer } from "zustand/middleware/immer"
import { toast } from "sonner"
import {
  generateLatexForCard,
  levelFromMessages,
  validateCard,
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
  ingestFiles: IngestFile[]
  assets: ExtractedAsset[]
  parseLog: ParseLogEntry[]

  // Actions — project
  switchProject: (id: string) => Promise<void>
  getStatus: (card: Card) => ValidationLevel
  selectCard: (id: string | null) => void
  updateCard: (id: string, patch: Partial<Card>) => void
  addCard: (column: ColumnIndex) => void
  deleteCard: (id: string) => void
  reorderCard: (id: string, dir: -1 | 1) => void
  moveColumn: (id: string, column: ColumnIndex) => void
  validateCardAction: (id: string) => void
  generateCardAction: (id: string) => void
  explainFailure: (id: string) => void
  suggestImprovements: (id: string) => void
  validateAll: () => void
  newProject: () => void
  duplicateProject: () => void

  // Actions — ingestion
  openIngestion: () => void
  closeIngestion: () => void
  uploadFiles: (files: { name: string; size: number }[]) => void
  retryFile: (id: string) => void
  removeFile: (id: string) => void
  applyFigureOp: (assetId: string, op: string) => Promise<void>
  promoteAsset: (assetId: string, cardId: string, slot: AssignSlot) => void
  unassignAsset: (assetId: string) => void
  discardAsset: (assetId: string) => void
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

function createEditorStore() {
  return createStore<EditorState>()(
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
            const f = s.ingestFiles.find((f) => f.id === fileId)
            if (f) { f.status = "parsing"; f.progress = 40 }
          })
        }, 500)
        // parsing → done
        window.setTimeout(() => {
          set((s) => {
            const file = s.ingestFiles.find((f) => f.id === fileId)
            if (file) {
              const produced = syntheticAssetsForFile(file)
              s.assets.push(...produced)
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
        ingestFiles: initialIngestFiles,
        assets: initialAssets,
        parseLog: initialParseLog,

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
              s.project = data
              s.isSwitchingProject = false
              s.agentEvents = [makeEvent({
                kind: "info",
                status: "done",
                title: "Workspace loaded",
                detail: `${data.cards.length} cards · ${data.templateName}`,
              })]
            })
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

        explainFailure: (id) => {
          const card = get().project.cards.find((c) => c.id === id)
          if (!card) return
          const msgs = validateCard(card).filter((m) => m.level === "error")
          pushEvent({
            kind: "explain",
            status: msgs.length ? "warning" : "done",
            title: `Explanation — ${id}`,
            detail: msgs.length
              ? `Cannot compile because ${msgs[0].field}: ${msgs[0].message}`
              : "No blocking errors — card would compile as-is.",
          })
        },

        suggestImprovements: (id) => {
          const card = get().project.cards.find((c) => c.id === id)
          if (!card) return
          const tips: string[] = []
          if (card.content.length > 500) tips.push("Consider shortening content to reduce overflow risk.")
          if ((card.content.match(/^[-*]\s/gm) || []).length > 5) tips.push("Consider splitting; >5 bullets crowds the column.")
          if (!tips.length) tips.push("Card is concise and well-scoped.")
          pushEvent({ kind: "suggest", status: "done", title: `Suggestions — ${id}`, detail: tips.join(" · ") })
        },

        validateAll: () => {
          pushEvent({ kind: "validate", status: "running", title: "Validating all cards" })
          window.setTimeout(() => {
            const results = get().project.cards.map((c) => ({
              id: c.id,
              level: levelFromMessages(validateCard(c)),
            }))
            const invalid = results.filter((r) => r.level === "invalid")
            const warn = results.filter((r) => r.level === "warning")
            pushEvent({
              kind: "validate",
              status: invalid.length ? "error" : warn.length ? "warning" : "done",
              title: `Validated ${results.length} cards`,
              detail: `${results.length - invalid.length - warn.length} valid · ${warn.length} warn · ${invalid.length} invalid`,
            })
            if (invalid.length) toast.error(`${invalid.length} card(s) have errors`)
            else if (warn.length) toast.warning(`${warn.length} card(s) have warnings`)
            else toast.success("All cards valid")
          }, 400)
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
            status: "queued" as const,
            progress: 0,
          }))
          set((s) => { s.ingestFiles.push(...created) })
          created.forEach((f) => {
            pushLog("info", `Queued ${f.name} (${f.method} router).`)
            advanceFile(f.id)
          })
          toast.success(`Queued ${created.length} file${created.length === 1 ? "" : "s"} for parsing`)
        },

        retryFile: (id) => {
          set((s) => {
            const f = s.ingestFiles.find((f) => f.id === id)
            if (f) { f.status = "queued"; f.progress = 0; f.error = undefined }
          })
          pushLog("info", `Retrying parse for file ${id}.`)
          advanceFile(id)
        },

        removeFile: (id) => set((s) => {
          s.ingestFiles = s.ingestFiles.filter((f) => f.id !== id)
          s.assets = s.assets.filter((a) => a.fileId !== id)
        }),

        applyFigureOp: async (assetId, op) => {
          pushLog("info", `Applied "${op}" to ${assetId} via image pipeline.`)
          await new Promise((r) => window.setTimeout(r, 900))
          set((s) => {
            const a = s.assets.find((a) => a.id === assetId)
            if (a && a.confidence === "low") a.confidence = "medium"
          })
        },

        promoteAsset: (assetId, cardId, slot) => {
          const asset = get().assets.find((a) => a.id === assetId)
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
            const a = s.assets.find((a) => a.id === assetId)
            if (a) { a.assignedCardId = cardId; a.assignedSlot = slot }
          })
          pushEvent({ kind: "info", status: "done", title: `Asset promoted — ${cardId}`, detail: `${asset.kind} → ${cardId} (${slot})` })
          toast.success(`Promoted to ${cardId}`)
        },

        unassignAsset: (assetId) => set((s) => {
          const a = s.assets.find((a) => a.id === assetId)
          if (a) { a.assignedCardId = undefined; a.assignedSlot = undefined }
        }),

        discardAsset: (assetId) => set((s) => {
          s.assets = s.assets.filter((a) => a.id !== assetId)
          toast.success("Asset discarded")
        }),
      }
    })
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
export function useEditor(): EditorState
export function useEditor<T>(selector: (state: EditorState) => T): T
export function useEditor<T>(selector?: (state: EditorState) => T): T | EditorState {
  const store = useContext(EditorStoreContext)
  if (!store) throw new Error("useEditor must be used within EditorProvider")
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useStore(store, selector ?? ((s) => s as unknown as T)) as T | EditorState
}
