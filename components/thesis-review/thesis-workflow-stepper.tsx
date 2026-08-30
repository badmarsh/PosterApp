"use client"

/**
 * ThesisWorkflowStepper — Compact, dynamic interactive 6-stage pipeline rail for academic reviews.
 * Displays real-time stage progression across:
 *  1. Podklad a integrita (Source document integrity & parse quality)
 *  2. Porozumenie textu (Document understanding, structure & classifier)
 *  3. Plán a rubrika (Pre-flight evaluation plan & rubric applicability)
 *  4. Dôkazová analýza (Evidence-grounded retrieval & epistemic findings)
 *  5. Návrh posudku (14-section draft review composer)
 *  6. Verifikácia a export (Human verification, defense questions & DOCX/PDF export)
 */

import { CheckCircle2, Loader2, FileUp, Cpu, Compass, SearchCode, FileEdit, Award, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDocumentDisplayName } from "@/lib/ingestion"

export type PipelineStep = 1 | 2 | 3 | 4 | 5 | 6

interface Props {
  currentStep: PipelineStep
  hasDocument: boolean
  isParsing: boolean
  isIndexed: boolean
  chunkCount: number
  isFormValid: boolean
  hasPlan?: boolean
  hasReview?: boolean
  isConfirmed?: boolean
  activeFileName?: string
  detectedTitle?: string
  onUploadClick?: () => void
  onAutoFillClick?: () => void
  onStepClick?: (step: PipelineStep) => void
}

export function ThesisWorkflowStepper({
  currentStep,
  hasDocument,
  isParsing,
  isIndexed,
  chunkCount,
  isFormValid,
  hasPlan,
  hasReview,
  isConfirmed,
  activeFileName,
  detectedTitle,
  onUploadClick,
  onAutoFillClick,
  onStepClick,
}: Props) {
  const cleanDocName = formatDocumentDisplayName(activeFileName, detectedTitle)

  const steps = [
    {
      num: 1 as PipelineStep,
      title: "1. Podklad & Integrita",
      shortTitle: "Integrita",
      detail: hasDocument ? cleanDocName : "Nahrajte PDF",
      done: hasDocument && !isParsing,
      active: currentStep === 1,
      icon: FileUp,
    },
    {
      num: 2 as PipelineStep,
      title: "2. Porozumenie textu",
      shortTitle: "Porozumenie",
      detail: isParsing ? "Parsovanie…" : isFormValid ? "Štruktúra overená" : "Metadáta",
      done: hasDocument && !isParsing && isFormValid,
      active: currentStep === 2 || isParsing,
      icon: Cpu,
    },
    {
      num: 3 as PipelineStep,
      title: "3. Plán & Rubrika",
      shortTitle: "Plán",
      detail: hasPlan ? "Plán schválený" : isIndexed ? `${chunkCount} chunkov (HNSW ✓)` : "Pre-flight plán",
      done: Boolean(hasPlan || (isIndexed && isFormValid)),
      active: currentStep === 3,
      icon: Compass,
    },
    {
      num: 4 as PipelineStep,
      title: "4. Dôkazová analýza",
      shortTitle: "Dôkazy",
      detail: hasReview ? "Dôkazy ukotvené" : isIndexed ? "Pripravené" : "Vektorový RAG",
      done: Boolean(hasReview),
      active: currentStep === 4,
      icon: SearchCode,
    },
    {
      num: 5 as PipelineStep,
      title: "5. Návrh posudku",
      shortTitle: "Návrh",
      detail: hasReview ? "14 sekcií pripravených" : "Generovanie posudku",
      done: Boolean(hasReview),
      active: currentStep === 5,
      icon: FileEdit,
    },
    {
      num: 6 as PipelineStep,
      title: "6. Verifikácia & Export",
      shortTitle: "Export",
      detail: isConfirmed ? "Potvrdené (Finál)" : "Rozhodnutie & DOCX",
      done: Boolean(isConfirmed),
      active: currentStep === 6,
      icon: Award,
    },
  ]

  const completedCount = steps.filter((s) => s.done).length
  const progressPercent = Math.round((completedCount / 6) * 100)

  return (
    <div
      aria-label="Kroky hodnotenia záverečnej práce"
      className="rounded-xl border bg-card text-card-foreground shadow-2xs overflow-hidden p-4 sm:p-6 lg:p-8"
    >
      <div className="relative w-full max-w-5xl mx-auto">
        {/* Background Track (Hidden on smallest screens where we might stack, but here we can just do overflow-x-auto or scale down) */}
        <div className="absolute top-7 left-[8%] right-[8%] h-1.5 bg-muted rounded-full hidden sm:block" />

        {/* Animated Progress Track */}
        <div
          className="absolute top-7 left-[8%] h-1.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-[#8B2635] rounded-full transition-all duration-1000 ease-in-out hidden sm:block"
          style={{ width: `${Math.min(100, (Math.max(0, currentStep - 1) / 5) * 84)}%` }}
        />

        {/* Steps Container */}
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-0">
          {steps.map((s, idx) => {
            const isCurrent = s.active && !s.done
            const isReady = s.num === 5 && isFormValid && isIndexed
            const isActiveState = isCurrent || isReady

            return (
              <div
                key={s.num}
                className="flex flex-row sm:flex-col items-center gap-4 sm:gap-0 group relative z-10 w-full sm:w-[16%] cursor-pointer"
                onClick={() => onStepClick?.(s.num)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onStepClick?.(s.num)
                  }
                }}
              >
                {/* Node Circle */}
                <div
                  className={cn(
                    "relative flex items-center justify-center shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 transition-all duration-500 ease-out shadow-sm",
                    s.done
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800/60 dark:text-emerald-400"
                      : isActiveState
                      ? "bg-[#8B2635] text-white border-white dark:border-zinc-900 shadow-md shadow-[#8B2635]/30 scale-110 sm:scale-125"
                      : "bg-card text-muted-foreground border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
                  )}
                  title={`${s.title} — ${s.detail}`}
                >
                  {s.done ? (
                    <CheckCircle2 className="size-6 sm:size-7 transition-transform group-hover:scale-110 duration-300" />
                  ) : isParsing && s.num === 2 ? (
                    <Loader2 className="size-6 sm:size-7 animate-spin" />
                  ) : (
                    <s.icon className={cn("size-5 sm:size-6 transition-transform duration-300", isActiveState ? "animate-in zoom-in duration-500" : "group-hover:scale-110")} />
                  )}

                  {/* Pulsing ring for active state */}
                  {isActiveState && (
                    <div
                      className="absolute inset-0 rounded-full border border-[#8B2635] animate-ping opacity-30"
                      style={{ animationDuration: '2.5s' }}
                    />
                  )}
                </div>

                {/* Vertical Line for Mobile (connects nodes when stacked) */}
                {idx < steps.length - 1 && (
                  <div className="absolute top-12 bottom-[-1.5rem] left-6 w-0.5 bg-muted sm:hidden" />
                )}
                {/* Mobile Active Track */}
                {idx < steps.length - 1 && (s.done || isActiveState) && (
                  <div
                    className={cn(
                      "absolute top-12 bottom-[-1.5rem] left-6 w-0.5 sm:hidden transition-all duration-700",
                      s.done ? "bg-emerald-500" : "bg-gradient-to-b from-[#8B2635] to-transparent"
                    )}
                  />
                )}

                {/* Label Area */}
                <div className="flex flex-col sm:items-center sm:text-center sm:mt-4 flex-1 w-full min-w-0">
                  <div
                    className={cn(
                      "text-[10px] uppercase font-bold tracking-wider mb-1 transition-colors duration-300",
                      isActiveState
                        ? "text-[#8B2635] dark:text-[#E06D7B]"
                        : s.done
                        ? "text-emerald-600 dark:text-emerald-500"
                        : "text-muted-foreground"
                    )}
                  >
                    Krok {s.num}
                  </div>
                  <div
                    className={cn(
                      "text-sm sm:text-[13px] md:text-sm font-semibold leading-tight transition-colors duration-300 truncate w-full",
                      isActiveState ? "text-foreground" : "text-foreground/70 group-hover:text-foreground"
                    )}
                  >
                    <span className="hidden lg:inline">{s.title.replace(/^\d+\.\s*/, '')}</span>
                    <span className="lg:hidden">{s.shortTitle}</span>
                  </div>
                  <div className="text-[11px] sm:text-[10px] md:text-[11px] text-muted-foreground mt-1 sm:mt-1.5 opacity-90 transition-opacity truncate w-full max-w-[120px] sm:max-w-full">
                    {s.detail}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Auto-fill affordance (Mobile only inside the flow, or absolute on desktop) */}
        {hasDocument && !isParsing && onAutoFillClick && (
          <div className="absolute -top-3 right-0 sm:top-auto sm:-bottom-4 sm:right-4 hidden md:block">
            <button
              onClick={onAutoFillClick}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#8B2635] dark:text-[#E06D7B] bg-[#8B2635]/5 hover:bg-[#8B2635]/15 border border-[#8B2635]/20 transition-all shadow-sm cursor-pointer group"
              title="Predvyplniť metadáta z nahraného PDF"
            >
              <Sparkles className="size-4 group-hover:rotate-12 transition-transform" />
              <span>Predvyplniť metadáta</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
