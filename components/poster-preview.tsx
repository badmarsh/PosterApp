"use client"

import { useState, useCallback, memo, useMemo, useEffect } from "react"
import { ChevronDown, ChevronUp, ImageIcon, List, Table2, FileDown, Loader2, ChevronDown as ChevronDownIcon, Plus, GripVertical, Settings2, LayoutTemplate, FileText, Sparkles, MonitorPlay, BookOpen, PanelTopOpen, X } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { StatusIcon } from "@/components/status"
import { COLUMN_BUDGET, estimateHeight, generateFullTemplate } from "@/lib/latex"
import type { Card, ColumnIndex } from "@/lib/poster-types"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-fetch"
import type { OutputType } from "@/lib/output-types"
import { OUTPUT_TYPE_LABELS, TEMPLATE_REGISTRY, getTemplatesForType } from "@/lib/output-types"

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------
type Tab = "structure" | "pdf"

// ---------------------------------------------------------------------------
// OutputTypeIcon — maps output type to a small icon
// ---------------------------------------------------------------------------
function OutputTypeIcon({ type, className }: { type: OutputType; className?: string }) {
  if (type === "slides") return <MonitorPlay className={className} />
  if (type === "paper") return <BookOpen className={className} />
  return <PanelTopOpen className={className} />
}

// ---------------------------------------------------------------------------
// AddOutputDialog — pick type + template, then create
// ---------------------------------------------------------------------------
function AddOutputDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addOutput = useEditor((s) => s.addOutput)
  const [selectedType, setSelectedType] = useState<OutputType>("slides")
  const templates = getTemplatesForType(selectedType)
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]?.id ?? "")

  // Sync template when type changes
  const handleTypeChange = (t: OutputType) => {
    setSelectedType(t)
    const ts = getTemplatesForType(t)
    setSelectedTemplate(ts[0]?.id ?? "")
  }

  const handleCreate = () => {
    addOutput(selectedType, selectedTemplate)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Output</DialogTitle>
          <DialogDescription>Choose an output format and template for this workspace.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          {/* Type selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Output type</label>
            <div className="flex gap-2">
              {(["poster", "slides", "paper"] as OutputType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-3 text-[11px] font-medium transition-colors",
                    selectedType === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
                  )}
                >
                  <OutputTypeIcon type={t} className="size-4" />
                  {OUTPUT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          {/* Template selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Template</label>
            <div className="flex flex-col gap-1">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className={cn(
                    "flex flex-col rounded-md border px-3 py-2 text-left transition-colors",
                    selectedTemplate === tmpl.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/40",
                  )}
                >
                  <span className="text-[12px] font-semibold">{tmpl.label}</span>
                  <span className="text-[10px] text-muted-foreground">{tmpl.description}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create Output
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// OutputTabBar — row of output tabs + add button
// ---------------------------------------------------------------------------
function OutputTabBar() {
  const { project, switchOutput } = useEditor(
    useShallow((s) => ({ project: s.project, switchOutput: s.switchOutput }))
  )
  const [addOpen, setAddOpen] = useState(false)
  const outputs = project.outputs ?? []

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-muted/30 px-2 py-1 shrink-0">
        {outputs.map((o) => {
          const isActive = o.id === project.activeOutputId
          return (
            <button
              key={o.id}
              onClick={() => switchOutput(o.id)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-background border border-border shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60",
              )}
            >
              <OutputTypeIcon type={o.outputType as OutputType} className="size-3" />
              {OUTPUT_TYPE_LABELS[o.outputType as OutputType]}
            </button>
          )
        })}
        <button
          onClick={() => setAddOpen(true)}
          className="ml-1 flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
          aria-label="Add output"
        >
          <Plus className="size-3" />
          Add
        </button>
      </div>
      <AddOutputDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}

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
// PosterColumn — 3-column poster layout column
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
// PosterSkeleton
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
// StructureView (poster 3-column DnD, poster-only)
// ---------------------------------------------------------------------------
function PosterStructureView() {
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
    
    if (activeCard.column !== overCard.column && overCard.column != null) {
      moveCard(activeId, overCard.column as ColumnIndex, overCard.order)
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
    
    if (activeCard && overCard && overCard.column != null) {
      moveCard(activeId, overCard.column as ColumnIndex, overCard.order)
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
// SlideCard — linear card for slides view
// ---------------------------------------------------------------------------
const SlideCard = memo(function SlideCard({ card, index, overlay }: { card: Card; index: number; overlay?: boolean }) {
  const { selectedCardId, selectCard, deleteCard, autoFillCardAction } = useEditor(
    useShallow((s) => ({
      selectedCardId: s.selectedCardId,
      selectCard: s.selectCard,
      deleteCard: s.deleteCard,
      autoFillCardAction: s.autoFillCardAction,
    }))
  )
  const active = card.id === selectedCardId
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const figs = card.figures?.filter((f) => f.url.trim()).length ?? 0
  const preview = card.content?.split("\n").find((l) => l.trim())

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      onClick={() => selectCard(card.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectCard(card.id) } }}
      className={cn(
        "group relative flex items-stretch gap-0 rounded-md border bg-card shadow-sm transition-all hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/40",
        overlay && "shadow-xl border-primary/50 cursor-grabbing rotate-1 scale-105",
      )}
    >
      {/* Slide number badge */}
      <div className={cn(
        "flex w-8 shrink-0 flex-col items-center justify-center rounded-l-md border-r border-border bg-muted/40 text-center",
        active && "bg-primary/10",
      )}>
        <span className="font-mono text-[10px] font-bold text-muted-foreground">{index + 1}</span>
      </div>
      {/* Drag handle */}
      <div
        className={cn("flex items-center px-1 cursor-grab text-muted-foreground/40 hover:text-muted-foreground", overlay && "cursor-grabbing")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </div>
      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-2">
        <div className="flex items-center gap-1.5">
          <StatusIcon level={"valid"} className="size-3 shrink-0" />
          <span className="truncate text-[12px] font-semibold">{card.title || "Untitled Slide"}</span>
        </div>
        {preview && (
          <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{preview}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="rounded border border-border bg-muted px-1 py-px font-mono text-[9px] text-muted-foreground">{card.pattern}</span>
          {figs > 0 && <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground"><ImageIcon className="size-2.5" />{figs}</span>}
          {card.slideNotes && <span className="text-[9px] text-muted-foreground/60 italic">has notes</span>}
        </div>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// PaperSection — linear card for paper view
// ---------------------------------------------------------------------------
const PaperSection = memo(function PaperSection({ card, overlay }: { card: Card; overlay?: boolean }) {
  const { selectedCardId, selectCard, deleteCard } = useEditor(
    useShallow((s) => ({
      selectedCardId: s.selectedCardId,
      selectCard: s.selectCard,
      deleteCard: s.deleteCard,
    }))
  )
  const active = card.id === selectedCardId
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const preview = card.content?.split("\n").find((l) => l.trim())
  const figs = card.figures?.filter((f) => f.url.trim()).length ?? 0
  const hasTable = card.table?.rows?.length > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      onClick={() => selectCard(card.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectCard(card.id) } }}
      className={cn(
        "group relative flex items-stretch gap-0 rounded-md border bg-card shadow-sm transition-all hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/40",
        overlay && "shadow-xl border-primary/50 cursor-grabbing rotate-1 scale-105",
      )}
    >
      {/* Left accent: section type icon */}
      <div className={cn(
        "flex w-8 shrink-0 flex-col items-center justify-center rounded-l-md border-r border-border bg-muted/40",
        active && "bg-primary/10",
      )}>
        <FileText className="size-3.5 text-muted-foreground" />
      </div>
      {/* Drag handle */}
      <div
        className={cn("flex items-center px-1 cursor-grab text-muted-foreground/40 hover:text-muted-foreground", overlay && "cursor-grabbing")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </div>
      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-2">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold">{card.title || "Untitled Section"}</span>
        </div>
        {preview && (
          <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{preview}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="rounded border border-border bg-muted px-1 py-px font-mono text-[9px] text-muted-foreground">{card.pattern}</span>
          {figs > 0 && <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground"><ImageIcon className="size-2.5" />{figs}</span>}
          {hasTable && <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground"><Table2 className="size-2.5" />table</span>}
        </div>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// SlidesView — linear sortable list of slides
// ---------------------------------------------------------------------------
function SlidesView() {
  const { project, addCard, moveCard, isSwitchingProject } = useEditor(
    useShallow((s) => ({
      project: s.project,
      addCard: s.addCard,
      moveCard: s.moveCard,
      isSwitchingProject: s.isSwitchingProject,
    }))
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const cards = useMemo(() => [...project.cards].sort((a, b) => a.order - b.order), [project.cards])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const activeCard = useMemo(() => cards.find(c => c.id === activeId), [cards, activeId])

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string)
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const overCard = cards.find(c => c.id === over.id)
    if (overCard) moveCard(active.id as string, null, overCard.order)
  }

  if (isSwitchingProject) return <PosterSkeleton />

  return (
    <ScrollArea className="min-h-0 flex-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="mx-auto w-full max-w-2xl px-5 py-6 pb-20 flex flex-col gap-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MonitorPlay className="size-4 text-primary" />
              <span className="text-[13px] font-bold">Slides</span>
              <span className="rounded-full bg-muted px-2 py-px text-[10px] font-mono text-muted-foreground">{cards.length}</span>
            </div>
          </div>
          <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((c, i) => <SlideCard key={c.id} card={c} index={i} />)}
          </SortableContext>
          <button
            onClick={() => addCard(null)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-primary mt-1"
          >
            <Plus className="size-3.5" />
            Add Slide
          </button>
        </div>
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
          {activeCard ? <SlideCard card={activeCard} index={cards.findIndex(c => c.id === activeCard.id)} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// PaperView — linear sortable list of sections
// ---------------------------------------------------------------------------
function PaperView() {
  const { project, addCard, moveCard, isSwitchingProject } = useEditor(
    useShallow((s) => ({
      project: s.project,
      addCard: s.addCard,
      moveCard: s.moveCard,
      isSwitchingProject: s.isSwitchingProject,
    }))
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const cards = useMemo(() => [...project.cards].sort((a, b) => a.order - b.order), [project.cards])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const activeCard = useMemo(() => cards.find(c => c.id === activeId), [cards, activeId])

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string)
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const overCard = cards.find(c => c.id === over.id)
    if (overCard) moveCard(active.id as string, null, overCard.order)
  }

  if (isSwitchingProject) return <PosterSkeleton />

  return (
    <ScrollArea className="min-h-0 flex-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="mx-auto w-full max-w-2xl px-5 py-6 pb-20 flex flex-col gap-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              <span className="text-[13px] font-bold">Paper Sections</span>
              <span className="rounded-full bg-muted px-2 py-px text-[10px] font-mono text-muted-foreground">{cards.length}</span>
            </div>
          </div>
          <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((c) => <PaperSection key={c.id} card={c} />)}
          </SortableContext>
          <button
            onClick={() => addCard(null)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-primary mt-1"
          >
            <Plus className="size-3.5" />
            Add Section
          </button>
        </div>
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
          {activeCard ? <PaperSection card={activeCard} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </ScrollArea>
  )
}


// ---------------------------------------------------------------------------
// StructureView — routes to the right view based on active output type
// ---------------------------------------------------------------------------
function StructureView() {
  const activeOutputType = useEditor((s) => {
    const o = s.project.outputs?.find((o) => o.id === s.project.activeOutputId)
    return (o?.outputType ?? "poster") as OutputType
  })

  if (activeOutputType === "slides") return <SlidesView />
  if (activeOutputType === "paper") return <PaperView />
  return <PosterStructureView />
}

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
            // eslint-disable-next-line react-hooks/purity
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
  const { isSwitchingProject, compiling, compileOk, compileProject, project, autoCompile, setAutoCompile, lastCompileFormat, setLastCompileFormat, showLatexSource } = useEditor(
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
      showLatexSource: s.showLatexSource,
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

  const handleCompile = useCallback((format: OutputType) => {
    setLastCompileFormat(format)
    setActiveTab("pdf")
    compileProject(format)
  }, [compileProject, setLastCompileFormat])

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-muted/30">
      {/* Output type tab bar */}
      <OutputTabBar />
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
              <DropdownMenuItem onClick={() => handleCompile("slides")}>
                <MonitorPlay className="text-muted-foreground" />
                Compile as Slides
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
      {showLatexSource ? (
        <ScrollArea className="flex-1 min-h-0 bg-muted/20">
          <div className="p-4">
            <pre className="rounded-md border border-border bg-card p-4 font-mono text-[11px] leading-relaxed text-foreground max-w-full overflow-x-auto whitespace-pre-wrap break-all">
              {(() => {
                const activeOutput = project.outputs?.find(o => o.id === project.activeOutputId) || project.outputs?.[0];
                return activeOutput ? generateFullTemplate(project, activeOutput, project.id) : "No output selected";
              })()}
            </pre>
          </div>
        </ScrollArea>
      ) : activeTab === "structure" ? (
        <StructureView />
      ) : (
        <PdfView />
      )}
    </section>
  )
}

