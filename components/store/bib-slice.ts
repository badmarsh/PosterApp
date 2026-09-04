import type { EditorSlice, BibSlice } from "./types"
import { apiFetch } from "@/lib/api-fetch"
import { notify } from "@/lib/notify"
import { parseBibEntries, formatBibEntry, type BibEntry } from "@/lib/bib-types"
import { parseBibKeys } from "@/lib/bib-parser"
import { suggestCitationsForText } from "@/lib/services/citation-suggester"

export const createBibSlice: EditorSlice<BibSlice> = (set, get) => ({
  bibContent: "",
  bibKeys: [],
  bibEntries: [],
  isBibManagerOpen: false,

  setIsBibManagerOpen: (open) => set({ isBibManagerOpen: open }),

  fetchBib: async (projectId) => {
    try {
      const res = await apiFetch(`/api/workspaces/${projectId}/bib`)
      if (res.ok) {
        const data = await res.json()
        const content = data.bib ?? ""
        const parsed = parseBibEntries(content)
        set((s) => {
          s.bibContent = content
          s.bibKeys = data.keys ?? parseBibKeys(content)
          s.bibEntries = parsed
        })
      } else {
        set((s) => {
          s.bibContent = ""
          s.bibKeys = []
          s.bibEntries = []
        })
      }
    } catch {
      set((s) => {
        s.bibContent = ""
        s.bibKeys = []
        s.bibEntries = []
      })
    }
  },

  updateBib: async (projectId, bib) => {
    const keys = parseBibKeys(bib)
    const entries = parseBibEntries(bib)

    set((s) => {
      s.bibContent = bib
      s.bibKeys = keys
      s.bibEntries = entries
    })

    try {
      const res = await apiFetch(`/api/workspaces/${projectId}/bib`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bib }),
      })
      if (res.ok) {
        const data = await res.json()
        set((s) => {
          s.bibKeys = data.keys ?? keys
        })
      }
    } catch (err) {
      get().pushEvent({
        kind: "info",
        status: "error",
        title: "Bibliography Save Failed",
        detail: err instanceof Error ? err.message : String(err),
      })
      notify.error("Bibliography save failed", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  },

  addBibEntry: async (entry) => {
    const current = get().bibContent
    const existingEntries = get().bibEntries || parseBibEntries(current)

    // Prevent duplicate entry by key or normalized title
    const normalizedNewTitle = (entry.title || "").toLowerCase().replace(/[^a-z0-9]/g, "")
    const duplicate = existingEntries.find((e) => {
      if (entry.key && e.key.toLowerCase() === entry.key.toLowerCase()) return true
      if (normalizedNewTitle && (e.title || "").toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedNewTitle) return true
      return false
    })

    if (duplicate) {
      get().pushEvent({
        kind: "info",
        status: "done",
        title: "Citation Already Present",
        detail: `@${duplicate.type || "article"}{${duplicate.key}} is already in your bibliography`,
      })
      return
    }

    const formatted = formatBibEntry(entry)
    const updated = current.trim() ? `${current.trim()}\n\n${formatted}` : formatted
    await get().updateBib(get().project.id, updated)

    get().pushEvent({
      kind: "info",
      status: "done",
      title: "Citation Added",
      detail: `@${entry.type || "article"}{${entry.key || "ref"}} added to bibliography`,
    })
  },

  updateBibEntry: async (oldKey, entry) => {
    const current = get().bibContent
    const entries = parseBibEntries(current)
    const existing = entries.find((e) => e.key === oldKey)

    if (!existing) {
      await get().addBibEntry(entry)
      return
    }

    const merged = { ...existing, ...entry }
    const newFormatted = formatBibEntry(merged)

    // Replace old entry block in raw bib
    const regex = new RegExp(`@\\w+\\s*\\{\\s*${oldKey}\\s*,[\\s\\S]*?\\n\\}`, "g")
    let updated = current.replace(regex, newFormatted)
    if (updated === current) {
      // If regex didn't match exact format, rebuild from entries array
      updated = entries.map((e) => (e.key === oldKey ? newFormatted : e.rawBibtex)).join("\n\n")
    }

    await get().updateBib(get().project.id, updated)
  },

  deleteBibEntry: async (key) => {
    const current = get().bibContent
    const regex = new RegExp(`@\\w+\\s*\\{\\s*${key}\\s*,[\\s\\S]*?\\n\\}`, "g")
    let updated = current.replace(regex, "").replace(/\n{3,}/g, "\n\n").trim()

    if (updated === current) {
      const entries = parseBibEntries(current)
      updated = entries
        .filter((e) => e.key !== key)
        .map((e) => e.rawBibtex)
        .join("\n\n")
    }

    await get().updateBib(get().project.id, updated)
    get().pushEvent({
      kind: "info",
      status: "done",
      title: "Citation Deleted",
      detail: `Removed citation ${key}`,
    })
  },

  insertCitation: (key, cardId) => {
    set((s) => {
      const output = s.project.outputs.find((o) => o.id === s.project.activeOutputId)
      const card = output?.cards.find((c) => c.id === cardId)
      if (!card) return
      const cite = `\\cite{${key}}`
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
      detail: `\\cite{${key}} added to card`,
    })
  },

  lookupCitation: async (query) => {
    const projectId = get().project.id
    try {
      const res = await apiFetch(`/api/workspaces/${projectId}/bib/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) throw new Error("Lookup failed")
      const data = await res.json()
      return data.entry || null
    } catch {
      return null
    }
  },

  suggestCitationsForCard: async (cardContent, cardTitle) => {
    const entries = get().bibEntries
    if (!entries || entries.length === 0) return []

    // 1. Fast local deterministic suggestions
    const fastSuggestions = suggestCitationsForText(cardContent, entries)

    // 2. Optionally query backend for semantic enhancement
    try {
      const projectId = get().project.id
      const res = await apiFetch(`/api/workspaces/${projectId}/bib/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardContent, cardTitle }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.suggestions && data.suggestions.length > 0) {
          return data.suggestions
        }
      }
    } catch {
      // fallback to fastSuggestions
    }

    return fastSuggestions
  },
})
