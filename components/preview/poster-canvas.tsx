"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Columns3, Plus, Ruler, Sparkles } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { useEditor } from "@/components/editor-store"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { TEMPLATE_REGISTRY } from "@/lib/output-types"
import { resolveOutputMetadata } from "@/lib/poster-types"
import { columnBudgetFor, estimateHeight, posterBoardFor, posterColumnHeightMm } from "@/lib/latex"
import type { Card, ColumnIndex } from "@/lib/poster-types"

const COLUMN_GAP_MM = 12
/** Blank strip kept under the last block, mirroring the class' bottom padding. */
const BOTTOM_RESERVE_MM = 30

/** Accent colour of a template: the project's theme override, else the palette. */
export function posterAccentFor(templateId?: string | null, themeColor?: string | null): string {
  if (themeColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(themeColor.trim())) return themeColor.trim()
  const def = TEMPLATE_REGISTRY.find((t) => t.id === templateId)
  return def?.colors?.[0]?.hex ?? "#1d4ed8"
}

/**
 * The poster surface: a real A0 board, drawn to scale.
 *
 * The previous preview was a fixed-width HTML approximation whose column
 * heights had no relationship to the printed board, so a poster that looked
 * full on screen could print with half a column of white space — or overflow
 * the board edge unnoticed. Everything here is derived from the physical
 * geometry in `lib/latex/layout.ts` (`posterBoardFor`), the same column budget
 * validation and the compile-fit report use, and each block is sized by its
 * estimated share of the column. Empty space is therefore *visible and honest*:
 * the hatched region at the bottom of a column is what will print white, and
 * the fill meters say how much of the board is used.
 *
 * Drag/drop and card behaviour stay in the caller; this component owns
 * geometry, proportion and the fill read-out.
 */
export function PosterCanvas({
  cards,
  templateId,
  renderCard,
  renderColumn,
  onAddCard,
  onBalance,
  balancing,
}: {
  cards: Card[]
  templateId?: string | null
  renderCard: (card: Card) => React.ReactNode
  /** Wraps the sized card list (e.g. in a `SortableContext`). */
  renderColumn?: (column: ColumnIndex, cards: Card[], children: React.ReactNode) => React.ReactNode
  onAddCard: (column: ColumnIndex) => void
  /** Redistribute cards across columns to fill the board evenly. */
  onBalance?: () => void
  balancing?: boolean
}) {
  const { project, selectCard, setHeaderUnlocked } = useEditor(
    useShallow((s) => ({
      project: s.project,
      selectCard: s.selectCard,
      setHeaderUnlocked: s.setHeaderUnlocked,
    })),
  )
  const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)
  const metadata = resolveOutputMetadata(project, activeOutput)
  const accent = useMemo(
    () => posterAccentFor(templateId ?? activeOutput?.templateId, activeOutput?.themeColor),
    [templateId, activeOutput?.templateId, activeOutput?.themeColor],
  )

  const board = useMemo(() => posterBoardFor(templateId ?? activeOutput?.templateId), [templateId, activeOutput?.templateId])
  const budget = columnBudgetFor(templateId ?? activeOutput?.templateId)

  const frameRef = useRef<HTMLDivElement | null>(null)
  const [frameWidth, setFrameWidth] = useState(1000)
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setFrameWidth(entry.contentRect.width)
    })
    ro.observe(el)
    setFrameWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // px per millimetre of the physical board. Capped so a very wide monitor does
  // not try to render the 841 mm board at 1:1.
  const scale = Math.max(0.12, Math.min(1.05, (frameWidth - 32) / board.widthMm))
  const bodyFontPx = Math.max(8.5, Math.min(15, 10.5 * (scale / 0.5)))

  const marginPx = board.marginMm * scale
  const titleBandPx = board.titleBandMm * scale
  const columnHeightPx = posterColumnHeightMm(board, BOTTOM_RESERVE_MM) * scale
  const gapPx = 8

  const columnPlans = useMemo(() => {
    const columns = ([1, 2, 3] as ColumnIndex[]).slice(0, board.columnWidths.length)
    return columns.map((column) => {
      const columnCards = cards.filter((card) => card.column === column).sort((a, b) => a.order - b.order)
      const estimated = columnCards.reduce((sum, card) => sum + estimateHeight(card), 0)
      const heights = columnCards.map((card) => (estimateHeight(card) / budget) * columnHeightPx)
      const used = heights.reduce((sum, h) => sum + h, 0) + Math.max(0, columnCards.length - 1) * gapPx
      return {
        column,
        cards: columnCards,
        heights,
        estimated,
        budget,
        fill: budget > 0 ? estimated / budget : 0,
        usedPx: used,
        emptyPx: Math.max(0, columnHeightPx - used),
      }
    })
  }, [cards, board.columnWidths.length, budget, columnHeightPx])

  const fillValues = columnPlans.map((c) => c.fill)
  const coverage = fillValues.length ? fillValues.reduce((a, b) => a + Math.min(1, b), 0) / fillValues.length : 0
  const overBudget = columnPlans.filter((c) => c.fill > 1.02)
  const emptiest = columnPlans.reduce<null | (typeof columnPlans)[number]>((min, c) => (min === null || c.fill < min.fill ? c : min), null)
  const offBalance =
    fillValues.length > 1 && Math.max(...fillValues) - Math.min(...fillValues) > 0.2 && columnPlans.some((c) => c.emptyPx > 60)

  const tone = (fill: number) =>
    fill > 1.02
      ? { bar: "bg-destructive", text: "text-destructive", label: "over budget" }
      : fill >= 0.85
        ? { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "full" }
        : fill >= 0.6
          ? { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "partly filled" }
          : { bar: "bg-sky-500", text: "text-sky-600 dark:text-sky-400", label: "sparse" }

  const editHeader = () => {
    selectCard(null)
    setHeaderUnlocked(true)
  }

  return (
    <div ref={frameRef} className="flex w-full flex-col gap-2">
      {/* ── Fill read-out ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
          <Ruler className="size-3.5 text-muted-foreground" />
          {board.description}
          <span className="font-normal text-muted-foreground">
            · {board.widthMm} × {board.heightMm} mm
          </span>
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {columnPlans.map((plan) => {
            const t = tone(plan.fill)
            return (
              <Tooltip key={plan.column}>
                <TooltipTrigger
                  render={
                    <div
                      className="flex items-center gap-1.5"
                      aria-label={`Column ${plan.column}: ${Math.round(plan.fill * 100)} percent of budget`}
                    >
                      <span className="font-mono text-[10px] text-muted-foreground">C{plan.column}</span>
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", t.bar)}
                          style={{ width: `${Math.min(100, plan.fill * 100)}%` }}
                        />
                      </div>
                      <span className={cn("w-9 font-mono text-[10px] tabular-nums", t.text)}>{Math.round(plan.fill * 100)}%</span>
                    </div>
                  }
                />
                <TooltipContent>
                  Column {plan.column}: {plan.estimated}u of {plan.budget}u ({t.label})
                  {plan.emptyPx > 24 ? ` · ~${Math.round((plan.emptyPx / columnHeightPx) * 100)}% will print white` : ""}
                </TooltipContent>
              </Tooltip>
            )
          })}

          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              coverage >= 0.85
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : coverage >= 0.6
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-sky-500/10 text-sky-600 dark:text-sky-400",
            )}
          >
            {Math.round(coverage * 100)}% of board
          </span>

          {onBalance && columnPlans.length > 1 && (
            <Button
              type="button"
              variant={offBalance ? "default" : "ghost"}
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={onBalance}
              disabled={balancing}
              title="Redistribute cards so every column is filled as evenly as possible"
            >
              <Columns3 className="size-3" />
              {balancing ? "Balancing…" : "Fill canvas"}
            </Button>
          )}
        </div>
      </div>

      {/* ── The board ─────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto pb-1">
        <div
          className="relative mx-auto shrink-0 bg-white text-black shadow-[0_2px_4px_rgba(15,23,42,0.10),0_26px_60px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/10"
          data-poster-board={board.id}
          data-poster-orientation={board.orientation}
          style={{
            width: board.widthMm * scale,
            height: board.heightMm * scale,
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          }}
        >
          {/* Crop marks: a print-shop reminder that this is a physical board. */}
          {["left-1 top-1 border-l border-t", "right-1 top-1 border-r border-t", "left-1 bottom-1 border-l border-b", "right-1 bottom-1 border-r border-b"].map(
            (cls) => (
              <span key={cls} className={cn("pointer-events-none absolute size-3 border-black/25", cls)} aria-hidden />
            ),
          )}

          <div className="flex h-full flex-col overflow-hidden" style={{ padding: marginPx, paddingTop: marginPx * 0.65 }}>
            {/* Title band — click to edit the header in the inspector. */}
            <button
              type="button"
              onClick={editHeader}
              title="Click to edit the header in the right sidebar"
              className="group relative flex shrink-0 items-center justify-between gap-3 overflow-hidden rounded text-left text-white transition-shadow hover:ring-2 hover:ring-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
              style={{
                height: titleBandPx,
                minHeight: 34,
                background: `linear-gradient(115deg, ${accent} 0%, ${accent} 62%, ${shade(accent, -0.22)} 100%)`,
                padding: `0 ${Math.max(6, titleBandPx * 0.14)}px`,
              }}
            >
              {metadata.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={metadata.logoUrl} alt="" className="max-h-[52%] w-auto shrink-0 object-contain" />
              ) : (
                <span className="size-5 shrink-0 rounded-sm bg-white/20" aria-hidden />
              )}
              <span className="min-w-0 flex-1 text-center">
                <span className="block truncate font-bold leading-tight" style={{ fontSize: bodyFontPx * 1.55 }}>
                  {metadata.title}
                </span>
                {metadata.authors && (
                  <span className="block truncate opacity-90" style={{ fontSize: bodyFontPx * 0.9 }}>
                    {metadata.authors}
                  </span>
                )}
                {metadata.venue && (
                  <span className="block truncate italic opacity-80" style={{ fontSize: bodyFontPx * 0.78 }}>
                    {metadata.venue}
                  </span>
                )}
              </span>
              {metadata.secondaryLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={metadata.secondaryLogoUrl} alt="" className="max-h-[52%] w-auto shrink-0 object-contain" />
              ) : (
                <span className="size-5 shrink-0 rounded-sm bg-white/20" aria-hidden />
              )}
            </button>

            <div
              className="grid min-h-0 flex-1"
              style={{
                marginTop: 8,
                gridTemplateColumns: board.columnWidths.map((w) => `${w}fr`).join(" "),
                columnGap: COLUMN_GAP_MM * scale,
              }}
            >
              {columnPlans.map((plan) => {
                const sizedCards = plan.cards.map((card, i) => (
                  <div key={card.id} className="flex flex-col" style={{ minHeight: plan.heights[i] }}>
                    {renderCard(card)}
                  </div>
                ))
                return (
                  <div key={plan.column} className="flex min-w-0 flex-col" style={{ rowGap: gapPx }}>
                    {plan.cards.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => onAddCard(plan.column)}
                        className="flex flex-1 flex-col items-center justify-center gap-1 rounded border border-dashed border-black/20 bg-black/[0.02] text-center text-black/45 transition-colors hover:border-black/40 hover:bg-black/[0.04]"
                        style={{ fontSize: bodyFontPx * 0.85 }}
                      >
                        <Plus className="size-4" />
                        Empty column
                        <span className="text-[0.85em]">Drop cards here or click to add</span>
                      </button>
                    ) : renderColumn ? (
                      renderColumn(plan.column, plan.cards, sizedCards)
                    ) : (
                      sizedCards
                    )}

                    {/* Honest white space: what is left of the column after the
                        estimated block heights. Shown, not hidden. */}
                    {plan.cards.length > 0 && plan.emptyPx > 28 && (
                      <button
                        type="button"
                        onClick={() => onAddCard(plan.column)}
                        aria-label={`Column ${plan.column} is ${Math.round((plan.emptyPx / columnHeightPx) * 100)} percent empty — add a card`}
                        className="group flex flex-1 flex-col items-center justify-center gap-1 rounded border border-dashed border-black/15 bg-[repeating-linear-gradient(45deg,rgba(15,23,42,0.035)_0_6px,transparent_6px_12px)] text-center text-black/40 transition-colors hover:border-black/30 hover:text-black/60"
                        style={{ minHeight: Math.min(plan.emptyPx, 200), fontSize: bodyFontPx * 0.8 }}
                      >
                        <span className="font-mono text-[0.95em] font-semibold">
                          {Math.round((plan.emptyPx / columnHeightPx) * 100)}% white
                        </span>
                        <span className="flex items-center gap-1">
                          <Plus className="size-3" /> add content to fill the board
                        </span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <span className="pointer-events-none absolute bottom-1 right-2 font-mono text-[8px] uppercase tracking-wider text-black/25">
            {board.label} · {cards.length} blocks
          </span>
        </div>
      </div>

      {/* ── Advice ────────────────────────────────────────────────────────── */}
      {(overBudget.length > 0 || offBalance || coverage < 0.6) && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-[11px]",
            overBudget.length
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
          )}
        >
          {overBudget.length > 0 ? <AlertTriangle className="size-3.5" /> : <Sparkles className="size-3.5" />}
          <span>
            {overBudget.length > 0
              ? `Column${overBudget.length > 1 ? "s" : ""} ${overBudget.map((c) => c.column).join(", ")} exceed the ${budget}u budget — the print overflows the board edge.`
              : coverage < 0.6
                ? `Only ${Math.round(coverage * 100)}% of the board is used. Add figures and results, or let the poster stretch the blocks it has.`
                : `Columns are uneven (${Math.round(Math.min(...fillValues) * 100)}%–${Math.round(Math.max(...fillValues) * 100)}%). "Fill canvas" balances them.`}
          </span>
          {offBalance && onBalance && (
            <Button type="button" size="sm" variant="outline" className="ml-auto h-6 px-2 text-[10px]" onClick={onBalance}>
              <Columns3 className="size-3" /> Balance columns
            </Button>
          )}
          {!offBalance && coverage < 0.6 && !overBudget.length && emptiest && (
            <Button type="button" size="sm" variant="outline" className="ml-auto h-6 px-2 text-[10px]" onClick={() => onAddCard(emptiest.column)}>
              <Plus className="size-3" /> Fill column {emptiest.column}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Darken/lighten a hex colour by `amount` (-1…1). */
function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const num = parseInt(m[1], 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const r = clamp(((num >> 16) & 0xff) * (1 + amount))
  const g = clamp(((num >> 8) & 0xff) * (1 + amount))
  const b = clamp((num & 0xff) * (1 + amount))
  return `rgb(${r}, ${g}, ${b})`
}
