"use client"

import { AlertTriangle } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { Label } from "@/components/ui/label"
import type { Card } from "@/lib/poster-types"
import { estimateHeightBreakdown, columnBudgetFor } from "@/lib/latex/layout"
import { cn } from "@/lib/utils"

export function RagSourcesIllustration() {
  return (
    <svg
      viewBox="0 0 56 40"
      className="size-full shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Back doc */}
      <rect x="14" y="6" width="22" height="28" rx="2" className="fill-muted stroke-border/70" strokeWidth="1" />
      {/* Front doc */}
      <rect x="8" y="10" width="22" height="28" rx="2" className="fill-card stroke-border" strokeWidth="1.2" />
      <rect x="12" y="14" width="8" height="2" rx="0.5" className="fill-primary" />
      <rect x="12" y="18" width="14" height="1.5" rx="0.5" className="fill-muted-foreground/40" />
      <rect x="12" y="21" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="12" y="24" width="14" height="1.5" rx="0.5" className="fill-muted-foreground/30" />

      {/* RAG Context Filter Shield / Funnel */}
      <circle cx="38" cy="22" r="10" className="fill-background stroke-primary/50" strokeWidth="1.2" />
      <path
        d="M33 17H43L39 22V27L37 28V22L33 17Z"
        className="fill-primary/20 stroke-primary"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Sparkle */}
      <path d="M47 8L48 11L51 12L48 13L47 16L46 13L43 12L46 11L47 8Z" className="fill-warning" />
    </svg>
  )
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <Label className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
      <span className="uppercase tracking-wide">{children}</span>
      {hint && <span className="font-mono text-[10px] normal-case">{hint}</span>}
    </Label>
  )
}

/**
 * Live column-budget meter for the Content tab: renders the same
 * estimateHeightBreakdown model that validation uses, so the bar and the
 * overflow warning can never disagree. Soft threshold at 85%, hard at 100%.
 */
export function HeightMeter({ card, templateId }: { card: Card; templateId?: string | null }) {
  const breakdown = estimateHeightBreakdown(card)
  const budget = columnBudgetFor(templateId)
  const target = card.heightBudget && card.heightBudget > 0 ? card.heightBudget : null
  const effectiveBudget = target ?? budget
  const ratio = Math.min(breakdown.total / effectiveBudget, 1)
  const percent = Math.round((breakdown.total / effectiveBudget) * 100)
  const overSoft = breakdown.total > effectiveBudget * 0.85
  const overHard = breakdown.total > effectiveBudget

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <FieldLabel hint={`column max ${budget}u`}>Height budget usage</FieldLabel>
        <span
          className={cn(
            "font-mono text-[10px]",
            overHard ? "text-destructive" : overSoft ? "text-warning" : "text-success",
          )}
        >
          {breakdown.total}u / {effectiveBudget}u ({percent}%)
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={Math.min(percent, 999)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Card height usage relative to column budget"
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-150",
            overHard ? "bg-destructive" : overSoft ? "bg-warning" : "bg-success",
          )}
          style={{ width: `${Math.max(ratio * 100, breakdown.total > 0 ? 3 : 0)}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {overHard ? (
          <>
            Over budget by {breakdown.total - effectiveBudget}u — likely overflow.
            {target && effectiveBudget !== budget ? ` Custom target (${target}u) is stricter than the ${templateId ?? "default"} column (${budget}u).` : ""}
          </>
        ) : overSoft ? (
          <>Close to the {effectiveBudget}u budget — the validation tab will warn above 85%.</>
        ) : (
          <>
            {breakdown.prose > 0 && `${breakdown.prose}u prose`}
            {breakdown.bullets > 0 && `${breakdown.prose > 0 ? " · " : ""}${breakdown.bullets}u bullets`}
            {breakdown.table > 0 && `${breakdown.prose + breakdown.bullets > 0 ? " · " : ""}${breakdown.table}u table`}
            {breakdown.figures > 0 && `${breakdown.total - breakdown.prose - breakdown.bullets - breakdown.table > 0 ? " · " : ""}${breakdown.figures}u figures`}
            {breakdown.total <= 70 && "empty — add content"}
          </>
        )}
      </p>
    </div>
  )
}
