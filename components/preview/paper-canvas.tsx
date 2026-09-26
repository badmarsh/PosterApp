"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Eye,
  Maximize2,
  Minus,
  Plus,
  Rows3,
  Type,
} from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { useEditor } from "@/components/editor-store"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { extractCiteKeys } from "@/lib/bib-parser"
import { resolveOutputMetadata } from "@/lib/poster-types"
import {
  PX_PER_MM,
  buildPaperBlocks,
  columnHeightPx,
  columnWidthPx,
  estimateBlockHeight,
  pageSizePx,
  paginatePaper,
  paperGeometryFor,
  summarizePlan,
  type PaperBlock,
} from "@/lib/preview/paper-layout"
import { PaperBlockView, PaperTitleBlock } from "@/components/preview/paper-block"

const ZOOM_STEPS = [0.5, 0.65, 0.8, 1, 1.15, 1.35, 1.6, 1.9]

/**
 * Live paper canvas.
 *
 * A measured, paginated preview of what the LaTeX export will typeset: the same
 * section order, the same two-column or single-column flow, real figure/table
 * numbering, the same reference list and a real page count. Blocks are measured
 * in a hidden probe pass at the exact column width and typographic scale, then
 * flowed into columns by `paginatePaper`; because the placement heights are
 * applied back to the DOM, what the canvas shows *is* the plan — no separate
 * estimate can drift away from the render.
 */
export function PaperCanvas({ className }: { className?: string }) {
  const { project, selectedCardId, selectCard, setInspectorTab, bibEntries } = useEditor(
    useShallow((s) => ({
      project: s.project,
      selectedCardId: s.selectedCardId,
      selectCard: s.selectCard,
      setInspectorTab: s.setInspectorTab,
      bibEntries: s.bibEntries,
    })),
  )

  const output = project.outputs?.find((o) => o.id === project.activeOutputId) ?? project.outputs?.[0]
  const geometry = useMemo(() => paperGeometryFor(output?.templateId), [output?.templateId])
  const meta = useMemo(() => resolveOutputMetadata(project, output ?? null), [project, output])

  const blocks = useMemo(() => {
    if (!output) return [] as PaperBlock[]
    const cited = new Set<string>()
    for (const card of output.cards) {
      const textParts = [card.content]
      if (card.table?.caption) textParts.push(card.table.caption)
      for (const fig of card.figures ?? []) if (fig?.caption) textParts.push(fig.caption)
      for (const key of extractCiteKeys(textParts.join("\n"))) cited.add(key)
    }
    return buildPaperBlocks({ cards: output.cards, bibEntries, citedKeys: [...cited] })
  }, [output, bibEntries])

  // The abstract is rendered inside the title band (as LaTeX does with the
  // frontmatter), so it must not also flow as a column block.
  const abstractBlock = blocks.find((b) => b.kind === "abstract")
  const flowBlocks = useMemo(() => blocks.filter((b) => b.kind !== "abstract"), [blocks])

  // ---------------------------------------------------------------------------
  // Measurement pass
  // ---------------------------------------------------------------------------
  const probeRef = useRef<HTMLDivElement | null>(null)
  const titleProbeRef = useRef<HTMLDivElement | null>(null)
  const heightsRef = useRef<Record<string, number>>({})
  const [heights, setHeights] = useState<Record<string, number>>({})
  const [titleHeight, setTitleHeight] = useState<number | null>(null)
  const probes = useRef<Map<string, HTMLElement>>(new Map())

  const measure = useCallback(
    (block: PaperBlock): number => {
      const measured = heights[block.id]
      if (typeof measured === "number" && measured > 0) return measured
      if (block.kind === "title" && titleHeight) return titleHeight
      return estimateBlockHeight(block, geometry)
    },
    [heights, titleHeight, geometry],
  )

  const runMeasurement = useCallback(() => {
    const next: Record<string, number> = {}
    let changed = false
    for (const [id, el] of probes.current) {
      const h = el.getBoundingClientRect().height
      if (!Number.isFinite(h)) continue
      next[id] = h
      const prev = heightsRef.current[id]
      if (prev === undefined || Math.abs(prev - h) > 0.5) changed = true
    }
    const nextTitle = titleProbeRef.current?.getBoundingClientRect().height ?? null
    if (nextTitle !== null) {
      const prevTitle = heightsRef.current.__title__
      next.__title__ = nextTitle
      if (prevTitle === undefined || Math.abs(prevTitle - nextTitle) > 0.5) changed = true
      setTitleHeight((prev) => (prev === null || Math.abs(prev - nextTitle) > 0.5 ? nextTitle : prev))
    }
    if (!changed) return
    heightsRef.current = next
    setHeights(next)
  }, [])

  // Measure after every render that can change geometry or content, and once
  // web fonts have settled (KaTeX + serif metrics shift block heights).
  useLayoutEffect(() => {
    const raf = requestAnimationFrame(runMeasurement)
    return () => cancelAnimationFrame(raf)
  })

  useEffect(() => {
    let cancelled = false
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => {
        if (!cancelled) requestAnimationFrame(runMeasurement)
      })
    }
    return () => {
      cancelled = true
    }
  }, [runMeasurement])

  // ---------------------------------------------------------------------------
  // Plan
  // ---------------------------------------------------------------------------
  const titleBandHeight = titleHeight ?? estimateBlockHeight({ id: "__title__", cardId: "__title__", kind: "title" }, geometry)
  const plan = useMemo(
    () => paginatePaper(flowBlocks, measure, geometry, { firstPageInset: titleBandHeight + 10 }),
    [flowBlocks, measure, geometry, titleBandHeight],
  )
  const summary = useMemo(() => summarizePlan(plan), [plan])

  // ---------------------------------------------------------------------------
  // Zoom + fit
  // ---------------------------------------------------------------------------
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(900)
  const [zoom, setZoom] = useState(1)
  const [fitWidth, setFitWidth] = useState(true)
  const [showGuides, setShowGuides] = useState(false)
  const [page, setPage] = useState(1)

  const pageSize = pageSizePx(geometry)
  const pageMarginPx = {
    top: geometry.marginTopMm * PX_PER_MM,
    bottom: geometry.marginBottomMm * PX_PER_MM,
    left: geometry.marginLeftMm * PX_PER_MM,
    right: geometry.marginRightMm * PX_PER_MM,
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!fitWidth) return
    const available = Math.max(320, containerWidth - 48)
    setZoom(Math.min(2, Math.max(0.4, available / pageSize.width)))
  }, [fitWidth, containerWidth, pageSize.width])

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), plan.pageCount))
  }, [plan.pageCount])

  const stepZoom = (dir: 1 | -1) => {
    setFitWidth(false)
    setZoom((z) => {
      if (dir === 1) return ZOOM_STEPS.find((s) => s > z + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
      return [...ZOOM_STEPS].reverse().find((s) => s < z - 0.001) ?? ZOOM_STEPS[0]
    })
  }

  const handleSelect = useCallback(
    (block: PaperBlock) => {
      if (block.cardId.startsWith("__")) return
      selectCard(block.cardId)
      setInspectorTab("content")
    },
    [selectCard, setInspectorTab],
  )

  const accent = output?.themeColor ?? "#1d4ed8"
  const isSelected = (block: PaperBlock) => Boolean(selectedCardId) && block.cardId === selectedCardId

  if (!output) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/40 text-sm text-muted-foreground">
        No output selected.
      </div>
    )
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-muted/40", className)}>
      {/* ---------------------------------------------------------------- chrome */}
      <div className="flex h-9 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Type className="size-3" />
            {geometry.label}
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">{summary.pageCount} page{summary.pageCount === 1 ? "" : "s"}</span>
          <span>·</span>
          <span>{summary.figureCount} fig · {summary.tableCount} tab · {summary.referenceCount} ref</span>
          <span
            className={cn(
              "ml-1 rounded-full px-1.5 py-px font-mono text-[10px]",
              summary.averageFill >= 0.85
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : summary.averageFill >= 0.65
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground",
            )}
            title="Mean column fill across all pages except the trailing ones"
          >
            {Math.round(summary.averageFill * 100)}% fill
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 px-1.5", showGuides && "bg-primary/10 text-primary")}
                  onClick={() => setShowGuides((v) => !v)}
                  aria-label="Toggle column guides"
                >
                  <Columns2 className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Column guides &amp; fill meters</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-4 w-px bg-border" />

          <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => stepZoom(-1)} aria-label="Zoom out">
            <Minus className="size-3.5" />
          </Button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className={cn(
              "h-7 min-w-11 rounded px-1 text-[11px] font-medium tabular-nums text-muted-foreground hover:bg-muted",
              fitWidth && "text-primary",
            )}
            title="Click to reset to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => stepZoom(1)} aria-label="Zoom in">
            <Plus className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1 px-1.5 text-[11px]", fitWidth && "bg-primary/10 text-primary")}
            onClick={() => {
              const next = !fitWidth
              setFitWidth(next)
              if (!next) setZoom(1)
            }}
            aria-pressed={fitWidth}
          >
            <Maximize2 className="size-3" /> Fit
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------- the paper */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-muted/40 p-6">
        {flowBlocks.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-md border border-dashed border-border bg-card p-8 text-center">
            <Rows3 className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">This paper has no content yet</p>
            <p className="text-xs text-muted-foreground">
              Add a section in the structure sidebar or use <span className="font-medium">Auto-fill all</span> to draft it from
              your sources. The canvas paginates as you type.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex flex-col items-center gap-6 pb-10">
            {plan.pages.map((pagePlan, pageIdx) => (
              <div key={pagePlan.index} className={cn("flex flex-col items-center", plan.pages.length > 1 && "gap-1")}>
                <div
                  data-paper-page={pagePlan.index}
                  className="relative shrink-0 bg-white text-black shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_28px_-12px_rgba(15,23,42,0.35)] ring-1 ring-black/10"
                  style={{
                    width: pageSize.width * zoom,
                    height: pageSize.height * zoom,
                    fontSize: geometry.baseFontPt * (96 / 72) * zoom,
                    fontFamily:
                      geometry.family === "serif"
                        ? "'Times New Roman', 'Nimbus Roman', 'Liberation Serif', 'Tinos', Georgia, serif"
                        : "'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', sans-serif",
                  }}
                >
                  {/* Running head */}
                  <div
                    className="absolute inset-x-0 flex items-baseline justify-between text-black/45"
                    style={{
                      top: Math.max(4, pageMarginPx.top * zoom * 0.35),
                      paddingLeft: pageMarginPx.left * zoom,
                      paddingRight: pageMarginPx.right * zoom,
                      fontSize: "0.62em",
                    }}
                  >
                    <span className="truncate">
                      {pageIdx === 0 ? "" : (meta.title ?? "").slice(0, 70)}
                    </span>
                    <span className="tabular-nums">
                      {output.templateId.replace(/-/g, " ")}
                    </span>
                  </div>

                  <div
                    className="flex h-full flex-col"
                    style={{
                      paddingTop: pageMarginPx.top * zoom,
                      paddingBottom: pageMarginPx.bottom * zoom,
                      paddingLeft: pageMarginPx.left * zoom,
                      paddingRight: pageMarginPx.right * zoom,
                    }}
                  >
                    {pageIdx === 0 && (
                      <div style={{ height: titleBandHeight * zoom, overflow: "hidden" }}>
                        <PaperTitleBlock
                          title={meta.title}
                          authors={meta.authors}
                          venue={meta.venue}
                          abstract={abstractBlock?.text}
                          accent={accent}
                          abstractLabel="Abstract"
                        />
                      </div>
                    )}

                    <div
                      className="grid min-h-0 flex-1"
                      style={{
                        gridTemplateColumns: geometry.columns === 2 ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)",
                        columnGap: geometry.columnGutterMm * PX_PER_MM * zoom,
                        marginTop: pageIdx === 0 ? 10 * zoom : 0,
                      }}
                    >
                      {pagePlan.columns.map((column) => (
                        <div
                          key={column.index}
                          className={cn("relative min-w-0", showGuides && "outline outline-1 outline-dashed outline-sky-400/40")}
                        >
                          {column.placements.map((placement) => (
                            <div
                              key={placement.block.id}
                              style={{ height: placement.height * zoom, overflow: "hidden" }}
                              className="relative"
                            >
                              <PaperBlockView
                                block={placement.block}
                                geometry={geometry}
                                accent={accent}
                                showGuides={showGuides}
                                interactive
                                selected={isSelected(placement.block)}
                                onSelect={() => handleSelect(placement.block)}
                              />
                            </div>
                          ))}
                          {showGuides && (
                            <div className="pointer-events-none absolute -right-2 top-0 h-full w-1 rounded bg-black/[0.06]">
                              <div
                                className="absolute bottom-0 w-full rounded bg-sky-500/50"
                                style={{ height: `${Math.min(100, Math.round((column.usedHeight / Math.max(1, column.capacity)) * 100))}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Folio */}
                  <div
                    className="absolute inset-x-0 text-center tabular-nums text-black/55"
                    style={{ bottom: Math.max(4, pageMarginPx.bottom * zoom * 0.3), fontSize: "0.66em" }}
                  >
                    {pagePlan.index}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- page bar */}
      {plan.pageCount > 1 && (
        <div className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-card px-3 text-[11px] text-muted-foreground">
          <span>
            {summary.blockCount} blocks · {Math.round(summary.averageFill * 100)}% mean column fill
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="tabular-nums">
              {page} / {plan.pageCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1"
              onClick={() => setPage((p) => Math.min(plan.pageCount, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[11px]"
              onClick={() => {
                const el = scrollRef.current?.querySelector<HTMLElement>(`[data-paper-page="${page}"]`)
                el?.scrollIntoView({ behavior: "smooth", block: "center" })
              }}
            >
              <Eye className="size-3" /> Go to page
            </Button>
          </div>
        </div>
      )}

      {plan.unplaced.length > 0 && (
        <div className="flex items-start gap-2 border-t border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span>
            {plan.unplaced.length} block{plan.unplaced.length === 1 ? "" : "s"} cannot fit a whole column (
            {plan.unplaced.map((b) => b.cardId).slice(0, 3).join(", ")}
            {plan.unplaced.length > 3 ? "…" : ""}). Shrink the figure/table or split the card — in LaTeX this is an
            overfull column too.
          </span>
        </div>
      )}

      {/* -------------------------------------------------------------- probe layer */}
      <div aria-hidden className="pointer-events-none fixed -left-[10000px] top-0 opacity-0">
        <div ref={probeRef} style={{ width: pageSize.width, fontFamily: geometry.family === "serif" ? "'Times New Roman', 'Nimbus Roman', 'Liberation Serif', 'Tinos', Georgia, serif" : "'Helvetica Neue', Helvetica, Arial, sans-serif", fontSize: geometry.baseFontPt * (96 / 72) }}>
          <div style={{ paddingLeft: pageMarginPx.left, paddingRight: pageMarginPx.right }}>
            <div style={{ width: pageSize.width - pageMarginPx.left - pageMarginPx.right }}>
              <PaperTitleBlock
                title={meta.title}
                authors={meta.authors}
                venue={meta.venue}
                abstract={abstractBlock?.text}
                accent={accent}
                abstractLabel="Abstract"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: geometry.columns === 2 ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)", columnGap: geometry.columnGutterMm * PX_PER_MM }}>
              {[0, 1].slice(0, geometry.columns).map((col) => (
                <div key={col} style={{ width: columnWidthPx(geometry) }}>
                  {flowBlocks
                    .filter((_, i) => i % geometry.columns === col)
                    .map((block) => (
                      <div
                        key={`${col}-${block.id}`}
                        ref={(el) => {
                          if (el) probes.current.set(block.id, el)
                          else probes.current.delete(block.id)
                        }}
                      >
                        <PaperBlockView block={block} geometry={geometry} accent={accent} />
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
