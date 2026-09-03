/**
 * Zustand slice for thesis review state.
 *
 * Manages:
 *  - List of thesis reviews in the current workspace
 *  - Active review being edited
 *  - Full parsed manuscript source text for live Evidence Split-View
 *  - Generation state (loading, error)
 *  - Single-criterion re-generation
 *  - Finding triage and human-in-the-loop decision confirmation
 *  - Export state
 */

import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { getSettingsStore } from "@/lib/settings-store"
import {
  computeOverallScore,
  scoreToEctsGrade,
  gradeToRecommendation,
  type ThesisSection,
  type ThesisMetadata,
  type ReviewLanguage,
  type ThesisType,
  type ReviewerRole,
} from "@/lib/ai/thesis-rubric"
import type {
  ReviewKind,
  ReviewFinding,
  EvidenceReference,
  ReportingStandard,
  ReportingGuidelineCheck,
  ReviewDiagnostics,
  ReviewAnalysisPlan,
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
  suggestedGrade?: string | null
  finalGrade?: string | null
  recommendation?: string | null
  suggestedRecommendation?: string | null
  finalRecommendation?: string | null
  sections: ThesisSection[]
  defenseQuestions: string[]
  questionsForAuthors?: string[]
  citationIssues: string[]
  reviewKind?: ReviewKind
  targetVenue?: string | null
  summary?: string | null
  strengths?: string[]
  findings?: ReviewFinding[]
  sourceRevision?: string | null
  rubricVersion?: string | null
  discipline?: string | null
  proposedGradeRange?: string | null
  confidence?: number | null
  limitationsSummary?: string | null
  reportingStandard?: ReportingStandard | null
  reportingGuidelineChecks?: ReportingGuidelineCheck[]
  confidentialComments?: string | null
  phdEnrichment?: any | null // Or imported PhdEnrichmentData if possible, but let's just use any or import
  status: "draft" | "final"
  language: ReviewLanguage
  diagnostics?: ReviewDiagnostics
  confirmedAt?: string | null
  confirmedBy?: string | null
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
  institution?: string | null
  department?: string | null
  grade?: string | null
  suggestedGrade?: string | null
  finalGrade?: string | null
  recommendation?: string | null
  suggestedRecommendation?: string | null
  finalRecommendation?: string | null
  reviewKind?: string | null
  targetVenue?: string | null
  sourceRevision?: string | null
  rubricVersion?: string | null
  discipline?: string | null
  proposedGradeRange?: string | null
  confidence?: number | null
  limitationsSummary?: string | null
  reportingStandard?: string | null
  confirmedAt?: string | null
  status: string
  language: string
  createdAt: string
  updatedAt: string
}

export interface ThesisReviewGenerateOptions {
  workspaceId: string
  sourceFileId?: string
  metadata: ThesisMetadata & {
    reviewKind?: ReviewKind
    targetVenue?: string
    reportingStandard?: ReportingStandard
  }
  focusCriteria?: string[]
  skipCitationAudit?: boolean
  professionalMode?: boolean
  rubricTemplateId?: string
  customWeights?: Record<string, number>
}

export interface ThesisReviewFormMetadata {
  studentName: string
  thesisTitle: string
  thesisType: ThesisType
  reviewerRole: ReviewerRole
  reviewerName?: string
  institution?: string
  department?: string
  language: ReviewLanguage
  academicYear?: string
  reviewKind: ReviewKind
  targetVenue?: string
  reportingStandard: ReportingStandard
}

export function normalizeFormMetadataToThesisMetadata(meta: ThesisReviewFormMetadata): ThesisMetadata & {
  reviewKind?: ReviewKind
  targetVenue?: string
  reportingStandard?: ReportingStandard
} {
  return {
    studentName: meta.studentName,
    thesisTitle: meta.thesisTitle,
    thesisType: meta.thesisType,
    reviewerRole: meta.reviewerRole,
    reviewerName: meta.reviewerName || undefined,
    institution: meta.institution || undefined,
    department: meta.department || undefined,
    language: meta.language,
    academicYear: meta.academicYear || undefined,
    reviewKind: meta.reviewKind,
    targetVenue: meta.targetVenue || undefined,
    reportingStandard: meta.reportingStandard,
  }
}

export interface ThesisReviewState {
  reviews: ThesisReviewListItem[]
  activeReview: ThesisReviewRecord | null
  sourceMarkdown: string
  isLoadingSource: boolean
  selectedEvidence: EvidenceReference | null
  analysisPlan: ReviewAnalysisPlan | null
  isGeneratingPlan: boolean
  isGenerating: boolean
  isSaving: boolean
  isExporting: boolean
  regeneratingCriterionId: string | null
  generateError: string | null
  saveError: string | null
  exportError: string | null
  isPanelOpen: boolean
  isMetadataValid: boolean
  formMetadata: ThesisReviewFormMetadata
  confidentialityAgreed: boolean
  skipCitationAudit: boolean
  multiAgentDebate: boolean
  professionalModeOverride: boolean
  selectedFileId: string

  // Actions
  openPanel: () => void
  closePanel: () => void
  setMetadataValid: (valid: boolean) => void
  updateFormMetadata: (updates: Partial<ThesisReviewFormMetadata>) => void
  setConfidentialityAgreed: (agreed: boolean) => void
  setSkipCitationAudit: (skip: boolean) => void
  setMultiAgentDebate: (debate: boolean) => void
  setProfessionalModeOverride: (enabled: boolean) => void
  setSelectedFileId: (fileId: string) => void
  setActiveReview: (review: ThesisReviewRecord | null) => void
  setSelectedEvidence: (ev: EvidenceReference | null) => void
  setAnalysisPlan: (plan: ReviewAnalysisPlan | null) => void
  generateAnalysisPlan: (workspaceId: string, metadata: any, sourceFileId?: string) => Promise<ReviewAnalysisPlan | null>
  loadSourceDocument: (workspaceId: string, fileId?: string) => Promise<void>
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

  // Decision confirmation (Human-in-the-loop)
  confirmFinalDecision: (grade: string, recommendation: string) => void

  saveReview: (workspaceId: string, reviewId: string) => Promise<boolean>
  exportReviewPdf: (workspaceId: string, reviewId: string) => Promise<void>
  deleteReview: (workspaceId: string, reviewId: string) => Promise<boolean>
  clearErrors: () => void
  _syncReviewFromYjs: (review: ThesisReviewRecord) => void
  _removeReviewFromYjs: (reviewId: string) => void
}

// ---------------------------------------------------------------------------
// Store & Module Caches
// ---------------------------------------------------------------------------

// In-memory cache for source document markdown by workspace + fileId
const sourceDocCache = new Map<string, string>()

function createThesisReviewStore() {
return create<ThesisReviewState>()(
  immer((set, get) => ({
    reviews: [],
    activeReview: null,
    sourceMarkdown: "",
    isLoadingSource: false,
    selectedEvidence: null,
    analysisPlan: null,
    isGeneratingPlan: false,
    isGenerating: false,
    isSaving: false,
    isExporting: false,
    regeneratingCriterionId: null,
    generateError: null,
    saveError: null,
    exportError: null,
    isPanelOpen: false,
    isMetadataValid: false,
    formMetadata: {
      studentName: "",
      thesisTitle: "",
      thesisType: "master",
      reviewerRole: "opponent",
      reviewerName: "",
      institution: "Slovenská technická univerzita v Bratislave",
      department: "FIIT - Ústav počítačového inžinierstva a aplikovanej informatiky",
      language: getSettingsStore().getState().defaultReviewLanguage,
      academicYear: "2025/2026",
      reviewKind: "thesis",
      targetVenue: "",
      reportingStandard: "none",
    },
    confidentialityAgreed: true,
    skipCitationAudit: false,
    multiAgentDebate: false,
    professionalModeOverride: false,
    selectedFileId: "",

    openPanel: () => set((s) => { s.isPanelOpen = true }),
    closePanel: () => set((s) => { s.isPanelOpen = false }),
    setMetadataValid: (valid) => set((s) => { s.isMetadataValid = valid }),
    updateFormMetadata: (updates) =>
      set((s) => {
        Object.assign(s.formMetadata, updates)
        const valid =
          Boolean(s.formMetadata.studentName?.trim()) &&
          Boolean(s.formMetadata.thesisTitle?.trim()) &&
          s.confidentialityAgreed
        s.isMetadataValid = valid
      }),
    setConfidentialityAgreed: (agreed) =>
      set((s) => {
        s.confidentialityAgreed = agreed
        s.isMetadataValid = Boolean(s.formMetadata.studentName?.trim()) && Boolean(s.formMetadata.thesisTitle?.trim()) && agreed
      }),
    setSkipCitationAudit: (skip) => set((s) => { s.skipCitationAudit = skip }),
    setMultiAgentDebate: (debate) => set((s) => { s.multiAgentDebate = debate }),
    setProfessionalModeOverride: (enabled) => set((s) => { s.professionalModeOverride = enabled }),
    setSelectedFileId: (fileId) => set((s) => { s.selectedFileId = fileId }),

    setActiveReview: (review) => set((s) => { s.activeReview = review }),
    setSelectedEvidence: (ev) => set((s) => { s.selectedEvidence = ev }),
    setAnalysisPlan: (plan) => set((s) => { s.analysisPlan = plan }),

    generateAnalysisPlan: async (workspaceId, metadata, fileId) => {
      set((s) => { s.isGeneratingPlan = true; s.generateError = null })
      try {
        const targetFileId = fileId || get().selectedFileId || undefined
        const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review/analysis-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            thesisMetadata: metadata,
            sourceFileId: targetFileId,
          }),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.message ?? errData.error ?? `HTTP ${res.status}`)
        }
        const plan: ReviewAnalysisPlan = await res.json()
        set((s) => {
          s.analysisPlan = plan
          s.isGeneratingPlan = false
        })
        return plan
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Plan generation failed"
        set((s) => {
          s.isGeneratingPlan = false
          s.generateError = msg
        })
        return null
      }
    },

    loadSourceDocument: async (workspaceId: string, fileId?: string) => {
      const cacheKey = `${workspaceId}:${fileId || "all"}`
      const cached = sourceDocCache.get(cacheKey)
      if (cached) {
        set((s) => {
          s.sourceMarkdown = cached
          s.isLoadingSource = false
        })
        return
      }

      set((s) => { s.isLoadingSource = true })
      try {
        const url = fileId
          ? `/api/workspaces/${workspaceId}/thesis-review/source-document?fileId=${encodeURIComponent(fileId)}`
          : `/api/workspaces/${workspaceId}/thesis-review/source-document`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          const text = data.fullText ?? ""
          sourceDocCache.set(cacheKey, text)
          set((s) => {
            s.sourceMarkdown = text
            s.isLoadingSource = false
          })
        } else {
          set((s) => { s.isLoadingSource = false })
        }
      } catch (err) {
        console.warn("[ThesisReviewStore] loadSourceDocument failed:", err)
        set((s) => { s.isLoadingSource = false })
      }
    },

    loadReviews: async (workspaceId) => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review`)
        if (res.status === 404) {
          set((s) => { s.reviews = [] })
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        set((s) => { s.reviews = data.reviews ?? [] })
      } catch (err) {
        console.error("[ThesisReviewStore] loadReviews failed:", err)
      }
    },

    loadReview: async (workspaceId, reviewId) => {
      try {
        // Parallel fetch of review record and real source document
        const [reviewRes] = await Promise.all([
          fetch(`/api/workspaces/${workspaceId}/thesis-review/${reviewId}`),
          get().loadSourceDocument(workspaceId, get().selectedFileId || undefined),
        ])
        if (!reviewRes.ok) {
          if (reviewRes.status === 404) {
            // Stale review ID from past session — clean up local state
            set((s) => {
              s.reviews = s.reviews.filter((r) => r.id !== reviewId)
              if (s.activeReview?.id === reviewId) {
                s.activeReview = null
              }
            })
            console.warn(`[ThesisReviewStore] Review ${reviewId} not found (404)`)
            return
          }
          const errData = await reviewRes.json().catch(() => ({}))
          throw new Error(errData.error ?? errData.message ?? `HTTP ${reviewRes.status}`)
        }
        const review = await reviewRes.json()
        set((s) => { s.activeReview = review })
      } catch (err) {
        console.warn("[ThesisReviewStore] loadReview failed:", err)
      }
    },

    generateReview: async (opts) => {
      set((s) => { s.isGenerating = true; s.generateError = null })
      try {
        const fileId = opts.sourceFileId || get().selectedFileId || undefined
        // Ensure source document is fetched
        void get().loadSourceDocument(opts.workspaceId, fileId)

        const res = await fetch(`/api/workspaces/${opts.workspaceId}/thesis-review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            thesisMetadata: opts.metadata,
            sourceFileId: fileId,
            focusCriteria: opts.focusCriteria,
            skipCitationAudit: opts.skipCitationAudit ?? false,
            multiAgentDebate: get().multiAgentDebate,
            professionalMode: opts.professionalMode ?? get().professionalModeOverride,
            rubricTemplateId: opts.rubricTemplateId,
            customWeights: opts.customWeights,
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.message ?? errData.error ?? `HTTP ${res.status}`)
        }

        const data = await res.json()
        const initialGrade = data.overallGrade ?? data.grade ?? null
        const initialRec = data.recommendation ?? null

        const newReview: ThesisReviewRecord = {
          id: data.id,
          studentName: opts.metadata.studentName,
          thesisTitle: opts.metadata.thesisTitle,
          thesisType: opts.metadata.thesisType,
          reviewerRole: opts.metadata.reviewerRole,
          reviewerName: opts.metadata.reviewerName,
          institution: opts.metadata.institution,
          department: opts.metadata.department,
          grade: initialGrade,
          suggestedGrade: initialGrade,
          finalGrade: initialGrade,
          recommendation: initialRec,
          suggestedRecommendation: initialRec,
          finalRecommendation: initialRec,
          sections: data.sections ?? [],
          defenseQuestions: data.defenseQuestions ?? [],
          citationIssues: data.citationIssues ?? [],
          reviewKind: data.reviewKind ?? opts.metadata.reviewKind ?? "thesis",
          targetVenue: data.targetVenue ?? opts.metadata.targetVenue,
          summary: data.summary ?? "",
          strengths: data.strengths ?? [],
          findings: data.findings ?? [],
          reportingStandard: data.reportingStandard ?? opts.metadata.reportingStandard ?? "none",
          reportingGuidelineChecks: data.reportingGuidelineChecks ?? [],
          questionsForAuthors: data.questionsForAuthors ?? data.defenseQuestions ?? [],
          confidentialComments: data.confidentialComments,
          phdEnrichment: data.phdEnrichment ?? null,
          status: "draft",
          language: opts.metadata.language,
          diagnostics: {
            corruptedFields: [],
            parseWarnings: [],
            unverifiedEvidenceCount: (data.findings ?? []).filter((f: any) => !f.evidence?.every((e: any) => e.verified)).length,
            staleEvidenceCount: 0,
          },
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
            s.activeReview.suggestedGrade = data.grade
            if (data.recommendation) {
              s.activeReview.recommendation = data.recommendation
              s.activeReview.suggestedRecommendation = data.recommendation
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
            s.activeReview.suggestedGrade = newGrade
            s.activeReview.recommendation = gradeToRecommendation(newGrade, s.activeReview.language)
            s.activeReview.suggestedRecommendation = s.activeReview.recommendation
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
          source: "reviewer",
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

    confirmFinalDecision: (grade, recommendation) => {
      set((s) => {
        if (s.activeReview) {
          s.activeReview.finalGrade = grade
          s.activeReview.grade = grade
          s.activeReview.finalRecommendation = recommendation
          s.activeReview.recommendation = recommendation
          s.activeReview.confirmedAt = new Date().toISOString()
        }
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
            grade: activeReview.finalGrade ?? activeReview.grade,
            recommendation: activeReview.finalRecommendation ?? activeReview.recommendation,
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
            phdEnrichment: activeReview.phdEnrichment ? JSON.stringify(activeReview.phdEnrichment) : undefined,
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
}

// Default singleton instance — shared by tests, the Yjs collab layer and any
// consumer that is not tied to a specific output tab.
export const useThesisReviewStore = createThesisReviewStore()

// Per-output (tab) store instances so every thesis-review tab keeps its own
// independent review state instead of sharing one global store.
const reviewStoreRegistry = new Map<string, ReturnType<typeof createThesisReviewStore>>()

export function getThesisReviewStore(outputKey: string) {
  let store = reviewStoreRegistry.get(outputKey)
  if (!store) {
    store = createThesisReviewStore()
    reviewStoreRegistry.set(outputKey, store)
  }
  return store
}

export function destroyThesisReviewStore(outputKey: string) {
  reviewStoreRegistry.delete(outputKey)
}

export function clearThesisReviewStoreRegistry() {
  reviewStoreRegistry.clear()
}

if (typeof window !== "undefined") {
  ;(window as any).__thesisReviewStore = useThesisReviewStore
}
