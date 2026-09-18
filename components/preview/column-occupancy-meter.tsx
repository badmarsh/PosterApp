"use client"

import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { estimatePosterColumnOccupancy } from "@/lib/latex"
import type { Card, ColumnIndex } from "@/lib/poster-types"

export function occupancyTone(percent: number) {
  if (percent > 100) return { bar: "bg-destructive", text: "text-destructive", label: "Over budget" }
  if (percent >= 85) return { bar: "bg-warning", text: "text-warning", label: "Near budget" }
  return { bar: "bg-success", text: "text-success", label: "Within budget" }
}

/** Vertical gutter heatmap: the fill is visible even when card labels are hidden. */
export function ColumnOccupancyMeter({
  cards,
  templateId,
  column,
}: {
  cards: Card[]
  templateId?: string | null
  column: ColumnIndex
}) {
  const occupancy = estimatePosterColumnOccupancy(cards, templateId).find((item) => item.column === column)
  if (!occupancy) return null
  const percent = Math.round((occupancy.estimatedHeight / occupancy.budget) * 100)
  const tone = occupancyTone(percent)
  return (
    <div className="group relative flex w-3 shrink-0 flex-col items-center justify-start pt-8" aria-label={`Column ${column}: ${percent}% occupied`}>
      <div className="relative h-full min-h-40 w-1 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent, 999)}>
        <div className={cn("absolute inset-x-0 bottom-0 rounded-full transition-all duration-300", tone.bar)} style={{ height: `${Math.min(100, Math.max(2, percent))}%` }} />
        {percent > 100 && <div className="absolute -left-1/2 top-0 size-2 animate-pulse rounded-full bg-destructive ring-2 ring-background" />}
      </div>
      <span className={cn("mt-1 [writing-mode:vertical-rl] text-[8px] font-mono font-semibold opacity-0 transition-opacity group-hover:opacity-100", tone.text)}>
        {percent}%
      </span>
      {percent > 100 && <AlertTriangle className="absolute -right-1 top-5 size-3 text-destructive" aria-hidden="true" />}
      <span className="sr-only">{tone.label}: {occupancy.estimatedHeight} of {occupancy.budget} units</span>
    </div>
  )
}
