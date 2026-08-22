import { toast } from "sonner"
import type { EditorSlice, ProjectSlice } from "./types"
import { sampleProject } from "@/lib/mock-data"
import { COLUMN_BUDGET, estimateHeight, generateLatexForCard, levelFromMessages, validateCard } from "@/lib/latex"
import type { Project } from "@/lib/poster-types"
import type { ExtractedAsset as Asset } from "@/lib/ingestion"
import { apiFetch } from "@/lib/api-fetch"
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
      const res = await apiFetch(`/api/workspaces/${id}`)
      if (!res.ok) throw new Error("Failed to load workspace")
      const projData = await res.json()
      
      const { agentEvents = [], chatMessages = [], ...projectData } = projData

      set((state) => {
        state.project = { ...projectData, assets: projectData.assets || [], ingestFiles: projectData.ingestFiles || [] }
        state.selectedCardId = null
        state.isSwitchingProject = false
        state.isDirty = false
        
        // Reset legacy assets (not linked to current workspace)
        state.ingestionOpen = false
      })

      // Load UI history
      get().hydrateUi(agentEvents, chatMessages)

      get().pushEvent({
        kind: "info",
        status: "done",
        title: "Workspace loaded",
        detail: `${projectData.cards?.length || 0} cards · ${projectData.templateName || "atlas"}`,
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

  moveCard: (id, toColumn, toIndex) => set((s) => {
    const cardIndex = s.project.cards.findIndex((c) => c.id === id)
    if (cardIndex === -1) return
    
    const card = s.project.cards[cardIndex]
    const fromColumn = card.column
    const fromIndex = card.order

    if (fromColumn === toColumn) {
      if (fromIndex === toIndex) return
      const colCards = s.project.cards
        .filter(c => c.column === toColumn)
        .sort((a, b) => a.order - b.order)
        
      const [moved] = colCards.splice(fromIndex, 1)
      colCards.splice(toIndex, 0, moved)
      
      colCards.forEach((c, idx) => {
        const target = s.project.cards.find(sc => sc.id === c.id)
        if (target) target.order = idx
      })
    } else {
      card.column = toColumn
      
      const sourceCards = s.project.cards
        .filter(c => c.column === fromColumn && c.id !== id)
        .sort((a, b) => a.order - b.order)
      sourceCards.forEach((c, idx) => {
        const target = s.project.cards.find(sc => sc.id === c.id)
        if (target) target.order = idx
      })
      
      const destCards = s.project.cards
        .filter(c => c.column === toColumn && c.id !== id)
        .sort((a, b) => a.order - b.order)
      
      destCards.splice(toIndex, 0, card)
      destCards.forEach((c, idx) => {
        const target = s.project.cards.find(sc => sc.id === c.id)
        if (target) target.order = idx
      })
    }
  }),

  validateCardAction: (id) => {
    const card = get().project.cards.find((c) => c.id === id)
    if (!card) return
    const evId = get().pushEvent({ kind: "validate", status: "running", title: `Validating — ${id}` })
    const msgs = validateCard(card)
    const level = levelFromMessages(msgs)
    window.setTimeout(() => {
      get().updateEvent(evId, {
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

  generateLatexForCardAction: (id) => {
    const card = get().project.cards.find((c) => c.id === id)
    if (!card) return
    const msgs = validateCard(card)
    if (levelFromMessages(msgs) === "invalid") {
      get().pushEvent({ kind: "generate", status: "error", title: `Generation blocked — ${id}`, detail: "Fix input errors first." })
      toast.error("Cannot generate: card has input errors.")
      return
    }
    set((s) => { s.generatingId = id })
    const evId = get().pushEvent({ kind: "generate", status: "running", title: `Generating LaTeX — ${id}`, detail: `${card.pattern} pattern` })
    window.setTimeout(() => {
      const latex = generateLatexForCard(card, get().project.id)
      set((s) => {
        const c = s.project.cards.find((c) => c.id === id)
        if (c) c.generatedLatex = latex
        if (s.generatingId === id) s.generatingId = null
      })
      get().updateEvent(evId, {
        status: "done",
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
    const evId = get().pushEvent({ kind: "generate", status: "running", title: `Auto-filling content — ${id}`, detail: `Reading workspace sources with Gemini (Target limit: ${characterLimit} chars)` })
    toast.info("Auto-filling card...")

    try {
      const workspaceId = get().project.id
      const res = await apiFetch(`/api/workspaces/${workspaceId}/cards/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: card.title || "Introduction",
          assets: get().project.assets,
          sourceIds: card.sourceIds,
          characterLimit,
          bibKeys: get().bibKeys,
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

      get().updateEvent(evId, {
        status: "done",
        title: `Auto-fill complete — ${id}`,
        detail: `Filled ${data.bullets?.length || 0} bullets.`,
      })
      toast.success("Card auto-filled successfully")

      // Optionally, automatically trigger LaTeX generation now that content is filled
      get().generateLatexForCardAction(id)
      
    } catch (err: unknown) {
      set((s) => { if (s.generatingId === id) s.generatingId = null })
      get().updateEvent(evId, { status: "error", title: `Auto-fill failed — ${id}`, detail: String(err) })
      toast.error(err instanceof Error ? err.message : "Failed to auto-fill card")
    }
  },

  autoFillAllCardsAction: async () => {
    const cards = get().project.cards.filter(c => 
      c.pattern !== "references" && (!c.content || c.content.trim() === "")
    ).sort((a, b) => a.order - b.order)
    
    if (cards.length === 0) {
      toast.info("No empty cards to auto-fill.")
      return
    }

    toast.info(`Starting auto-fill for ${cards.length} cards in parallel...`)
    const evId = get().pushEvent({ kind: "info", status: "running", title: "Bulk Auto-fill Started", detail: `Running ${cards.length} cards in parallel.` })

    const results = await Promise.allSettled(
      cards.map(card => get().autoFillCardAction(card.id))
    )

    const failed = results.filter(r => r.status === "rejected").length
    const succeeded = results.length - failed

    get().updateEvent(evId, { status: "done", title: "Bulk Auto-fill Complete", detail: `${succeeded} succeeded, ${failed} failed.` })
    if (failed > 0) {
      toast.warning(`Auto-fill: ${succeeded} cards done, ${failed} failed.`)
    } else {
      toast.success("All cards auto-filled successfully.")
    }
  },

  aiReview: async () => {
    const evId = get().pushEvent({ kind: "verify", status: "running", title: "AI Poster review" })
    try {
      const proj = get().project
      const res = await apiFetch(`/api/workspaces/${proj.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...proj, 
          bibContent: get().bibContent, 
          bibKeys: get().bibKeys 
        })
      })
      if (!res.ok) throw new Error("Verification failed")
      
      const data = await res.json()
      const tips = data.tips || []
      
      if (tips.length > 0) {
        // Find if any tip is an error or warning
        const hasError = tips.some((t: any) => t.severity === "error")
        const hasWarning = tips.some((t: any) => t.severity === "warning")
        const status = hasError ? "error" : hasWarning ? "warning" : "done"
        
        get().updateEvent(evId, { 
          status, 
          title: "Review Complete", 
          detail: `Found ${tips.length} issue${tips.length === 1 ? "" : "s"}.`,
          tips 
        })
      } else {
        get().updateEvent(evId, { status: "done", title: "Review Complete", detail: "Looking good! No major issues found." })
      }
    } catch (e: unknown) {
      get().updateEvent(evId, { status: "error", title: "Review Failed", detail: e instanceof Error ? e.message : String(e) })
      toast.error("Failed to run AI verification.")
    }
  },

  newProject: () => toast.info("New project — coming soon"),
  duplicateProject: () => toast.info(`Duplicated "${get().project.name}" — coming soon`),

  saveProject: async () => {
    if (get().isSaving) return
    set((s) => { s.isSaving = true })
    try {
      const proj = get().project
      const agentEvents = get().agentEvents
      const chatMessages = get().chatMessages

      const res = await apiFetch(`/api/workspaces/${proj.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...proj,
          agentEvents,
          chatMessages,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      set((s) => {
        s.isSaving = false
        s.isDirty = false
        s.lastSavedAt = new Date()
      })
    } catch (err: unknown) {
      set((s) => { s.isSaving = false })
    }
  },
})
