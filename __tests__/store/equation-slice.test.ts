import { describe, it, expect, vi, beforeEach } from "vitest"
import { createEditorStore } from "@/components/editor-store"
import type { EquationItem } from "@/lib/equation-types"

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from "@/lib/api-fetch"
const mockApiFetch = vi.mocked(apiFetch)

describe("equation-slice", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("initializes with 5 sample equations and library closed", () => {
    const store = createEditorStore()
    expect(store.getState().equations.length).toBe(5)
    expect(store.getState().isEquationLibraryOpen).toBe(false)
  })

  it("setIsEquationLibraryOpen toggles modal state", () => {
    const store = createEditorStore()
    store.getState().setIsEquationLibraryOpen(true)
    expect(store.getState().isEquationLibraryOpen).toBe(true)
    store.getState().setIsEquationLibraryOpen(false)
    expect(store.getState().isEquationLibraryOpen).toBe(false)
  })

  it("fetchEquations populates equations on success", async () => {
    const store = createEditorStore()
    const mockEquations: EquationItem[] = [
      {
        id: "eq-1",
        key: "eq:gain_variance",
        formula: "\\Delta \\beta = k \\Phi_n",
        name: "Relative Gain Variance",
        workspaceId: "ws-1",
      },
    ]

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ equations: mockEquations }),
    } as Response)

    await store.getState().fetchEquations("ws-1")

    expect(mockApiFetch).toHaveBeenCalledWith("/api/workspaces/ws-1/equations")
    expect(store.getState().equations).toEqual(mockEquations)
  })

  it("fetchEquations falls back to sample equations on failure or network error", async () => {
    const store = createEditorStore()

    mockApiFetch.mockRejectedValueOnce(new Error("Network offline"))
    await store.getState().fetchEquations("ws-1")

    expect(store.getState().equations.length).toBe(5)
  })

  it("addEquation appends equation to store and calls API", async () => {
    const store = createEditorStore()
    const newEq = {
      key: "eq:bragg_peak",
      name: "Bragg Peak Formulation",
      formula: "-\\frac{dE}{dx} = \\frac{4\\pi n z^2 e^4}{m_e v^2}",
    }

    const createdEq: EquationItem = {
      id: "eq-new-123",
      workspaceId: store.getState().project.id,
      ...newEq,
    }

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, equation: createdEq }),
    } as Response)

    await store.getState().addEquation(newEq)

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/workspaces/${store.getState().project.id}/equations`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(newEq),
      })
    )
    expect(store.getState().equations).toContainEqual(createdEq)
  })

  it("updateEquation modifies local state and syncs to API", async () => {
    const store = createEditorStore()
    const existingEq: EquationItem = {
      id: "eq-existing",
      key: "eq:old_key",
      name: "Old Name",
      formula: "E = mc^2",
      workspaceId: store.getState().project.id,
    }

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ equations: [existingEq] }),
    } as Response)
    await store.getState().fetchEquations(store.getState().project.id)

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        equation: { ...existingEq, key: "eq:einstein_energy", name: "Mass-Energy Equivalence" },
      }),
    } as Response)

    await store.getState().updateEquation("eq-existing", {
      key: "eq:einstein_energy",
      name: "Mass-Energy Equivalence",
    })

    const found = store.getState().equations.find((e) => e.id === "eq-existing")
    expect(found?.key).toBe("eq:einstein_energy")
    expect(found?.name).toBe("Mass-Energy Equivalence")
  })

  it("deleteEquation removes equation from state and calls DELETE", async () => {
    const store = createEditorStore()
    const eqItem: EquationItem = {
      id: "eq-to-delete",
      key: "eq:temp",
      name: "Temporary Eq",
      formula: "x = 1",
      workspaceId: store.getState().project.id,
    }

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ equations: [eqItem] }),
    } as Response)
    await store.getState().fetchEquations(store.getState().project.id)
    expect(store.getState().equations.length).toBe(1)

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)

    await store.getState().deleteEquation("eq-to-delete")

    expect(store.getState().equations.length).toBe(0)
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/workspaces/${store.getState().project.id}/equations?id=eq-to-delete`,
      { method: "DELETE" }
    )
  })

  it("insertEquation appends formatted LaTeX equation into the target card", () => {
    const store = createEditorStore()
    const activeOutput = store.getState().project.outputs?.find(
      (o) => o.id === store.getState().project.activeOutputId
    )
    const firstCard = activeOutput?.cards[0]
    expect(firstCard).toBeDefined()

    const formula = "I_C = I_S e^{\\frac{V_{BE}}{V_T}}"
    store.getState().insertEquation(formula, firstCard!.id, "display")

    const updatedCard = store.getState().project.outputs
      ?.find((o) => o.id === store.getState().project.activeOutputId)
      ?.cards.find((c) => c.id === firstCard!.id)

    expect(updatedCard?.content).toContain("$$\nI_C = I_S e^{\\frac{V_{BE}}{V_T}}\n$$")
  })
})
