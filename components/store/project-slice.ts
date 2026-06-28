import { toast } from "sonner"
import type { EditorSlice, ProjectSlice } from "./types"
import { sampleProject } from "@/lib/mock-data"
import { COLUMN_BUDGET, estimateHeight, generateLatexForCard, levelFromMessages, validateCard } from "@/lib/latex"
import type { Project } from "@/lib/poster-types"
import type { ExtractedAsset as Asset } from "@/lib/ingestion"
export const createProjectSlice: EditorSlice<ProjectSlice> = (set, get) => ({
  project: sampleProject,
  selectedCardId: null,
  isSwitchingProject: false,
  columnCount: 3,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,

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
      })
      get().pushEvent({
        kind: "info",
        status: "done",
        title: "Workspace loaded",
        detail: `${data.cards.length} cards · ${data.templateName}`,
      })
      get().fetchBib(id)
    } catch (err) {
      set((s) => { s.isSwitchingProject = false })
      get().pushEvent({ kind: "info", status: "error", title: "Failed to load workspace", detail: String(err) })
      toast.error("Failed to load workspace")
    }
  },

  getStatus: (card) => {
    if (get().generatingId === card.id) return "generating"
    return levelFromMessages(validateCard(card))
  },

  updateProject: (patch) => set((s) => {
    Object.assign(s.project, patch)
    s.isDirty = true
  }),

  selectCard: (id) => set((s) => { s.selectedCardId = id }),

  updateCard: (id, patch) => set((s) => {
    const card = s.project.cards.find((c) => c.id === id)
    if (card) {
      Object.assign(card, patch)
      s.isDirty = true
    }
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
    get().pushEvent({ kind: "validate", status: "running", title: `Validating — ${id}` })
    const msgs = validateCard(card)
    const level = levelFromMessages(msgs)
    window.setTimeout(() => {
      get().pushEvent({
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
      get().pushEvent({ kind: "generate", status: "error", title: `Generation blocked — ${id}`, detail: "Fix input errors first." })
      toast.error("Cannot generate: card has input errors.")
      return
    }
    set((s) => { s.generatingId = id })
    get().pushEvent({ kind: "generate", status: "running", title: `Generating LaTeX — ${id}`, detail: `${card.pattern} pattern` })
    window.setTimeout(() => {
      const latex = generateLatexForCard(card, get().project.id)
      set((s) => {
        const c = s.project.cards.find((c) => c.id === id)
        if (c) c.generatedLatex = latex
        if (s.generatingId === id) s.generatingId = null
      })
      get().pushEvent({
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
    get().pushEvent({ kind: "generate", status: "running", title: `Auto-filling content — ${id}`, detail: `Reading workspace sources with Gemini (Target limit: ${characterLimit} chars)` })
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
            data.assignedAssets?.forEach((assignment: {assetId: string, slot: string}) => {
              const assetId = assignment.assetId
              if (assetId) {
                const asset = s.project.assets.find((a: Asset) => a.id === assetId)
                if (asset) {
                  c.figures.push({ id: asset.id, url: asset.url || asset.thumbnailUrl || "", caption: asset.caption || "" })
                }
              }
            })
          }
        }
        if (s.generatingId === id) s.generatingId = null
      })

      get().pushEvent({
        kind: "generate", status: "done",
        title: `Auto-fill complete — ${id}`,
        detail: `Filled ${data.bullets?.length || 0} bullets.`,
      })
      toast.success("Card auto-filled successfully")

      // Optionally, automatically trigger LaTeX generation now that content is filled
      get().generateCardAction(id)
      
    } catch (err: unknown) {
      set((s) => { if (s.generatingId === id) s.generatingId = null })
      get().pushEvent({ kind: "generate", status: "error", title: `Auto-fill failed — ${id}`, detail: String(err) })
      toast.error(err instanceof Error ? err.message : "Failed to auto-fill card")
    }
  },

  aiReview: async () => {
    get().pushEvent({ kind: "verify", status: "running", title: "AI Poster review" })
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
        get().pushEvent({ kind: "verify", status: "warning", title: "Review Complete", detail: tips.join("\n\n") })
      } else {
        get().pushEvent({ kind: "verify", status: "done", title: "Review Complete", detail: "Looking good! No major issues found." })
      }
    } catch (e: unknown) {
      get().pushEvent({ kind: "verify", status: "error", title: "Review Failed", detail: e instanceof Error ? e.message : String(e) })
      toast.error("Failed to run AI verification.")
    }
  },

  newProject: () => toast.info("New project — coming soon"),
  duplicateProject: () => toast.info(`Duplicated "${get().project.name}" — coming soon`),

  saveProject: async () => {
    const { project } = get()
    set((s) => { s.isSaving = true })
    try {
      const res = await fetch(`/api/workspaces/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      set((s) => {
        s.isSaving = false
        s.isDirty = false
        s.lastSavedAt = new Date()
      })
      toast.success("Workspace saved")
    } catch (err: unknown) {
      set((s) => { s.isSaving = false })
      toast.error("Failed to save workspace")
    }
  },
})
