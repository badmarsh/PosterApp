"use client"

import { Plus } from "lucide-react"
import { TemplateHeader } from "@/components/template-header"
import { ColumnOccupancyMeter } from "./column-occupancy-meter"
import type { Card, ColumnIndex } from "@/lib/poster-types"

/**
 * The layout-only poster surface. Drag/drop and card behavior stay in the
 * caller; this component owns the invariant three-column geometry and gutter
 * occupancy heatmap, making it straightforward to test independently.
 */
export function PosterCanvas({
  cards,
  templateId,
  renderCard,
  renderColumn,
  onAddCard,
}: {
  cards: Card[]
  templateId?: string | null
  renderCard: (card: Card) => React.ReactNode
  renderColumn?: (column: ColumnIndex, cards: Card[]) => React.ReactNode
  onAddCard: (column: ColumnIndex) => void
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <TemplateHeader variant="poster" />
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="flex min-w-[720px] gap-2 p-3 sm:min-w-[760px] md:min-w-0">
        {[1, 2, 3].map((column, index) => {
          const col = column as ColumnIndex
          const columnCards = cards.filter((card) => card.column === col).sort((a, b) => a.order - b.order)
          return (
            <div key={col} className="contents">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="mb-1.5 flex items-center justify-between border-b border-dashed border-border pb-1">
                  <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Col {col}</span>
                  <span className="text-[10px] text-muted-foreground">{columnCards.length} blocks</span>
                </div>
                <div className="flex min-h-[100px] flex-col gap-2 rounded-md p-1">
                  {renderColumn ? renderColumn(col, columnCards) : columnCards.length ? columnCards.map(renderCard) : (
                    <div className="rounded-md border border-dashed border-border px-2 py-6 text-center text-[10px] text-muted-foreground">Drop cards here</div>
                  )}
                  <button type="button" onClick={() => onAddCard(col)} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-primary">
                    <Plus className="size-3.5" /> Add Card
                  </button>
                </div>
              </div>
              {index < 2 && <ColumnOccupancyMeter cards={cards} templateId={templateId} column={col} />}
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
