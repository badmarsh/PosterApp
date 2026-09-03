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
  type ReviewTone,
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
  /** Adversarial self-critique summary (present only when the critique pass ran). */
  debateLog?: string | null
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
  reviewTone?: ReviewTone
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

export interface ReviewJobProgress {
  jobId: string
  stage: string
  detail: string
  progress: number
  status: "running" | "done" | "error" | "cancelled"
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
  /** Live stage progress for a streaming (SSE) review-generation job. */
  generationJob: ReviewJobProgress | null
  isSaving: boolean
  /** True when local edits (triage decisions, text) have not been persisted yet. */
  isReviewDirty: boolean
  /** Monotonic counter of local edits; used to detect edits during an in-flight save. */
  editSeq: number
  lastSavedAt: string | null
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
  /** Cancel the in-flight streaming review job. */
  cancelGeneration: (workspaceId: string) => Promise<void>
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

export interface SharedThesisContext {
  studentName: string
  thesisTitle: string
  thesisType: ThesisType
  institution: string
  department: string
  academicYear: string
  language: ReviewLanguage
  reviewKind: ReviewKind
  targetVenue: string
  reportingStandard: ReportingStandard
  selectedFileId: string
  sourceMarkdown: string
}

export const SHARED_FORM_FIELDS: (keyof ThesisReviewFormMetadata)[] = [
  "studentName",
  "thesisTitle",
  "thesisType",
  "institution",
  "department",
  "academicYear",
  "language",
  "reviewKind",
  "targetVenue",
  "reportingStandard",
]

const workspaceSharedThesisMap = new Map<string, SharedThesisContext>()

export function parseOutputKey(outputKey?: string | null): { workspaceId: string; outputId: string } {
  if (!outputKey) return { workspaceId: "", outputId: "" }
  const idx = outputKey.indexOf(":")
  if (idx === -1) return { workspaceId: outputKey, outputId: "" }
  return {
    workspaceId: outputKey.slice(0, idx),
    outputId: outputKey.slice(idx + 1),
  }
}

// In-memory cache for source document markdown by workspace + fileId
const sourceDocCache = new Map<string, string>()

function createThesisReviewStore(
  outputKey?: string | null,
  initialShared?: Partial<SharedThesisContext>,
  initialRole?: ReviewerRole
) {
  const { workspaceId } = parseOutputKey(outputKey)

  const studentName = initialShared?.studentName ?? ""
  const thesisTitle = initialShared?.thesisTitle ?? ""
  const isInitialValid = (initialRole === "self" || Boolean(studentName.trim())) && Boolean(thesisTitle.trim())

  /**
   * Attaches to an existing SSE job stream and resolves with the saved review
   * payload on `done`, or rejects on error/cancel/drop. Shared by fresh starts
   * and resume-after-refresh. If SSE is blocked/stalled by a proxy, falls back
   * to polling the one-shot GET status endpoint so the UI can never hang.
   */
  function attachToJobStream(
    wsId: string,
    jobId: string,
    onStage: (p: { stage: string; detail: string; progress: number }) => void
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let settled = false
      let es: EventSource | null = null
      let lastFrameAt = Date.now()
      let pollTimer: ReturnType<typeof setInterval> | null = null
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        if (pollTimer) clearInterval(pollTimer)
        es?.close()
        fn()
      }

      const pollStatus = async () => {
        // If frames keep arriving, no need to poll.
        if (Date.now() - lastFrameAt < 20_000) return
        try {
          const res = await fetch(`/api/workspaces/${wsId}/thesis-review/jobs/${jobId}`)
          if (!res.ok) return
          const s = await res.json()
          if (s.status === "done") {
            finish(() => resolve(s.result ?? s))
          } else if (s.status === "error") {
            finish(() => reject(new Error(s.error ?? "Review generation failed")))
          } else if (s.status === "cancelled") {
            finish(() => reject(new Error("Review generation was cancelled.")))
          } else if (s.stage) {
            onStage({ stage: s.stage, detail: s.detail ?? s.stage, progress: s.progress ?? 0 })
          }
        } catch {
          /* transient — keep waiting; EventSource or next poll may recover */
        }
      }

      try {
        es = new EventSource(`/api/workspaces/${wsId}/thesis-review/jobs/${jobId}/stream`)
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Failed to open review progress stream"))
        return
      }
      es.addEventListener("stage", (ev) => {
        lastFrameAt = Date.now()
        try {
          const p = JSON.parse((ev as MessageEvent).data)
          onStage(p)
        } catch { /* malformed frame ignored */ }
      })
      es.addEventListener("done", (ev) => {
        finish(() => resolve(JSON.parse((ev as MessageEvent).data)))
      })
      es.addEventListener("error", (ev) => {
        const payload = (ev as MessageEvent).data
        if (payload) {
          finish(() => {
            try {
              const p = JSON.parse(payload)
              reject(new Error(p.error ?? "Review generation failed"))
            } catch {
              reject(new Error("Review generation failed"))
            }
          })
        } else if (es && es.readyState === EventSource.CLOSED) {
          finish(() => reject(new Error("Spojenie s posudkom sa prerušilo. Skúste to znova.")))
        }
        // readyState === CONNECTING: EventSource auto-retries; the poll
        // watchdog below resolves terminal states even if frames never come.
      })
      es.addEventListener("cancelled", () => {
        finish(() => reject(new Error("Review generation was cancelled.")))
      })

      // Watchdog: poll status when no SSE frame has arrived for 20s.
      pollTimer = setInterval(pollStatus, 10_000)
    })
  }

  // Abort controller for the in-flight "start job" request, so Cancel works
  // even before the SSE stream exists.
  let startAbort: AbortController | null = null

  return create<ThesisReviewState>()(
    immer((set, get) => ({
      reviews: [],
      activeReview: null,
      sourceMarkdown: initialShared?.sourceMarkdown ?? "",
      isLoadingSource: false,
      selectedEvidence: null,
      analysisPlan: null,
      isGeneratingPlan: false,
      isGenerating: false,
      generationJob: null,
      isSaving: false,
      isReviewDirty: false,
      editSeq: 0,
      lastSavedAt: null,
      isExporting: false,
      regeneratingCriterionId: null,
      generateError: null,
      saveError: null,
      exportError: null,
      isPanelOpen: false,
      isMetadataValid: isInitialValid,
      formMetadata: {
        studentName,
        thesisTitle,
        thesisType: initialShared?.thesisType ?? "master",
        reviewerRole: initialRole ?? "supervisor",
        reviewerName: "",
        institution: initialShared?.institution ?? "Slovenská technická univerzita v Bratislave",
        department: initialShared?.department ?? "FIIT - Ústav počítačového inžinierstva a aplikovanej informatiky",
        language: initialShared?.language ?? getSettingsStore().getState().defaultReviewLanguage,
        academicYear: initialShared?.academicYear ?? "2025/2026",
        reviewKind: initialShared?.reviewKind ?? "thesis",
        targetVenue: initialShared?.targetVenue ?? "",
        reportingStandard: initialShared?.reportingStandard ?? "none",
      },
      confidentialityAgreed: true,
      skipCitationAudit: false,
      multiAgentDebate: false,
      professionalModeOverride: false,
      selectedFileId: initialShared?.selectedFileId ?? "",

      openPanel: () => set((s) => { s.isPanelOpen = true }),
      closePanel: () => set((s) => { s.isPanelOpen = false }),
      setMetadataValid: (valid) => set((s) => { s.isMetadataValid = valid }),
      updateFormMetadata: (updates) =>
        set((s) => {
          Object.assign(s.formMetadata, updates)
          const valid =
            (s.formMetadata.reviewerRole === "self" || Boolean(s.formMetadata.studentName?.trim())) &&
            Boolean(s.formMetadata.thesisTitle?.trim()) &&
            s.confidentialityAgreed
          s.isMetadataValid = valid

          // Synchronize shared thesis metadata across all tabs in this workspace
          if (workspaceId) {
            const sharedUpdates: Partial<SharedThesisContext> = {}
            for (const key of SHARED_FORM_FIELDS) {
              if (key in updates && updates[key] !== undefined) {
                ;(sharedUpdates as any)[key] = updates[key]
              }
            }

            if (Object.keys(sharedUpdates).length > 0) {
              let shared = workspaceSharedThesisMap.get(workspaceId)
              if (!shared) {
                shared = {
                  studentName: s.formMetadata.studentName,
                  thesisTitle: s.formMetadata.thesisTitle,
                  thesisType: s.formMetadata.thesisType,
                  institution: s.formMetadata.institution || "",
                  department: s.formMetadata.department || "",
                  academicYear: s.formMetadata.academicYear || "",
                  language: s.formMetadata.language,
                  reviewKind: s.formMetadata.reviewKind,
                  targetVenue: s.formMetadata.targetVenue || "",
                  reportingStandard: s.formMetadata.reportingStandard,
                  selectedFileId: s.selectedFileId,
                  sourceMarkdown: s.sourceMarkdown,
                }
                workspaceSharedThesisMap.set(workspaceId, shared)
              } else {
                Object.assign(shared, sharedUpdates)
              }

              // Propagate to all other stores in this workspace that share the same thesis file
              for (const [key, otherStore] of reviewStoreRegistry.entries()) {
                if (key !== outputKey && key.startsWith(workspaceId + ":")) {
                  otherStore.setState((otherState) => {
                    const sameFile = !s.selectedFileId || !otherState.selectedFileId || s.selectedFileId === otherState.selectedFileId
                    if (!sameFile) return

                    let changed = false
                    for (const [k, v] of Object.entries(sharedUpdates)) {
                      if ((otherState.formMetadata as any)[k] !== v) {
                        ;(otherState.formMetadata as any)[k] = v
                        changed = true
                      }
                    }
                    if (changed) {
                      otherState.isMetadataValid =
                        (otherState.formMetadata.reviewerRole === "self" || Boolean(otherState.formMetadata.studentName?.trim())) &&
                        Boolean(otherState.formMetadata.thesisTitle?.trim()) &&
                        otherState.confidentialityAgreed
                    }
                  })
                }
              }
            }
          }
        }),
      setConfidentialityAgreed: (agreed) =>
        set((s) => {
          s.confidentialityAgreed = agreed
          s.isMetadataValid =
            (s.formMetadata.reviewerRole === "self" || Boolean(s.formMetadata.studentName?.trim())) &&
            Boolean(s.formMetadata.thesisTitle?.trim()) &&
            agreed
        }),
      setSkipCitationAudit: (skip) => set((s) => { s.skipCitationAudit = skip }),
      setMultiAgentDebate: (debate) => set((s) => { s.multiAgentDebate = debate }),
      setProfessionalModeOverride: (enabled) => set((s) => { s.professionalModeOverride = enabled }),
      setSelectedFileId: (fileId) => {
        set((s) => { s.selectedFileId = fileId })
        if (workspaceId) {
          let shared = workspaceSharedThesisMap.get(workspaceId)
          if (shared) {
            shared.selectedFileId = fileId
          }
        }
      },

      setActiveReview: (review) => set((s) => { s.activeReview = review; s.isReviewDirty = false }),
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

            if (workspaceId && text) {
              let shared = workspaceSharedThesisMap.get(workspaceId)
              if (shared) {
                shared.sourceMarkdown = text
                if (fileId) shared.selectedFileId = fileId
              }
              for (const [key, otherStore] of reviewStoreRegistry.entries()) {
                if (key !== outputKey && key.startsWith(workspaceId + ":")) {
                  const otherFileId = otherStore.getState().selectedFileId
                  // Only propagate to tabs reviewing the exact same file
                  if (fileId && otherFileId && otherFileId === fileId) {
                    if (otherStore.getState().sourceMarkdown !== text) {
                      otherStore.setState((s) => {
                        s.sourceMarkdown = text
                        s.isLoadingSource = false
                      })
                    }
                  }
                }
              }
            }
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

        // Resume progress tracking for a job still running (e.g. after refresh).
        const running = Array.isArray(data.activeJobs) ? data.activeJobs : []
        if (running.length > 0 && !get().generationJob) {
          const job = running[0]
          set((s) => {
            s.generationJob = {
              jobId: job.jobId,
              stage: job.stage ?? "retrieval",
              detail: job.detail ?? "",
              progress: job.progress ?? 0,
              status: "running",
            }
            s.isGenerating = true
          })
          attachToJobStream(workspaceId, job.jobId, (p) =>
            set((s) => {
              if (s.generationJob) {
                s.generationJob.stage = p.stage
                s.generationJob.detail = p.detail ?? p.stage
                s.generationJob.progress = p.progress ?? s.generationJob.progress
              }
            })
          )
            .then(() => {
              set((s) => { s.generationJob = null; s.isGenerating = false })
              void get().loadReviews(workspaceId)
            })
            .catch((err) => {
              const msg = err instanceof Error ? err.message : "Generation failed"
              set((s) => { s.generationJob = null; s.isGenerating = false; s.generateError = msg })
            })
        }
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

    cancelGeneration: async (workspaceId) => {
      startAbort?.abort()
      startAbort = null
      const job = get().generationJob
      if (job && !job.jobId.startsWith("starting_")) {
        try {
          await fetch(`/api/workspaces/${workspaceId}/thesis-review/jobs/${job.jobId}`, { method: "DELETE" })
        } catch {
          /* non-fatal — the SSE stream will also close on cancellation */
        }
      }
      set((s) => {
        s.generationJob = null
        s.isGenerating = false
      })
    },

    generateReview: async (opts) => {
      set((s) => {
        s.isGenerating = true
        s.generateError = null
        // Show the progress card immediately ("Spúšťam…") so the UI never sits
        // on a dead spinner while the start request or first stage is in flight.
        s.generationJob = {
          jobId: `starting_${Date.now()}`,
          stage: "queued",
          detail: "starting",
          progress: 1,
          status: "running",
        }
      })
      startAbort?.abort()
      startAbort = new AbortController()
      const fileId = opts.sourceFileId || get().selectedFileId || undefined
      // Ensure source document is fetched
      void get().loadSourceDocument(opts.workspaceId, fileId)

      const requestBody = {
        thesisMetadata: opts.metadata,
        sourceFileId: fileId,
        focusCriteria: opts.focusCriteria,
        skipCitationAudit: opts.skipCitationAudit ?? false,
        multiAgentDebate: get().multiAgentDebate,
        professionalMode: opts.professionalMode ?? get().professionalModeOverride,
        reviewTone: opts.reviewTone,
        rubricTemplateId: opts.rubricTemplateId,
        customWeights: opts.customWeights,
      }

      const buildRecord = (data: any): ThesisReviewRecord => {
        const initialGrade = data.overallGrade ?? data.grade ?? null
        const initialRec = data.recommendation ?? null
        return {
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
      }

      try {
        // Start a detached streaming job so 5–20-min professional reviews
        // report live stage progress ("retrieval 13/13 · primary review · self-critique")
        // and can be cancelled.
        const startRes = await fetch(`/api/workspaces/${opts.workspaceId}/thesis-review`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
          body: JSON.stringify({ ...requestBody, stream: true }),
          signal: startAbort?.signal,
        })
        if (!startRes.ok) {
          const errData = await startRes.json().catch(() => ({}))
          throw new Error(errData.message ?? errData.error ?? `HTTP ${startRes.status}`)
        }
        const { jobId } = await startRes.json()
        set((s) => {
          s.generationJob = { jobId, stage: "queued", detail: "queued", progress: 0, status: "running" }
        })

        const data: any = await attachToJobStream(opts.workspaceId, jobId, (p) =>
          set((s) => {
            if (s.generationJob) {
              s.generationJob.stage = p.stage
              s.generationJob.detail = p.detail ?? p.stage
              s.generationJob.progress = p.progress ?? s.generationJob.progress
            }
          })
        )
        const newReview = buildRecord(data)
        set((s) => {
          s.activeReview = newReview
          s.isGenerating = false
          s.generationJob = null
        })
        startAbort = null
        await get().loadReviews(opts.workspaceId)
        return newReview
      } catch (err) {
        startAbort = null
        const cancelled = (err instanceof Error && err.name === "AbortError") || get().generationJob === null
        set((s) => {
          s.isGenerating = false
          s.generationJob = null
          if (!cancelled) {
            s.generateError = err instanceof Error ? err.message : "Generation failed"
          }
        })
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
        s.isReviewDirty = true; s.editSeq++
        if (s.activeReview) Object.assign(s.activeReview, updates)
      })
    },

    updateCriterionLocally: (criterionId, updates) => {
      set((s) => {
        s.isReviewDirty = true; s.editSeq++
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
        s.isReviewDirty = true; s.editSeq++
        if (!s.activeReview?.findings) return
        const f = s.activeReview.findings.find((item) => item.id === findingId)
        if (f) f.status = "accepted"
      })
    },

    rejectFinding: (findingId) => {
      set((s) => {
        s.isReviewDirty = true; s.editSeq++
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
        s.isReviewDirty = true; s.editSeq++
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
        s.isReviewDirty = true; s.editSeq++
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
        s.isReviewDirty = true; s.editSeq++
        if (!s.activeReview?.findings) return
        const f = s.activeReview.findings.find((item) => item.id === findingId)
        if (f) f.includeInExport = !f.includeInExport
      })
    },

    confirmFinalDecision: (grade, recommendation) => {
      set((s) => {
        s.isReviewDirty = true; s.editSeq++
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

      const seqAtStart = get().editSeq
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

        set((s) => {
          s.isSaving = false
          s.lastSavedAt = new Date().toISOString()
          // Only clear the flag if nothing changed while the request was in flight.
          if (s.editSeq === seqAtStart) s.isReviewDirty = false
        })
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

export function getExistingThesisReviewStore(outputKey: string) {
  return reviewStoreRegistry.get(outputKey)
}

export function getAllThesisStoresForWorkspace(workspaceId: string) {
  const list: { outputKey: string; outputId: string; store: ReturnType<typeof createThesisReviewStore> }[] = []
  for (const [key, store] of reviewStoreRegistry.entries()) {
    if (key.startsWith(workspaceId + ":")) {
      const { outputId } = parseOutputKey(key)
      list.push({ outputKey: key, outputId, store })
    }
  }
  return list
}

export function getWorkspaceSharedThesis(workspaceId: string): SharedThesisContext | undefined {
  return workspaceSharedThesisMap.get(workspaceId)
}

export function getThesisReviewStore(outputKey: string) {
  let store = reviewStoreRegistry.get(outputKey)
  if (!store) {
    const { workspaceId } = parseOutputKey(outputKey)
    let shared = workspaceSharedThesisMap.get(workspaceId)

    // If not yet in shared map, inspect any existing stores for this workspace
    if (!shared) {
      for (const [key, existingStore] of reviewStoreRegistry.entries()) {
        if (key.startsWith(workspaceId + ":")) {
          const state = existingStore.getState()
          shared = {
            studentName: state.formMetadata.studentName,
            thesisTitle: state.formMetadata.thesisTitle,
            thesisType: state.formMetadata.thesisType,
            institution: state.formMetadata.institution || "",
            department: state.formMetadata.department || "",
            academicYear: state.formMetadata.academicYear || "",
            language: state.formMetadata.language,
            reviewKind: state.formMetadata.reviewKind,
            targetVenue: state.formMetadata.targetVenue || "",
            reportingStandard: state.formMetadata.reportingStandard,
            selectedFileId: state.selectedFileId,
            sourceMarkdown: state.sourceMarkdown,
          }
          workspaceSharedThesisMap.set(workspaceId, shared)
          break
        }
      }
    }

    // Differentiate reviewer role
    let initialRole: ReviewerRole = "supervisor"
    const existingStores = Array.from(reviewStoreRegistry.entries())
      .filter(([k]) => k.startsWith(workspaceId + ":") && k !== outputKey)
      .map(([, s]) => s)

    if (existingStores.length > 0) {
      const existingRoles = existingStores.map((s) => s.getState().formMetadata.reviewerRole)
      if (existingRoles.includes("supervisor")) {
        initialRole = "opponent"
      } else if (existingRoles.includes("opponent")) {
        initialRole = "supervisor"
      } else {
        initialRole = "opponent"
      }
    }

    store = createThesisReviewStore(outputKey, shared, initialRole)
    reviewStoreRegistry.set(outputKey, store)
  }
  return store
}

export function destroyThesisReviewStore(outputKey: string) {
  reviewStoreRegistry.delete(outputKey)
}

export function clearThesisReviewStoreRegistry() {
  reviewStoreRegistry.clear()
  workspaceSharedThesisMap.clear()
  sourceDocCache.clear()
}

if (typeof window !== "undefined") {
  ;(window as any).__thesisReviewStore = useThesisReviewStore
}

