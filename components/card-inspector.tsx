"use client"

import { AlertTriangle, Copy, GripVertical, Save, SaveAll, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { StatusBadge } from "@/components/status"
import { generateLatexForCard } from "@/lib/latex"
import { estimateHeightBreakdown, columnBudgetFor } from "@/lib/latex/layout"
import {
  BLOCK_PATTERNS,
  type Card,
  type ColumnIndex,
} from "@/lib/poster-types"
import { PATTERNS_FOR_TYPE, OUTPUT_TYPE_LABELS, type OutputType } from "@/lib/output-types"
import { decodeHtmlEntities } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { ContentTab as ModularContentTab } from "@/components/card-inspector/content-tab"
import { FiguresTab as ModularFiguresTab } from "@/components/card-inspector/figures-tab"
import { TableTab as ModularTableTab } from "@/components/card-inspector/table-tab"
import { ValidationTab as ModularValidationTab } from "@/components/card-inspector/validation-tab"
import { LayoutTruthBanner } from "@/components/grounding/layout-truth-banner"

function RagSourcesIllustration() {
  return (
    <svg
      viewBox="0 0 56 40"
      className="size-full shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Back doc */}
      <rect x="14" y="6" width="22" height="28" rx="2" className="fill-muted stroke-border/70" strokeWidth="1" />
      {/* Front doc */}
      <rect x="8" y="10" width="22" height="28" rx="2" className="fill-card stroke-border" strokeWidth="1.2" />
      <rect x="12" y="14" width="8" height="2" rx="0.5" className="fill-primary" />
      <rect x="12" y="18" width="14" height="1.5" rx="0.5" className="fill-muted-foreground/40" />
      <rect x="12" y="21" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="12" y="24" width="14" height="1.5" rx="0.5" className="fill-muted-foreground/30" />

      {/* RAG Context Filter Shield / Funnel */}
      <circle cx="38" cy="22" r="10" className="fill-background stroke-primary/50" strokeWidth="1.2" />
      <path
        d="M33 17H43L39 22V27L37 28V22L33 17Z"
        className="fill-primary/20 stroke-primary"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Sparkle */}
      <path d="M47 8L48 11L51 12L48 13L47 16L46 13L43 12L46 11L47 8Z" className="fill-warning" />
    </svg>
  )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <Label className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
      <span className="uppercase tracking-wide">{children}</span>
      {hint && <span className="font-mono text-[10px] normal-case">{hint}</span>}
    </Label>
  )
}

/**
 * Live column-budget meter for the Content tab: renders the same
 * estimateHeightBreakdown model that validation uses, so the bar and the
 * overflow warning can never disagree. Soft threshold at 85%, hard at 100%.
 */
function HeightMeter({ card, templateId }: { card: Card; templateId?: string | null }) {
  const breakdown = estimateHeightBreakdown(card)
  const budget = columnBudgetFor(templateId)
  const target = card.heightBudget && card.heightBudget > 0 ? card.heightBudget : null
  const effectiveBudget = target ?? budget
  const ratio = Math.min(breakdown.total / effectiveBudget, 1)
  const percent = Math.round((breakdown.total / effectiveBudget) * 100)
  const overSoft = breakdown.total > effectiveBudget * 0.85
  const overHard = breakdown.total > effectiveBudget

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <FieldLabel hint={`column max ${budget}u`}>Height budget usage</FieldLabel>
        <span
          className={cn(
            "font-mono text-[10px]",
            overHard ? "text-destructive" : overSoft ? "text-warning" : "text-success",
          )}
        >
          {breakdown.total}u / {effectiveBudget}u ({percent}%)
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={Math.min(percent, 999)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Card height usage relative to column budget"
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-150",
            overHard ? "bg-destructive" : overSoft ? "bg-warning" : "bg-success",
          )}
          style={{ width: `${Math.max(ratio * 100, breakdown.total > 0 ? 3 : 0)}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {overHard ? (
          <>
            Over budget by {breakdown.total - effectiveBudget}u — likely overflow.
            {target && effectiveBudget !== budget ? ` Custom target (${target}u) is stricter than the ${templateId ?? "default"} column (${budget}u).` : ""}
          </>
        ) : overSoft ? (
          <>Close to the {effectiveBudget}u budget — the validation tab will warn above 85%.</>
        ) : (
          <>
            {breakdown.prose > 0 && `${breakdown.prose}u prose`}
            {breakdown.bullets > 0 && `${breakdown.prose > 0 ? " · " : ""}${breakdown.bullets}u bullets`}
            {breakdown.table > 0 && `${breakdown.prose + breakdown.bullets > 0 ? " · " : ""}${breakdown.table}u table`}
            {breakdown.figures > 0 && `${breakdown.total - breakdown.prose - breakdown.bullets - breakdown.table > 0 ? " · " : ""}${breakdown.figures}u figures`}
            {breakdown.total <= 70 && "empty — add content"}
          </>
        )}
      </p>
    </div>
  )
}

function BasicsTab({ card }: { card: Card }) {
  const { updateCard, moveColumn, project } = useEditor(
    useShallow((s) => ({
      updateCard: s.updateCard,
      moveColumn: s.moveColumn,
      project: s.project,
    }))
  )
  const idValid = /^(blk|card)_[a-z0-9_]+$/.test(card.id)
  const titleInvalid = card.title.trim().length === 0
  const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)
  const cards = activeOutput?.cards || []
  const outputType = (activeOutput?.outputType ?? "poster") as OutputType
  const isPosters = outputType === "poster"

  const orderInCol =
    cards
      .filter((c) => c.column === card.column)
      .sort((a, b) => a.order - b.order)
      .findIndex((c) => c.id === card.id) + 1
  const colCount = cards.filter((c) => c.column === card.column).length

  // Patterns valid for the current output type
  const patternsForOutput = BLOCK_PATTERNS.filter((p) =>
    PATTERNS_FOR_TYPE[outputType]?.some((q: { id: string }) => q.id === p.id)
  )

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <FieldLabel>Title</FieldLabel>
        <Input
          aria-label="Card title"
          value={card.title}
          onChange={(e) => updateCard(card.id, { title: e.target.value })}
          placeholder="Card title"
          aria-invalid={titleInvalid}
          aria-describedby={titleInvalid ? `${card.id}-title-error` : undefined}
          className={cn(
            "h-8",
            titleInvalid && "border-destructive focus-visible:ring-destructive/40",
          )}
        />
        {titleInvalid && (
          <p
            id={`${card.id}-title-error`}
            className="flex items-center gap-1 text-[10px] text-destructive"
          >
            <AlertTriangle className="size-3" />
            Title is required — it becomes the {"\\block{}"} heading.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <FieldLabel hint="blk_ or card_">Stable block ID</FieldLabel>
        <Input
          aria-label="Stable block ID"
          value={card.id}
          readOnly
          className={cn(
            "h-8 font-mono text-xs",
            !idValid && "border-destructive text-destructive",
          )}
        />
        <p className="text-[10px] text-muted-foreground">
          Used to patch / replace this block inside the fixed template. Stable across edits.
        </p>
      </div>

      {isPosters ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <FieldLabel>Column</FieldLabel>
            <Select
              value={String(card.column)}
              onValueChange={(v) => moveColumn(card.id, Number(v) as ColumnIndex)}
            >
              <SelectTrigger size="sm" className="w-full" aria-label="Column">
                <SelectValue>{`Column ${card.column}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Column 1</SelectItem>
                <SelectItem value="2">Column 2</SelectItem>
                <SelectItem value="3">Column 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>Order in column</FieldLabel>
            <div className="flex h-7 items-center gap-1.5 rounded-md border border-input bg-muted/40 px-2.5 font-mono text-xs text-muted-foreground">
              <GripVertical className="size-3.5" />
              {orderInCol} / {colCount}
              <span className="ml-auto text-[10px] normal-case">reorder in preview</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <FieldLabel>Order</FieldLabel>
          <div className="flex h-7 items-center gap-1.5 rounded-md border border-input bg-muted/40 px-2.5 font-mono text-xs text-muted-foreground">
            <GripVertical className="size-3.5" />
            {[...cards].sort((a, b) => a.order - b.order).findIndex((c) => c.id === card.id) + 1} / {cards.length}
            <span className="ml-auto text-[10px] normal-case">reorder in preview</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <FieldLabel>Block pattern</FieldLabel>
        <Select
          value={card.pattern}
          onValueChange={(v) => updateCard(card.id, { pattern: v as Card["pattern"] })}
        >
          <SelectTrigger size="sm" className="w-full" aria-label="Block pattern">
            <SelectValue>
              {patternsForOutput.find((p) => p.id === card.pattern)?.label ?? card.pattern}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {patternsForOutput.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          {patternsForOutput.find((p) => p.id === card.pattern)?.description}
        </p>
      </div>
    </div>
  )
}

function OutputTab({ card }: { card: Card }) {
  const latex = card.generatedLatex ?? generateLatexForCard(card)
  const stale = !card.generatedLatex
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <FieldLabel hint={`block ${card.id}`}>
          {stale ? "Live preview (not yet generated)" : "Generated LaTeX"}
        </FieldLabel>
        <Button
          variant="outline"
          size="xs"
          className="gap-1"
          onClick={() => {
            navigator.clipboard?.writeText(latex)
          }}
        >
          <Copy className="size-3" /> Copy
        </Button>
      </div>
      <pre className="max-h-full overflow-auto rounded-md border border-border bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed text-foreground">
        {latex}
      </pre>
      <p className="text-[10px] text-muted-foreground">
        Generated in isolated scope for this card only. The app patches this single{" "}
        <span className="font-mono">{"\\block{}"}</span> into the fixed template by ID.
      </p>
    </div>
  )
}

export function CardInspector() {
  const {
    saveProject,
    deleteCard,
    selectCard,
    getStatus,
    generatingIds,
    autoShrinkCardAction,
    inspectorTab,
    setInspectorTab,
  } = useEditor(
    useShallow((s) => ({
      saveProject: s.saveProject,
      deleteCard: s.deleteCard,
      selectCard: s.selectCard,
      getStatus: s.getStatus,
      generatingIds: s.generatingIds,
      autoShrinkCardAction: s.autoShrinkCardAction,
      inspectorTab: s.inspectorTab,
      setInspectorTab: s.setInspectorTab,
    }))
  )
  const selectedCard = useEditor((s) => {
    const activeOutput = s.project.outputs?.find((o) => o.id === s.project.activeOutputId)
    return activeOutput?.cards.find((c) => c.id === s.selectedCardId) ?? null
  })
  const activeOutputType = useEditor((s) => {
    const activeOutput = s.project.outputs?.find((o) => o.id === s.project.activeOutputId)
    return activeOutput?.outputType ?? "poster"
  })

  if (!selectedCard) {
    return (
      <section
        aria-label="Card inspector"
        className="flex w-full shrink-0 flex-col items-center justify-center border-l border-border bg-card px-6 py-10 text-center lg:w-[26rem]"
      >
        <div className="rounded-full border border-border bg-muted p-3">
          <GripVertical className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm font-medium">No card selected</p>
        <p className="mt-1 max-w-[16rem] text-[12px] text-muted-foreground">
          Select a block from the structure tree or the poster preview to edit its
          content.
        </p>
      </section>
    )
  }

  const card = selectedCard
  const status = getStatus(card)
  const isGenerating = generatingIds.includes(card.id)
  const cardSubtitle = activeOutputType === "poster"
    ? `${card.id} · column ${card.column}`
    : `${card.id} · ${BLOCK_PATTERNS.find((p) => p.id === card.pattern)?.label ?? card.pattern}`

  return (
    <section
      aria-label={`Inspector for ${card.title || "Untitled card"}`}
      className="flex w-full shrink-0 flex-col border-l border-border bg-card lg:w-[26rem]"
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{card.title || "Untitled"}</h2>
            <StatusBadge level={status} />
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {cardSubtitle}
          </p>
          <LayoutTruthBanner
            layout={card.grounding?.layout}
            onAutoShrink={() => void autoShrinkCardAction(card.id)}
            compact
          />
        </div>
      </div>

      <Tabs value={inspectorTab} onValueChange={(v) => setInspectorTab(v as "basics" | "content" | "validation")} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList variant="line" className="h-9 shrink-0 justify-start gap-0.5 overflow-x-auto overflow-y-hidden border-b border-border px-2">
          <TabsTrigger value="basics" className="px-2 text-[12px]">Basics</TabsTrigger>
          <TabsTrigger value="content" className="px-2 text-[12px]">Content</TabsTrigger>
          <TabsTrigger value="table" className="px-2 text-[12px]">Table</TabsTrigger>
          <TabsTrigger value="figures" className="px-2 text-[12px]">Figures</TabsTrigger>
          <TabsTrigger value="validation" className="px-2 text-[12px]">Validation</TabsTrigger>
          <TabsTrigger value="output" className="px-2 text-[12px]">Output</TabsTrigger>
        </TabsList>

        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="basics"><BasicsTab card={card} /></TabsContent>
          <TabsContent value="content"><ModularContentTab card={card} /></TabsContent>
          <TabsContent value="table"><ModularTableTab card={card} /></TabsContent>
          <TabsContent value="figures"><ModularFiguresTab card={card} /></TabsContent>
          <TabsContent value="validation"><ModularValidationTab card={card} /></TabsContent>
          <TabsContent value="output"><OutputTab card={card} /></TabsContent>
        </ScrollArea>
      </Tabs>

      <div className="flex flex-col gap-2 border-t border-border bg-muted/30 p-4">
        <Button
          size="default"
          className="w-full justify-center h-9 text-sm"
          onClick={() => saveProject(true)}
          disabled={isGenerating}
        >
          <SaveAll className="size-4 mr-2" /> Save Project
        </Button>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => {
              deleteCard(card.id)
              selectCard(null)
            }}
            disabled={isGenerating}
          >
            <Trash2 className="size-4 mr-2" /> Delete
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => saveProject(true)}
            disabled={isGenerating}
          >
            <Save className="size-4 mr-2" /> Save Card
          </Button>
        </div>
      </div>
    </section>
  )
}
