"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  Bold,
  Italic,
  Code as CodeIcon,
  Link as LinkIcon,
  Calculator,
  Quote,
  Plus,
  Trash2,
  Sparkles,
  Eye,
  Code2,
  X,
  Sigma,
  Search,
  Loader2,
  Edit2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import katex from "katex"
import "katex/dist/katex.min.css"
import type { Card } from "@/lib/poster-types"
import type { BibEntry } from "@/lib/bib-types"
import type { EquationItem } from "@/lib/equation-types"

interface RichCardEditorProps {
  card: Card
  onUpdateContent: (nextContent: string) => void
  bibEntries: BibEntry[]
  equations: EquationItem[]
  onAutoFill?: () => void
  isGenerating?: boolean
  onOpenEquationRegistry?: () => void
  onOpenBibManager?: () => void
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Render KaTeX Math safely
// ---------------------------------------------------------------------------
function KaTeXSpan({ math, displayMode = false }: { math: string; displayMode?: boolean }) {
  const html = useMemo(() => {
    try {
      const clean = math
        .replace(/^\$\$|\$\$$/g, "")
        .replace(/^\$|\$$/g, "")
        .replace(/^\\\[|\\\]$/g, "")
        .replace(/^\\\(|\\\)$/g, "")
        .replace(/\\tag\{[^}]+\}/g, "")
        .trim()
      return katex.renderToString(clean, {
        throwOnError: false,
        displayMode,
      })
    } catch {
      return null
    }
  }, [math, displayMode])

  if (!html) {
    return <span className="font-mono text-xs text-amber-600 dark:text-amber-400">{math}</span>
  }

  return (
    <span
      className={cn(
        "inline-block text-foreground select-all",
        displayMode && "my-1 block text-center overflow-x-auto py-1 px-2 rounded bg-muted/20 border border-border/40"
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ---------------------------------------------------------------------------
// Citation Chip Component — simple pill, no inline icons, delete via popover
// ---------------------------------------------------------------------------
function CitationChip({
  citeKey,
  bibEntries,
  onRemove,
  onOpenBibManager,
  onEnterPress,
  onKeyboardDelete,
}: {
  citeKey: string
  bibEntries: BibEntry[]
  onRemove?: () => void
  onOpenBibManager?: () => void
  onEnterPress?: () => void
  onKeyboardDelete?: () => void
}) {
  const [open, setOpen] = useState(false)
  const entry = useMemo(
    () => bibEntries.find((b) => b.key.toLowerCase() === citeKey.toLowerCase()),
    [bibEntries, citeKey]
  )

  const label = useMemo(() => {
    if (!entry) return citeKey
    const firstAuthor = entry.authors?.[0] || entry.authorString?.split(",")[0] || ""
    const surname = firstAuthor.split(" ").pop() || firstAuthor
    const etAl = entry.authors && entry.authors.length > 1 ? " et al." : ""
    const year = entry.year ? `, ${entry.year}` : ""
    return `${surname}${etAl}${year}` || citeKey
  }, [entry, citeKey])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 text-[10px] font-medium text-primary dark:text-primary-foreground mx-0.5 align-baseline select-none shadow-2xs hover:bg-primary/20 hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer transition-colors"
            title={`Citation: @${citeKey} — Backspace to delete, Enter for new line`}
            onKeyDown={(e) => {
              if (e.key === "Backspace" || e.key === "Delete") {
                e.preventDefault()
                onKeyboardDelete?.() ?? onRemove?.()
              } else if (e.key === "Enter") {
                e.preventDefault()
                onEnterPress?.()
              } else if (e.key === " ") {
                e.preventDefault()
                // Jump to next contenteditable sibling so the user can keep typing
                const next = (e.currentTarget as HTMLButtonElement).nextElementSibling
                if (next?.hasAttribute("contenteditable")) {
                  ;(next as HTMLElement).focus()
                  const range = document.createRange()
                  const sel = window.getSelection()
                  range.selectNodeContents(next)
                  range.collapse(false)
                  sel?.removeAllRanges()
                  sel?.addRange(range)
                }
              }
            }}
          >
            {label}
          </button>
        }
      />

      <PopoverContent className="w-80 p-3 space-y-2 shadow-lg" align="start">
        <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
          <span className="text-xs font-semibold flex items-center gap-1 text-primary">
            <Quote className="size-3.5 text-primary" /> Citation Details
          </span>
          <span className="font-mono text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/25">
            @{citeKey}
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground leading-snug">{entry?.title || citeKey}</p>
          {entry?.authorString && <p className="text-[11px] text-muted-foreground">{entry.authorString}</p>}
          {entry?.journal && <p className="text-[10px] italic text-muted-foreground">{entry.journal}</p>}
          {entry?.year && <p className="text-[10px] font-mono text-muted-foreground">Year: {entry.year}</p>}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          {onRemove && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setOpen(false)
                onRemove()
              }}
              className="text-destructive hover:bg-destructive/10 text-[10px] h-6 px-2"
            >
              <Trash2 className="size-3 mr-1" /> Delete
            </Button>
          )}
          {onOpenBibManager && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setOpen(false)
                onOpenBibManager()
              }}
              className="text-[10px] h-6 px-2 ml-auto hover:bg-primary/10 hover:text-primary"
            >
              Open Bibliography Manager →
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Math Chip Component — simple amber pill, no inline icons, edit/delete via popover
// ---------------------------------------------------------------------------
function MathChip({
  math,
  onUpdate,
  onRemove,
  onOpenRegistry,
  onEnterPress,
  onKeyboardDelete,
}: {
  math: string
  onUpdate: (newFormula: string) => void
  onRemove: () => void
  onOpenRegistry?: () => void
  onEnterPress?: () => void
  onKeyboardDelete?: () => void
}) {
  const [open, setOpen] = useState(false)
  const clean = math.replace(/^\$\$|\$\$$/g, "").replace(/^\$|\$$/g, "").trim()
  const [editFormula, setEditFormula] = useState(clean)

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) setEditFormula(clean)
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center rounded bg-amber-500/10 border border-amber-500/35 px-1.5 py-0.5 text-amber-800 dark:text-amber-200 hover:border-amber-500/60 hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-400/50 cursor-pointer select-none transition-colors mx-0.5 align-baseline shadow-2xs"
            title={`Formula: ${clean} — Backspace to delete, Enter for new line`}
            onKeyDown={(e) => {
              if (e.key === "Backspace" || e.key === "Delete") {
                e.preventDefault()
                onKeyboardDelete?.() ?? onRemove()
              } else if (e.key === "Enter") {
                e.preventDefault()
                onEnterPress?.()
              } else if (e.key === " ") {
                e.preventDefault()
                const next = (e.currentTarget as HTMLButtonElement).nextElementSibling
                if (next?.hasAttribute("contenteditable")) {
                  ;(next as HTMLElement).focus()
                  const range = document.createRange()
                  const sel = window.getSelection()
                  range.selectNodeContents(next)
                  range.collapse(false)
                  sel?.removeAllRanges()
                  sel?.addRange(range)
                }
              }
            }}
          >
            <span
              className="inline-block overflow-hidden leading-none"
              style={{ fontSize: "10px", maxHeight: "16px", verticalAlign: "middle" }}
              dangerouslySetInnerHTML={{
                __html: (() => {
                  try {
                    return katex.renderToString(clean, { throwOnError: false, displayMode: false, output: "html" })
                  } catch {
                    return `<span style="font-family:monospace;font-size:10px">${clean.slice(0, 20)}${clean.length > 20 ? "…" : ""}</span>`
                  }
                })()
              }}
            />
          </button>
        }
      />
      <PopoverContent className="w-80 p-3 space-y-2.5 shadow-lg" align="start">
        <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
          <span className="text-xs font-semibold flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Sigma className="size-3.5" /> Edit Formula
          </span>
          {onOpenRegistry && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onOpenRegistry()
              }}
              className="text-[10px] text-primary hover:underline"
            >
              Open Registry →
            </button>
          )}
        </div>
        <div className="p-2 rounded bg-muted/30 border border-border/40 min-h-8 flex items-center justify-center text-center overflow-hidden">
          <KaTeXSpan math={`$${editFormula}$`} displayMode={false} />
        </div>
        <input
          type="text"
          value={editFormula}
          onChange={(e) => setEditFormula(e.target.value)}
          placeholder="LaTeX formula (e.g. \alpha + \beta)"
          className="w-full h-7 rounded border border-border bg-background px-2 text-xs font-mono focus:ring-1 focus:ring-amber-500/30 outline-none"
          autoFocus
        />
        <div className="flex justify-between items-center pt-1">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              setOpen(false)
              onRemove()
            }}
            className="text-destructive hover:bg-destructive/10 text-[10px] h-6 px-2"
          >
            <Trash2 className="size-3 mr-1" /> Delete
          </Button>
          <div className="flex gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => setOpen(false)}
              className="text-[10px] h-6 px-2"
            >
              Cancel
            </Button>
            <Button
              size="xs"
              variant="default"
              onClick={() => {
                if (editFormula.trim()) {
                  onUpdate(`$${editFormula.trim()}$`)
                }
                setOpen(false)
              }}
              className="text-[10px] h-6 px-2.5"
            >
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Segment types for mixed text+token lines
// ---------------------------------------------------------------------------
type LineSegment =
  | { type: "text"; value: string }
  | { type: "math"; raw: string }
  | { type: "cite"; raw: string }

function parseToSegments(text: string): LineSegment[] {
  const tokenRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\cite\{[^}]+\})/g
  const segments: LineSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) })
    }
    const raw = match[0]
    segments.push(raw.startsWith("\\cite{") ? { type: "cite", raw } : { type: "math", raw })
    lastIndex = match.index + raw.length
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) })
  }
  return segments
}

function segmentsToText(segs: LineSegment[]): string {
  return segs.map((s) => (s.type === "text" ? s.value : s.raw)).join("")
}

// ---------------------------------------------------------------------------
// Inline editable text span (contenteditable, uncontrolled while focused)
// ---------------------------------------------------------------------------
function InlineTextSegment({
  value,
  placeholder,
  onChange,
  onEnterPress,
  onBackspaceEmpty,
}: {
  value: string
  placeholder?: string
  onChange: (v: string) => void
  onEnterPress?: () => void
  onBackspaceEmpty?: () => void
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const isFocused = useRef(false)

  // Sync external value only when not focused (e.g. after chip delete)
  useEffect(() => {
    const el = ref.current
    if (el && !isFocused.current && el.textContent !== value) {
      el.textContent = value
    }
  }, [value])

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onFocus={() => { isFocused.current = true }}
      onBlur={(e) => {
        isFocused.current = false
        onChange(e.currentTarget.textContent ?? "")
      }}
      onInput={(e) => onChange(e.currentTarget.textContent ?? "")}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          onEnterPress?.()
        } else if (e.key === "Backspace" && !e.currentTarget.textContent) {
          e.preventDefault()
          onBackspaceEmpty?.()
        }
      }}
      className={cn(
        "outline-none whitespace-pre-wrap break-words min-w-[2px]",
        !value && "before:content-[attr(data-placeholder)] before:text-muted-foreground/40 before:pointer-events-none"
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// Display Math Block (Block KaTeX with dialog editor & registry lookup)
// ---------------------------------------------------------------------------
function DisplayMathBlock({
  math,
  onUpdate,
  onDelete,
  onOpenRegistry,
}: {
  math: string
  onUpdate: (newFormula: string) => void
  onDelete: () => void
  onOpenRegistry?: () => void
}) {
  const [open, setOpen] = useState(false)
  const clean = math.replace(/^\$\$|\$\$$/g, "").trim()
  const [editFormula, setEditFormula] = useState(clean)

  return (
    <div className="group relative rounded-md border border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 p-2 transition-all w-full shadow-2xs">
      {/* 2 icons only: Edit and Delete in top-right corner */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => {
            setEditFormula(clean)
            setOpen(true)
          }}
          className="p-1 rounded bg-background/90 hover:bg-amber-500/20 text-muted-foreground hover:text-amber-700 dark:hover:text-amber-300 border border-border/60 shadow-2xs transition-colors cursor-pointer"
          title="Edit formula"
        >
          <Edit2 className="size-3" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded bg-background/90 hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border/60 shadow-2xs transition-colors cursor-pointer"
          title="Delete equation"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      <div
        onClick={() => {
          setEditFormula(clean)
          setOpen(true)
        }}
        className="cursor-pointer py-1 text-center overflow-hidden select-all"
        title="Click to edit formula"
      >
        <KaTeXSpan math={math} displayMode={true} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sigma className="size-4 text-amber-500" /> Edit Equation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-3 rounded-md bg-muted/40 border border-border/60 min-h-12 flex items-center justify-center text-center overflow-hidden">
              <KaTeXSpan math={`$$${editFormula}$$`} displayMode={true} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground">LaTeX Formula</label>
              <Textarea
                value={editFormula}
                onChange={(e) => setEditFormula(e.target.value)}
                placeholder="E = mc^2"
                rows={3}
                className="font-mono text-xs focus-visible:ring-1 border border-border/70"
              />
            </div>
          </div>
          <div className="flex justify-between items-center">
            {onOpenRegistry ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  onOpenRegistry()
                }}
                className="text-xs"
              >
                Choose from Registry
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (editFormula.trim()) {
                    onUpdate(`$$\n${editFormula.trim()}\n$$`)
                  }
                  setOpen(false)
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Render Inline Visual Segments (Text + Math + Citation chips inline)
// ---------------------------------------------------------------------------
function renderVisualSegments(
  text: string,
  bibEntries: BibEntry[],
  onRemoveCite?: (key: string) => void,
  onUpdateMath?: (oldMath: string, newMath: string) => void,
  onRemoveMath?: (math: string) => void,
  onOpenRegistry?: () => void,
  onOpenBibManager?: () => void
) {
  if (!text) return null

  // Match $$...$$, $...$, or \cite{...}
  const tokenRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\cite\{[^}]+\})/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    const start = match.index
    const matchText = match[0]

    // Plain text before token
    if (start > lastIndex) {
      parts.push(
        <span key={`txt-${lastIndex}`} className="text-foreground select-text">
          {text.slice(lastIndex, start)}
        </span>
      )
    }

    // Process Token
    if (matchText.startsWith("\\cite{")) {
      const citeKeys = matchText.slice(6, -1).split(",").map((k) => k.trim()).filter(Boolean)
      citeKeys.forEach((key, idx) => {
        parts.push(
          <CitationChip
            key={`cite-${start}-${key}-${idx}`}
            citeKey={key}
            bibEntries={bibEntries}
            onRemove={onRemoveCite ? () => onRemoveCite(key) : undefined}
            onOpenBibManager={onOpenBibManager}
          />
        )
      })
    } else if (matchText.startsWith("$")) {
      parts.push(
        <MathChip
          key={`math-${start}`}
          math={matchText}
          onUpdate={(newMath) => onUpdateMath?.(matchText, newMath)}
          onRemove={() => onRemoveMath?.(matchText)}
          onOpenRegistry={onOpenRegistry}
        />
      )
    }

    lastIndex = start + matchText.length
  }

  // Trailing plain text
  if (lastIndex < text.length) {
    parts.push(
      <span key={`txt-${lastIndex}`} className="text-foreground select-text">
        {text.slice(lastIndex)}
      </span>
    )
  }

  return parts
}

// ---------------------------------------------------------------------------
// Inline Editable Line in Visual Mode
// ---------------------------------------------------------------------------
function VisualLineItem({
  line,
  index,
  bibEntries,
  onChange,
  onDelete,
  onEnterPress,
  onBackspaceEmpty,
  onOpenEquationRegistry,
  onOpenBibManager,
  inputRef,
}: {
  line: string
  index: number
  bibEntries: BibEntry[]
  onChange: (val: string) => void
  onDelete: () => void
  onEnterPress: () => void
  onBackspaceEmpty: () => void
  onOpenEquationRegistry?: () => void
  onOpenBibManager?: () => void
  inputRef: (el: HTMLInputElement | null) => void
}) {
  const isDisplayMath = line.trim().startsWith("$$")
  const isNumbered = /^\d+\.\s/.test(line.trim())
  const isHeader = line.trim().startsWith("#")

  // Strip prefix for input display so user types text directly
  const rawText = isDisplayMath
    ? line.trim()
    : line.replace(/^[\s-*]+/, "").trimStart()

  const hasSpecialFormatting = useMemo(() => {
    return isDisplayMath || /\$[^$\n]+?\$|\\cite\{[^}]+\}/.test(line)
  }, [isDisplayMath, line])

  const [isEditing, setIsEditing] = useState<boolean>(!rawText.trim())
  const textareaElRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-grow textarea height to match wrapped text perfectly without jumping
  const adjustHeight = useCallback(() => {
    const el = textareaElRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = `${Math.max(el.scrollHeight, 24)}px`
    }
  }, [])

  useEffect(() => {
    if (isEditing) {
      adjustHeight()
    }
  }, [rawText, isEditing, adjustHeight])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      setIsEditing(false)
      onEnterPress()
    } else if (e.key === "Backspace" && !rawText.trim()) {
      e.preventDefault()
      onBackspaceEmpty()
    } else if (e.key === "Escape") {
      setIsEditing(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    if (isDisplayMath) {
      onChange(val)
    } else if (isNumbered) {
      const numPrefix = line.match(/^\s*\d+\.\s*/)?.[0] || `${index + 1}. `
      onChange(`${numPrefix}${val}`)
    } else if (isHeader) {
      const hPrefix = line.match(/^\s*#+\s*/)?.[0] || "# "
      onChange(`${hPrefix}${val}`)
    } else {
      onChange(`- ${val}`)
    }
    adjustHeight()
  }

  const handleRemoveCitation = (citeKey: string) => {
    let next = line.replace(new RegExp(`\\\\cite\\{[^}]*\\b${citeKey}\\b[^}]*\\}`, "g"), (match) => {
      const keys = match.slice(6, -1).split(",").map((k) => k.trim()).filter((k) => k !== citeKey)
      return keys.length > 0 ? `\\cite{${keys.join(", ")}}` : ""
    }).replace(/\s{2,}/g, " ").trim()
    onChange(next)
  }

  const handleUpdateMath = (oldMath: string, newMath: string) => {
    const next = line.replace(oldMath, newMath)
    onChange(next)
  }

  const handleRemoveMath = (targetMath: string) => {
    const next = line.replace(targetMath, "").replace(/\s{2,}/g, " ").trim()
    onChange(next)
  }

  const startEditing = () => {
    setIsEditing(true)
    window.setTimeout(() => {
      textareaElRef.current?.focus()
      adjustHeight()
    }, 10)
  }

  // 1. Display Math block ($$...$$)
  if (isDisplayMath) {
    return (
      <DisplayMathBlock
        math={line}
        onUpdate={onChange}
        onDelete={onDelete}
        onOpenRegistry={onOpenEquationRegistry}
      />
    )
  }

  // 2. Regular line (bullet, numbered, header, text)
  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-md border border-border/40 bg-muted/15 hover:bg-muted/30 hover:border-border/70 transition-all w-full min-w-0 shadow-2xs"
      )}
    >
      {/* Top row: marker + visual content (always visible) */}
      <div className="flex items-start gap-2.5 p-2 w-full min-w-0">
        {/* Icon / Marker */}
        <div className="flex size-4 shrink-0 items-center justify-center text-primary/70 select-none pt-0.5">
          {isHeader ? (
            <span className="text-[10px] font-mono font-bold text-muted-foreground">#</span>
          ) : isNumbered ? (
            <span className="text-[10px] font-mono font-bold text-muted-foreground">{index + 1}</span>
          ) : (
            <span className="size-1.5 rounded-full bg-muted-foreground/60" />
          )}
        </div>

        {/* Main Content Area */}
        {!hasSpecialFormatting ? (
          /* Plain text line: direct textarea editing */
          <textarea
            ref={(el) => {
              textareaElRef.current = el
              if (inputRef && el) {
                inputRef(el as unknown as HTMLInputElement)
              }
            }}
            value={rawText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type bullet content..."
            rows={1}
            className="flex-1 w-full min-w-0 resize-none overflow-hidden border-0 bg-transparent p-0 text-[12px] leading-normal shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-muted-foreground/40 whitespace-pre-wrap break-words min-h-[20px]"
          />
        ) : (
          /* Special formatting: inline segment editing — text parts editable, chips clickable */
          <div className="flex-1 min-w-0 w-full text-[12px] leading-normal min-h-[20px] flex items-center flex-wrap gap-y-0.5 break-words whitespace-normal">
            {parseToSegments(rawText).map((seg, segIdx) => {
              if (seg.type === "text") {
                return (
                  <InlineTextSegment
                    key={`tseg-${segIdx}`}
                    value={seg.value}
                    placeholder={segIdx === 0 ? "Type here…" : undefined}
                    onChange={(newVal) => {
                      const segs = parseToSegments(rawText)
                      const next = segs.map((s, i) =>
                        i === segIdx && s.type === "text" ? { ...s, value: newVal } : s
                      )
                      const rebuilt = segmentsToText(next)
                      if (isNumbered) {
                        const numPrefix = line.match(/^\s*\d+\.\s*/)?.[0] ?? `${index + 1}. `
                        onChange(`${numPrefix}${rebuilt}`)
                      } else if (isHeader) {
                        const hPrefix = line.match(/^\s*#+\s*/)?.[0] ?? "# "
                        onChange(`${hPrefix}${rebuilt}`)
                      } else {
                        onChange(`- ${rebuilt}`)
                      }
                    }}
                    onEnterPress={onEnterPress}
                    onBackspaceEmpty={onBackspaceEmpty}
                  />
                )
              }
              if (seg.type === "math") {
                return (
                  <MathChip
                    key={`math-${segIdx}`}
                    math={seg.raw}
                    onUpdate={(newMath) => handleUpdateMath(seg.raw, newMath)}
                    onRemove={() => handleRemoveMath(seg.raw)}
                    onOpenRegistry={onOpenEquationRegistry}
                    onEnterPress={onEnterPress}
                    onKeyboardDelete={() => handleRemoveMath(seg.raw)}
                  />
                )
              }
              // cite
              const citeKeys = seg.raw.slice(6, -1).split(",").map((k) => k.trim()).filter(Boolean)
              return citeKeys.map((key) => (
                <CitationChip
                  key={`cite-${segIdx}-${key}`}
                  citeKey={key}
                  bibEntries={bibEntries}
                  onRemove={() => handleRemoveCitation(key)}
                  onOpenBibManager={onOpenBibManager}
                  onEnterPress={onEnterPress}
                  onKeyboardDelete={() => handleRemoveCitation(key)}
                />
              ))
            })}
          </div>
        )}

        {/* Delete action */}
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0 pt-0.5"
          title="Delete bullet"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main RichCardEditor Component
// ---------------------------------------------------------------------------
export function RichCardEditor({
  card,
  onUpdateContent,
  bibEntries,
  equations,
  onAutoFill,
  isGenerating = false,
  onOpenEquationRegistry,
  onOpenBibManager,
  disabled = false,
}: RichCardEditorProps) {
  const [mode, setMode] = useState<"visual" | "source">("visual")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [focusedLineIndex, setFocusedLineIndex] = useState<number>(0)

  // Equation insert popover state
  const [eqSearch, setEqSearch] = useState("")
  const [isEqPopoverOpen, setIsEqPopoverOpen] = useState(false)

  // Citation insert popover state
  const [citeSearch, setCiteSearch] = useState("")
  const [isCitePopoverOpen, setIsCitePopoverOpen] = useState(false)

  // Split lines / bullets
  const lines = useMemo(() => {
    if (!card.content) return []
    return card.content.split("\n")
  }, [card.content])

  const appendContent = useCallback((snippet: string) => {
    const current = card.content || ""
    const separator = current.endsWith("\n") || !current ? "" : "\n"
    onUpdateContent(`${current}${separator}${snippet}`)
  }, [card.content, onUpdateContent])

  const insertAtCursor = useCallback((prefix: string, suffix: string = "") => {
    const el = textareaRef.current
    if (!el) {
      appendContent(`${prefix}${suffix}`)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = card.content || ""
    const selected = text.slice(start, end)
    const before = text.slice(0, start)
    const after = text.slice(end)
    const replacement = selected || "text"
    const next = `${before}${prefix}${replacement}${suffix}${after}`
    onUpdateContent(next)
    window.setTimeout(() => {
      el.focus()
      el.setSelectionRange(
        start + prefix.length,
        start + prefix.length + replacement.length
      )
    }, 0)
  }, [card.content, onUpdateContent, appendContent])

  // Filtered equation options for popover
  const filteredEquations = useMemo(() => {
    if (!eqSearch.trim()) return equations
    const q = eqSearch.toLowerCase()
    return equations.filter(
      (eq) =>
        eq.formula.toLowerCase().includes(q) ||
        eq.name?.toLowerCase().includes(q) ||
        eq.description?.toLowerCase().includes(q)
    )
  }, [equations, eqSearch])

  // Filtered citation options for popover
  const filteredCitations = useMemo(() => {
    if (!citeSearch.trim()) return bibEntries
    const q = citeSearch.toLowerCase()
    return bibEntries.filter(
      (b) =>
        b.key.toLowerCase().includes(q) ||
        b.title?.toLowerCase().includes(q) ||
        b.authorString?.toLowerCase().includes(q) ||
        b.year?.toLowerCase().includes(q)
    )
  }, [bibEntries, citeSearch])

  const handleInsertEquation = (formula: string) => {
    const clean = formula.replace(/^\$\$|\$\$$/g, "").trim()
    const formatted = `$$\n${clean}\n$$`
    if (mode === "source" && textareaRef.current) {
      insertAtCursor(`$$\n${clean}\n$$`, "")
    } else {
      if (lines.length > 0 && focusedLineIndex >= 0 && focusedLineIndex < lines.length) {
        const updated = [...lines]
        updated[focusedLineIndex] = `${updated[focusedLineIndex]} $${clean}$`
        onUpdateContent(updated.join("\n"))
      } else {
        appendContent(formatted)
      }
    }
    setIsEqPopoverOpen(false)
    setEqSearch("")
  }

  const handleInsertCitation = (key: string) => {
    const tag = `\\cite{${key}}`
    if (mode === "source" && textareaRef.current) {
      insertAtCursor(`\\cite{${key}}`, "")
    } else {
      if (lines.length > 0 && focusedLineIndex >= 0 && focusedLineIndex < lines.length) {
        const updated = [...lines]
        updated[focusedLineIndex] = `${updated[focusedLineIndex]} ${tag}`
        onUpdateContent(updated.join("\n"))
      } else {
        appendContent(`- Research finding ${tag}`)
      }
    }
    setIsCitePopoverOpen(false)
    setCiteSearch("")
  }

  const handleUpdateLine = (index: number, newText: string) => {
    const updated = [...lines]
    updated[index] = newText
    onUpdateContent(updated.join("\n"))
  }

  const handleDeleteLine = (index: number) => {
    const updated = lines.filter((_, i) => i !== index)
    onUpdateContent(updated.join("\n"))
  }

  const handleEnterPress = (index: number) => {
    const updated = [...lines]
    updated.splice(index + 1, 0, "- ")
    onUpdateContent(updated.join("\n"))
    setFocusedLineIndex(index + 1)
    window.setTimeout(() => {
      lineInputRefs.current[index + 1]?.focus()
    }, 20)
  }

  const handleBackspaceEmpty = (index: number) => {
    if (lines.length <= 1) return
    const updated = lines.filter((_, i) => i !== index)
    onUpdateContent(updated.join("\n"))
    const prevIdx = Math.max(0, index - 1)
    setFocusedLineIndex(prevIdx)
    window.setTimeout(() => {
      lineInputRefs.current[prevIdx]?.focus()
    }, 20)
  }

  const handleAddBullet = () => {
    const newIdx = lines.length
    appendContent("- ")
    setFocusedLineIndex(newIdx)
    window.setTimeout(() => {
      lineInputRefs.current[newIdx]?.focus()
    }, 20)
  }

  return (
    <div className="flex flex-col rounded-md border border-border/60 bg-card shadow-2xs overflow-hidden">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border/50 bg-muted/30 px-2 py-1">
        {/* Mode Toggle (Icon-only: Eye & Code2) */}
        <div className="flex items-center rounded border border-border/60 bg-background p-0.5">
          <Button
            type="button"
            size="icon-xs"
            variant={mode === "visual" ? "secondary" : "ghost"}
            onClick={() => setMode("visual")}
            className="size-6 text-foreground"
            title="Visual Mode (Direct WYSIWYG editing)"
          >
            <Eye className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant={mode === "source" ? "secondary" : "ghost"}
            onClick={() => setMode("source")}
            className="size-6 text-foreground"
            title="Source Mode (Raw Markdown / LaTeX)"
          >
            <Code2 className="size-3.5" />
          </Button>
        </div>

        {/* Insert Modality Action Buttons & AI Auto-Fill */}
        <div className="flex items-center gap-1">
          {/* Equation Popover */}
          <Popover open={isEqPopoverOpen} onOpenChange={setIsEqPopoverOpen}>
            <PopoverTrigger
              render={
                <Button
                  size="xs"
                  variant="outline"
                  className="h-6.5 gap-1.5 px-2 text-[11px] font-medium border-border/80 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
                  title="Insert LaTeX Equation from Registry"
                >
                  <Sigma className="size-3.5 text-amber-500" />
                  <span>Equation</span>
                </Button>
              }
            />
            <PopoverContent className="w-80 p-2.5 space-y-2 shadow-md" align="end">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sigma className="size-3.5 text-amber-500" />
                  Select Equation
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {equations.length} available
                </span>
              </div>

              {/* Search Registry */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
                <input
                  type="text"
                  value={eqSearch}
                  onChange={(e) => setEqSearch(e.target.value)}
                  placeholder="Search equations in registry..."
                  className="h-7 w-full rounded-md border border-border/70 bg-background pl-7 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 shadow-none transition-colors"
                />
              </div>

              {/* Existing Equations List */}
              {filteredEquations.length === 0 ? (
                <div className="py-4 text-center space-y-1">
                  <p className="text-[11px] text-muted-foreground italic">
                    {equations.length === 0 ? "No equations in registry yet." : "No matching equations found."}
                  </p>
                  {onOpenEquationRegistry && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEqPopoverOpen(false)
                        onOpenEquationRegistry()
                      }}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Open Equation Registry →
                    </button>
                  )}
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {filteredEquations.map((eq) => (
                    <button
                      key={eq.id}
                      type="button"
                      onClick={() => handleInsertEquation(eq.formula)}
                      className="w-full text-left p-1.5 rounded border border-border/60 bg-card hover:bg-amber-500/5 hover:border-amber-500/40 transition-colors space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-foreground truncate max-w-[190px]">
                          {eq.name}
                        </span>
                        <span className="font-mono text-[9px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 rounded">
                          {eq.key}
                        </span>
                      </div>
                      <div className="overflow-x-auto text-[10px] py-0.5">
                        <KaTeXSpan math={eq.formula} displayMode={false} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Citation Popover */}
          <Popover open={isCitePopoverOpen} onOpenChange={setIsCitePopoverOpen}>
            <PopoverTrigger
              render={
                <Button
                  size="xs"
                  variant="outline"
                  className="h-6.5 gap-1.5 px-2 text-[11px] font-medium border-border/80 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                  title="Insert BibTeX Citation"
                >
                  <Quote className="size-3.5 text-primary" />
                  <span>Citation</span>
                </Button>
              }
            />
            <PopoverContent className="w-80 p-2.5 space-y-2 shadow-md" align="end">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Quote className="size-3.5 text-primary" />
                  Select Citation
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {bibEntries.length} refs
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
                <input
                  type="text"
                  value={citeSearch}
                  onChange={(e) => setCiteSearch(e.target.value)}
                  placeholder="Search authors, title, or key..."
                  className="h-7 w-full rounded-md border border-border/70 bg-background pl-7 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 shadow-none transition-colors"
                />
              </div>

              {filteredCitations.length === 0 ? (
                <div className="py-4 text-center space-y-1">
                  <p className="text-[11px] text-muted-foreground italic">
                    {bibEntries.length === 0 ? "No bibliography entries yet." : "No citations match search."}
                  </p>
                  {onOpenBibManager && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCitePopoverOpen(false)
                        onOpenBibManager()
                      }}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Open Bibliography Manager →
                    </button>
                  )}
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {filteredCitations.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => handleInsertCitation(b.key)}
                      className="w-full text-left p-1.5 rounded border border-border/60 bg-card hover:bg-primary/5 hover:border-primary/40 transition-colors space-y-0.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[9px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded border border-primary/25">
                          @{b.key}
                        </span>
                        {b.year && <span className="font-mono text-[9px] text-muted-foreground">{b.year}</span>}
                      </div>
                      <p className="text-[11px] font-medium text-foreground line-clamp-1">{b.title}</p>
                      {b.authorString && (
                        <p className="text-[9px] text-muted-foreground line-clamp-1">{b.authorString}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>



          {/* AI Auto-Fill button */}
          {onAutoFill && (
            <Button
              size="xs"
              variant="outline"
              onClick={onAutoFill}
              disabled={isGenerating || disabled}
              className="h-6.5 gap-1.5 px-2 text-[11px] font-medium border-border/80 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 text-foreground"
            >
              {isGenerating ? (
                <Loader2 className="size-3.5 animate-spin text-indigo-500" />
              ) : (
                <Sparkles className="size-3.5 text-indigo-500" />
              )}
              <span>Auto-Fill</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Editor Body */}
      {mode === "visual" ? (
        <div className="p-2.5 space-y-1 min-h-[16rem] bg-card">
          {lines.length === 0 || (lines.length === 1 && !lines[0].trim()) ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2 border border-dashed border-border/60 rounded-md bg-muted/10">
              <p className="text-xs text-muted-foreground">Empty card content</p>
              <Button
                size="xs"
                variant="outline"
                onClick={handleAddBullet}
                className="h-6 gap-1 text-[11px]"
              >
                <Plus className="size-3" />
                Add First Bullet Point
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <VisualLineItem
                  key={idx}
                  line={line}
                  index={idx}
                  bibEntries={bibEntries}
                  onChange={(newText) => handleUpdateLine(idx, newText)}
                  onDelete={() => handleDeleteLine(idx)}
                  onEnterPress={() => handleEnterPress(idx)}
                  onBackspaceEmpty={() => handleBackspaceEmpty(idx)}
                  onOpenEquationRegistry={onOpenEquationRegistry}
                  onOpenBibManager={onOpenBibManager}
                  inputRef={(el) => {
                    lineInputRefs.current[idx] = el
                  }}
                />
              ))}

              {/* Bottom Visual Action Bar */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/40 mt-1">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={handleAddBullet}
                  className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-3" />
                  Add Bullet
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Source Mode (Raw Markdown / LaTeX Textarea) */
        <div className="flex flex-col">
          {/* Formatting Shortcut Buttons */}
          <div className="flex items-center gap-1 border-b border-border/40 bg-muted/10 px-2 py-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5.5"
              onClick={() => insertAtCursor("**", "**")}
              title="Bold (**text**)"
            >
              <Bold className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5.5"
              onClick={() => insertAtCursor("*", "*")}
              title="Italic (*text*)"
            >
              <Italic className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5.5"
              onClick={() => insertAtCursor("`", "`")}
              title="Inline Code"
            >
              <CodeIcon className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5.5"
              onClick={() => insertAtCursor("[", "](url)")}
              title="Link"
            >
              <LinkIcon className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5.5"
              onClick={() => insertAtCursor("$$\n", "\n$$")}
              title="Math Block ($$...$$)"
            >
              <Calculator className="size-3 text-amber-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5.5"
              onClick={() => insertAtCursor("- ", "")}
              title="Add Bullet Item"
            >
              <Plus className="size-3" />
            </Button>
          </div>

          <Textarea
            ref={textareaRef}
            value={card.content || ""}
            onChange={(e) => onUpdateContent(e.target.value)}
            placeholder="Use - or * for bulleted lists, $$...$$ for LaTeX math, and \cite{key} for citations..."
            className="min-h-[16rem] resize-y border-0 text-[13px] font-mono leading-relaxed shadow-none focus-visible:ring-0 rounded-none bg-background p-2.5"
          />
        </div>
      )}
    </div>
  )
}
