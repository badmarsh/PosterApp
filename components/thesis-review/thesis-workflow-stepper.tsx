"use client"

/**
 * ThesisWorkflowStepper — Config-Driven, Dynamic Academic Pipeline Rail.
 *
 * Supports dynamic workflow step configurations (4-step, 6-step, 10-step full academic).
 * Displays real-time stage progression, animated progress tracks, accessibility focus,
 * and responsive mobile layout.
 */

import { CheckCircle2, Loader2, Sparkles, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDocumentDisplayName } from "@/lib/ingestion"
import {
  buildWorkflowSteps,
  STEP_ICON_MAP,
  type WorkflowPresetId,
  type WorkflowStepId,
  type WorkflowContext,
} from "@/lib/workflow/step-registry"

export type PipelineStep = number

type Lang = "sk" | "cs" | "en"

const LABELS: Record<Lang, {
  ariaLabel: string
  upload: string
  parsing: string
  structureVerified: string
  metadata: string
  planApproved: string
  preflightPlan: string
  evidenceAnchored: string
  ready: string
  vectorRag: string
  sectionsReady: string
  generatingReview: string
  confirmedFinal: string
  decisionDocx: string
  step: string
  autofillMetadata: string
  autofillTitle: string
}> = {
  sk: {
    ariaLabel: "Kroky hodnotenia záverečnej práce",
    upload: "Nahrajte PDF",
    parsing: "Parsovanie…",
    structureVerified: "Štruktúra overená",
    metadata: "Metadáta",
    planApproved: "Plán schválený",
    preflightPlan: "Pre-flight plán",
    evidenceAnchored: "Dôkazy ukotvené",
    ready: "Pripravené",
    vectorRag: "Vektorový RAG",
    sectionsReady: "14 sekcií pripravených",
    generatingReview: "Generovanie posudku",
    confirmedFinal: "Potvrdené (Finál)",
    decisionDocx: "Rozhodnutie & DOCX",
    step: "Krok",
    autofillMetadata: "Predvyplniť metadáta",
    autofillTitle: "Predvyplniť metadáta z nahraného PDF",
  },
  cs: {
    ariaLabel: "Kroky hodnocení závěrečné práce",
    upload: "Nahrajte PDF",
    parsing: "Parsování…",
    structureVerified: "Struktura ověřena",
    metadata: "Metadata",
    planApproved: "Plán schválen",
    preflightPlan: "Pre-flight plán",
    evidenceAnchored: "Důkazy ukotveny",
    ready: "Připraveno",
    vectorRag: "Vektorový RAG",
    sectionsReady: "14 sekcí připraveno",
    generatingReview: "Generování posudku",
    confirmedFinal: "Potvrzeno (Finál)",
    decisionDocx: "Rozhodnutí & DOCX",
    step: "Krok",
    autofillMetadata: "Předvyplnit metadata",
    autofillTitle: "Předvyplnit metadata z nahraného PDF",
  },
  en: {
    ariaLabel: "Thesis review workflow steps",
    upload: "Upload PDF",
    parsing: "Parsing…",
    structureVerified: "Structure verified",
    metadata: "Metadata",
    planApproved: "Plan approved",
    preflightPlan: "Pre-flight plan",
    evidenceAnchored: "Evidence anchored",
    ready: "Ready",
    vectorRag: "Vector RAG",
    sectionsReady: "14 sections ready",
    generatingReview: "Generating review",
    confirmedFinal: "Confirmed (Final)",
    decisionDocx: "Decision & DOCX",
    step: "Step",
    autofillMetadata: "Autofill metadata",
    autofillTitle: "Autofill metadata from uploaded PDF",
  },
}

interface Props {
  currentStep: number
  activeStepId?: WorkflowStepId
  presetId?: WorkflowPresetId
  lang?: Lang
  hasDocument: boolean
  isParsing: boolean
  isIndexed: boolean
  chunkCount: number
  isFormValid: boolean
  hasPlan?: boolean
  hasReview?: boolean
  isConfirmed?: boolean
  hasPlagiarismReport?: boolean
  hasSupervisorNotes?: boolean
  hasDefensePrep?: boolean
  hasCalibrationDiff?: boolean
  hasFollowupTasks?: boolean
  savedReviewsCount?: number
  activeFileName?: string
  detectedTitle?: string
  onUploadClick?: () => void
  onAutoFillClick?: () => void
  onStepClick?: (step: number, stepId?: WorkflowStepId) => void
}

export function ThesisWorkflowStepper({
  currentStep,
  activeStepId,
  presetId = "standard_6_step",
  lang = "sk",
  hasDocument,
  isParsing,
  isIndexed,
  chunkCount,
  isFormValid,
  hasPlan = false,
  hasReview = false,
  isConfirmed = false,
  hasPlagiarismReport = false,
  hasSupervisorNotes = false,
  hasDefensePrep = false,
  hasCalibrationDiff = false,
  hasFollowupTasks = false,
  savedReviewsCount = 0,
  activeFileName,
  detectedTitle,
  onUploadClick,
  onAutoFillClick,
  onStepClick,
}: Props) {
  const L = LABELS[lang] || LABELS.sk
  const cleanDocName = formatDocumentDisplayName(activeFileName, detectedTitle)

  const ctx: WorkflowContext = {
    hasDocument,
    isParsing,
    isIndexed,
    chunkCount,
    isFormValid,
    hasPlan,
    hasReview,
    isConfirmed,
    hasPlagiarismReport,
    hasSupervisorNotes,
    hasDefensePrep,
    hasCalibrationDiff,
    hasFollowupTasks,
    savedReviewsCount,
  }

  const stepConfigs = buildWorkflowSteps(presetId)

  const steps = stepConfigs.map((cfg) => {
    const isDone = cfg.checkDone(ctx)
    const isCurrent = activeStepId ? cfg.id === activeStepId : currentStep === cfg.number
    const IconComp = (STEP_ICON_MAP[cfg.iconName] || STEP_ICON_MAP.FileUp) as LucideIcon

    let detail = cfg.description
    if (cfg.id === "document_integrity") {
      detail = hasDocument ? cleanDocName : L.upload
    } else if (cfg.id === "text_understanding") {
      detail = isParsing ? L.parsing : isFormValid ? L.structureVerified : L.metadata
    } else if (cfg.id === "plan_and_rubric") {
      detail = hasPlan ? L.planApproved : isIndexed ? `${chunkCount} chunkov (HNSW ✓)` : L.preflightPlan
    } else if (cfg.id === "evidence_analysis") {
      detail = hasReview ? L.evidenceAnchored : isIndexed ? L.ready : L.vectorRag
    } else if (cfg.id === "draft_review") {
      detail = hasReview ? L.sectionsReady : L.generatingReview
    } else if (cfg.id === "verification_and_export") {
      detail = isConfirmed ? L.confirmedFinal : L.decisionDocx
    }

    return {
      ...cfg,
      done: isDone,
      active: isCurrent,
      icon: IconComp,
      detail,
    }
  })

  const completedCount = steps.filter((s) => s.done).length
  const totalSteps = steps.length
  const progressPercent = Math.round((completedCount / Math.max(1, totalSteps)) * 100)

  return (
    <div
      aria-label={L.ariaLabel}
      className="rounded-xl border bg-card text-card-foreground shadow-2xs overflow-hidden p-4 sm:p-6"
    >
      <div className="relative w-full max-w-5xl mx-auto">
        {/* Background Track */}
        <div className="absolute top-7 left-[5%] right-[5%] h-1.5 bg-muted rounded-full hidden sm:block" />

        {/* Animated Progress Track */}
        <div
          className="absolute top-7 left-[5%] h-1.5 bg-gradient-to-r from-success via-success to-primary rounded-full transition-all duration-1000 ease-in-out hidden sm:block"
          style={{ width: `${Math.min(90, (Math.max(0, currentStep - 1) / Math.max(1, totalSteps - 1)) * 90)}%` }}
        />

        {/* Steps Container */}
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-2">
          {steps.map((s, idx) => {
            const isCurrent = s.active && !s.done
            const isReady = s.id === "draft_review" && isFormValid && isIndexed
            const isActiveState = isCurrent || isReady

            return (
              <div
                key={s.id}
                className="flex flex-row sm:flex-col items-center gap-4 sm:gap-0 group relative z-10 w-full sm:flex-1 cursor-pointer"
                onClick={() => onStepClick?.(s.number, s.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onStepClick?.(s.number, s.id)
                  }
                }}
              >
                {/* Node Circle */}
                <div
                  className={cn(
                    "relative flex items-center justify-center shrink-0 w-11 h-11 sm:w-13 sm:h-13 rounded-full border-4 transition-all duration-500 ease-out shadow-xs",
                    s.done
                      ? "bg-success/10 text-success border-success/30 dark:bg-success/5 dark:border-success/20 dark:text-success"
                      : isActiveState
                      ? "bg-primary text-primary-foreground border-background shadow-md shadow-primary/30 scale-105 sm:scale-115"
                      : "bg-card text-muted-foreground border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
                  )}
                  title={`${s.title} — ${s.detail}`}
                >
                  {s.done ? (
                    <CheckCircle2 className="size-5 sm:size-6 transition-transform group-hover:scale-110 duration-300" />
                  ) : isParsing && s.id === "text_understanding" ? (
                    <Loader2 className="size-5 sm:size-6 animate-spin" />
                  ) : (
                    <s.icon className={cn("size-4.5 sm:size-5.5 transition-transform duration-300", isActiveState ? "animate-in zoom-in duration-500" : "group-hover:scale-110")} />
                  )}

                  {/* Pulsing ring for active state */}
                  {isActiveState && (
                    <div
                      className="absolute inset-0 rounded-full border border-primary animate-ping opacity-30"
                      style={{ animationDuration: "2.5s" }}
                    />
                  )}
                </div>

                {/* Vertical Line for Mobile */}
                {idx < steps.length - 1 && (
                  <div className="absolute top-11 bottom-[-1.5rem] left-5.5 w-0.5 bg-muted sm:hidden" />
                )}
                {/* Mobile Active Track */}
                {idx < steps.length - 1 && (s.done || isActiveState) && (
                  <div
                    className={cn(
                      "absolute top-11 bottom-[-1.5rem] left-5.5 w-0.5 sm:hidden transition-all duration-700",
                      s.done ? "bg-success" : "bg-gradient-to-b from-primary to-transparent"
                    )}
                  />
                )}

                {/* Label Area */}
                <div className="flex flex-col sm:items-center sm:text-center sm:mt-3 flex-1 w-full min-w-0">
                  <div
                    className={cn(
                      "text-[10px] uppercase font-bold tracking-wider mb-0.5 transition-colors duration-300",
                      isActiveState
                        ? "text-primary"
                        : s.done
                        ? "text-success"
                        : "text-muted-foreground"
                    )}
                  >
                    {L.step} {s.number}
                  </div>
                  <div
                    className={cn(
                      "text-xs sm:text-[11px] md:text-xs font-semibold leading-tight transition-colors duration-300 truncate w-full",
                      isActiveState ? "text-foreground font-bold" : "text-foreground/70 group-hover:text-foreground"
                    )}
                  >
                    <span className="hidden xl:inline">{s.title}</span>
                    <span className="xl:hidden">{s.shortTitle}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 opacity-90 transition-opacity truncate w-full max-w-[110px] sm:max-w-full">
                    {s.detail}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Auto-fill affordance */}
        {hasDocument && !isParsing && onAutoFillClick && (
          <div className="absolute -top-2 right-0 sm:top-auto sm:-bottom-3 sm:right-2 hidden md:block">
            <button
              onClick={onAutoFillClick}
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-primary bg-primary/5 hover:bg-primary/15 border border-primary/20 transition-all shadow-xs cursor-pointer group"
              title={L.autofillTitle}
            >
              <Sparkles className="size-3.5 group-hover:rotate-12 transition-transform" />
              <span>{L.autofillMetadata}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
