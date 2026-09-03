import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  useThesisReviewStore,
  getThesisReviewStore,
  clearThesisReviewStoreRegistry,
  getWorkspaceSharedThesis,
  type ThesisReviewRecord,
} from "@/components/thesis-review/use-thesis-review-store"

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

  it("prioritizes opts.professionalMode when professionalModeOverride is false", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "rev-2", sections: [], defenseQuestions: [], citationIssues: [] }), { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)
    useThesisReviewStore.getState().setProfessionalModeOverride(false)

    await useThesisReviewStore.getState().generateReview({
      workspaceId: "ws-1",
      metadata: {
        studentName: "Ján Novák",
        thesisTitle: "Test thesis",
        thesisType: "master",
        reviewerRole: "opponent",
        language: "sk",
      },
      professionalMode: true,
    })

    const reviewRequest = fetchMock.mock.calls.find(([url, options]) =>
      String(url).endsWith("/thesis-review") && options?.method === "POST"
    )
    const requestBody = JSON.parse(reviewRequest?.[1].body)
    expect(requestBody.professionalMode).toBe(true)
  })

  it("cleans up stale 404 review from reviews list during loadReview without throwing", async () => {
    const existingReviews = [
      { id: "rev-1", studentName: "A", thesisTitle: "T1", thesisType: "master", reviewerRole: "opponent", status: "draft", language: "sk", createdAt: "", updatedAt: "" },
      { id: "rev-2", studentName: "B", thesisTitle: "T2", thesisType: "bachelor", reviewerRole: "supervisor", status: "draft", language: "sk", createdAt: "", updatedAt: "" },
    ]
    useThesisReviewStore.setState({
      reviews: existingReviews as any,
      activeReview: { id: "rev-1" } as any,
    })

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/thesis-review/rev-1")) {
        return Promise.resolve(new Response(JSON.stringify({ error: "Not found" }), { status: 404 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ fullText: "" }), { status: 200 }))
    })
    vi.stubGlobal("fetch", fetchMock)

    await useThesisReviewStore.getState().loadReview("ws-1", "rev-1")

    const state = useThesisReviewStore.getState()
    expect(state.reviews.map((r) => r.id)).toEqual(["rev-2"])
    expect(state.activeReview).toBeNull()
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

describe("Shared Thesis Context & Multi-Tab Isolation", () => {
  beforeEach(() => {
    clearThesisReviewStoreRegistry()
  })

  it("defaults Tab 1 to supervisor role and Tab 2 to opponent role", () => {
    const store1 = getThesisReviewStore("ws-test-1:out-1")
    expect(store1.getState().formMetadata.reviewerRole).toBe("supervisor")

    const store2 = getThesisReviewStore("ws-test-1:out-2")
    expect(store2.getState().formMetadata.reviewerRole).toBe("opponent")
  })

  it("inherits shared thesis metadata from Tab 1 into newly created Tab 2", () => {
    const store1 = getThesisReviewStore("ws-test-2:out-1")
    store1.getState().updateFormMetadata({
      studentName: "Ján Novák",
      thesisTitle: "Neurónové siete pre fyziku",
      thesisType: "master",
      institution: "STU Bratislava",
      department: "FIIT",
      academicYear: "2025/2026",
    })

    const store2 = getThesisReviewStore("ws-test-2:out-2")
    const meta2 = store2.getState().formMetadata

    expect(meta2.studentName).toBe("Ján Novák")
    expect(meta2.thesisTitle).toBe("Neurónové siete pre fyziku")
    expect(meta2.thesisType).toBe("master")
    expect(meta2.institution).toBe("STU Bratislava")
    expect(meta2.department).toBe("FIIT")
    expect(meta2.academicYear).toBe("2025/2026")
    // reviewerName must be independent and blank
    expect(meta2.reviewerName).toBe("")
    expect(meta2.reviewerRole).toBe("opponent")
  })

  it("synchronizes shared fields across existing tabs when updated in any tab", () => {
    const store1 = getThesisReviewStore("ws-test-3:out-1")
    const store2 = getThesisReviewStore("ws-test-3:out-2")

    store1.getState().updateFormMetadata({
      studentName: "Marek Kováč",
      thesisTitle: "Pôvodný názov",
    })

    expect(store2.getState().formMetadata.studentName).toBe("Marek Kováč")
    expect(store2.getState().formMetadata.thesisTitle).toBe("Pôvodný názov")

    // Update thesisTitle from Tab 2
    store2.getState().updateFormMetadata({
      thesisTitle: "Aktualizovaný spoločný názov práce",
    })

    expect(store1.getState().formMetadata.thesisTitle).toBe("Aktualizovaný spoločný názov práce")
    expect(getWorkspaceSharedThesis("ws-test-3")?.thesisTitle).toBe("Aktualizovaný spoločný názov práce")
  })

  it("keeps reviewer-specific fields strictly isolated between tabs", () => {
    const store1 = getThesisReviewStore("ws-test-4:out-1")
    const store2 = getThesisReviewStore("ws-test-4:out-2")

    store1.getState().updateFormMetadata({
      studentName: "Ján Novák",
      thesisTitle: "Diplomovka",
      reviewerName: "prof. RNDr. Peter Varga, DrSc.",
    })

    store2.getState().updateFormMetadata({
      reviewerName: "doc. Ing. Elena Horváthová, PhD.",
    })

    expect(store1.getState().formMetadata.reviewerName).toBe("prof. RNDr. Peter Varga, DrSc.")
    expect(store2.getState().formMetadata.reviewerName).toBe("doc. Ing. Elena Horváthová, PhD.")

    // Independent activeReview
    store2.getState().setActiveReview({
      id: "rev-tab2",
      studentName: "Ján Novák",
      thesisTitle: "Diplomovka",
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
    })

    expect(store1.getState().activeReview).toBeNull()
    expect(store2.getState().activeReview?.id).toBe("rev-tab2")
    expect(store2.getState().activeReview?.grade).toBe("B")
  })
})

