"use client"

import { BookOpen, Plus } from "lucide-react"
import { TemplateHeader } from "@/components/template-header"
import type { Card } from "@/lib/poster-types"

export function PaperDocumentView({
  cards,
  renderCard,
  renderContent,
  onAdd,
}: {
  cards: Card[]
  renderCard: (card: Card) => React.ReactNode
  renderContent?: () => React.ReactNode
  onAdd: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-5 py-6 pb-20">
      <TemplateHeader variant="paper" />
      <div className="mb-3 flex items-center gap-2"><BookOpen className="size-4 text-primary" /><span className="text-sm font-bold">Paper Sections</span><span className="rounded-full bg-muted px-2 py-px font-mono text-[10px] text-muted-foreground">{cards.length}</span></div>
      <div className="flex flex-col gap-2">{renderContent ? renderContent() : cards.map(renderCard)}</div>
      <button type="button" onClick={onAdd} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-primary"><Plus className="size-3.5" /> Add Section</button>
    </div>
  )
}
