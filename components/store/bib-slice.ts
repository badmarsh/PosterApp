import { toast } from "sonner"
import type { EditorSlice, BibSlice } from "./types"
import { apiFetch } from "@/lib/api-fetch"

export const createBibSlice: EditorSlice<BibSlice> = (set) => ({
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
    } catch (err) {
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
      toast.error("Failed to save bibliography")
    }
  },
})
