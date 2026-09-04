import type { EditorSlice, EquationSlice } from "./types"
import { apiFetch } from "@/lib/api-fetch"
import { notify } from "@/lib/notify"
import { formatEquationForInsertion, cleanFormula, type EquationItem } from "@/lib/equation-types"
import { SAMPLE_EQUATIONS } from "@/lib/sample-data"

export const createEquationSlice: EditorSlice<EquationSlice> = (set, get) => ({
  equations: SAMPLE_EQUATIONS || [],
  isEquationLibraryOpen: false,

  setIsEquationLibraryOpen: (open) => {
    set((s) => {
      s.isEquationLibraryOpen = open
    })
  },

  fetchEquations: async (projectId) => {
    try {
      const res = await apiFetch(`/api/workspaces/${projectId}/equations`)
      if (res.ok) {
        const data = await res.json()
        set((s) => {
          s.equations = (data.equations && data.equations.length > 0) ? data.equations : SAMPLE_EQUATIONS || []
        })
      } else {
        set((s) => {
          s.equations = SAMPLE_EQUATIONS || []
        })
      }
    } catch {
      set((s) => {
        s.equations = SAMPLE_EQUATIONS || []
      })
    }
  },

  addEquation: async (eq) => {
    const projectId = get().project.id
    try {
      const res = await apiFetch(`/api/workspaces/${projectId}/equations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eq),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.equation) {
          set((s) => {
            const idx = s.equations.findIndex((e) => e.id === data.equation.id)
            if (idx >= 0) {
              s.equations[idx] = data.equation
            } else {
              s.equations.push(data.equation)
            }
          })
          get().pushEvent({
            kind: "info",
            status: "done",
            title: "Equation Added",
            detail: `Added ${data.equation.key} to Equation Library`,
          })
        }
      }
    } catch (err) {
      get().pushEvent({
        kind: "info",
        status: "error",
        title: "Failed to Add Equation",
        detail: err instanceof Error ? err.message : String(err),
      })
      notify.error("Equation add failed", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  },

  updateEquation: async (id, updates) => {
    const projectId = get().project.id
    set((s) => {
      const eq = s.equations.find((e) => e.id === id)
      if (eq) {
        Object.assign(eq, updates)
      }
    })

    try {
      const res = await apiFetch(`/api/workspaces/${projectId}/equations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.equation) {
          set((s) => {
            const idx = s.equations.findIndex((e) => e.id === id)
            if (idx >= 0) s.equations[idx] = data.equation
          })
        }
      }
    } catch (err) {
      get().pushEvent({
        kind: "info",
        status: "error",
        title: "Failed to Update Equation",
        detail: err instanceof Error ? err.message : String(err),
      })
      notify.error("Equation update failed", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  },

  deleteEquation: async (id) => {
    const projectId = get().project.id
    set((s) => {
      s.equations = s.equations.filter((e) => e.id !== id)
    })

    try {
      await apiFetch(`/api/workspaces/${projectId}/equations?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
    } catch (err) {
      get().pushEvent({
        kind: "info",
        status: "error",
        title: "Failed to Delete Equation",
        detail: err instanceof Error ? err.message : String(err),
      })
      notify.error("Equation delete failed", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  },

  insertEquation: (eqIdOrFormula, cardId, format = "display") => {
    const eq = get().equations.find((e) => e.id === eqIdOrFormula || e.key === eqIdOrFormula)
    const formula = eq ? eq.formula : cleanFormula(eqIdOrFormula)
    const key = eq?.key

    set((s) => {
      const output = s.project.outputs.find((o) => o.id === s.project.activeOutputId)
      const card = output?.cards.find((c) => c.id === cardId)
      if (!card) return

      const formatted = formatEquationForInsertion(formula, format)
      if (card.content.trim()) {
        card.content = `${card.content.trimEnd()}\n\n${formatted}`
      } else {
        card.content = formatted
      }
    })

    get().pushEvent({
      kind: "info",
      status: "done",
      title: "Equation Inserted",
      detail: key ? `Inserted ${key} into card` : "Equation inserted into card",
    })
  },
})
