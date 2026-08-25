"use client"

import { useEffect, useState, memo } from "react"
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  FilePlus2,
  FileStack,
  Plus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import {
  CardTypeBadge,
  ContentIndicators,
  PATTERN_SHORT,
  StatusIcon,
} from "@/components/status"
import { apiFetch } from "@/lib/api-fetch"

import type { Card, ColumnIndex } from "@/lib/poster-types"
import { cn } from "@/lib/utils"

const CardRow = memo(function CardRow({ card }: { card: Card }) {
  const { selectedCardId, selectCard, deleteCard, getStatus, layoutWarnings, reorderCard, moveColumn } = useEditor(
    useShallow((s) => ({
      selectedCardId: s.selectedCardId,
      selectCard: s.selectCard,
      deleteCard: s.deleteCard,
      getStatus: s.getStatus,
      layoutWarnings: s.layoutWarnings,
      reorderCard: s.reorderCard,
      moveColumn: s.moveColumn,
    }))
  )
  const active = card.id === selectedCardId
  const status = getStatus(card)
  const warning = layoutWarnings.find(w => 
    w.cardTitle && card.title && w.cardTitle.trim().toLowerCase() === card.title.trim().toLowerCase()
  )
  return (
    <ContextMenu>
      <ContextMenuTrigger
        role="button"
          tabIndex={0}
          aria-current={active ? "true" : undefined}
      aria-label={`Edit card ${card.title || "Untitled"} (${card.id})`}
      onClick={() => selectCard(card.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          selectCard(card.id)
        }
      }}
      className={cn(
        "group flex cursor-pointer flex-col gap-1 rounded-md border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary/40 bg-sidebar-accent"
          : "border-transparent hover:border-border hover:bg-sidebar-accent/50 active:bg-sidebar-accent/70",
      )}
    >
      <div className="flex items-center gap-1.5">
        <StatusIcon level={status} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight">
          {card.title || "Untitled"}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={`Delete ${card.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  deleteCard(card.id)
                }}
                className="hidden rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
              >
                <Trash2 className="size-3.5" />
              </button>
            }
          />
          <TooltipContent>Delete card</TooltipContent>
        </Tooltip>
      </div>
      {warning && (
        <div className="flex flex-col gap-1 rounded bg-destructive/10 p-1.5 text-[10px] text-destructive mt-1">
          <div className="flex items-center gap-1 font-semibold">
            <AlertTriangle className="size-3" /> Overflow Detected
          </div>
          <span className="leading-tight">{warning.issue}</span>
          <Button 
            size="sm" 
            variant="destructive" 
            className="h-5 mt-0.5 text-[9px] uppercase tracking-wider"
            onClick={(e) => {
              e.stopPropagation();
              // In the future this triggers an LLM rewrite to shrink content
              alert(`Shrinking content for ${card.title} based on VLM recommendation...`);
            }}
          >
            Auto-Shrink Content
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 pl-5 mt-1">
        <span className="truncate font-mono text-[10px] text-muted-foreground">
          {card.id}
        </span>
        <div className="flex items-center gap-1.5">
          <ContentIndicators card={card} />
          <CardTypeBadge card={card} />
        </div>
      </div>
      <div className="pl-5">
        <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground/70">
          {PATTERN_SHORT[card.pattern]}
        </span>
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent className="w-48 text-[12px]">
      <ContextMenuItem onClick={() => reorderCard(card.id, -1)}>Move up</ContextMenuItem>
      <ContextMenuItem onClick={() => reorderCard(card.id, 1)}>Move down</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>Move to column</ContextMenuSubTrigger>
        <ContextMenuSubContent className="text-[12px]">
          <ContextMenuItem onClick={() => moveColumn(card.id, 1)} disabled={card.column === 1}>Column 1</ContextMenuItem>
          <ContextMenuItem onClick={() => moveColumn(card.id, 2)} disabled={card.column === 2}>Column 2</ContextMenuItem>
          <ContextMenuItem onClick={() => moveColumn(card.id, 3)} disabled={card.column === 3}>Column 3</ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => deleteCard(card.id)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">Delete block</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
  )
})

function ColumnGroup({ column }: { column: ColumnIndex }) {
  const { project, addCard } = useEditor(
    useShallow((s) => ({
      project: s.project,
      addCard: s.addCard,
    }))
  )
  const cards = project.cards
    .filter((c) => c.column === column)
    .sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <ChevronDown className="size-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Column {column}
          </span>
          <span className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
            {cards.length}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Add card to column ${column}`}
                onClick={() => addCard(column)}
              >
                <Plus className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent>Add card</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-col gap-0.5">
        {cards.length ? (
          cards.map((c) => <CardRow key={c.id} card={c} />)
        ) : (
          <button
            type="button"
            onClick={() => addCard(column)}
            className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border px-2 py-3 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-sidebar-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-3.5" />
            No cards yet — add the first block
          </button>
        )}
      </div>
    </div>
  )
}

export function StructureSidebar() {
  const {
    project,
    columnCount,
    newProject,
    duplicateProject,
    switchProject,
    isSwitchingProject,
    openIngestion,
  } = useEditor(
    useShallow((s) => ({
      project: s.project,
      columnCount: s.columnCount,
      newProject: s.newProject,
      duplicateProject: s.duplicateProject,
      switchProject: s.switchProject,
      isSwitchingProject: s.isSwitchingProject,
      openIngestion: s.openIngestion,
    }))
  )

  const promotedCount = (project.assets || []).filter((a: { assignedCardId?: string | null }) => a.assignedCardId).length

  const [workspaces, setWorkspaces] = useState<{id: string, name: string}[]>([])
  useEffect(() => {
    apiFetch('/api/workspaces')
      .then((r) => r.json())
      .then((data) => setWorkspaces(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [project.id])

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-border bg-sidebar lg:w-72">
      <div className="flex flex-col gap-2 border-b border-border p-2.5">
        <div className="rounded-md border border-border bg-card p-2">
          <p className="text-[11px] font-medium leading-tight text-pretty">
            {project.posterTitle}
          </p>
          <dl className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
            <div className="flex gap-1">
              <dt className="text-muted-foreground/70">Authors</dt>
              <dd className="truncate">{project.authors}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted-foreground/70">Venue</dt>
              <dd className="truncate">{project.venue}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted-foreground/70">Cards</dt>
              <dd>
                {project.cards.length} blocks · {columnCount} columns
              </dd>
            </div>
          </dl>
        </div>

        <Button
          variant="outline"
          size="xs"
          className="w-full justify-start gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
          onClick={openIngestion}
        >
          <FileStack className="size-3.5" />
          Ingest sources (PDF)
          {(project.assets || []).length > 0 && (
            <span className="ml-auto font-mono text-[9px] text-muted-foreground">
              {promotedCount}/{(project.assets || []).length} used
            </span>
          )}
        </Button>
      </div>

      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
          Poster structure
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {isSwitchingProject ? (
          <div
            className="flex flex-col gap-3 px-2.5 pb-4"
            role="status"
            aria-label="Loading project structure"
          >
            {Array.from({ length: 3 }).map((_, g) => (
              <div key={g} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-20" />
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ))}
            <span className="sr-only">Loading project structure…</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-2.5 pb-4">
            <ColumnGroup column={1} />
            <ColumnGroup column={2} />
            <ColumnGroup column={3} />
          </div>
        )}
      </ScrollArea>
    </aside>
  )
}
