import type { EditorSlice, BibSlice } from "./types"
import { apiFetch } from "@/lib/api-fetch"

export const createBibSlice: EditorSlice<BibSlice> = (set, get) => ({
  bibContent: "",
  bibKeys: [],

  fetchBib: async (projectId) => {
    try {
      const res = await apiFetch(`/api/workspaces/${projectId}/bib`)
      if (res.ok) {
        const data = await res.json()
        set((s) => {
          s.bibContent = data.bib ?? ""
          s.bibKeys = data.keys ?? []
        })
      } else {
        set((s) => { s.bibContent = ""; s.bibKeys = [] })
      }
    } catch {
      set((s) => { s.bibContent = ""; s.bibKeys = [] })
    }
  },

  updateBib: async (projectId, bib) => {
    set((s) => { s.bibContent = bib })
    try {
      const res = await apiFetch(`/api/workspaces/${projectId}/bib`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bib })
      })
      if (res.ok) {
        const data = await res.json()
        set((s) => { s.bibKeys = data.keys ?? [] })
      }
    } catch (err) {
      get().pushEvent({
        kind: "info",
        status: "error",
        title: "Bibliography Save Failed",
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  },

  insertCitation: (key, cardId) => {
    set((s) => {
      const output = s.project.outputs.find((o) => o.id === s.project.activeOutputId)
      const card = output?.cards.find((c) => c.id === cardId)
      if (!card) return
      const cite = `\\cite{${key}}`
      // Append citation to end of content (inline, or on a new bullets line)
      if (card.content.trim()) {
        card.content = card.content.trimEnd() + " " + cite
      } else {
        card.content = cite
      }
    })
    get().pushEvent({
      kind: "info",
      status: "done",
      title: "Citation inserted",
      detail: `\\cite{${key}} added to card ${cardId}`,
    })
  },
})
