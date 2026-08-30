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
    <nav
      aria-label="Kroky hodnotenia záverečnej práce"
      className="rounded-xl border bg-card text-card-foreground shadow-2xs overflow-hidden"
    >
      {/* Horizontal Rail */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between p-1.5 sm:p-2 gap-1.5 sm:gap-2 bg-muted/10">
        <ol role="list" className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-nowrap items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
          {steps.map((s) => {
            const isCurrent = s.active && !s.done
            const isReady = s.num === 5 && isFormValid && isIndexed

            return (
              <li key={s.num} role="listitem" className="flex items-center gap-1 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => onStepClick?.(s.num)}
                  aria-current={isCurrent || isReady ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 w-full px-2 py-1.5 rounded-lg border text-left transition-all text-xs cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                    s.done
                      ? "border-emerald-500/20 bg-emerald-500/5 text-muted-foreground hover:text-foreground hover:bg-emerald-500/10 hover:border-emerald-500/30"
                      : isReady
                      ? "border-[#8B2635]/60 bg-[#8B2635]/10 text-foreground font-semibold ring-1 ring-[#8B2635]/20 shadow-2xs"
                      : isCurrent
                      ? "border-[#8B2635] bg-card text-foreground font-semibold shadow-2xs ring-1 ring-[#8B2635]/30"
                      : "border-transparent bg-transparent text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30"
                  )}
                  title={`${s.title} — ${s.detail}`}
                >
                  {/* Step Badge */}
                  <div
                    className={cn(
                      "flex size-4.5 sm:size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-transform",
                      s.done
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : isReady || isCurrent
                        ? "bg-[#8B2635] text-white"
                        : "bg-muted text-muted-foreground/60"
                    )}
                  >
                    {s.done ? (
                      <CheckCircle2 className="size-3 sm:size-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : isParsing && s.num === 2 ? (
                      <Loader2 className="size-3 animate-spin text-white" />
                    ) : (
                      <span>{s.num}</span>
                    )}
                  </div>

                  {/* Step Title & Subtitle */}
                  <div className="min-w-0 flex-1 truncate">
                    <p
                      className={cn(
                        "text-[10px] sm:text-[11px] truncate leading-tight",
                        isCurrent || isReady
                          ? "font-bold text-foreground"
                          : s.done
                          ? "font-medium text-foreground/80"
                          : "font-normal text-muted-foreground/70"
                      )}
                    >
                      <span className="hidden xl:inline">{s.title}</span>
                      <span className="xl:hidden">{s.shortTitle}</span>
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate leading-none pt-0.5">
                      {s.detail}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ol>

        {/* Right quick auto-fill affordance */}
        {hasDocument && !isParsing && onAutoFillClick && (
          <button
            onClick={onAutoFillClick}
            type="button"
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#8B2635] dark:text-[#E06D7B] bg-[#8B2635]/5 hover:bg-[#8B2635]/10 border border-[#8B2635]/20 transition-all shrink-0 cursor-pointer self-end md:self-auto"
            title="Predvyplniť metadáta z nahraného PDF"
          >
            <Sparkles className="size-3.5" />
            <span className="hidden md:inline text-[11px]">Predvyplniť</span>
          </button>
        )}
      </div>

      {/* Subtle progress track */}
      <div className="h-0.5 w-full bg-muted/40 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-[#8B2635] to-[#8B2635] transition-all duration-300"
          style={{ width: `${Math.max(6, progressPercent)}%` }}
        />
      </div>
    </nav>
  )
}
