"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Minus, MonitorPlay, Plus, Presentation, Ruler } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { useEditor } from "@/components/editor-store"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { TEMPLATE_REGISTRY } from "@/lib/output-types"
import { resolveOutputMetadata } from "@/lib/poster-types"
import type { Card } from "@/lib/poster-types"
import { posterAccentFor } from "@/components/preview/poster-canvas"
import { PaperProse } from "@/components/preview/paper-block"

/** Beamer's 16:9 paper size, in millimetres (160 × 90 mm). */
export const SLIDE_WIDTH_MM = 160
export const SLIDE_HEIGHT_MM = 90

const ZOOM_STEPS = [0.45, 0.6, 0.75, 0.9, 1, 1.15]

/**
 * Themes whose slides are dark ink on a light ground, versus full dark decks.
 * `beamer-focus` and `beamer-metropolis` are the dark ones in the registry; a
 * preview that draws a white slide for them would misrepresent the exported
 * PDF, which is the whole point of having a canvas.
 */
const DARK_TEMPLATES = new Set(["beamer-focus", "beamer-metropolis"])

type SlideChrome = {
  dark: boolean
  accent: string
  /** 0…1 share of the slide height used by the title band. */
  titleBand: number
  /** Where content starts vertically (fraction of slide height). */
  contentTop: number
}

export function slideChromeFor(templateId?: string | null, themeColor?: string | null): SlideChrome {
  const dark = DARK_TEMPLATES.has(templateId ?? "")
  const accent = posterAccentFor(templateId, themeColor)
  if (templateId === "beamer-focus") return { dark, accent, titleBand: 0.3, contentTop: 0.34 }
  if (templateId === "beamer-metropolis") return { dark, accent, titleBand: 0.2, contentTop: 0.26 }
  if (templateId === "beamer-editorial") return { dark, accent, titleBand: 0.18, contentTop: 0.24 }
  return { dark, accent, titleBand: 0.16, contentTop: 0.22 }
}

/**
 * The slide surface: the deck as it will be projected.
 *
 * The previous slides preview was a list of one-line rows, so a user could not
 * see the layout they were exporting — whether a title fits, how a figure
 * occupies a 16:9 frame, or that a "two-column" slide is out of balance. Each
 * card here is drawn on a real 160 × 90 mm frame at the template's own title
 * proportions, with the editing surface (`renderCard`) mounted inside it so
 * drag/drop and inline editing keep working.
 */
export function SlideCanvas({
  cards,
  templateId,
  renderSlide,
  onAddSlide,
}: {
  cards: Card[]
  templateId?: string | null
  /** Body renderer override; the default draws the slide content itself. */
  renderSlide?: (card: Card, index: number) => React.ReactNode
  onAddSlide?: () => void
}) {
  const { project, selectedCardId, selectCard } = useEditor(
    useShallow((s) => ({ project: s.project, selectedCardId: s.selectedCardId, selectCard: s.selectCard })),
  )
  const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)
  const resolvedTemplate = templateId ?? activeOutput?.templateId
  const metadata = resolveOutputMetadata(project, activeOutput)
  const chrome = useMemo(
    () => slideChromeFor(resolvedTemplate, activeOutput?.themeColor),
    [resolvedTemplate, activeOutput?.themeColor],
  )
  const templateDef = TEMPLATE_REGISTRY.find((t) => t.id === resolvedTemplate)

  const frameRef = useRef<HTMLDivElement | null>(null)
  const [frameWidth, setFrameWidth] = useState(760)
  const [zoom, setZoom] = useState(1)

  // Fit-to-frame until the user picks a zoom level; no measurement in SSR.
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const update = () => setFrameWidth(el.clientWidth || 760)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const slideWidth = Math.max(200, Math.min(frameWidth - 24, 980)) * zoom
  const slideHeight = (slideWidth * SLIDE_HEIGHT_MM) / SLIDE_WIDTH_MM
  const scale = slideWidth / ((SLIDE_WIDTH_MM / 25.4) * 96)

  const titleSlide = (index: number) => index === 0 && cards[0]?.pattern === "title-slide"

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Deck toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
          <Ruler className="size-3.5 text-muted-foreground" />
          {SLIDE_WIDTH_MM} × {SLIDE_HEIGHT_MM} mm · 16:9
          <span className="font-normal text-muted-foreground">
            · {templateDef?.label ?? "Beamer"} theme{chrome.dark ? " · dark ground" : ""}
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: `${chrome.accent}1a`, color: chrome.accent }}
          >
            {cards.length} {cards.length === 1 ? "slide" : "slides"}
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[10px]"
                  onClick={() => setZoom((z) => Math.max(ZOOM_STEPS[0], ZOOM_STEPS[Math.max(0, ZOOM_STEPS.indexOf(z) - 1)] ?? z))}
                  aria-label="Zoom out"
                >
                  <Minus className="size-3" />
                </Button>
              }
            />
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          <span className="w-10 text-center font-mono text-[10px] tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[10px]"
                  onClick={() =>
                    setZoom((z) => {
                      const i = ZOOM_STEPS.indexOf(z)
                      return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, (i === -1 ? ZOOM_STEPS.indexOf(1) : i) + 1)] ?? z
                    })
                  }
                  aria-label="Zoom in"
                >
                  <Plus className="size-3" />
                </Button>
              }
            />
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() => setZoom(1)}
          >
            <Presentation className="size-3" /> Fit width
          </Button>
        </div>
      </div>

      {/* Deck */}
      <div ref={frameRef} className="overflow-x-auto pb-2">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          {cards.length === 0 && (
            <button
              type="button"
              onClick={onAddSlide}
              className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              <MonitorPlay className="size-5" />
              <span className="text-xs">No slides yet — add the first one</span>
            </button>
          )}

          {cards.map((card, index) => {
            const isTitle = titleSlide(index)
            return (
              <div key={card.id} className="flex flex-col items-center gap-1">
                <div
                  data-slide-canvas={index + 1}
                  data-slide-template={resolvedTemplate ?? "beamer"}
                  role="button"
                  tabIndex={0}
                  aria-current={card.id === selectedCardId ? "true" : undefined}
                  onClick={() => selectCard(card.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      selectCard(card.id)
                    }
                  }}
                  className={cn(
                    "relative shrink-0 cursor-pointer overflow-hidden rounded-sm ring-1 transition-shadow hover:shadow-md",
                    chrome.dark ? "ring-black/40" : "ring-black/10",
                    card.id === selectedCardId && "ring-2 ring-primary",
                  )}
                  style={{
                    width: slideWidth,
                    height: slideHeight,
                    backgroundColor: chrome.dark ? "#1c1c1c" : "#ffffff",
                    color: chrome.dark ? "#f4f4f5" : "#111827",
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  }}
                >
                  {/* Full-bleed accent rule (editorial) or a title band. */}
                  {isTitle ? (
                    <div
                      className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center"
                      style={{ background: chrome.dark ? "#1c1c1c" : `linear-gradient(180deg, #ffffff 0%, ${chrome.accent}12 100%)` }}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: chrome.accent }}>
                        {metadata.venue || "Conference 2026"}
                      </span>
                      <h1 className="max-w-[90%] text-2xl font-bold leading-tight">{metadata.title}</h1>
                      <p className="text-[11px] opacity-80">{metadata.authors}</p>
                      <span className="mt-1 h-1 w-16 rounded-full" style={{ backgroundColor: chrome.accent }} />
                      <p className="text-[9px] uppercase tracking-widest opacity-50">
                        {templateDef?.label ?? "Beamer"} · {SLIDE_WIDTH_MM} × {SLIDE_HEIGHT_MM} mm
                      </p>
                    </div>
                  ) : (
                    <>
                      <div
                        className="absolute left-0 right-0 top-0 flex items-end justify-between gap-3 px-5"
                        style={{ height: slideHeight * chrome.titleBand }}
                      >
                        <span
                          className="pb-1 text-base font-bold leading-tight"
                          style={{ color: chrome.dark ? "#ffffff" : chrome.accent }}
                        >
                          {card.title || "Untitled slide"}
                        </span>
                        <span className="pb-1 font-mono text-[9px] opacity-40">{metadata.venue}</span>
                      </div>
                      <span
                        className="absolute left-0 right-0"
                        style={{ top: slideHeight * chrome.titleBand - 2, height: 2, backgroundColor: chrome.accent }}
                      />
                      <div
                        className="absolute left-0 right-0 bottom-6 overflow-hidden px-5"
                        style={{ top: slideHeight * chrome.contentTop }}
                      >
                        <div style={{ fontSize: 12.5 * Math.max(0.62, slideWidth / 940) }}>
                          {renderSlide ? renderSlide(card, index) : <SlideBody card={card} accent={chrome.accent} />}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Running footline */}
                  <div
                    className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 text-[9px]"
                    style={{ height: slideHeight * 0.07, color: chrome.dark ? "#a1a1aa" : "#6b7280" }}
                  >
                    <span className="truncate">{metadata.authors?.split(",")[0] ?? ""}</span>
                    <span className="font-mono tabular-nums" style={{ color: chrome.accent }}>
                      {index + 1} / {cards.length}
                    </span>
                  </div>
                  {resolvedTemplate === "beamer-metropolis" && (
                    <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-black/10">
                      <div
                        className="h-full"
                        style={{ width: `${((index + 1) / Math.max(1, cards.length)) * 100}%`, backgroundColor: chrome.accent }}
                      />
                    </div>
                  )}
                </div>
                <span className="font-mono text-[9px] text-muted-foreground">
                  Slide {index + 1} · {card.pattern}
                  {card.figures?.length ? ` · ${card.figures.length} fig` : ""}
                </span>
              </div>
            )
          })}

          {cards.length > 0 && onAddSlide && (
            <button
              type="button"
              onClick={onAddSlide}
              className="flex aspect-video w-full items-center justify-center gap-1.5 rounded border border-dashed border-border text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              <Plus className="size-3.5" /> Add slide
            </button>
          )}
        </div>
      </div>
      <p className="text-center text-[10px] text-muted-foreground" style={{ transform: `scale(${Math.min(1, scale)})` }}>
        Slides are drawn at the projected 16:9 aspect ratio; the exported Beamer PDF paginates one card per frame.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Slide body — read-only rendering of a card on a 16:9 frame
// ---------------------------------------------------------------------------

/** `**value** | label` lines (the `stats` pattern) → label/value pairs. */
function parseStats(content: string): { value: string; label: string }[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label = ""] = line.split("|").map((part) => part.replace(/\*\*/g, "").trim())
      return { value, label }
    })
}

function SlideBody({ card, accent }: { card: Card; accent: string }) {
  const figures = (card.figures ?? []).filter((f) => f.url?.trim())
  const rows = card.table?.rows ?? []
  const content = card.content ?? ""

  if (card.pattern === "stats") {
    const stats = parseStats(content)
    return (
      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded border-l-2 bg-black/[0.03] px-2 py-1.5" style={{ borderColor: accent }}>
            <div className="text-lg font-bold leading-tight" style={{ color: accent }}>
              {stat.value}
            </div>
            <div className="text-[0.72em] leading-snug opacity-75">{stat.label}</div>
          </div>
        ))}
      </div>
    )
  }

  if (figures.length) {
    return (
      <div className="flex h-full items-start gap-3">
        {content.trim() && (
          <div className="w-2/5 shrink-0">
            <PaperProse markdown={content} />
          </div>
        )}
        <div className={cn("flex min-w-0 flex-1 gap-2", figures.length > 1 ? "items-start" : "items-center")}>
          {figures.slice(0, 2).map((figure) => (
            <figure key={figure.id} className="min-w-0 flex-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={figure.url} alt="" className="max-h-[7.5em] w-full object-contain" />
              {figure.caption && (
                <figcaption className="mt-0.5 text-[0.62em] leading-snug opacity-70">
                  {figure.caption.replace(/^\s*(Figure|Fig\.?)\s*\d*\s*:?\s*/i, "")}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    )
  }

  if (rows.length) {
    const [header, ...body] = rows
    return (
      <div className="flex flex-col gap-0.5">
        <table className="w-full border-collapse text-[0.72em]">
          <thead>
            <tr>
              {header.map((cell, i) => (
                <th
                  key={i}
                  className="border-b px-1.5 py-0.5 text-left font-semibold"
                  style={{ borderColor: `${accent}66`, color: accent }}
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.slice(0, 6).map((row, r) => (
              <tr key={r} className={r % 2 ? "bg-black/[0.025]" : undefined}>
                {row.map((cell, i) => (
                  <td key={i} className="border-b border-black/5 px-1.5 py-0.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {card.table?.caption && <p className="text-[0.62em] opacity-70">{card.table.caption}</p>}
      </div>
    )
  }

  if (card.pattern === "references") {
    return (
      <div className="text-[0.72em] leading-snug opacity-85">
        <PaperProse markdown={content || "_References are collected from every card that cites them._"} />
      </div>
    )
  }

  // Bullets and prose share the markdown renderer; `two-column` splits on the
  // blank line between its two halves, which is how the pattern is authored.
  if (card.pattern === "two-column") {
    const [left, right = ""] = content.split(/\n\s*\n/)
    return (
      <div className="grid grid-cols-2 gap-4">
        <PaperProse markdown={left} />
        <PaperProse markdown={right} />
      </div>
    )
  }

  return <PaperProse markdown={content} />
}
