"use client"

import { useState, useCallback, memo, useMemo, useEffect } from "react"
import { ChevronDown, ChevronUp, ImageIcon, List, Table2, FileDown, Loader2, ChevronDown as ChevronDownIcon, Plus, GripVertical, Settings2, LayoutTemplate, FileText, Sparkles } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { StatusIcon } from "@/components/status"
import { COLUMN_BUDGET, estimateHeight, generateFullTemplate } from "@/lib/latex"
import type { Card, ColumnIndex } from "@/lib/poster-types"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-fetch"

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

const MiniBlock = memo(function MiniBlock({ card, overlay }: { card: Card, overlay?: boolean }) {
  const { selectedCardId, selectCard, getStatus, project, deleteCard, validateCardAction, autoFillCardAction, generateLatexForCardAction, setInspectorTab, setPendingAiPrompt } =
    useEditor(
      useShallow((s) => ({
        selectedCardId: s.selectedCardId,
        selectCard: s.selectCard,
        getStatus: s.getStatus,
        project: s.project,
        deleteCard: s.deleteCard,
        validateCardAction: s.validateCardAction,
        autoFillCardAction: s.autoFillCardAction,
        generateLatexForCardAction: s.generateLatexForCardAction,
        setInspectorTab: s.setInspectorTab,
        setPendingAiPrompt: s.setPendingAiPrompt,
      }))
    )
  const active = card.id === selectedCardId
  const status = getStatus(card)
  const height = estimateHeight(card)
  const pct = Math.min(100, Math.round((height / COLUMN_BUDGET) * 100))
  const figs = card.figures.filter((f) => f.url.trim()).length
  const hasBullets =
    card.pattern !== "image-focused" && card.content.trim().length > 0
  const hasTable = card.pattern === "bullets-table" && card.table.rows.length > 0

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const colCards = useMemo(
    () => project.cards
      .filter((c) => c.column === card.column)
      .sort((a, b) => a.order - b.order),
    [project.cards, card.column]
  )
  const idx = colCards.findIndex((c) => c.id === card.id)

  const handleAreaClick = useCallback((e: React.MouseEvent, tab: import("@/components/store/types").InspectorTab) => {
    e.stopPropagation()
    selectCard(card.id)
    setInspectorTab(tab)
  }, [card.id, selectCard, setInspectorTab])

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
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
            ref={setNodeRef}
            style={style}
            className={cn(
              "group relative rounded-md border bg-card p-2 text-left shadow-sm transition-all hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary ring-1 ring-primary"
                : status === "invalid"
                  ? "border-destructive/50"
                  : "border-border hover:border-muted-foreground/40",
              overlay && "shadow-xl border-primary/50 cursor-grabbing rotate-2 scale-105"
            )}
          >
            {/* Drag Handle Overlay to capture drags anywhere on the card */}
            <div 
              className={cn("absolute inset-0 z-10", overlay ? "cursor-grabbing" : "cursor-grab")}
              {...attributes}
              {...listeners}
            />
            
            {/* Make content relative so it sits above the absolute drag layer if we want to click specific things */}
            <div className="relative z-20 pointer-events-none">
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
                <GripVertical className="size-4 text-muted-foreground" />
              </div>
            </div>

            <p 
              className="mt-1 line-clamp-4 pl-1.5 text-[11px] leading-relaxed text-muted-foreground pointer-events-auto cursor-pointer hover:bg-muted/50 rounded transition-colors"
              onClick={(e) => handleAreaClick(e, "content")}
            >
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
                      className="flex h-8 flex-1 items-center justify-center rounded border border-dashed border-border bg-muted/60 pointer-events-auto cursor-pointer hover:bg-muted transition-colors"
                      onClick={(e) => handleAreaClick(e, "figures")}
                    >
                      <ImageIcon className="size-3 text-muted-foreground" />
                    </div>
                  ),
                )}
              </div>
            )}

            {card.pattern === "bullets-table" && (
              <div className="mt-1.5 flex gap-1 pl-1.5">
                <div
                  className="flex h-8 flex-1 items-center justify-center rounded border border-dashed border-border bg-muted/60 pointer-events-auto cursor-pointer hover:bg-muted transition-colors"
                  onClick={(e) => handleAreaClick(e, "table")}
                >
                  <Table2 className="size-3 text-muted-foreground" />
                </div>
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
          </div>
        }
      />
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => selectCard(card.id)}>
          Edit Card
        </ContextMenuItem>
        <ContextMenuItem onClick={() => autoFillCardAction(card.id)}>
          AI Auto-fill
        </ContextMenuItem>
        <ContextMenuItem onClick={() => validateCardAction(card.id)}>
          Validate with AI
        </ContextMenuItem>
        <ContextMenuItem onClick={() => generateLatexForCardAction(card.id)}>
          Re-compile LaTeX
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem 
          onClick={() => setPendingAiPrompt("Prosím, oprav chyby na tejto karte.")}
          className="gap-2"
        >
          <Sparkles className="size-4" />
          <span>Opraviť chyby pomocou AI</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem 
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation()
            deleteCard(card.id)
          }}
        >
          Delete Card
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

// ---------------------------------------------------------------------------
// PosterColumn (unchanged)
// ---------------------------------------------------------------------------
function PosterColumn({ column }: { column: ColumnIndex }) {
  const { project, addCard } = useEditor(
    useShallow((s) => ({
      project: s.project,
      addCard: s.addCard,
    }))
  )
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
      <div className="flex flex-col gap-2 min-h-[100px] rounded-md p-1 -mx-1">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.length ? (
            cards.map((c) => <MiniBlock key={c.id} card={c} />)
          ) : (
            <div className="rounded-md border border-dashed border-border px-2 py-6 text-center text-[10px] leading-snug text-muted-foreground">
              Drop cards here
            </div>
          )}
        </SortableContext>
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
  const { project, isSwitchingProject, moveCard } = useEditor(
    useShallow((s) => ({
      project: s.project,
      isSwitchingProject: s.isSwitchingProject,
      moveCard: s.moveCard,
    }))
  )
  
  const [activeId, setActiveId] = useState<string | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    
    const activeId = active.id as string
    const overId = over.id as string
    
    if (activeId === overId) return
    
    const activeCard = project.cards.find(c => c.id === activeId)
    const overCard = project.cards.find(c => c.id === overId)
    
    if (!activeCard || !overCard) return
    
    if (activeCard.column !== overCard.column) {
      moveCard(activeId, overCard.column, overCard.order)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    
    if (activeId === overId) return

    const activeCard = project.cards.find(c => c.id === activeId)
    const overCard = project.cards.find(c => c.id === overId)
    
    if (activeCard && overCard) {
      moveCard(activeId, overCard.column, overCard.order)
    }
  }

  const activeCardData = useMemo(
    () => project.cards.find(c => c.id === activeId),
    [project.cards, activeId]
  )

  return (
    <ScrollArea className="min-h-0 flex-1">
      {isSwitchingProject ? (
        <PosterSkeleton />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
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
          
          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
            {activeCardData ? <MiniBlock card={activeCardData} overlay /> : null}
          </DragOverlay>
        </DndContext>
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
// PdfView — react-pdf based viewer
// ---------------------------------------------------------------------------

import dynamic from "next/dynamic"
import { Minus, Download } from "lucide-react"

const PdfViewerComponent = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
)

const ZOOM_OPTIONS: { value: number | "auto"; label: string }[] = [
  { value: "auto", label: "Fit Width" },
  { value: 0.25, label: "25%" },
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 1, label: "100%" },
  { value: 1.25, label: "125%" },
  { value: 1.5, label: "150%" },
  { value: 2, label: "200%" },
  { value: 3, label: "300%" },
  { value: 4, label: "400%" },
]

function PdfView() {
  const { pdfData, compileLog, compileOk, compiling, projectId } = useEditor(
    useShallow((s) => ({
      pdfData: s.pdfData,
      compileLog: s.compileLog,
      compileOk: s.compileOk,
      compiling: s.compiling,
      projectId: s.project.id,
    }))
  )

  const [scale, setScale] = useState<number | "auto">("auto")
  const [numPages, setNumPages] = useState(0)

  const zoomIn = () => {
    const idx = ZOOM_OPTIONS.findIndex((z) => z.value === scale)
    if (idx !== -1) {
      const next = ZOOM_OPTIONS[Math.min(idx + 1, ZOOM_OPTIONS.length - 1)]
      if (next) setScale(next.value)
    }
  }
  const zoomOut = () => {
    const idx = ZOOM_OPTIONS.findIndex((z) => z.value === scale)
    if (idx !== -1) {
      const prev = ZOOM_OPTIONS[Math.max(idx - 1, 0)]
      if (prev) setScale(prev.value)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Zoom toolbar */}
      {pdfData && (
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card/60 px-3 py-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale === ZOOM_OPTIONS[0].value}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              aria-label="Zoom out"
            >
              <Minus className="size-3.5" />
            </button>
            <select
              value={scale}
              onChange={(e) => {
                const val = e.target.value
                setScale(val === "auto" ? "auto" : Number(val))
              }}
              className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]"
            >
              {ZOOM_OPTIONS.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={zoomIn}
              disabled={scale === ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1].value}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              aria-label="Zoom in"
            >
              <Plus className="size-3.5" />
            </button>
            {numPages > 0 && (
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                {numPages} page{numPages !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <a
            href={`/api/workspaces/${projectId}/pdf?t=${Date.now()}`}
            download="poster.pdf"
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Download className="size-3" />
            Download
          </a>
        </div>
      )}

      {/* PDF render area */}
      <div className="relative min-h-0 flex-1 bg-muted/20">
        {compiling && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-[11px] text-muted-foreground">Compiling with pdflatex…</span>
          </div>
        )}
        {pdfData ? (
          <PdfViewerComponent
            data={pdfData}
            scale={scale}
            onLoadSuccess={setNumPages}
          />
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
  const { isSwitchingProject, compiling, compileOk, compileProject, project, autoCompile, setAutoCompile, lastCompileFormat, setLastCompileFormat } = useEditor(
    useShallow((s) => ({
      isSwitchingProject: s.isSwitchingProject,
      compiling: s.compiling,
      compileOk: s.compileOk,
      compileProject: s.compileProject,
      project: s.project,
      autoCompile: s.autoCompile,
      setAutoCompile: s.setAutoCompile,
      lastCompileFormat: s.lastCompileFormat,
      setLastCompileFormat: s.setLastCompileFormat,
    }))
  )

  const [activeTab, setActiveTab] = useState<Tab>("structure")

  useEffect(() => {
    if (!autoCompile) return
    const t = setTimeout(() => {
      compileProject(lastCompileFormat)
    }, 2500)
    return () => clearTimeout(t)
  }, [project, autoCompile, lastCompileFormat, compileProject])

  const handleCompile = useCallback((format: "poster" | "paper") => {
    setLastCompileFormat(format)
    setActiveTab("pdf")
    compileProject(format)
  }, [compileProject, setLastCompileFormat])

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

        {/* Right side: compile button */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Switch
              id="auto-compile"
              checked={autoCompile}
              onCheckedChange={setAutoCompile}
            />
            <label
              htmlFor="auto-compile"
              className="text-[11px] font-medium text-muted-foreground cursor-pointer"
            >
              Live Preview
            </label>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
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
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleCompile("poster")}>
                <LayoutTemplate className="text-muted-foreground" />
                Compile as Poster
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCompile("paper")}>
                <FileText className="text-muted-foreground" />
                Compile as Paper
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "structure" ? (
        <StructureView />
      ) : (
        <PdfView />
      )}
    </section>
  )
}

