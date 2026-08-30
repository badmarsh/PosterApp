/**
 * Zustand slice for thesis review state.
 *
 * Manages:
 *  - List of thesis reviews in the current workspace
 *  - Active review being edited
 *  - Generation state (loading, error)
 *  - Export state
 */

import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { ThesisSection, ThesisMetadata, ReviewLanguage } from "@/lib/ai/thesis-rubric"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThesisReviewRecord {
  id: string
  studentName: string
  thesisTitle: string
  thesisType: "bachelor" | "master" | "phd"
  reviewerRole: "supervisor" | "opponent"
  reviewerName?: string | null
  institution?: string | null
  department?: string | null
  grade?: string | null
  recommendation?: string | null
  sections: ThesisSection[]
  defenseQuestions: string[]
  citationIssues: string[]
  status: "draft" | "final"
  language: ReviewLanguage
  createdAt: string
  updatedAt: string
}

export interface ThesisReviewListItem {
  id: string
  studentName: string
  thesisTitle: string
  thesisType: string
  reviewerRole: string
  reviewerName?: string | null
  grade?: string | null
  recommendation?: string | null
  status: string
  language: string
  createdAt: string
  updatedAt: string
}

export interface ThesisReviewGenerateOptions {
  workspaceId: string
  metadata: ThesisMetadata
  focusCriteria?: string[]
  skipCitationAudit?: boolean
}

interface ThesisReviewState {
  reviews: ThesisReviewListItem[]
  activeReview: ThesisReviewRecord | null
  isGenerating: boolean
  isExporting: boolean
  generateError: string | null
  exportError: string | null
  isPanelOpen: boolean

  // Actions
  openPanel: () => void
  closePanel: () => void
  setActiveReview: (review: ThesisReviewRecord | null) => void
  loadReviews: (workspaceId: string) => Promise<void>
  loadReview: (workspaceId: string, reviewId: string) => Promise<void>
  generateReview: (opts: ThesisReviewGenerateOptions) => Promise<ThesisReviewRecord | null>
  updateReviewLocally: (updates: Partial<ThesisReviewRecord>) => void
  saveReview: (workspaceId: string, reviewId: string) => Promise<void>
  exportReviewPdf: (workspaceId: string, reviewId: string) => Promise<void>
  deleteReview: (workspaceId: string, reviewId: string) => Promise<void>
  clearErrors: () => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useThesisReviewStore = create<ThesisReviewState>()(
  immer((set, get) => ({
    reviews: [],
    activeReview: null,
    isGenerating: false,
    isExporting: false,
    generateError: null,
    exportError: null,
    isPanelOpen: false,

    openPanel: () => set((s) => { s.isPanelOpen = true }),
    closePanel: () => set((s) => { s.isPanelOpen = false }),

    setActiveReview: (review) => set((s) => { s.activeReview = review }),

    loadReviews: async (workspaceId) => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review`)
        if (!res.ok) throw new Error("Failed to load reviews")
        const data = await res.json()
        set((s) => { s.reviews = data.reviews ?? [] })
      } catch (err) {
        console.error("[ThesisReviewStore] loadReviews failed:", err)
      }
    },

    loadReview: async (workspaceId, reviewId) => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review/${reviewId}`)
        if (!res.ok) throw new Error("Review not found")
        const review = await res.json()
        set((s) => { s.activeReview = review })
      } catch (err) {
        console.error("[ThesisReviewStore] loadReview failed:", err)
      }
    },

    generateReview: async (opts) => {
      set((s) => { s.isGenerating = true; s.generateError = null })
      try {
        const res = await fetch(`/api/workspaces/${opts.workspaceId}/thesis-review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            thesisMetadata: opts.metadata,
            focusCriteria: opts.focusCriteria,
            skipCitationAudit: opts.skipCitationAudit ?? false,
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error ?? `HTTP ${res.status}`)
        }

        const data = await res.json()
        const newReview: ThesisReviewRecord = {
          id: data.id,
          studentName: opts.metadata.studentName,
          thesisTitle: opts.metadata.thesisTitle,
          thesisType: opts.metadata.thesisType,
          reviewerRole: opts.metadata.reviewerRole,
          reviewerName: opts.metadata.reviewerName,
          institution: opts.metadata.institution,
          department: opts.metadata.department,
          grade: data.overallGrade ?? null,
          recommendation: data.recommendation ?? null,
          sections: data.sections ?? [],
          defenseQuestions: data.defenseQuestions ?? [],
          citationIssues: data.citationIssues ?? [],
          status: "draft",
          language: opts.metadata.language,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        set((s) => {
          s.activeReview = newReview
          s.isGenerating = false
        })

        // Refresh list
        await get().loadReviews(opts.workspaceId)
        return newReview
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Generation failed"
        set((s) => { s.isGenerating = false; s.generateError = msg })
        return null
      }
    },

    updateReviewLocally: (updates) => {
      set((s) => {
        if (s.activeReview) Object.assign(s.activeReview, updates)
      })
    },

    saveReview: async (workspaceId, reviewId) => {
      const { activeReview } = get()
      if (!activeReview || activeReview.id !== reviewId) return

      try {
        await fetch(`/api/workspaces/${workspaceId}/thesis-review/${reviewId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grade: activeReview.grade,
            recommendation: activeReview.recommendation,
            sections: JSON.stringify(activeReview.sections),
            defenseQuestions: JSON.stringify(activeReview.defenseQuestions),
            citationIssues: JSON.stringify(activeReview.citationIssues),
            status: activeReview.status,
          }),
        })
      } catch (err) {
        console.error("[ThesisReviewStore] saveReview failed:", err)
      }
    },

    exportReviewPdf: async (workspaceId, reviewId) => {
      set((s) => { s.isExporting = true; s.exportError = null })
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review/${reviewId}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error ?? `HTTP ${res.status}`)
        }

        // Trigger browser download
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        const { activeReview } = get()
        a.href = url
        a.download = `posudok-${activeReview?.studentName?.replace(/\s+/g, "-") ?? reviewId}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        set((s) => { s.isExporting = false })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Export failed"
        set((s) => { s.isExporting = false; s.exportError = msg })
      }
    },

    deleteReview: async (workspaceId, reviewId) => {
      try {
        await fetch(`/api/workspaces/${workspaceId}/thesis-review/${reviewId}`, { method: "DELETE" })
        set((s) => {
          s.reviews = s.reviews.filter((r) => r.id !== reviewId)
          if (s.activeReview?.id === reviewId) s.activeReview = null
        })
      } catch (err) {
        console.error("[ThesisReviewStore] deleteReview failed:", err)
      }
    },

    clearErrors: () => set((s) => { s.generateError = null; s.exportError = null }),
  }))
)
