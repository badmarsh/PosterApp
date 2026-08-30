/**
 * Zustand slice for thesis review state.
 *
 * Manages:
 *  - List of thesis reviews in the current workspace
 *  - Active review being edited
 *  - Generation state (loading, error)
 *  - Single-criterion re-generation
 *  - Export state
 */

import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import {
  computeOverallScore,
  scoreToEctsGrade,
  gradeToRecommendation,
  type ThesisSection,
  type ThesisMetadata,
  type ReviewLanguage,
} from "@/lib/ai/thesis-rubric"
import type {
  ReviewKind,
  ReviewFinding,
  EvidenceReference,
  ReportingStandard,
  ReportingGuidelineCheck,
} from "@/lib/ai/review-types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThesisReviewRecord {
  id: string
  studentName: string
  thesisTitle: string
  thesisType: "bachelor" | "master" | "phd"
  reviewerRole: string
  reviewerName?: string | null
  institution?: string | null
  department?: string | null
  grade?: string | null
  recommendation?: string | null
  sections: ThesisSection[]
  defenseQuestions: string[]
  questionsForAuthors?: string[]
  citationIssues: string[]
  reviewKind?: ReviewKind
  targetVenue?: string | null
  summary?: string | null
  strengths?: string[]
  findings?: ReviewFinding[]
  reportingStandard?: ReportingStandard | null
  reportingGuidelineChecks?: ReportingGuidelineCheck[]
  confidentialComments?: string | null
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
  reviewKind?: string | null
  status: string
  language: string
  createdAt: string
  updatedAt: string
}

export interface ThesisReviewGenerateOptions {
  workspaceId: string
  metadata: ThesisMetadata & {
    reviewKind?: ReviewKind
    targetVenue?: string
    reportingStandard?: ReportingStandard
  }
  focusCriteria?: string[]
  skipCitationAudit?: boolean
  professionalMode?: boolean
}

interface ThesisReviewState {
  reviews: ThesisReviewListItem[]
  activeReview: ThesisReviewRecord | null
  selectedEvidence: EvidenceReference | null
  isGenerating: boolean
  isSaving: boolean
  isExporting: boolean
  regeneratingCriterionId: string | null
  generateError: string | null
  saveError: string | null
  exportError: string | null
  isPanelOpen: boolean

  // Actions
  openPanel: () => void
  closePanel: () => void
  setActiveReview: (review: ThesisReviewRecord | null) => void
  setSelectedEvidence: (ev: EvidenceReference | null) => void
  loadReviews: (workspaceId: string) => Promise<void>
  loadReview: (workspaceId: string, reviewId: string) => Promise<void>
  generateReview: (opts: ThesisReviewGenerateOptions) => Promise<ThesisReviewRecord | null>
  regenerateCriterion: (
    workspaceId: string,
    reviewId: string,
    criterionId: string,
    userInstruction?: string
  ) => Promise<ThesisSection | null>
  updateReviewLocally: (updates: Partial<ThesisReviewRecord>) => void
  updateCriterionLocally: (criterionId: string, updates: Partial<ThesisSection>) => void
  
  // Finding Triage Actions
  acceptFinding: (findingId: string) => void
  rejectFinding: (findingId: string) => void
  editFinding: (findingId: string, updates: Partial<ReviewFinding>) => void
  addCustomFinding: (finding: Omit<ReviewFinding, "id" | "createdBy">) => void
  toggleFindingExport: (findingId: string) => void

  saveReview: (workspaceId: string, reviewId: string) => Promise<boolean>
  exportReviewPdf: (workspaceId: string, reviewId: string) => Promise<void>
  deleteReview: (workspaceId: string, reviewId: string) => Promise<boolean>
  clearErrors: () => void
  _syncReviewFromYjs: (review: ThesisReviewRecord) => void
  _removeReviewFromYjs: (reviewId: string) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useThesisReviewStore = create<ThesisReviewState>()(
  immer((set, get) => ({
    reviews: [],
    activeReview: null,
    selectedEvidence: null,
    isGenerating: false,
    isSaving: false,
    isExporting: false,
    regeneratingCriterionId: null,
    generateError: null,
    saveError: null,
    exportError: null,
    isPanelOpen: false,

    openPanel: () => set((s) => { s.isPanelOpen = true }),
    closePanel: () => set((s) => { s.isPanelOpen = false }),

    setActiveReview: (review) => set((s) => { s.activeReview = review }),
    setSelectedEvidence: (ev) => set((s) => { s.selectedEvidence = ev }),

    loadReviews: async (workspaceId) => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
          throw new Error(errData.message ?? errData.error ?? `HTTP ${res.status}`)
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

    regenerateCriterion: async (workspaceId, reviewId, criterionId, userInstruction) => {
      set((s) => {
        s.regeneratingCriterionId = criterionId
        s.generateError = null
      })
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review/${reviewId}/regenerate-criterion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ criterionId, userInstruction }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.message ?? errData.error ?? `HTTP ${res.status}`)
        }

        const data = await res.json()
        set((s) => {
          if (s.activeReview) {
            s.activeReview.sections = data.sections
            s.activeReview.grade = data.grade
            if (data.recommendation) {
              s.activeReview.recommendation = data.recommendation
            }
          }
          s.regeneratingCriterionId = null
        })
        return data.section
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Regeneration failed"
        set((s) => {
          s.regeneratingCriterionId = null
          s.generateError = msg
        })
        return null
      }
    },

    updateReviewLocally: (updates) => {
      set((s) => {
        if (s.activeReview) Object.assign(s.activeReview, updates)
      })
    },

    updateCriterionLocally: (criterionId, updates) => {
      set((s) => {
        if (!s.activeReview) return
        const idx = s.activeReview.sections.findIndex(
          (sec) => sec.criterionId === criterionId || sec.sectionId === criterionId
        )
        if (idx >= 0) {
          Object.assign(s.activeReview.sections[idx], updates)
          const newScore = computeOverallScore(s.activeReview.sections)
          if (newScore != null) {
            const newGrade = scoreToEctsGrade(newScore)
            s.activeReview.grade = newGrade
            s.activeReview.recommendation = gradeToRecommendation(newGrade, s.activeReview.language)
          }
        }
      })
    },

    acceptFinding: (findingId) => {
      set((s) => {
        if (!s.activeReview?.findings) return
        const f = s.activeReview.findings.find((item) => item.id === findingId)
        if (f) f.status = "accepted"
      })
    },

    rejectFinding: (findingId) => {
      set((s) => {
        if (!s.activeReview?.findings) return
        const f = s.activeReview.findings.find((item) => item.id === findingId)
        if (f) {
          f.status = "rejected"
          f.includeInExport = false
        }
      })
    },

    editFinding: (findingId, updates) => {
      set((s) => {
        if (!s.activeReview?.findings) return
        const f = s.activeReview.findings.find((item) => item.id === findingId)
        if (f) {
          Object.assign(f, updates)
          if (f.status === "unreviewed") f.status = "edited"
        }
      })
    },

    addCustomFinding: (finding) => {
      set((s) => {
        if (!s.activeReview) return
        if (!s.activeReview.findings) s.activeReview.findings = []
        const newFinding: ReviewFinding = {
          ...finding,
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdBy: "reviewer",
          status: "accepted",
          includeInExport: true,
        }
        s.activeReview.findings.unshift(newFinding)
      })
    },

    toggleFindingExport: (findingId) => {
      set((s) => {
        if (!s.activeReview?.findings) return
        const f = s.activeReview.findings.find((item) => item.id === findingId)
        if (f) f.includeInExport = !f.includeInExport
      })
    },

    saveReview: async (workspaceId, reviewId) => {
      const { activeReview } = get()
      if (!activeReview || activeReview.id !== reviewId) return false

      set((s) => { s.isSaving = true; s.saveError = null })
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review/${reviewId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentName: activeReview.studentName,
            thesisTitle: activeReview.thesisTitle,
            thesisType: activeReview.thesisType,
            reviewerRole: activeReview.reviewerRole,
            reviewerName: activeReview.reviewerName,
            institution: activeReview.institution,
            department: activeReview.department,
            grade: activeReview.grade,
            recommendation: activeReview.recommendation,
            sections: JSON.stringify(activeReview.sections),
            defenseQuestions: JSON.stringify(activeReview.defenseQuestions),
            citationIssues: JSON.stringify(activeReview.citationIssues),
            reviewKind: activeReview.reviewKind,
            targetVenue: activeReview.targetVenue,
            summary: activeReview.summary,
            strengths: activeReview.strengths ? JSON.stringify(activeReview.strengths) : undefined,
            findings: activeReview.findings ? JSON.stringify(activeReview.findings) : undefined,
            reportingStandard: activeReview.reportingStandard,
            reportingGuidelineChecks: activeReview.reportingGuidelineChecks ? JSON.stringify(activeReview.reportingGuidelineChecks) : undefined,
            confidentialComments: activeReview.confidentialComments,
            status: activeReview.status,
            language: activeReview.language,
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error ?? `Save failed (HTTP ${res.status})`)
        }

        set((s) => { s.isSaving = false })
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Save failed"
        console.error("[ThesisReviewStore] saveReview failed:", err)
        set((s) => { s.isSaving = false; s.saveError = msg })
        return false
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
      const prevReviews = get().reviews
      const prevActive = get().activeReview

      // Optimistic delete
      set((s) => {
        s.reviews = s.reviews.filter((r) => r.id !== reviewId)
        if (s.activeReview?.id === reviewId) s.activeReview = null
      })

      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review/${reviewId}`, { method: "DELETE" })
        if (!res.ok) {
          throw new Error(`Delete failed (HTTP ${res.status})`)
        }
        return true
      } catch (err) {
        console.error("[ThesisReviewStore] deleteReview failed:", err)
        // Rollback state on failure
        set((s) => {
          s.reviews = prevReviews
          s.activeReview = prevActive
          s.saveError = err instanceof Error ? err.message : "Delete failed"
        })
        return false
      }
    },

    clearErrors: () => set((s) => {
      s.generateError = null
      s.saveError = null
      s.exportError = null
    }),

    _syncReviewFromYjs: (incoming) => {
      set((s) => {
        if (s.activeReview && s.activeReview.id === incoming.id) {
          s.activeReview = incoming
        }
        const existingIdx = s.reviews.findIndex((r) => r.id === incoming.id)
        const summaryItem: ThesisReviewListItem = {
          id: incoming.id,
          studentName: incoming.studentName,
          thesisTitle: incoming.thesisTitle,
          thesisType: incoming.thesisType,
          reviewerRole: incoming.reviewerRole,
          reviewerName: incoming.reviewerName,
          grade: incoming.grade,
          recommendation: incoming.recommendation,
          status: incoming.status,
          language: incoming.language,
          createdAt: incoming.createdAt,
          updatedAt: incoming.updatedAt,
        }
        if (existingIdx >= 0) {
          s.reviews[existingIdx] = summaryItem
        } else {
          s.reviews.unshift(summaryItem)
        }
      })
    },

    _removeReviewFromYjs: (reviewId) => {
      set((s) => {
        s.reviews = s.reviews.filter((r) => r.id !== reviewId)
        if (s.activeReview?.id === reviewId) {
          s.activeReview = null
        }
      })
    },
  }))
)

if (typeof window !== "undefined") {
  ;(window as any).__thesisReviewStore = useThesisReviewStore
}


