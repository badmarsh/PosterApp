"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileWarning,
  GripVertical,
  Info,
  HelpCircle,
  Lightbulb,
  Loader2,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  XCircle,
  Bold,
  Italic,
  Code as CodeIcon,
  Link as LinkIcon,
  Save,
  MoreHorizontal,
  SaveAll,
} from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { StatusBadge } from "@/components/status"
import {
  generateLatexForCard,
  levelFromMessages,
  validateCard,
} from "@/lib/latex"
import {
  BLOCK_PATTERNS,
  type Card,
  type ColumnIndex,
  type ValidationMessage,
} from "@/lib/poster-types"
import { cn } from "@/lib/utils"

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <Label className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
      <span className="uppercase tracking-wide">{children}</span>
      {hint && <span className="font-mono text-[10px] normal-case">{hint}</span>}
    </Label>
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

  const orderInCol =
    cards
      .filter((c) => c.column === card.column)
      .sort((a, b) => a.order - b.order)
      .findIndex((c) => c.id === card.id) + 1
  const colCount = cards.filter((c) => c.column === card.column).length

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <FieldLabel>Title</FieldLabel>
        <Input
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

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <FieldLabel>Column</FieldLabel>
          <Select
            value={String(card.column)}
            onValueChange={(v) => moveColumn(card.id, Number(v) as ColumnIndex)}
          >
            <SelectTrigger size="sm" className="w-full">
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
            <span className="ml-auto text-[9px] normal-case">reorder in preview</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <FieldLabel>Block pattern</FieldLabel>
        <Select
          value={card.pattern}
          onValueChange={(v) => updateCard(card.id, { pattern: v as Card["pattern"] })}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue>
              {BLOCK_PATTERNS.find((p) => p.id === card.pattern)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BLOCK_PATTERNS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          {BLOCK_PATTERNS.find((p) => p.id === card.pattern)?.description}
        </p>
      </div>
    </div>
  )
}

function ContentTab({ card }: { card: Card }) {
  const { updateCard, project, bibKeys, autoFillCardAction, generatingId } = useEditor(
    useShallow((s) => ({
      updateCard: s.updateCard,
      project: s.project,
      bibKeys: s.bibKeys,
      autoFillCardAction: s.autoFillCardAction,
      generatingId: s.generatingId,
    }))
  )
  const ingestFiles = project.ingestFiles || []
  const disabled = card.pattern === "image-focused" || card.pattern === "references"
  const isReferences = card.pattern === "references"
  const isGenerating = generatingId === card.id
  const contentRef = useRef<HTMLTextAreaElement>(null)

  function insertMarkdown(prefix: string, suffix: string) {
    const el = contentRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = card.content
    const selected = text.slice(start, end)
    const before = text.slice(0, start)
    const after = text.slice(end)
    const replacement = selected || "text"
    const next = `${before}${prefix}${replacement}${suffix}${after}`
    updateCard(card.id, { content: next })
    
    window.setTimeout(() => {
      el.focus()
      el.setSelectionRange(
        start + prefix.length,
        start + prefix.length + replacement.length,
      )
    }, 0)
  }

  function insertCiteKey(key: string) {
    const el = contentRef.current
    if (!el || !key) return
    const cite = `\\cite{${key}}`
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = card.content
    const next = text.slice(0, start) + cite + text.slice(end)
    updateCard(card.id, { content: next })
    window.setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + cite.length, start + cite.length)
    }, 0)
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <FieldLabel hint="markdown supported">Card Content</FieldLabel>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-[10px] text-indigo-500 hover:text-indigo-600 border-indigo-500/20"
            onClick={() => autoFillCardAction(card.id)}
            disabled={isGenerating || disabled}
          >
            {isGenerating ? <Loader2 className="size-3 animate-spin" /> : "✨"}
            Auto-Fill
          </Button>
        </div>
        {disabled ? (
          <p className="rounded-md border border-dashed border-border bg-muted/40 px-2.5 py-3 text-center text-[11px] text-muted-foreground">
            {isReferences
              ? "The references pattern automatically generates the bibliography. No text content is needed."
              : "The image-focused pattern has no text content. Switch pattern in Basics to enable."}
          </p>
        ) : (
          <div className="flex flex-col rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
            <div className="flex items-center gap-1 border-b border-border bg-muted/40 p-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => insertMarkdown("**", "**")}
                title="Bold"
              >
                <Bold className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => insertMarkdown("*", "*")}
                title="Italic"
              >
                <Italic className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => insertMarkdown("`", "`")}
                title="Inline Code"
              >
                <CodeIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => insertMarkdown("[", "](url)")}
                title="Link"
              >
                <LinkIcon className="size-3.5" />
              </Button>
            </div>
            <Textarea
              ref={contentRef}
              value={card.content}
              onChange={(e) => updateCard(card.id, { content: e.target.value })}
              placeholder="Use - or * for bulleted lists..."
              className="min-h-[16rem] resize-y border-0 text-[13px] shadow-none focus-visible:ring-0"
            />
          </div>
        )}
      </div>
      {!disabled && bibKeys.length > 0 && (
        <div className="flex flex-col gap-1">
          <FieldLabel>Insert cite key</FieldLabel>
          <select
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            defaultValue=""
            onChange={(e) => {
              insertCiteKey(e.target.value)
              e.target.value = ""
            }}
          >
            <option value="" disabled>
              — pick a key to insert \cite{'{'}…{'}'} —
            </option>
            {bibKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      )}

      {!disabled && (
        <div className="flex flex-col gap-1">
          <FieldLabel>Height Budget (u)</FieldLabel>
          <Input
            type="number"
            value={card.heightBudget || ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null
              updateCard(card.id, { heightBudget: val })
            }}
            placeholder="Auto (fit remaining space)"
            className="h-8 text-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Target height in layout units (Column max: 900u). Leave empty to automatically fit the remaining space in the column. The AI calculates character limits based on: Title (70u) + Images (~190u) + Text (14u per 60 chars).
          </p>
        </div>
      )}

      {!disabled && ingestFiles.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
          <FieldLabel>Data Sources for Auto-Fill</FieldLabel>
          <div className="flex flex-col gap-2">
            {ingestFiles.map((file: {id: string, name: string}) => {
              const isSelected = !card.sourceIds || card.sourceIds.length === 0 || card.sourceIds.includes(file.id)
              return (
                <div key={file.id} className="flex items-center gap-2">
                  <Switch
                    size="sm"
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const current = card.sourceIds || []
                      // If empty/all, and turning one off, we must implicitly select the others
                      let next: string[]
                      if (current.length === 0) {
                        next = checked ? [] : ingestFiles.filter((f: {id: string}) => f.id !== file.id).map(f => f.id)
                      } else {
                        next = checked ? [...current, file.id] : current.filter(id => id !== file.id)
                      }
                      
                      // If all are selected, reset to empty array for cleaner state
                      if (next.length === ingestFiles.length) {
                        next = []
                      }
                      
                      updateCard(card.id, { sourceIds: next })
                    }}
                  />
                  <span className="truncate text-[11px] text-muted-foreground">{file.name}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Restrict the Gemini RAG context to these specific files.
          </p>
        </div>
      )}
    </div>
  )
}

function TableTab({ card }: { card: Card }) {
  const { updateCard, project } = useEditor(
    useShallow((s) => ({
      updateCard: s.updateCard,
      project: s.project,
    }))
  )
  const parsedTables = (project.assets || []).filter(a => a.kind === "table" && a.tableRows && a.tableRows.length > 0)
  const { table } = card
  const cols = table.rows[0]?.length ?? 0
  const enabled = card.pattern === "bullets-table"

  function setCell(r: number, c: number, val: string) {
    const rows = table.rows.map((row) => [...row])
    rows[r][c] = val
    updateCard(card.id, { table: { ...table, rows } })
  }
  function addRow() {
    const width = cols || 2
    updateCard(card.id, {
      table: { ...table, rows: [...table.rows, Array(width).fill("")] },
    })
  }
  function removeRow(r: number) {
    updateCard(card.id, {
      table: { ...table, rows: table.rows.filter((_, i) => i !== r) },
    })
  }
  function addCol() {
    updateCard(card.id, {
      table: { ...table, rows: table.rows.map((row) => [...row, ""]) },
    })
  }
  function removeCol() {
    if (cols <= 1) return
    updateCard(card.id, {
      table: { ...table, rows: table.rows.map((row) => row.slice(0, -1)) },
    })
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {!enabled && (
        <p className="rounded-md border border-dashed border-border bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground">
          This pattern does not render a table. Select <span className="font-mono">bullets-table</span> in Basics to include it.
        </p>
      )}

      {enabled && parsedTables.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/20 p-2.5 mb-2">
          <FieldLabel>Populate from parsed tables</FieldLabel>
          <Select
            value=""
            onValueChange={(val) => {
              if (!val) return
              const asset = parsedTables.find(a => a.id === val)
              if (asset && asset.tableRows) {
                updateCard(card.id, {
                  table: {
                    hasHeader: true,
                    caption: asset.caption ?? table.caption,
                    rows: asset.tableRows,
                  }
                })
                toast.success("Table populated from parsed asset")
              }
            }}
          >
            <SelectTrigger size="sm" className="w-full bg-card text-[11px] h-7">
              <SelectValue placeholder="Select a parsed table..." />
            </SelectTrigger>
            <SelectContent>
              {parsedTables.map(t => (
                <SelectItem key={t.id} value={t.id} className="text-[11px]">
                  {t.filename ? `${t.filename} - ` : ""} {t.caption || `Table from p.${t.page}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={table.hasHeader}
            onCheckedChange={(v) => updateCard(card.id, { table: { ...table, hasHeader: v } })}
            size="sm"
          />
          <span className="text-[11px] text-foreground">Header row</span>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="xs" className="gap-1" onClick={addCol}>
            <Plus className="size-3" /> Col
          </Button>
          <Button variant="outline" size="xs" onClick={removeCol} disabled={cols <= 1}>
            Remove col
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            {table.rows.map((row, r) => (
              <tr
                key={r}
                className={cn(
                  "border-b border-border last:border-0",
                  r === 0 && table.hasHeader && "bg-muted/60",
                )}
              >
                {row.map((cell, c) => (
                  <td key={c} className="border-r border-border p-0 last:border-0">
                    <input
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      className={cn(
                        "w-full bg-transparent px-2 py-1 outline-none focus:bg-accent/40",
                        r === 0 && table.hasHeader && "font-semibold",
                      )}
                    />
                  </td>
                ))}
                <td className="w-7 bg-muted/30 text-center">
                  <button
                    type="button"
                    aria-label="Remove row"
                    onClick={() => removeRow(r)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="xs" className="w-fit gap-1" onClick={addRow}>
        <Plus className="size-3" /> Add row
      </Button>

      <div className="flex flex-col gap-1">
        <FieldLabel>Caption</FieldLabel>
        <Input
          value={table.caption}
          onChange={(e) => updateCard(card.id, { table: { ...table, caption: e.target.value } })}
          placeholder="Table caption"
          className="h-8 text-[13px]"
        />
      </div>
    </div>
  )
}

function FiguresTab({ card }: { card: Card }) {
  const updateCard = useEditor((s) => s.updateCard)
  const projectId = useEditor((s) => s.project.id)
  const slots =
    card.pattern === "bullets-two-images"
      ? 2
      : card.pattern === "bullets-image" || card.pattern === "image-focused"
        ? 1
        : 0
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])

  function setFigure(i: number, patch: Partial<Card["figures"][number]>) {
    const figures = [...card.figures]
    figures[i] = {
      // eslint-disable-next-line react-hooks/purity
      id: figures[i]?.id ?? `fig_${i}_${Date.now().toString(36)}`,
      url: figures[i]?.url ?? "",
      caption: figures[i]?.caption ?? "",
      ...patch,
    }
    updateCard(card.id, { figures })
  }

  async function onUpload(i: number, file?: File) {
    if (!file) return
    const blobUrl = URL.createObjectURL(file)
    setFigure(i, { url: blobUrl })
    toast.info(`Uploading ${file.name}...`)
    
    try {
      const formData = new FormData()
      formData.append("file", file)
      
      const res = await fetch(`/api/workspaces/${projectId}/assets/upload`, {
        method: "POST",
        body: formData
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || "Upload failed")
      
      setFigure(i, { url: data.asset.url })
      toast.success(`Uploaded ${file.name}`)
    } catch (err) {
      console.error(err)
      toast.error(`Failed to upload ${file.name}`)
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
  }

  if (slots === 0) {
    return (
      <div className="p-3">
        <p className="rounded-md border border-dashed border-border bg-muted/40 px-2.5 py-3 text-center text-[11px] text-muted-foreground">
          This block pattern has no figure slots. Choose an image pattern in Basics.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {slots === 2 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
          <span className="text-[11px] text-foreground">Layout</span>
          <Select
            value={card.figureLayout}
            onValueChange={(v) => updateCard(card.id, { figureLayout: v as Card["figureLayout"] })}
          >
            <SelectTrigger size="sm" className="w-36">
              <SelectValue>
                {card.figureLayout === "two-up" ? "Two-up figures" : "Single figure"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single figure</SelectItem>
              <SelectItem value="two-up">Two-up figures</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {Array.from({ length: slots }).map((_, i) => {
        const fig = card.figures[i]
        return (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                Slot {i + 1}
              </span>
              {fig?.url && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Clear image"
                  onClick={() => setFigure(i, { url: "" })}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>

            <div className="flex h-28 items-center justify-center overflow-hidden rounded border border-dashed border-border bg-muted/40">
              {fig?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fig.url || "/placeholder.svg"}
                  alt={fig.caption || "figure preview"}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[11px] text-muted-foreground">No image</span>
              )}
            </div>

            <div className="flex gap-1.5">
              <input
                ref={(el) => {
                  fileRefs.current[i] = el
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUpload(i, e.target.files?.[0])}
              />
              <Button
                variant="outline"
                size="xs"
                className="gap-1"
                onClick={() => fileRefs.current[i]?.click()}
              >
                <Upload className="size-3" /> Upload
              </Button>
              <Input
                value={fig?.url ?? ""}
                onChange={(e) => setFigure(i, { url: e.target.value })}
                placeholder="or image URL / path"
                className="h-7 flex-1 font-mono text-[11px]"
              />
            </div>
            <Input
              value={fig?.caption ?? ""}
              onChange={(e) => setFigure(i, { caption: e.target.value })}
              placeholder="Caption"
              className="h-7 text-[12px]"
            />
          </div>
        )
      })}
    </div>
  )
}

const LEVEL_ICON = {
  error: { Icon: XCircle, className: "text-destructive" },
  warning: { Icon: AlertTriangle, className: "text-chart-4" },
  info: { Icon: Info, className: "text-muted-foreground" },
} as const

function Section({ title, items }: { title: string; items: ValidationMessage[] }) {
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      {items.map((m, i) => {
        const { Icon, className } = LEVEL_ICON[m.level]
        return (
          <div
            key={i}
            className="flex items-start gap-1.5 rounded-md border border-border bg-card px-2 py-1.5"
          >
            <Icon className={cn("mt-0.5 size-3.5 shrink-0", className)} />
            <div className="min-w-0">
              <span className="font-mono text-[10px] text-muted-foreground">{m.field}</span>
              <p className="text-[12px] leading-snug">{m.message}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ValidationTab({ card }: { card: Card }) {
  const msgs = validateCard(card)
  const level = levelFromMessages(msgs)
  const safety = msgs.filter((m) => m.message.includes("LaTeX"))
  const overflow = msgs.filter((m) => m.message.includes("height"))
  const other = msgs.filter((m) => !safety.includes(m) && !overflow.includes(m))



  return (
    <div className="flex flex-col gap-3 p-3">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border px-2.5 py-2",
          level === "valid"
            ? "border-chart-3/30 bg-chart-3/10"
            : level === "warning"
              ? "border-chart-4/30 bg-chart-4/10"
              : "border-destructive/30 bg-destructive/10",
        )}
      >
        {level === "valid" ? (
          <CheckCircle2 className="size-4 text-chart-3" />
        ) : level === "warning" ? (
          <FileWarning className="size-4 text-chart-4" />
        ) : (
          <XCircle className="size-4 text-destructive" />
        )}
        <span className="text-[12px] font-medium">
          {level === "valid"
            ? "Card input is well-formed and ready to generate."
            : level === "warning"
              ? `${msgs.length} non-blocking warning${msgs.length === 1 ? "" : "s"}.`
              : "Blocking errors — fix before generation."}
        </span>
      </div>
      <Section title="Field validation" items={other} />
      <Section title="LaTeX safety" items={safety} />
      <Section title="Overflow estimate" items={overflow} />
      {!msgs.length && (
        <p className="text-center text-[11px] text-muted-foreground">No issues found.</p>
      )}
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
            toast.success("LaTeX copied")
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
    validateCardAction,
    generateLatexForCardAction,
    saveProject,
    deleteCard,
    selectCard,
    getStatus,
    generatingId,
    projectId,
    inspectorTab,
    setInspectorTab,
  } = useEditor(
    useShallow((s) => ({
      validateCardAction: s.validateCardAction,
      generateLatexForCardAction: s.generateLatexForCardAction,
      saveProject: s.saveProject,
      deleteCard: s.deleteCard,
      selectCard: s.selectCard,
      getStatus: s.getStatus,
      generatingId: s.generatingId,
      projectId: s.project.id,
      inspectorTab: s.inspectorTab,
      setInspectorTab: s.setInspectorTab,
    }))
  )
  const selectedCard = useEditor((s) => {
    const activeOutput = s.project.outputs?.find((o) => o.id === s.project.activeOutputId)
    return activeOutput?.cards.find((c) => c.id === s.selectedCardId) ?? null
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
  const isGenerating = generatingId === card.id

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
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {card.id} · column {card.column}
          </p>
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
          <TabsContent value="content"><ContentTab card={card} /></TabsContent>
          <TabsContent value="table"><TableTab card={card} /></TabsContent>
          <TabsContent value="figures"><FiguresTab card={card} /></TabsContent>
          <TabsContent value="validation"><ValidationTab card={card} /></TabsContent>
          <TabsContent value="output"><OutputTab card={card} /></TabsContent>
        </ScrollArea>
      </Tabs>

      <div className="flex flex-col gap-2 border-t border-border bg-muted/30 p-4">
        <Button
          size="default"
          className="w-full justify-center h-9 text-sm"
          onClick={() => saveProject()}
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
            onClick={async () => {
              try {
                await saveProject()
                toast.success("Card saved")
              } catch (e) {
                toast.error("Save card failed")
              }
            }}
            disabled={isGenerating}
          >
            <Save className="size-4 mr-2" /> Save Card
          </Button>
        </div>
      </div>
    </section>
  )
}
