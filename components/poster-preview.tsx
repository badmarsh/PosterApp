"use client"

import { useState, useCallback } from "react"
import { ChevronDown, ChevronUp, ImageIcon, List, Table2, FileDown, Loader2, ChevronDown as ChevronDownIcon, Plus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEditor } from "@/components/editor-store"
import { StatusIcon } from "@/components/status"
import { COLUMN_BUDGET, estimateHeight, generateFullTemplate } from "@/lib/latex"
import type { Card, ColumnIndex } from "@/lib/poster-types"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------
type Tab = "structure" | "pdf"

// ---------------------------------------------------------------------------
// MiniBlock (unchanged)
// ---------------------------------------------------------------------------
function summarize(card: Card): string {
  if (card.pattern === "image-focused") {
    return card.figures[0]?.caption || "Figure-dominant block"
  }
  const first = card.content.split("\n").find((b) => b.trim())
  return first || "No content yet"
}

function MiniBlock({ card }: { card: Card }) {
  const { selectedCardId, selectCard, reorderCard, getStatus, project } =
    useEditor()
  const active = card.id === selectedCardId
  const status = getStatus(card)
  const height = estimateHeight(card)
  const pct = Math.min(100, Math.round((height / COLUMN_BUDGET) * 100))
  const figs = card.figures.filter((f) => f.url.trim()).length
  const hasBullets =
    card.pattern !== "image-focused" && card.content.trim().length > 0
  const hasTable = card.pattern === "bullets-table" && card.table.rows.length > 0

  const colCards = project.cards
    .filter((c) => c.column === card.column)
    .sort((a, b) => a.order - b.order)
  const idx = colCards.findIndex((c) => c.id === card.id)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      aria-label={`Edit card ${card.title || "Untitled"}`}
      onClick={() => selectCard(card.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          selectCard(card.id)
        }
      }}
      className={cn(
        "group relative rounded-md border bg-card p-2 text-left shadow-sm transition-all hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary ring-1 ring-primary"
          : status === "invalid"
            ? "border-destructive/50"
            : "border-border hover:border-muted-foreground/40",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-y-1.5 left-0 w-0.5 rounded-full",
          status === "invalid"
            ? "bg-destructive"
            : status === "warning"
              ? "bg-chart-4"
              : status === "generating"
                ? "bg-primary"
                : "bg-chart-3",
        )}
      />
      <div className="flex items-start justify-between gap-1.5 pl-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <StatusIcon level={status} className="size-3" />
          <span className="truncate text-[12px] font-semibold leading-tight">
            {card.title || "Untitled"}
          </span>
        </div>
        <div className="flex shrink-0 flex-col opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            aria-label="Move up"
            disabled={idx === 0}
            onClick={(e) => {
              e.stopPropagation()
              reorderCard(card.id, -1)
            }}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={idx === colCards.length - 1}
            onClick={(e) => {
              e.stopPropagation()
              reorderCard(card.id, 1)
            }}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>

      <p className="mt-1 line-clamp-4 pl-1.5 text-[11px] leading-relaxed text-muted-foreground">
        {summarize(card)}
      </p>

      {(card.pattern === "bullets-image" ||
        card.pattern === "bullets-two-images" ||
        card.pattern === "image-focused") && (
        <div className="mt-1.5 flex gap-1 pl-1.5">
          {Array.from({ length: card.pattern === "bullets-two-images" ? 2 : 1 }).map(
            (_, i) => (
              <div
                key={i}
                className="flex h-8 flex-1 items-center justify-center rounded border border-dashed border-border bg-muted/60"
              >
                <ImageIcon className="size-3 text-muted-foreground" />
              </div>
            ),
          )}
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between gap-2 pl-1.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {hasBullets && <List className="size-3" />}
          {hasTable && <Table2 className="size-3" />}
          {figs > 0 && (
            <span className="flex items-center gap-0.5">
              <ImageIcon className="size-3" />
              <span className="font-mono text-[9px]">{figs}</span>
            </span>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <div className="flex items-center gap-1">
                <div className="h-1 w-10 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      pct > 100
                        ? "bg-destructive"
                        : pct > 85
                          ? "bg-chart-4"
                          : "bg-chart-3",
                    )}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {height}u
                </span>
              </div>
            }
          />
          <TooltipContent>
            Estimated height {height}u / {COLUMN_BUDGET}u budget
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PosterColumn (unchanged)
// ---------------------------------------------------------------------------
function PosterColumn({ column }: { column: ColumnIndex }) {
  const { project, addCard } = useEditor()
  const cards = project.cards
    .filter((c) => c.column === column)
    .sort((a, b) => a.order - b.order)
  const total = cards.reduce((s, c) => s + estimateHeight(c), 0)
  const pct = Math.round((total / COLUMN_BUDGET) * 100)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-1.5 flex items-center justify-between border-b border-dashed border-border pb-1">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Col {column}
        </span>
        <span
          className={cn(
            "font-mono text-[10px]",
            pct > 100 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {pct}% fill
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {cards.length ? (
          cards.map((c) => <MiniBlock key={c.id} card={c} />)
        ) : (
          <div className="rounded-md border border-dashed border-border px-2 py-6 text-center text-[10px] leading-snug text-muted-foreground">
            No blocks in this column yet.
          </div>
        )}
        <button
          onClick={() => addCard(column)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-primary mt-1"
        >
          <Plus className="size-3.5" />
          Add Card
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PosterSkeleton (unchanged)
// ---------------------------------------------------------------------------
function PosterSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-5xl p-5"
      role="status"
      aria-label="Loading poster preview"
    >
      <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
        <div className="flex flex-col items-center gap-1.5 border-b-2 border-primary/30 bg-muted/40 px-4 py-4">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-2 w-1/3" />
        </div>
        <div className="flex gap-3 p-3">
          {Array.from({ length: 3 }).map((_, c) => (
            <div key={c} className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-2 w-10" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading poster preview…</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StructureView
// ---------------------------------------------------------------------------
function StructureView() {
  const { project, isSwitchingProject } = useEditor()
  return (
    <ScrollArea className="min-h-0 flex-1">
      {isSwitchingProject ? (
        <PosterSkeleton />
      ) : (
        <div className="mx-auto w-full max-w-5xl p-5 pb-20">
          <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
            {/* fixed header area */}
            <div className="border-b-2 border-primary/30 bg-gradient-to-b from-muted/60 to-card px-4 py-3 text-center">
              <div className="mb-1 inline-block rounded border border-border bg-muted px-1.5 py-px font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                template header — locked
              </div>
              <h2 className="text-balance text-[13px] font-bold leading-tight">
                {project.posterTitle}
              </h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {project.authors}
              </p>
              <p className="text-[9px] text-muted-foreground/80">
                {project.venue}
              </p>
            </div>

            {/* three columns */}
            <div className="flex gap-3 p-3">
              <PosterColumn column={1} />
              <div className="w-px shrink-0 bg-border" />
              <PosterColumn column={2} />
              <div className="w-px shrink-0 bg-border" />
              <PosterColumn column={3} />
            </div>
          </div>
        </div>
      )}
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// CompileLog
// ---------------------------------------------------------------------------
function CompileLog({ log, ok }: { log: string; ok: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="shrink-0 border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between px-3 py-1.5 text-left text-[10px] font-mono font-semibold uppercase tracking-wide transition-colors hover:bg-muted/40",
          ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
        )}
      >
        <span>{ok ? "✓ Compile succeeded" : "✗ Compile failed"} — log</span>
        <ChevronDownIcon
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <pre
          className={cn(
            "max-h-48 overflow-auto px-3 py-2 font-mono text-[9px] leading-relaxed",
            ok
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-destructive",
          )}
        >
          {log || "(no output)"}
        </pre>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PdfView
// ---------------------------------------------------------------------------
interface PdfViewProps {
  projectId: string
  pdfUrl: string | null
  compileLog: string | null
  compileOk: boolean | null
  compiling: boolean
}

function PdfView({ projectId, pdfUrl, compileLog, compileOk, compiling }: PdfViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* PDF embed area */}
      <div className="relative min-h-0 flex-1 bg-muted/20">
        {compiling && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-[11px] text-muted-foreground">Compiling with pdflatex…</span>
          </div>
        )}
        {pdfUrl ? (
          <object
            data={pdfUrl}
            type="application/pdf"
            className="h-full w-full"
            aria-label="Compiled poster PDF preview"
          >
            <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
              PDF cannot be displayed.{" "}
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline"
              >
                Download
              </a>
            </div>
          </object>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <FileDown className="size-8 opacity-30" />
              <span className="text-[11px]">
                No PDF yet — click <strong>Compile</strong> to generate one.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Compile log (shown when there is output) */}
      {compileLog !== null && compileOk !== null && (
        <CompileLog log={compileLog} ok={compileOk} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PosterPreview (main export)
// ---------------------------------------------------------------------------
export function PosterPreview() {
  const { project, isSwitchingProject } = useEditor()

  const [activeTab, setActiveTab] = useState<Tab>("structure")
  const [compiling, setCompiling] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [compileLog, setCompileLog] = useState<string | null>(null)
  const [compileOk, setCompileOk] = useState<boolean | null>(null)

  const handleCompile = useCallback(async () => {
    if (compiling) return
    setCompiling(true)
    // Switch to PDF tab so the user can see progress
    setActiveTab("pdf")
    try {
      const tex = generateFullTemplate(project, project.id)
      const res = await fetch(`/api/workspaces/${project.id}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tex }),
      })
      const data: { ok: boolean; log: string } = await res.json()
      setCompileLog(data.log ?? "")
      setCompileOk(data.ok)
      if (data.ok) {
        // Bust the PDF cache with a timestamp query param
        setPdfUrl(`/api/workspaces/${project.id}/pdf?t=${Date.now()}`)
      }
    } catch (err) {
      setCompileLog(String(err))
      setCompileOk(false)
    } finally {
      setCompiling(false)
    }
  }, [compiling, project])

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-muted/30">
      {/* Header bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-card px-3">
        {/* Tab switcher */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("structure")}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
              activeTab === "structure"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Structure
          </button>
          <span className="text-muted-foreground/40">|</span>
          <button
            type="button"
            onClick={() => setActiveTab("pdf")}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
              activeTab === "pdf"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            PDF Preview
          </button>
        </div>

        {/* Right side: metadata labels + compile button */}
        <div className="flex items-center gap-2">
          {activeTab === "structure" && (
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
              reorder within column only
            </span>
          )}
          <button
            type="button"
            onClick={handleCompile}
            disabled={compiling || isSwitchingProject}
            className={cn(
              "flex items-center gap-1.5 rounded border border-border bg-card px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
              compileOk === true && "border-emerald-500/60 text-emerald-600 dark:text-emerald-400",
              compileOk === false && "border-destructive/60 text-destructive",
            )}
          >
            {compiling ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <FileDown className="size-3" />
            )}
            {compiling ? "Compiling…" : "Compile"}
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "structure" ? (
        <StructureView />
      ) : (
        <PdfView
          projectId={project.id}
          pdfUrl={pdfUrl}
          compileLog={compileLog}
          compileOk={compileOk}
          compiling={compiling}
        />
      )}
    </section>
  )
}
