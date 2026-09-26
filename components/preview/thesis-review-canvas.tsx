"use client"

/**
 * Live posudok canvas.
 *
 * Renders the A4 pages the LaTeX export will typeset — letterhead, title block,
 * identification table, evaluation blocks, the weighted criteria overview, the
 * per-criterion commentary with its rating, defence questions, citation notes,
 * the grade panel and the signature block — using the *same* design descriptor
 * (`THESIS_REVIEW_STYLES`) the generator reads. Switching between the six
 * posudok templates therefore changes the page here exactly as it changes the
 * PDF: a Slovak form gets a stacked letterhead and boxed classification, a
 * German Gutachten an accent bar and a shaded note panel, a Polish recenzja a
 * two-column header and a circled grade.
 *
 * Blocks are measured in a hidden probe pass and paginated by
 * `paginateThesisBlocks`, so the page count and the page breaks shown are the
 * ones the document will have.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { FileText, Minus, Plus, ScanSearch, Target, ZoomIn } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { useEditor } from "@/components/editor-store"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { THESIS_REVIEW_LABELS, reportLanguageFor, type ThesisReviewTemplate } from "@/lib/latex/templates-thesis"
import { thesisReviewStyleFor, type ThesisReviewStyle } from "@/lib/latex/thesis-review-styles"
import { deriveThesisReview, type ReportLanguageCode } from "@/lib/latex/thesis-review-meta"
import type { ThesisReviewOutputMeta } from "@/lib/poster-types"
import {
  PX_PER_MM,
  PX_PER_PT,
  buildThesisBlocks,
  columnHeightPx,
  estimateThesisBlockHeight,
  narrativeHeadingsFor,
  pageSizePx,
  paginateThesisBlocks,
  summarizeThesisPlan,
  thesisGeometryFor,
  type ThesisBlock,
} from "@/lib/preview/thesis-layout"

const ZOOM_STEPS = [0.55, 0.7, 0.85, 1, 1.2, 1.4, 1.65, 1.9]

export function ThesisReviewCanvas({
  className,
  /**
   * Stored review record folded into metadata. Wins over `output.reviewMeta`
   * so a workspace whose posudok cards are stale (or empty) still previews the
   * review the reviewer confirmed.
   */
  reviewMeta,
}: {
  className?: string
  reviewMeta?: ThesisReviewOutputMeta | null
}) {
  const { project, selectedCardId, selectCard, setInspectorTab } = useEditor(
    useShallow((s) => ({
      project: s.project,
      selectedCardId: s.selectedCardId,
      selectCard: s.selectCard,
      setInspectorTab: s.setInspectorTab,
    })),
  )

  const output = project.outputs?.find((o) => o.id === project.activeOutputId) ?? project.outputs?.[0]
  const templateId = output?.templateId ?? "posudok-sk"
  const style = useMemo(() => thesisReviewStyleFor(templateId), [templateId])
  const geometry = useMemo(() => thesisGeometryFor(templateId), [templateId])
  const labels = THESIS_REVIEW_LABELS[reportLanguageFor(templateId as ThesisReviewTemplate)]

  const derived = useMemo(
    () => deriveThesisReview(project, output, reportLanguageFor(templateId as ThesisReviewTemplate) as ReportLanguageCode, reviewMeta),
    [project, output, templateId, reviewMeta],
  )

  const blocks = useMemo<ThesisBlock[]>(() => {
    const headings = narrativeHeadingsFor(derived.language)
    return buildThesisBlocks({
      derived,
      labels,
      style,
      narrative: [
        ...(derived.summary ? [{ heading: headings.summary, text: derived.summary }] : []),
        ...(derived.strengths.length > 0 ? [{ heading: headings.strengths, items: derived.strengths }] : []),
      ],
    })
  }, [derived, labels, style])

  // ---------------------------------------------------------------------------
  // Measurement pass
  // ---------------------------------------------------------------------------
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const probeRef = useRef<HTMLDivElement | null>(null)
  const probes = useRef<Map<string, HTMLElement>>(new Map())
  const heightsRef = useRef<Record<string, number>>({})
  const [heights, setHeights] = useState<Record<string, number>>({})

  const measure = useCallback(
    (block: ThesisBlock): number => {
      const measured = heights[block.id]
      if (typeof measured === "number" && measured > 0) return measured
      return estimateThesisBlockHeight(block, geometry)
    },
    [heights, geometry],
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
    if (!changed) return
    heightsRef.current = next
    setHeights(next)
  }, [])

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

  const plan = useMemo(() => paginateThesisBlocks(blocks, measure, geometry), [blocks, measure, geometry])
  const summary = useMemo(() => summarizeThesisPlan(plan.pages, derived), [plan, derived])

  // ---------------------------------------------------------------------------
  // Zoom + fit
  // ---------------------------------------------------------------------------
  const [containerWidth, setContainerWidth] = useState(900)
  const [zoom, setZoom] = useState(1)
  const [fitWidth, setFitWidth] = useState(true)
  const [showGuides, setShowGuides] = useState(false)
  const [page, setPage] = useState(1)

  const pageSize = pageSizePx(geometry)

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
    (block: ThesisBlock) => {
      if (block.cardId.startsWith("__")) return
      selectCard(block.cardId)
      setInspectorTab("content")
    },
    [selectCard, setInspectorTab],
  )

  const isSelected = (block: ThesisBlock) => Boolean(selectedCardId) && block.cardId === selectedCardId
  const accent = `#${style.accent}`
  const accentDark = `#${style.accentDark}`
  const pageMarginPx = {
    top: geometry.marginTopMm * PX_PER_MM,
    bottom: geometry.marginBottomMm * PX_PER_MM,
    left: geometry.marginLeftMm * PX_PER_MM,
    right: geometry.marginRightMm * PX_PER_MM,
  }

  if (!output) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/40 text-sm text-muted-foreground">
        No output selected.
      </div>
    )
  }

  // The form always has a letterhead and a signature line; "empty" means there
  // is nothing to assess — neither cards nor a stored review record.
  const hasContent =
    (output.cards?.length ?? 0) > 0 ||
    derived.criteria.length > 0 ||
    Boolean(reviewMeta?.studentName || reviewMeta?.thesisTitle || reviewMeta?.summary || reviewMeta?.grade)

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-muted/40", className)}>
      {/* ---------------------------------------------------------------- chrome */}
      <div className="flex h-9 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <FileText className="size-3" />
            Posudok · A4
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            {summary.pageCount} page{summary.pageCount === 1 ? "" : "s"}
          </span>
          <span>·</span>
          <span>
            {summary.criteriaCount} criteria · {summary.ratedCount} rated
          </span>
          {summary.weightedScore !== null && (
            <span
              className="ml-1 rounded-full bg-primary/10 px-1.5 py-px font-mono text-[10px] text-primary"
              title={`Weighted score · ${derived.weightedGrade ?? "—"} band`}
            >
              {summary.weightedScore.toFixed(1)}% · {derived.weightedGrade ?? "—"}
            </span>
          )}
          <span className="hidden md:inline text-muted-foreground/80">· {style.templateId}</span>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="sm"
                  variant={showGuides ? "secondary" : "ghost"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setShowGuides((v) => !v)}
                >
                  <Target className="size-3" />
                  Guides
                </Button>
              }
            />
            <TooltipContent>Show page margins and block bounds</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="sm"
                  variant={fitWidth ? "secondary" : "ghost"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setFitWidth(true)}
                >
                  <ScanSearch className="size-3" />
                  Fit
                </Button>
              }
            />
            <TooltipContent>Scale the page to the pane width</TooltipContent>
          </Tooltip>
          <span className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => stepZoom(-1)} aria-label="Zoom out">
              <Minus className="size-3" />
            </Button>
            <span className="w-10 text-center font-mono text-[11px] tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => stepZoom(1)} aria-label="Zoom in">
              <Plus className="size-3" />
            </Button>
          </span>
          <span className="ml-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <ZoomIn className="size-3" />
            page
            <input
              type="number"
              min={1}
              max={plan.pageCount}
              value={page}
              onChange={(e) => setPage(Number(e.target.value) || 1)}
              className="w-10 rounded border border-border bg-background px-1 py-px text-center font-mono text-[11px] tabular-nums"
              aria-label="Page number"
            />
            / {plan.pageCount}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- the pages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-muted/40 p-6">
        {!hasContent ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-md border border-dashed border-border bg-card p-8 text-center">
            <FileText className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">This posudok has no content yet</p>
            <p className="text-xs text-muted-foreground">
              Add criterion cards in the structure sidebar — one card per assessed criterion — or use Auto-fill to
              draft the review from the uploaded thesis.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex flex-col items-center gap-6 pb-10">
            {plan.pages.map((pagePlan, pageIdx) => (
              <div
                key={pagePlan.index}
                data-thesis-page={pagePlan.index}
                data-thesis-template={style.templateId}
                className="relative shrink-0 bg-white text-black shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_28px_-12px_rgba(15,23,42,0.35)] ring-1 ring-black/10"
                style={{
                  width: pageSize.width * zoom,
                  height: pageSize.height * zoom,
                  fontSize: geometry.baseFontPt * PX_PER_PT * zoom,
                  fontFamily: "'Times New Roman', 'Nimbus Roman', 'Liberation Serif', 'Tinos', Georgia, serif",
                }}
              >
                {/* running head */}
                <div
                  className="absolute inset-x-0 flex items-baseline justify-between text-black/50"
                  style={{
                    top: Math.max(4, pageMarginPx.top * zoom * 0.32),
                    paddingLeft: pageMarginPx.left * zoom,
                    paddingRight: pageMarginPx.right * zoom,
                    fontSize: "0.62em",
                  }}
                >
                  <span className="truncate">{labels.title}</span>
                  <span className="tabular-nums">
                    {pagePlan.index} / {plan.pageCount}
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
                  {pagePlan.blocks.map((block) => (
                    <div
                      key={block.id}
                      style={{ height: measure(block) * zoom }}
                      className={cn("relative", showGuides && "outline outline-1 outline-dashed outline-sky-400/40")}
                    >
                      <BlockView
                        block={block}
                        style={style}
                        accent={accent}
                        accentDark={accentDark}
                        selected={isSelected(block)}
                        interactive={block.kind === "heading" || block.kind === "prose" || block.kind === "list" || block.kind === "figure"}
                        onSelect={() => handleSelect(block)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* hidden probe pass */}
        <div
          ref={probeRef}
          aria-hidden
          className="pointer-events-none absolute -left-[9999px] top-0"
          style={{ width: pageSize.width, fontSize: geometry.baseFontPt * PX_PER_PT }}
        >
          <div style={{ paddingLeft: pageMarginPx.left, paddingRight: pageMarginPx.right }}>
            {blocks.map((block) => (
              <div
                key={block.id}
                style={{ width: pageSize.width - pageMarginPx.left - pageMarginPx.right }}
                ref={(el) => {
                  if (el) probes.current.set(block.id, el)
                  else probes.current.delete(block.id)
                }}
              >
                <BlockView block={block} style={style} accent={accent} accentDark={accentDark} selected={false} interactive={false} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Block renderer — one switch per design decision of the active template
// ---------------------------------------------------------------------------

type BlockViewProps = {
  block: ThesisBlock
  style: ThesisReviewStyle
  accent: string
  accentDark: string
  selected: boolean
  interactive: boolean
  onSelect?: () => void
}

function BlockView({ block, style, accent, accentDark, selected, interactive, onSelect }: BlockViewProps) {
  const clickable = interactive && Boolean(onSelect)
  const wrapperClass = cn(
    "h-full",
    clickable && "cursor-pointer rounded-sm transition-colors hover:bg-primary/[0.04]",
    selected && "ring-2 ring-primary ring-offset-1",
  )
  const interactiveProps = clickable
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: onSelect,
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onSelect?.()
          }
        },
      }
    : {}

  switch (block.kind) {
    case "letterhead":
      return (
        <div className={cn("pb-[0.4em]", wrapperClass)}>
          <Letterhead style={style} accent={accent} institution={block.text ?? ""} faculty={block.title ?? ""} rightMeta={block.items?.[0] ?? ""} />
        </div>
      )

    case "title":
      return <Title style={style} accent={accent} accentDark={accentDark} text={block.text ?? ""} />

    case "identification":
      return <IdentificationTable style={style} rows={block.table?.rows ?? []} />

    case "heading":
      return (
        <div className={wrapperClass} {...interactiveProps}>
          <div className="flex items-baseline justify-between gap-2 border-b" style={{ borderColor: `${accent}55` }}>
            <span className="flex items-baseline gap-[0.45em] font-semibold" style={{ color: accentDark, fontSize: "1.06em" }}>
              <HeadingMarker style={style} index={markerNumber(block.title)} accent={accent} />
              <span>{markerLabel(block, style)}</span>
            </span>
            {block.rating && <RatingChip style={style} letter={block.rating} accent={accent} />}
          </div>
        </div>
      )

    case "prose":
      return (
        <div className={wrapperClass} {...interactiveProps}>
          <p className="whitespace-pre-line leading-[1.5]">{block.text}</p>
        </div>
      )

    case "list":
      return (
        <div className={wrapperClass} {...interactiveProps}>
          <ul className="list-disc space-y-[0.2em] pl-[1.4em] leading-[1.45]">
            {(block.items ?? []).map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )

    case "table":
      return <CriteriaTable style={style} accent={accent} accentDark={accentDark} columns={block.table?.columns ?? []} rows={block.table?.rows ?? []} note={block.text} />

    case "figure":
      return (
        <div className={cn("flex h-full flex-col items-center justify-center gap-[0.3em]", wrapperClass)} {...interactiveProps}>
          {block.figure?.url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={block.figure.url} alt={block.figure.caption ?? ""} className="max-h-[86%] w-auto object-contain" style={{ maxWidth: "72%" }} />
          ) : null}
          {block.figure?.caption && <p className="text-center italic text-black/70" style={{ fontSize: "0.82em" }}>{block.figure.caption}</p>}
        </div>
      )

    case "grade":
      return <GradePanel style={style} accent={accent} accentDark={accentDark} grade={block.grade!} />

    case "signature":
      return (
        <div className="flex h-full flex-col justify-end gap-[1.6em] pt-[0.6em]">
          <div className="flex gap-[2em] text-[0.95em]">
            <span className="flex-1 border-b border-black/50 pb-[1.8em]">{block.items?.[0]}</span>
            <span className="w-[38%] border-b border-black/50 pb-[1.8em]">{block.items?.[1]}</span>
          </div>
          {block.text && <p className="text-[0.85em] text-black/70">{block.text}</p>}
        </div>
      )

    case "disclosure":
      return <p className="text-[0.88em] leading-[1.45] text-black/80">{block.text}</p>

    default:
      return null
  }
}

/** `12. Název` → 12, used by the circled-number marker. */
function markerNumber(title?: string): string | null {
  const match = /^(\d+)\./.exec((title ?? "").trim())
  return match ? match[1] : null
}

function markerLabel(block: ThesisBlock, style: ThesisReviewStyle): string {
  const title = (block.title ?? "").trim()
  if (!style.numbered) return title.replace(/^\d+\.\s*/, "")
  return title
}

function HeadingMarker({ style, index, accent }: { style: ThesisReviewStyle; index: string | null; accent: string }) {
  switch (style.sectionMarker) {
    case "rule":
      return <span aria-hidden className="inline-block" style={{ width: "2px", height: "0.95em", background: accent }} />
    case "square":
      return <span aria-hidden className="inline-block" style={{ width: "0.42em", height: "0.42em", background: accent }} />
    case "bar":
      return (
        <span aria-hidden className="rounded-sm px-[0.4em] text-[0.72em] font-semibold text-white" style={{ background: accent }}>
          {index ?? "•"}
        </span>
      )
    case "number-circle":
      return (
        <span
          aria-hidden
          className="inline-flex items-center justify-center rounded-full text-[0.7em] font-semibold text-white"
          style={{ width: "1.35em", height: "1.35em", background: accent }}
        >
          {index ?? "•"}
        </span>
      )
    case "band":
      return <span aria-hidden className="inline-block rounded-sm" style={{ width: "0.7em", height: "0.7em", background: `${accent}22` }} />
    default:
      return null
  }
}

/**
 * The rating letter, drawn with the same symbol the exported document uses.
 *
 * The six posudok designs do not share one rating look: a Slovak form boxes the
 * letter, a Czech posudek shades it, a German Gutachten prints it as a solid
 * accent chip, a Polish recenzja circles it. Driving this off
 * `style.ratingSymbol` (the field the LaTeX macro reads) keeps the canvas and
 * the PDF in agreement.
 */
function RatingChip({ style, letter, accent }: { style: ThesisReviewStyle; letter: string; accent: string }) {
  const shared = { "data-rating-symbol": style.ratingSymbol }
  switch (style.ratingSymbol) {
    case "fbox":
      return <span {...shared} className="border border-black/70 px-[0.45em] font-semibold">{letter}</span>
    case "shaded":
      return <span {...shared} className="px-[0.5em] font-semibold" style={{ background: "rgba(0,0,0,0.09)" }}>{letter}</span>
    case "bold":
      return <span {...shared} className="font-bold">{letter}</span>
    case "dark":
      return <span {...shared} className="px-[0.5em] font-semibold text-white" style={{ background: accent }}>{letter}</span>
    case "circled":
      return (
        <span {...shared} className="inline-flex size-[1.55em] items-center justify-center rounded-full border border-black/70 text-[0.85em] font-semibold">
          {letter}
        </span>
      )
    default:
      return <span {...shared} className="px-[0.5em] font-semibold text-white" style={{ background: accent, opacity: 0.92 }}>{letter}</span>
  }
}

function Letterhead({ style, accent, institution, faculty, rightMeta }: {
  style: ThesisReviewStyle
  accent: string
  institution: string
  faculty: string
  rightMeta: string
}) {
  if (!institution && !faculty) return null

  switch (style.letterhead) {
    case "stacked-rule":
      return (
        <div>
          <div className="flex items-start justify-between gap-[1em]">
            <div>
              <p className="font-semibold" style={{ fontSize: "1.12em" }}>{institution}</p>
              {faculty && <p className="text-black/80" style={{ fontSize: "0.9em" }}>{faculty}</p>}
            </div>
            {rightMeta && <p className="text-right text-black/70" style={{ fontSize: "0.85em" }}>{rightMeta}</p>}
          </div>
          <div className="mt-[0.5em] border-t-[3px] border-double" style={{ borderColor: accent }} />
        </div>
      )
    case "shaded-table":
      return (
        <div>
          <div className="flex">
            <span className="w-[26%] bg-black/[0.07] px-[0.6em] py-[0.25em] font-semibold">{institution}</span>
            <span className="flex-1 px-[0.6em] py-[0.25em]">{faculty}</span>
          </div>
          {rightMeta && <p className="mt-[0.35em] italic text-black/70" style={{ fontSize: "0.88em" }}>{rightMeta}</p>}
          <div className="mt-[0.4em] border-t-2" style={{ borderColor: accent }} />
        </div>
      )
    case "minimal":
      return (
        <div>
          <div className="flex items-baseline justify-between" style={{ fontSize: "0.9em" }}>
            <span className="uppercase tracking-wide">{institution}</span>
            <span className="text-black/70">{rightMeta}</span>
          </div>
          <div className="mt-[0.3em] border-t border-black/40" />
          {faculty && <p className="mt-[0.25em] text-black/70" style={{ fontSize: "0.82em" }}>{faculty}</p>}
        </div>
      )
    case "rule-bar":
      return (
        <div>
          <div className="h-[0.32em] w-full" style={{ background: accent }} />
          <div className="mt-[0.5em] flex items-start justify-between gap-[1em]">
            <p className="font-semibold" style={{ fontSize: "1.12em" }}>{institution}</p>
            {rightMeta && <p className="text-right text-black/70" style={{ fontSize: "0.85em" }}>{rightMeta}</p>}
          </div>
          {faculty && <p className="text-black/80" style={{ fontSize: "0.9em" }}>{faculty}</p>}
        </div>
      )
    case "two-column":
      return (
        <div>
          <div className="flex">
            <span className="w-[46%] font-semibold">{institution}</span>
            <span className="flex-1 text-right text-black/70" style={{ fontSize: "0.9em" }}>{rightMeta}</span>
          </div>
          {faculty && <p className="mt-[0.2em] text-black/80" style={{ fontSize: "0.9em" }}>{faculty}</p>}
          <div className="mt-[0.35em] border-t-2" style={{ borderColor: accent }} />
        </div>
      )
    case "band":
    default:
      return (
        <div>
          <div className="flex items-center justify-between px-[0.5em] py-[0.28em] text-white" style={{ background: accent }}>
            <span className="font-semibold">{institution}</span>
            {rightMeta && <span className="opacity-90" style={{ fontSize: "0.85em" }}>{rightMeta}</span>}
          </div>
          {faculty && <p className="mt-[0.28em] text-black/80" style={{ fontSize: "0.9em" }}>{faculty}</p>}
        </div>
      )
  }
}

function Title({ style, accent, accentDark, text }: { style: ThesisReviewStyle; accent: string; accentDark: string; text: string }) {
  switch (style.titleStyle) {
    case "centered-double-rule":
      return (
        <div className="text-center">
          <p className="font-bold uppercase tracking-wide" style={{ fontSize: "1.5em" }}>{text}</p>
          <div className="mx-auto mt-[0.45em] w-[62%] border-t-2" style={{ borderColor: accent }} />
          <div className="mx-auto mt-[0.12em] w-[42%] border-t" style={{ borderColor: accent }} />
        </div>
      )
    case "left-accent":
      return (
        <div className="flex items-stretch gap-[0.6em]">
          <span aria-hidden style={{ width: "3px", background: accent }} />
          <div className="flex-1">
            <p className="font-bold" style={{ fontSize: "1.45em" }}>{text}</p>
          </div>
        </div>
      )
    case "plain-left":
      return (
        <div>
          <p className="font-bold" style={{ fontSize: "1.3em" }}>{text}</p>
          <div className="mt-[0.3em] border-t" style={{ borderColor: accent }} />
        </div>
      )
    case "band":
      return (
        <div className="py-[0.3em] text-center font-bold text-white" style={{ background: accentDark, fontSize: "1.22em" }}>
          {text}
        </div>
      )
    case "rule-pair":
      return (
        <div>
          <div className="border-t" style={{ borderColor: accent }} />
          <p className="py-[0.25em] font-bold" style={{ fontSize: "1.35em" }}>{text}</p>
          <div className="border-t" style={{ borderColor: accent }} />
        </div>
      )
    case "centered-band":
    default:
      return (
        <div className="text-center">
          <p className="font-bold tracking-wide" style={{ fontSize: "1.42em" }}>{text}</p>
          <div className="mx-auto mt-[0.35em] w-[50%] border-t-[3px]" style={{ borderColor: accent }} />
        </div>
      )
  }
}

function IdentificationTable({ style, rows }: { style: ThesisReviewStyle; rows: string[][] }) {
  const shaded = style.letterhead === "shaded-table"
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map(([label, value], index) => (
          <tr key={`${label}-${index}`}>
            <td
              className={cn("w-[36%] py-[0.12em] pr-[0.8em] align-top font-semibold", shaded && "px-[0.5em]")}
              style={shaded ? { background: "rgba(0,0,0,0.06)" } : undefined}
            >
              {label}:
            </td>
            <td className="py-[0.12em] align-top">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CriteriaTable({ style, accent, accentDark, columns, rows, note }: {
  style: ThesisReviewStyle
  accent: string
  accentDark: string
  columns: string[]
  rows: string[][]
  note?: string
}) {
  const shadedHeader = style.criteriaTable === "weighted-shaded"
  const banded = style.criteriaTable === "band-rows" || style.criteriaTable === "weighted-shaded"
  return (
    <div>
      <table className="w-full border-collapse">
        <thead>
          <tr style={shadedHeader ? { background: accent, color: "white" } : undefined}>
            {columns.map((column, index) => (
              <th
                key={column}
                className={cn(
                  "py-[0.28em] font-semibold",
                  index === 0 ? "text-left" : "text-right",
                  !shadedHeader && "border-b",
                )}
                style={{ borderColor: shadedHeader ? undefined : accentDark }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} style={banded && rowIndex % 2 === 1 ? { background: "rgba(0,0,0,0.05)" } : undefined}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn("py-[0.16em] align-top", cellIndex === 0 ? "text-left" : "text-right tabular-nums")}
                >
                  {cellIndex === row.length - 1 && cell && cell.length <= 2 && cell !== "—" ? (
                    <RatingChip style={style} letter={cell} accent={accent} />
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-[0.2em] border-t-2" style={{ borderColor: accent }} />
      {note && <p className="mt-[0.3em] italic text-black/70" style={{ fontSize: "0.82em" }}>{note}</p>}
    </div>
  )
}

function GradePanel({ style, accent, accentDark, grade }: {
  style: ThesisReviewStyle
  accent: string
  accentDark: string
  grade: NonNullable<ThesisBlock["grade"]>
}) {
  const letter = grade.grade || "—"
  const score = grade.scorePercent === null ? null : `${grade.scorePercent.toFixed(1)} %`

  const gradeRow = (() => {
    switch (style.gradeStyle) {
      case "fbox":
        return (
          <div className="flex items-baseline gap-[0.6em]">
            <span className="font-semibold">{grade.gradeLabel}:</span>
            <span className="border border-black/70 px-[0.6em] text-lg font-bold">{letter}</span>
          </div>
        )
      case "circled":
        return (
          <div className="flex items-baseline gap-[0.6em]">
            <span className="font-semibold">{grade.gradeLabel}:</span>
            <span className="border-2 border-double border-black/70 px-[0.6em] text-lg font-bold">{letter}</span>
          </div>
        )
      case "table-cell":
        return (
          <div className="flex">
            <span className="w-[40%] bg-black/[0.06] px-[0.5em] py-[0.15em] font-semibold">{grade.gradeLabel}</span>
            <span className="flex-1 px-[0.5em] py-[0.15em] text-lg font-bold" style={{ color: accentDark }}>{letter}</span>
          </div>
        )
      case "inline-bold":
        return (
          <p>
            <span className="font-semibold">{grade.gradeLabel}: </span>
            <span className="text-lg font-bold" style={{ color: accentDark }}>{letter}</span>
          </p>
        )
      case "panel":
        return (
          <div className="bg-black/[0.06] px-[0.6em] py-[0.3em]">
            <span className="font-semibold">{grade.gradeLabel}: </span>
            <span className="text-lg font-bold" style={{ color: accentDark }}>{letter}</span>
          </div>
        )
      case "band":
      default:
        return (
          <div className="px-[0.6em] py-[0.3em] text-white" style={{ background: accent }}>
            <span className="font-semibold">{grade.gradeLabel}: </span>
            <span className="text-lg font-bold">{letter}</span>
          </div>
        )
    }
  })()

  return (
    <div className="flex h-full flex-col gap-[0.5em]">
      {gradeRow}
      {score && (
        <div className="flex justify-between border-b border-black/15 pb-[0.2em]">
          <span className="text-black/80">{grade.scoreLabel}</span>
          <span className="tabular-nums">
            <span className="font-semibold">{score}</span>
            {grade.ects && <span className="ml-[0.8em] text-black/70">ECTS: {grade.ects}</span>}
          </span>
        </div>
      )}
      {grade.recommendation && (
        <p>
          <span className="font-semibold">{grade.recommendationLabel}: </span>
          {grade.recommendation}
        </p>
      )}
      <p className="mt-auto italic text-black/60" style={{ fontSize: "0.8em" }}>{grade.scale}</p>
    </div>
  )
}
