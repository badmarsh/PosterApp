"use client"

import { useState, memo } from "react"
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  FilePlus2,
  FileStack,
  Plus,
  Search,
  Trash2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { hasUnsafeLatex, validateCard } from "@/lib/latex/validation"

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
  const { selectedCardId, selectCard, deleteCard, getStatus, layoutWarnings, reorderCard, moveColumn, updateCard, saveProject, project, pushEvent, compactMode } = useEditor(
    useShallow((s) => ({
      selectedCardId: s.selectedCardId,
      selectCard: s.selectCard,
      deleteCard: s.deleteCard,
      getStatus: s.getStatus,
      layoutWarnings: s.layoutWarnings,
      reorderCard: s.reorderCard,
      moveColumn: s.moveColumn,
      updateCard: s.updateCard,
      saveProject: s.saveProject,
      project: s.project,
      pushEvent: s.pushEvent,
      compactMode: s.compactMode,
    }))
  )
  const [isShrinking, setIsShrinking] = useState(false)
  const active = card.id === selectedCardId
  const status = getStatus(card)
  const warning = layoutWarnings.find(w => {
    if (w.cardId === card.id) return true;
    if (!w.cardId && w.cardTitle && card.title) {
      const vlmTitle = w.cardTitle.trim().toLowerCase();
      const actualTitle = card.title.trim().toLowerCase();
      return vlmTitle.includes(actualTitle) || actualTitle.includes(vlmTitle);
    }
    return false;
  })
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
        "group flex cursor-pointer flex-col rounded-md border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compactMode ? "gap-0.5 px-1.5 py-1" : "gap-1 px-2 py-1.5",
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
        {status === "pending" && (
          <span className="shrink-0 rounded bg-amber-500/15 border border-amber-500/30 px-1 py-0.5 font-mono text-[9px] font-semibold text-amber-500 uppercase tracking-tight">
            Placeholder
          </span>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={`Delete card ${card.title || card.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  deleteCard(card.id)
                }}
                className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            }
          />
          <TooltipContent>Delete card</TooltipContent>
        </Tooltip>
      </div>
      {warning && (
        <div className="flex flex-col gap-1 rounded bg-destructive/10 p-1.5 text-[11px] text-destructive mt-1">
          <div className="flex items-center gap-1 font-semibold">
            <AlertTriangle className="size-3.5" /> Overflow Detected
          </div>
          <span className="leading-tight">{warning.issue}</span>
          <Button 
            size="sm" 
            variant="destructive" 
            className="h-7 px-2 mt-1 text-[11px] font-medium"
            disabled={isShrinking}
            onClick={async (e) => {
              e.stopPropagation();
              setIsShrinking(true);
              try {
                const res = await apiFetch(`/api/workspaces/${project.id}/cards/${card.id}/shrink?revision=${project.revision}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ 
                    content: card.content, 
                    warning: warning.issue,
                    sourceIds: card.sourceIds
                  })
                })
                const data = await res.json()
                if (data.content) {
                  const unsafeIssues = hasUnsafeLatex(data.content)
                  const validationMsgs = validateCard({ ...card, content: data.content })
                  const validationErrors = [
                    ...unsafeIssues,
                    ...validationMsgs.filter((m) => m.level === "error").map((m) => m.message),
                  ]

                  if (validationErrors.length > 0) {
                    toast.warning("Validation warnings in proposed content", {
                      description: validationErrors.join(" • "),
                      duration: 10000,
                      action: {
                        label: "Apply Anyway",
                        onClick: async () => {
                          updateCard(card.id, { content: data.content })
                          await saveProject()
                        }
                      }
                    })
                  } else {
                    updateCard(card.id, { content: data.content })
                    await saveProject()
                    toast.success("Content shrunk successfully.")
                  }
                }
              } catch (err: unknown) {
                pushEvent({
                  kind: "info",
                  status: "error",
                  title: "Shrink Failed",
                  detail: err instanceof Error ? err.message : String(err),
                })
                toast.error("Auto-shrink failed", {
                  description: err instanceof Error ? err.message : String(err),
                })
              } finally {
                setIsShrinking(false)
              }
            }}
          >
            {isShrinking ? "Shrinking..." : "Auto-Shrink Content"}
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 pl-5 mt-1">
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {card.id}
        </span>
        <div className="flex items-center gap-1.5">
          <ContentIndicators card={card} />
          <CardTypeBadge card={card} />
        </div>
      </div>
      <div className="pl-5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
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

function ColumnGroup({
  column,
  searchQuery = "",
  collapsed = false,
  onToggleCollapsed,
}: {
  column: ColumnIndex
  searchQuery?: string
  collapsed?: boolean
  onToggleCollapsed?: (column: ColumnIndex) => void
}) {
  const { project, addCard } = useEditor(
    useShallow((s) => ({
      project: s.project,
      addCard: s.addCard,
    }))
  )
  const q = searchQuery.trim().toLowerCase()
  const allCards = (project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? [])
    .filter((c) => c.column === column)
    .sort((a, b) => a.order - b.order)
  
  const cards = q
    ? allCards.filter(c => c.title.toLowerCase().includes(q) || c.content.toLowerCase().includes(q))
    : allCards

  if (q && cards.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "Expand" : "Collapse"} column ${column}`}
            onClick={() => onToggleCollapsed?.(column)}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", collapsed && "-rotate-90")} />
          </button>
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
      {!collapsed && (
        <div className="flex flex-col gap-0.5">
          {cards.length ? (
            cards.map((c) => <CardRow key={c.id} card={c} />)
          ) : (
            <EmptyState
              variant="inline"
              compact
              icon={Plus}
              title="No cards yet"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-0.5 h-6 gap-1 px-2 text-[10px]"
                  onClick={() => addCard(column)}
                >
                  <Plus className="size-3" />
                  Add block
                </Button>
              }
            />
          )}
        </div>
      )}
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
    layoutWarnings,
  } = useEditor(
    useShallow((s) => ({
      project: s.project,
      columnCount: s.columnCount,
      newProject: s.newProject,
      duplicateProject: s.duplicateProject,
      switchProject: s.switchProject,
      isSwitchingProject: s.isSwitchingProject,
      openIngestion: s.openIngestion,
      layoutWarnings: s.layoutWarnings,
    }))
  )

  const activeCards = project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? []
  const unmatchedWarnings = layoutWarnings.filter(w => {
    return !activeCards.some(card => {
      if (w.cardId === card.id) return true;
      if (!w.cardId && w.cardTitle && card.title) {
        const vlmTitle = w.cardTitle.trim().toLowerCase();
        const actualTitle = card.title.trim().toLowerCase();
        return vlmTitle.includes(actualTitle) || actualTitle.includes(vlmTitle);
      }
      return false;
    })
  })

  const promotedCount = (project.assets || []).filter((a: { assignedCardId?: string | null }) => a.assignedCardId).length

  const [cardSearch, setCardSearch] = useState("")
  const [collapsedColumns, setCollapsedColumns] = useState<Record<number, boolean>>({})

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-border bg-sidebar lg:w-72">
      <div className="flex flex-col gap-2 border-b border-border p-2.5">
        <div className="rounded-md border border-border bg-card p-2">
          <p className="text-[11px] font-medium leading-tight text-pretty">
            {project.posterTitle}
          </p>
          <dl className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
            <div className="flex gap-1">
              <dt className="text-muted-foreground">Authors</dt>
              <dd className="truncate">{project.authors}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted-foreground">Venue</dt>
              <dd className="truncate">{project.venue}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted-foreground">Cards</dt>
              <dd>
                {(project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? []).length} blocks · {columnCount} columns
              </dd>
            </div>
          </dl>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary h-8 text-[11px]"
          onClick={openIngestion}
        >
          <FileStack className="size-3.5" />
          Ingest sources (PDF)
          {(project.assets || []).length > 0 && (
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
              {promotedCount}/{(project.assets || []).length} used
            </span>
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 px-2.5 pt-2.5 pb-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
            Document structure
          </span>
          {activeCards.length > 0 && (
            <span className="text-[11px] text-muted-foreground font-mono">
              {activeCards.length} cards
            </span>
          )}
        </div>
        {activeCards.length > 3 && (
          <div className="relative">
            <Search className="absolute left-2 top-2 size-3 text-muted-foreground" />
            <Input
              value={cardSearch}
              onChange={(e) => setCardSearch(e.target.value)}
              placeholder="Filter sections..."
              className="h-7 pl-6 pr-6 text-[11px] bg-card"
            />
            {cardSearch && (
              <button
                type="button"
                aria-label="Clear card search"
                onClick={() => setCardSearch("")}
                className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
              >
                <XCircle className="size-3" />
              </button>
            )}
          </div>
        )}
      </div>
      
      {unmatchedWarnings.length > 0 && (
        <div className="px-2.5 pb-2">
          {unmatchedWarnings.map((w, i) => (
            <div key={i} className="flex flex-col gap-1 rounded bg-destructive/10 p-1.5 text-[11px] text-destructive mb-1.5">
              <div className="flex items-center gap-1 font-semibold">
                <AlertTriangle className="size-3.5" /> Overflow Detected: {w.cardTitle}
              </div>
              <span className="leading-tight">{w.issue}</span>
            </div>
          ))}
        </div>
      )}

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
            <ColumnGroup
              column={1}
              searchQuery={cardSearch}
              collapsed={!!collapsedColumns[1]}
              onToggleCollapsed={(c) => setCollapsedColumns((m) => ({ ...m, [c]: !m[c] }))}
            />
            <ColumnGroup
              column={2}
              searchQuery={cardSearch}
              collapsed={!!collapsedColumns[2]}
              onToggleCollapsed={(c) => setCollapsedColumns((m) => ({ ...m, [c]: !m[c] }))}
            />
            <ColumnGroup
              column={3}
              searchQuery={cardSearch}
              collapsed={!!collapsedColumns[3]}
              onToggleCollapsed={(c) => setCollapsedColumns((m) => ({ ...m, [c]: !m[c] }))}
            />
          </div>
        )}
      </ScrollArea>
    </aside>
  )
}
