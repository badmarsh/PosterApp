import { toast } from "sonner"
import type { EditorSlice, ProjectSlice } from "./types"
import { sampleProject } from "@/lib/mock-data"
import { COLUMN_BUDGET, estimateHeight, generateLatexForCard, levelFromMessages, validateCard } from "@/lib/latex"
import type { Project, OutputConfig, BlockPattern, Card } from "@/lib/poster-types"
import type { ExtractedAsset as Asset } from "@/lib/ingestion"
import { apiFetch } from "@/lib/api-fetch"
import type { OutputType } from "@/lib/output-types"
import { getDefaultTemplateId, DEFAULT_STRUCTURES } from "@/lib/output-types"
import { jobQueue } from "@/lib/job-queue"

/** outputs[].cards is the persisted source of truth. `project.cards` only mirrors the active output for legacy consumers. */
function activeOutput(project: Project) {
  return project.outputs?.find((output) => output.id === project.activeOutputId)
}

function syncActiveCards(project: Project) {
  const output = activeOutput(project)
  // Older workspaces may not have been migrated to outputs yet; do not erase
  // their legacy cards merely because no active output was found.
  project.cards = output?.cards ?? project.cards
  return project.cards
}

export const createProjectSlice: EditorSlice<ProjectSlice> = (set, get) => {
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleRetry = () => {
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      retryTimer = null
      void get().saveProject()
    }, 3_000)
  }

  return ({
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
        syncActiveCards(state.project)
        state.selectedCardId = null
        state.isSwitchingProject = false
        state.isDirty = false
        state.isSaving = false
        // Reset legacy assets (not linked to current workspace)
        state.ingestionOpen = false
      })
      get().setLastWorkspaceId(id)

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

  _setCardsFromYjs: (cards) => set((s) => {
    const output = activeOutput(s.project)
    if (output) output.cards = cards
    s.project.cards = cards
  }),

  switchOutput: (outputId) => set((s) => {
    const targetOutput = s.project.outputs?.find((o) => o.id === outputId)
    if (targetOutput) {
      s.project.activeOutputId = outputId
      syncActiveCards(s.project)
      s.selectedCardId = null
      s.isDirty = true
    }
  }),

  selectCard: (id) => set((s) => { s.selectedCardId = id }),

  updateCard: (id, patch) => set((s) => {
    const cards = syncActiveCards(s.project)
    const card = cards.find((c) => c.id === id)
    if (card) {
      Object.assign(card, patch)
      s.isDirty = true
    }
  }),

  addCard: (column = null) => set((s) => {
    const activeOutput = s.project.outputs?.find((o) => o.id === s.project.activeOutputId)
    if (!activeOutput) return
    const cards = activeOutput.cards
    const outputType: OutputType = (activeOutput?.outputType as OutputType) ?? "poster"
    const effectiveColumn = outputType === "poster" ? (column ?? 1) : null
    const order = outputType === "poster"
      ? cards.filter((c) => c.column === effectiveColumn).length
      : cards.length
    const defaultPattern = outputType === "slides" ? "bullets"
      : outputType === "paper" ? "section"
      : "bullets"
    const defaultTitle = outputType === "slides" ? "Untitled Slide"
      : outputType === "paper" ? "New Section"
      : "Untitled card"
    const id = `blk_new_${Date.now().toString(36)}`
    cards.push({
      id,
      title: defaultTitle,
      column: effectiveColumn as (1 | 2 | 3 | null),
      order,
      pattern: defaultPattern,
      content: "",
      table: { hasHeader: true, caption: "", rows: [] },
      figures: [],
      figureLayout: "single",
      sourceIds: [],
      heightBudget: null,
      validation: "warning",
    })
    s.selectedCardId = id
    syncActiveCards(s.project)
    s.isDirty = true
    if (outputType === "poster") {
      toast.success(`Added card to column ${effectiveColumn}`)
    } else {
      toast.success("Added card")
    }
  }),

  addOutput: (outputType, templateId) => set((s) => {
    const resolvedTemplate = templateId || getDefaultTemplateId(outputType)
    const id = `out_${outputType}_${Date.now().toString(36)}`
    
    const structure = DEFAULT_STRUCTURES[outputType]
    const newCards = structure.map((def, i) => ({
      id: `blk_${id}_${i}`,
      title: def.title,
      column: (def.column ?? null) as 1 | 2 | 3 | null,
      order: i,
      pattern: def.pattern as BlockPattern,
      content: "",
      table: { hasHeader: true, caption: "", rows: [] },
      figures: [],
      figureLayout: "single" as const,
      sourceIds: [],
      heightBudget: null,
      validation: "warning" as const,
    }))

    const newOutput: OutputConfig = {
      id,
      outputType,
      templateId: resolvedTemplate,
      title: s.project.name,
      cards: newCards,
    }
    if (!s.project.outputs) s.project.outputs = []
    s.project.outputs.push(newOutput)
    s.project.activeOutputId = id
    syncActiveCards(s.project)
    s.selectedCardId = null
    s.isDirty = true
    toast.success(`Created new ${outputType} output`)
  }),

  deleteCard: (id) => set((s) => {
    const output = activeOutput(s.project)
    if (!output) return
    output.cards = output.cards.filter((c) => c.id !== id)
    syncActiveCards(s.project)
    if (s.selectedCardId === id) s.selectedCardId = null
    // Clear orphaned asset assignments so the FK constraint isn't violated on next save
    s.project.assets.forEach((a) => {
      if (a.assignedCardId === id) {
        a.assignedCardId = undefined
        a.assignedSlot = undefined
      }
    })
    s.isDirty = true
    toast.success(`Deleted ${id}`)
  }),

  reorderCard: (id, dir) => set((s) => {
    const cards = syncActiveCards(s.project)
    const card = cards.find((c) => c.id === id)
    if (!card) return
    const col = cards
      .filter((c) => c.column === card.column)
      .sort((a, b) => a.order - b.order)
    const idx = col.findIndex((c) => c.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= col.length) return
    const aOrder = col[idx].order
    const bOrder = col[swapIdx].order
    const a = cards.find((c) => c.id === col[idx].id)!
    const b = cards.find((c) => c.id === col[swapIdx].id)!
    a.order = bOrder
    b.order = aOrder
    s.isDirty = true
  }),

  moveColumn: (id, column) => set((s) => {
    const cards = syncActiveCards(s.project)
    const card = cards.find((c) => c.id === id)
    if (!card) return
    card.column = column
    card.order = cards.filter((c) => c.column === column && c.id !== id).length
    s.isDirty = true
  }),

  moveCard: (id, toColumn, toIndex) => set((s) => {
    const cards = syncActiveCards(s.project)
    const cardIndex = cards.findIndex((c) => c.id === id)
    if (cardIndex === -1) return
    
    const card = cards[cardIndex]
    const fromColumn = card.column
    const fromIndex = card.order

    if (fromColumn === toColumn) {
      if (fromIndex === toIndex) return
      const colCards = cards
        .filter(c => c.column === toColumn)
        .sort((a, b) => a.order - b.order)
        
      const [moved] = colCards.splice(fromIndex, 1)
      colCards.splice(toIndex, 0, moved)
      
      colCards.forEach((c, idx) => {
        const target = cards.find(sc => sc.id === c.id)
        if (target) target.order = idx
      })
    } else {
      card.column = toColumn
      
      const sourceCards = cards
        .filter(c => c.column === fromColumn && c.id !== id)
        .sort((a, b) => a.order - b.order)
      sourceCards.forEach((c, idx) => {
        const target = cards.find(sc => sc.id === c.id)
        if (target) target.order = idx
      })
      
      const destCards = cards
        .filter(c => c.column === toColumn && c.id !== id)
        .sort((a, b) => a.order - b.order)
      
      destCards.splice(toIndex, 0, card)
      destCards.forEach((c, idx) => {
        const target = cards.find(sc => sc.id === c.id)
        if (target) target.order = idx
      })
    }
    s.isDirty = true
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
    const workspaceId = get().project.id
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
      if (get().project.id !== workspaceId) return
      const latex = generateLatexForCard(card, get().project.id)
      set((s) => {
        const c = syncActiveCards(s.project).find((c) => c.id === id)
        if (c) c.generatedLatex = latex
        if (c) s.isDirty = true
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
    const workspaceId = get().project.id
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
      const activeOutput = get().project.outputs?.find(o => o.id === get().project.activeOutputId)
      const outputType = activeOutput?.outputType || "poster"

      const res = await apiFetch(`/api/workspaces/${workspaceId}/cards/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outputType,
          topic: card.title || "Introduction",
          // Send only the fields the server actually uses, not full asset objects
          assets: get().project.assets.map(({ id: aid, filename, kind, caption, snippet }) => ({
            id: aid, filename, kind, caption, snippet,
          })),
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
        // A job is scoped to the workspace that started it. Never apply a late
        // response to whichever workspace happens to be open now.
        if (s.project.id !== workspaceId) return
        const c = syncActiveCards(s.project).find((c) => c.id === id)
        if (c) {
          // Update title if Gemini suggested one
          if (data.title) {
            c.title = data.title
          }
          s.isDirty = true
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
      set((s) => { if (s.project.id === workspaceId && s.generatingId === id) s.generatingId = null })
      get().updateEvent(evId, { status: "error", title: `Auto-fill failed — ${id}`, detail: String(err) })
      toast.error(err instanceof Error ? err.message : "Failed to auto-fill card")
      // Rethrow so bulk callers (autoFillAllCardsAction) can track failure counts correctly
      throw err
    }
  },

  autoFillAllCardsAction: async () => {
    const workspaceId = get().project.id
    const cards = get().project.cards.filter(c => 
      c.pattern !== "references" && (!c.content || c.content.trim() === "")
    ).sort((a, b) => a.order - b.order)
    
    if (cards.length === 0) {
      toast.info("No empty cards to auto-fill.")
      return
    }

    jobQueue.enqueue("Bulk Auto-fill", async (onProgress, signal) => {
      const evId = get().pushEvent({ kind: "info", status: "running", title: "Bulk Auto-fill Started", detail: `Processing ${cards.length} cards...` })

      let succeeded = 0
      let failed = 0
      
      for (let i = 0; i < cards.length; i++) {
        if (signal.aborted || get().project.id !== workspaceId) {
          get().updateEvent(evId, { status: "error", title: "Bulk Auto-fill Cancelled", detail: `${succeeded} succeeded, ${failed} failed before cancellation.` })
          const abortErr = new Error("Cancelled by user")
          abortErr.name = "AbortError"
          throw abortErr
        }
        
        try {
          await get().autoFillCardAction(cards[i].id)
          succeeded++
        } catch (e) {
          failed++
        }
        onProgress(Math.round(((i + 1) / cards.length) * 100))
      }

      get().updateEvent(evId, { status: "done", title: "Bulk Auto-fill Complete", detail: `${succeeded} succeeded, ${failed} failed.` })
      if (failed > 0) {
        toast.warning(`Auto-fill: ${succeeded} cards done, ${failed} failed.`)
      } else {
        toast.success("All cards auto-filled successfully.")
      }
    })
  },

  convertOutputAction: async (sourceOutputId: string, targetType: OutputType) => {
    const workspaceId = get().project.id
    const sourceOutput = get().project.outputs?.find((o) => o.id === sourceOutputId)
    if (!sourceOutput) return

    const sourceCards: Card[] = sourceOutput.cards ?? []

    toast.info(`Converting ${sourceOutput.outputType} to ${targetType}...`)
    const evId = get().pushEvent({ kind: "generate", status: "running", title: `Converting to ${targetType}`, detail: `Rewriting ${sourceCards.length} cards...` })

    // Create a new output of targetType
    get().addOutput(targetType, "")
    const newOutputId = get().project.activeOutputId
    if (!newOutputId) return

    const results = await Promise.allSettled(
      sourceCards.filter((c) => c.pattern !== "references" && c.content.trim() !== "").map(async (sourceCard, i) => {
        // Attempt to find a corresponding card in the scaffolded output
        const currentCards = get().project.cards
        const targetCard = currentCards[i]
        if (!targetCard) return

        set((s) => { s.generatingId = targetCard.id })

        try {
          const res = await apiFetch(`/api/workspaces/${workspaceId}/cards/convert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceContent: sourceCard.content,
              sourceTopic: sourceCard.title,
              sourceType: sourceOutput.outputType,
              targetType,
              bibKeys: get().bibKeys,
            })
          })

          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()

          set((s) => {
            if (s.project.id !== workspaceId || s.project.activeOutputId !== newOutputId) return
            const c = syncActiveCards(s.project).find((c) => c.id === targetCard.id)
            if (c && data.bullets) {
              c.content = Array.isArray(data.bullets) ? data.bullets.join("\n\n") : data.bullets
              c.title = data.title || targetCard.title
              s.isDirty = true
            }
          })
        } finally {
          set((s) => {
            if (s.generatingId === targetCard.id) s.generatingId = null
          })
        }
      })
    )

    const failed = results.filter((r) => r.status === "rejected").length
    const succeeded = results.length - failed

    get().updateEvent(evId, { status: "done", title: `Conversion Complete`, detail: `${succeeded} succeeded, ${failed} failed.` })
    if (failed > 0) {
      toast.warning(`Conversion: ${succeeded} cards done, ${failed} failed.`)
    } else {
      toast.success("Output successfully converted.")
    }
  },

  aiReview: async () => {
    const evId = get().pushEvent({ kind: "verify", status: "running", title: "AI Poster review" })
    try {
      const proj = get().project
      const activeOutput = proj.outputs?.find((o) => o.id === proj.activeOutputId)
      // Send only what the review route actually needs — not the entire project object
      const res = await apiFetch(`/api/workspaces/${proj.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: proj.id,
          name: proj.name,
          authors: proj.authors,
          venue: proj.venue,
          templateName: activeOutput?.templateId,
          cards: proj.cards,
          bibContent: get().bibContent,
          bibKeys: get().bibKeys,
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
    if (get().isSaving) {
      scheduleRetry()
      return
    }
    const workspaceId = get().project.id
    let conflict = false
    set((s) => { s.isSaving = true; s.isDirty = false })
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
      if (res.status === 409) {
        conflict = true
        throw new Error("This workspace changed in another session. Reload it before saving again.")
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json() as { revision?: number }
      // Ignore a completion belonging to a workspace that was switched away.
      set((s) => {
        if (s.project.id !== workspaceId) return
        if (typeof result.revision === "number") s.project.revision = result.revision
        s.isSaving = false
        s.lastSavedAt = new Date()
      })
    } catch (err: unknown) {
      // Keep the snapshot dirty so a transient failure cannot silently strand
      // user changes. The retry timer is de-duplicated by scheduleRetry.
      set((s) => {
        if (s.project.id === workspaceId) {
          s.isSaving = false
          s.isDirty = true
        }
      })
      if (conflict) {
        toast.error("Save blocked because this workspace changed elsewhere. Reload before saving again.")
      }
    } finally {
      // If an edit arrived while the save was in-flight, isDirty will be true.
      // Schedule a retry so the edit is never permanently stranded.
      if (get().isDirty && !conflict) {
        scheduleRetry()
      }
    }
  },
})
}
