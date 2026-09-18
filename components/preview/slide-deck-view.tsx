"use client"

import { Grid2X2, List, MonitorPlay, Plus } from "lucide-react"
import { TemplateHeader } from "@/components/template-header"
import { cn } from "@/lib/utils"
import type { Card } from "@/lib/poster-types"

export function SlideDeckView({
  cards,
  renderCard,
  renderContent,
  onAdd,
}: {
  cards: Card[]
  renderCard: (card: Card, index: number) => React.ReactNode
  renderContent?: () => React.ReactNode
  onAdd: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-5 py-6 pb-20">
      <TemplateHeader variant="slides" />
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2"><MonitorPlay className="size-4 text-primary" /><span className="text-[13px] font-bold">Slides</span><span className="rounded-full bg-muted px-2 py-px font-mono text-[10px] text-muted-foreground">{cards.length}</span></div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5" aria-label="Slide view">
          <button type="button" className="rounded p-1 text-primary" aria-label="List view"><List className="size-3.5" /></button>
          <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Grid view"><Grid2X2 className="size-3.5" /></button>
        </div>
      </div>
      <div className="flex flex-col gap-2">{renderContent ? renderContent() : cards.map(renderCard)}</div>
      <button type="button" onClick={onAdd} className={cn("mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-primary")}><Plus className="size-3.5" /> Add Slide</button>
    </div>
  )
}
