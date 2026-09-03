"use client"

/**
 * ReviewGenerationProgress — live progress card for long-running professional
 * review generations. Subscribes to the SSE-backed review job in the store and
 * shows the current stage ("retrieval 13/13 · primary review · self-critique"),
 * an overall progress bar, and a Cancel button.
 */

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  XCircle,
  FileSearch,
  ListChecks,
  PenLine,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
} from "lucide-react"
import type { ReviewLanguage } from "@/lib/ai/thesis-rubric"

export interface ReviewJobSnapshot {
  stage: string
  detail: string
  progress: number
  status: "running" | "done" | "error" | "cancelled"
}

const STAGE_META: Record<string, { icon: typeof FileSearch; sk: string; en: string; cs: string }> = {
  queued: { icon: Loader2, sk: "V poradí", cs: "Ve frontě", en: "Queued" },
  loading_context: { icon: FileSearch, sk: "Načítam dokument", cs: "Načítám dokument", en: "Loading manuscript" },
  retrieval: { icon: FileSearch, sk: "Vyhľadávam dôkazy (RAG)", cs: "Vyhledávám důkazy (RAG)", en: "Retrieving evidence" },
  criterion_reviews: { icon: ListChecks, sk: "Hodnotím kritériá po jednom", cs: "Hodnotím kritéria", en: "Reviewing criteria" },
  primary_review: { icon: PenLine, sk: "Píšem hlavný posudok", cs: "Píši hlavní posudek", en: "Writing primary review" },
  self_critique: { icon: ShieldAlert, sk: "Sebakritika a kontrola tvrdení", cs: "Sebekritika", en: "Self-critique" },
  synthesis: { icon: Sparkles, sk: "Záverečná syntéza a známka", cs: "Závěrečná syntéza", en: "Final synthesis" },
  persisting: { icon: CheckCircle2, sk: "Ukladám posudok", cs: "Ukládám posudek", en: "Saving review" },
  done: { icon: CheckCircle2, sk: "Hotovo", cs: "Hotovo", en: "Done" },
}

const STAGE_ORDER = [
  "loading_context",
  "retrieval",
  "criterion_reviews",
  "primary_review",
  "self_critique",
  "synthesis",
  "persisting",
]

interface Props {
  job: ReviewJobSnapshot
  language?: ReviewLanguage
  onCancel: () => void
}

export function ReviewGenerationProgress({ job, language = "sk", onCancel }: Props) {
  const meta = STAGE_META[job.stage] ?? STAGE_META.queued
  const Icon = meta.icon
  const label = language === "en" ? meta.en : language === "cs" ? meta.cs : meta.sk

  const stageIndex = STAGE_ORDER.indexOf(job.stage)
  const steps = useMemo(() => {
    // Agentic path shows criterion_reviews instead of primary_review; both
    // display as the same linear progression for the user.
    return [
      "loading_context",
      "retrieval",
      job.stage === "primary_review" ? "primary_review" : "criterion_reviews",
      "self_critique",
      "synthesis",
      "persisting",
    ]
  }, [job.stage])
  const activeIdx = stageIndex < 0 ? steps.length - 1 : Math.min(stageIndex, steps.length - 1)

  const progress = Math.max(2, Math.min(99, Math.round(job.progress ?? 0)))

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              {label}
            </p>
            <p className="text-xs text-muted-foreground truncate" title={job.detail}>
              {job.detail && job.detail !== job.stage ? job.detail : label}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive gap-1.5 shrink-0"
          onClick={onCancel}
        >
          <XCircle className="h-3.5 w-3.5" />
          Zrušiť
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stage stepper */}
      <div className="flex items-center justify-between gap-1">
        {steps.map((s, i) => {
          const StepIcon = STAGE_META[s]?.icon ?? FileSearch
          const done = i < activeIdx
          const active = i === activeIdx
          return (
            <div key={s} className="flex items-center gap-1 flex-1 last:flex-none">
              <div
                className={`flex items-center justify-center h-6 w-6 rounded-full shrink-0 transition-colors ${
                  done
                    ? "bg-primary/15 text-primary"
                    : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground/50"
                }`}
                title={STAGE_META[s]?.[language === "en" ? "en" : language === "cs" ? "cs" : "sk"]}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : active ? (
                  <StepIcon className="h-3.5 w-3.5 animate-pulse" />
                ) : (
                  <StepIcon className="h-3 w-3" />
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={`h-px flex-1 ${done ? "bg-primary/40" : "bg-border"}`} />
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {language === "en"
          ? "Professional reviews retrieve evidence, evaluate each criterion, then run a self-critique — this can take 5–20 minutes. You can safely cancel; no partial review is saved."
          : language === "cs"
          ? "Profesionální posudek vyhledává důkazy, hodnotí každé kritérium zvlášť a prochází sebekritikou — může trvat 5–20 minut. Zrušení neuloží žádný částečný posudek."
          : "Profesionálny posudok vyhľadáva dôkazy, hodnotí každé kritérium zvlášť a prechádza sebakritikou — môže trvať 5–20 minút. Zrušením sa neuloží žiadny čiastočný posudok."}
      </p>
    </div>
  )
}
