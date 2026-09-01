import { describe, it, expect, vi, beforeEach } from "vitest"
import { useThesisReviewStore, type ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"

describe("Thesis Review Store State & Error Handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useThesisReviewStore.setState({
      reviews: [],
      activeReview: null,
      isGenerating: false,
      isSaving: false,
      isExporting: false,
      regeneratingCriterionId: null,
      generateError: null,
      saveError: null,
      exportError: null,
      isPanelOpen: false,
    })
  })

  it("updates criterion locally and recalculates overall score, grade, and recommendation", () => {
    const initialReview: ThesisReviewRecord = {
      id: "rev-1",
      studentName: "Ján Novák",
      thesisTitle: "Neurónové siete",
      thesisType: "master",
      reviewerRole: "opponent",
      grade: "A",
      recommendation: "Prácu odporúčam na obhajobu.",
      sections: [
        { id: "s1", sectionId: "goal_definition", criterionId: "goal_definition", text: "Výborné ciele", rating: "A", numericScore: 100 },
        { id: "s2", sectionId: "methodology", criterionId: "methodology", text: "Výborná metodika", rating: "A", numericScore: 100 },
      ],
      defenseQuestions: [],
      citationIssues: [],
      status: "draft",
      language: "sk",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    useThesisReviewStore.setState({ activeReview: initialReview })

    // Change methodology from A (100) to FX (0)
    useThesisReviewStore.getState().updateCriterionLocally("methodology", {
      rating: "FX",
      numericScore: 0,
    })

    const updated = useThesisReviewStore.getState().activeReview
    expect(updated?.sections.find((s) => s.criterionId === "methodology")?.rating).toBe("FX")
    // Goal (weight 15, score 100) + Methodology (weight 20, score 0) -> (1500 + 0) / 35 = 42.8 -> FX
    expect(updated?.grade).toBe("FX")
    expect(updated?.recommendation).toContain("neodporúčam")
  })

  it("sends the explicit professional-mode override when generating a review", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "rev-1", sections: [], defenseQuestions: [], citationIssues: [] }), { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)
    useThesisReviewStore.getState().setProfessionalModeOverride(true)

    await useThesisReviewStore.getState().generateReview({
      workspaceId: "ws-1",
      metadata: {
        studentName: "Ján Novák",
        thesisTitle: "Test thesis",
        thesisType: "master",
        reviewerRole: "opponent",
        language: "sk",
      },
    })

    const reviewRequest = fetchMock.mock.calls.find(([url, options]) =>
      String(url).endsWith("/thesis-review") && options?.method === "POST"
    )
    const requestBody = JSON.parse(reviewRequest?.[1].body)
    expect(requestBody.professionalMode).toBe(true)
  })

  it("handles delete failure by rolling back optimistic removal and recording error", async () => {
    const existingReviews = [
      { id: "rev-1", studentName: "A", thesisTitle: "T1", thesisType: "master", reviewerRole: "opponent", status: "draft", language: "sk", createdAt: "", updatedAt: "" },
      { id: "rev-2", studentName: "B", thesisTitle: "T2", thesisType: "bachelor", reviewerRole: "supervisor", status: "draft", language: "sk", createdAt: "", updatedAt: "" },
    ]

    useThesisReviewStore.setState({
      reviews: existingReviews,
      activeReview: { id: "rev-1" } as any,
    })

    // Mock fetch failure
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 }))
    )

    const success = await useThesisReviewStore.getState().deleteReview("ws-1", "rev-1")
    expect(success).toBe(false)

    // Verify rollback
    const store = useThesisReviewStore.getState()
    expect(store.reviews).toHaveLength(2)
    expect(store.activeReview?.id).toBe("rev-1")
    expect(store.saveError).toContain("Delete failed")
  })

  it("records save error when PUT returns non-200 HTTP response", async () => {
    const activeReview: ThesisReviewRecord = {
      id: "rev-1",
      studentName: "Ján Novák",
      thesisTitle: "Neurónové siete",
      thesisType: "master",
      reviewerRole: "opponent",
      sections: [],
      defenseQuestions: [],
      citationIssues: [],
      status: "draft",
      language: "sk",
      createdAt: "",
      updatedAt: "",
    }

    useThesisReviewStore.setState({ activeReview })

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Access Denied" }), { status: 403 })
      )
    )

    const success = await useThesisReviewStore.getState().saveReview("ws-1", "rev-1")
    expect(success).toBe(false)
    expect(useThesisReviewStore.getState().saveError).toBe("Access Denied")
  })

  it("syncs incoming review updates from Yjs into activeReview and review list", () => {
    const activeReview: ThesisReviewRecord = {
      id: "rev-1",
      studentName: "Ján Novák",
      thesisTitle: "Neurónové siete",
      thesisType: "master",
      reviewerRole: "opponent",
      grade: "B",
      recommendation: "Odporúčam",
      sections: [],
      defenseQuestions: [],
      citationIssues: [],
      status: "draft",
      language: "sk",
      createdAt: "",
      updatedAt: "",
    }

    useThesisReviewStore.setState({
      activeReview,
      reviews: [{ id: "rev-1", studentName: "Ján Novák", thesisTitle: "Neurónové siete", thesisType: "master", reviewerRole: "opponent", grade: "B", status: "draft", language: "sk", createdAt: "", updatedAt: "" }],
    })

    const updatedRemote: ThesisReviewRecord = {
      ...activeReview,
      grade: "A",
      recommendation: "Výborne obhájené",
      sections: [{ id: "s1", sectionId: "goal_definition", criterionId: "goal_definition", text: "Skvelé", rating: "A", numericScore: 95 }],
    }

    useThesisReviewStore.getState()._syncReviewFromYjs(updatedRemote)

    const state = useThesisReviewStore.getState()
    expect(state.activeReview?.grade).toBe("A")
    expect(state.activeReview?.recommendation).toBe("Výborne obhájené")
    expect(state.reviews[0].grade).toBe("A")
  })

  it("removes deleted review when notified by Yjs", () => {
    useThesisReviewStore.setState({
      activeReview: { id: "rev-1" } as any,
      reviews: [
        { id: "rev-1", studentName: "A", thesisTitle: "T1", thesisType: "master", reviewerRole: "opponent", status: "draft", language: "sk", createdAt: "", updatedAt: "" },
        { id: "rev-2", studentName: "B", thesisTitle: "T2", thesisType: "master", reviewerRole: "supervisor", status: "draft", language: "sk", createdAt: "", updatedAt: "" },
      ],
    })

    useThesisReviewStore.getState()._removeReviewFromYjs("rev-1")

    const state = useThesisReviewStore.getState()
    expect(state.activeReview).toBeNull()
    expect(state.reviews).toHaveLength(1)
    expect(state.reviews[0].id).toBe("rev-2")
  })
})
