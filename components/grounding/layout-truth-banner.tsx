"use client"

import { AlertTriangle, WandSparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CardLayoutTruth } from "@/lib/poster-types"

export function LayoutTruthBanner({
  layout,
  onAutoShrink,
  isShrinking = false,
  compact = false,
}: {
  layout?: CardLayoutTruth
  onAutoShrink: () => void
  isShrinking?: boolean
  compact?: boolean
}) {
  if (!layout?.overBudget) return null
  const delta = Math.max(0, Math.round(layout.delta || (layout.estimatedHeight ?? 0) - (layout.budget ?? 0)))
  return (
    <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-warning" role="status">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 text-[10px] font-medium">
        {compact ? `+${delta}u over budget` : `Layout overflow: +${delta}u over budget`}
      </span>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="h-6 shrink-0 gap-1 border-warning/40 bg-background/50 px-2 text-[10px] text-warning hover:bg-warning/10"
        onClick={onAutoShrink}
        disabled={isShrinking}
      >
        <WandSparkles className="size-3" />
        {isShrinking ? "Shrinking…" : "Auto-Shrink Content"}
      </Button>
    </div>
  )
}
