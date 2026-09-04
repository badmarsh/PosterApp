"use client"

import { useMemo, useRef, useEffect, memo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Cpu,
  FileCode2,
  Lightbulb,
  Loader2,
  PanelRightClose,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  XCircle,
  Camera,
  Undo2,
  Layers,
} from "lucide-react"
import { ApprovalInbox } from "@/components/agent/approval-inbox"
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useMessagePartText,
} from "@assistant-ui/react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import type { Job } from "@/lib/job-queue"
import type { AgentEvent } from "@/lib/poster-types"
import { cn } from "@/lib/utils"
import { makeChatAdapter } from "@/components/agent-chat-adapter"
import { DeerflowPanel } from "@/components/deerflow/deerflow-panel"
import { validateCard, hasUnsafeLatex } from "@/lib/latex/validation"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import "katex/dist/katex.min.css"

// ---------------------------------------------------------------------------
// Status event log helpers
// ---------------------------------------------------------------------------

const KIND_ICON = {
  validate: ShieldCheck,
  generate: FileCode2,
  suggest: Lightbulb,
  explain: AlertTriangle,
  info: Terminal,
  verify: ShieldCheck,
  review: Sparkles,
} as const

function statusColor(status: AgentEvent["status"]) {
  switch (status) {
    case "running":
      return "text-primary"
    case "done":
      return "text-muted-foreground"
    case "warning":
      return "text-chart-4"
    case "error":
      return "text-destructive"
  }
}

function StatusGlyph({ status }: { status: AgentEvent["status"] }) {
  const cls = cn("size-3.5", statusColor(status))
  switch (status) {
    case "running":
      return <Loader2 className={cn(cls, "animate-spin")} />
    case "done":
      return <CheckCircle2 className={cls} />
    case "warning":
      return <AlertTriangle className={cls} />
    case "error":
      return <XCircle className={cls} />
  }
}

const EventRow = memo(function EventRow({
  event,
  last,
}: {
  event: AgentEvent
  last: boolean
}) {
  const { updateCard, saveProject, compileProject, updateEvent, project, selectCard } = useEditor(
    useShallow((s) => ({
      updateCard: s.updateCard,
      saveProject: s.saveProject,
      compileProject: s.compileProject,
      updateEvent: s.updateEvent,
      project: s.project,
      selectCard: s.selectCard,
    }))
  )
  const Icon = KIND_ICON[event.kind]
  const [mounted, setMounted] = useState(false)
  const [elapsed, setElapsed] = useState("")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (event.status === "running" && event.createdAt) {
      const update = () => {
        const diff = Math.floor((Date.now() - event.createdAt!) / 1000)
        if (diff < 60) setElapsed(`${diff}s`)
        else setElapsed(`${Math.floor(diff / 60)}m ${diff % 60}s`)
      }
      update()
      const interval = setInterval(update, 1000)
      return () => clearInterval(interval)
    } else {
      setElapsed("")
    }
  }, [event.status, event.createdAt])

  return (
    <div className="relative flex gap-2 pl-1">
      {!last && (
        <span
          aria-hidden
          className="absolute top-5 left-[10px] h-[calc(100%-4px)] w-px bg-border"
        />
      )}
      <div className="z-10 mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border border-border bg-card">
        <StatusGlyph status={event.status} />
      </div>
      <div className="min-w-0 flex-1 pb-3">
        <div className="flex items-center gap-1.5">
          <Icon className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate text-[12px] font-medium leading-tight">
            {event.title}
          </span>
        </div>
        {event.detail && (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground whitespace-pre-line">
            {event.detail}
          </p>
        )}
        {event.undo && !event.undoApplied && (
          <Button
            size="sm"
            variant="outline"
            className="mt-1.5 h-6 gap-1 px-2 text-[11px]"
            onClick={() => {
              const snap = event.undo!
              updateCard(snap.cardId, { title: snap.title, content: snap.content, figures: snap.figures })
              updateEvent(event.id, { undoApplied: true, detail: `${event.detail ?? ""}\nReverted to the previous content.`.trim() })
              selectCard(snap.cardId)
            }}
          >
            <Undo2 className="size-3" />
            Undo auto-fill
          </Button>
        )}
        {event.undoMany && event.undoMany.length > 0 && !event.undoManyApplied && (
          <Button
            size="sm"
            variant="outline"
            className="mt-1.5 h-6 gap-1 px-2 text-[11px]"
            onClick={() => {
              event.undoMany!.forEach((snap) => updateCard(snap.cardId, { content: snap.content }))
              updateEvent(event.id, { undoManyApplied: true, detail: `${event.detail ?? ""}\nAutofix patches reverted.`.trim() })
            }}
          >
            <Undo2 className="size-3" />
            Undo autofix ({event.undoMany.length})
          </Button>
        )}
        {event.tips && event.tips.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {event.tips.map((tip: any, i: number) => {
              const severityColor =
                tip.severity === "error"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : tip.severity === "warning"
                    ? "bg-chart-4/10 text-chart-4 border-chart-4/20"
                    : "bg-status-info/10 text-status-info border-status-info/20"

              // Separate issue description from suggested fix
              let issueText = tip.issue || ""
              let fixText = tip.recommendation || ""

              if (!issueText && tip.message) {
                if (tip.message.includes(" — ")) {
                  const parts = tip.message.split(" — ")
                  issueText = parts[0]
                  fixText = parts.slice(1).join(" — ")
                } else {
                  issueText = tip.message
                }
              }

              // Strip redundant leading "Card: " or numbers from title
              const displayCategory = (tip.category || "Layout")
                .replace(/^card:\s*/i, "")
                .replace(/^\d+[\.\s]*/, "")

              return (
                <div
                  key={i}
                  className="flex flex-col gap-1.5 rounded-lg border bg-card p-2 shadow-xs transition-colors hover:border-border/80"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          severityColor
                        )}
                      >
                        {tip.severity}
                      </span>
                      <span className="truncate text-[10.5px] font-medium text-foreground">
                        {displayCategory}
                      </span>
                    </div>
                    {tip.cardId && (
                      <button
                        type="button"
                        onClick={() => selectCard(tip.cardId)}
                        className="shrink-0 text-[10px] font-medium text-primary hover:underline"
                      >
                        Jump to Card →
                      </button>
                    )}
                  </div>

                  {issueText && (
                    <p className="text-[11px] leading-snug text-foreground/90 font-normal">
                      {issueText}
                    </p>
                  )}

                  {fixText && (
                    <div className="mt-0.5 flex items-start gap-1.5 rounded-md bg-muted/60 px-2 py-1.5 text-[11px] border border-border/40">
                      <Sparkles className="size-3.5 mt-0.5 text-chart-4 shrink-0" />
                      <div className="flex-1 leading-snug">
                        <span className="font-semibold text-foreground">Action: </span>
                        <span className="text-muted-foreground">{fixText}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {event.fixes && event.fixes.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-chart-4/30 bg-chart-4/10 p-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-chart-4">
                {event.fixesApplied
                  ? "✓ Fixes Applied"
                  : `${event.fixes.length} AI Fix${event.fixes.length === 1 ? "" : "es"} Available`}
              </span>
              {!event.fixesApplied && (
                <Button
                  size="sm"
                  className="h-6 px-2.5 text-[10px] font-semibold bg-chart-4 hover:bg-chart-4/90 text-primary-foreground border-0"
                  onClick={async () => {
                    const activeCards = project.outputs?.find((o) => o.id === project.activeOutputId)?.cards ?? []
                    const validationErrors: string[] = []

                    event.fixes?.forEach((fix) => {
                      const targetCard = activeCards.find((c) => c.id === fix.id)
                      const unsafeIssues = hasUnsafeLatex(fix.content)
                      const cardValidation = targetCard
                        ? validateCard({ ...targetCard, content: fix.content })
                        : []
                      const errorMsgs = [
                        ...unsafeIssues,
                        ...cardValidation.filter((m) => m.level === "error").map((m) => m.message),
                      ]
                      if (errorMsgs.length > 0) {
                        validationErrors.push(`${targetCard?.title || fix.id}: ${errorMsgs.join("; ")}`)
                      }
                    })

                    const applyAllFixes = async () => {
                      event.fixes?.forEach((fix) => {
                        updateCard(fix.id, { content: fix.content })
                      })
                      updateEvent(event.id, {
                        fixesApplied: true,
                        status: "done",
                        detail: "Fixes applied. Recompiling...",
                      })
                      await saveProject()
                      compileProject()
                    }

                    if (validationErrors.length > 0) {
                      toast.warning("Some proposed fixes contain LaTeX or validation issues", {
                        description: validationErrors.join("\n"),
                        duration: 10000,
                        action: {
                          label: "Apply Anyway",
                          onClick: applyAllFixes
                        }
                      })
                    } else {
                      await applyAllFixes()
                    }
                  }}
                >
                  <Sparkles className="size-3 mr-1" />
                  Apply Fixes
                </Button>
              )}
            </div>
          </div>
        )}
        <span className="mt-0.5 block min-h-[12px] font-mono text-[10px] text-muted-foreground">
          {mounted ? (event.status === "running" && elapsed ? elapsed : event.ts) : ""}
        </span>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Status Strip — collapsible event log
// ---------------------------------------------------------------------------

function StatusStrip({
  agentEvents,
  generatingIds,
}: {
  agentEvents: AgentEvent[]
  generatingIds: string[]
}) {
  const running = agentEvents.filter((e) => e.status === "running")
  const current =
    running[running.length - 1] ?? agentEvents[agentEvents.length - 1]
  const ordered = useMemo(() => [...agentEvents].reverse(), [agentEvents])
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (running.length > 0) setOpen(true)
  }, [running.length])

  const visibleOrdered = showAll ? ordered : ordered.slice(0, 5)
  const hiddenCount = ordered.length - visibleOrdered.length

  return (
    <div className="shrink-0 border-b border-border">
      {/* Summary row (always visible) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-card/60 px-3 py-1.5 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {current ? (
            <StatusGlyph status={current.status} />
          ) : (
            <CircleDot className="size-3.5 text-muted-foreground" />
          )}
          <span className="truncate text-[11px] font-medium leading-tight">
            {current?.title ?? "Idle"}
          </span>
          {generatingIds.length > 0 && (
            <span className="ml-1 shrink-0 font-mono text-[10px] text-muted-foreground">
              {generatingIds[0]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="rounded bg-muted px-1 font-mono text-[10px]">
            {agentEvents.length}
          </span>
          <ChevronDown
            className={cn(
              "size-3 transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Expanded timeline */}
      {open && (
        <div
          className="max-h-[60vh] overflow-y-auto px-3 pt-1 pb-2"
          role="log"
          aria-live="polite"
          aria-label="Agent status timeline"
        >
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-center py-1.5 mb-2 text-[10px] font-medium text-muted-foreground hover:bg-muted/50 rounded transition-colors"
            >
              Show older ({hiddenCount})
            </button>
          )}
          {visibleOrdered.length ? (
            visibleOrdered.map((e, i) => (
              <EventRow key={e.id} event={e} last={i === visibleOrdered.length - 1} />
            ))
          ) : (
            <p className="py-2 text-center text-[11px] text-muted-foreground">
              No activity yet
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chat message bubble — renders a single assistant or user message
// ---------------------------------------------------------------------------

function UserMessageBubble() {
  return (
    <MessagePrimitive.Root className="flex justify-end px-3 py-1">
      <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-primary/10 px-3 py-2 text-[12px] leading-relaxed text-foreground">
        <MessagePrimitive.Content
          components={{
            Text: UserTextContent,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  )
}

function UserTextContent() {
  const { text } = useMessagePartText()
  return <span>{text}</span>
}

function AssistantMessageBubble() {
  const { isAiStreaming } = useEditor(useShallow((s) => ({ isAiStreaming: s.isAiStreaming })))

  return (
    <MessagePrimitive.Root className="flex flex-col gap-1 px-3 py-1">
      <div className="flex items-center gap-1.5">
        {/* Subtle, non-distracting sparkle animation during AI response */}
        <Sparkles
          className={cn(
            "size-3 text-primary transition-all duration-300",
            isAiStreaming && "animate-pulse text-primary scale-110"
          )}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          AI
        </span>
        {isAiStreaming && (
          <span className="inline-flex items-center gap-0.5 ml-0.5" title="AI is thinking…">
            <span className="size-1 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.3s]" />
            <span className="size-1 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.15s]" />
            <span className="size-1 rounded-full bg-primary/70 animate-bounce" />
          </span>
        )}
      </div>
      <div className="max-w-[92%] rounded-xl rounded-tl-sm bg-muted/60 px-3 py-2 text-[12px] leading-relaxed text-foreground">
        <MessagePrimitive.Content
          components={{
            Text: AssistantTextContent,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantTextContent() {
  const { text } = useMessagePartText()
  const { updateCard, selectedCardId, pushEvent, project, isAiStreaming } = useEditor(
    useShallow((s) => ({
      updateCard: s.updateCard,
      selectedCardId: s.selectedCardId,
      pushEvent: s.pushEvent,
      project: s.project,
      isAiStreaming: s.isAiStreaming,
    }))
  )

  const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)

  const fixRegex = /<fix(?:\s+card="([^"]*)")?>([\s\S]*?)<\/fix>/g
  let cleanText = text
  const fixes: string[] = []
  const fixTargets: Array<string | undefined> = []

  cleanText = text.replace(fixRegex, (fullMatch, cardAttr, content) => {
    fixes.push(content.trim())
    fixTargets.push(cardAttr || undefined)
    return ""
  })
  // A truncated completion may contain an unclosed <fix> — never offer to apply it.
  const truncationMarker = "[response truncated — output limit reached]"
  const wasTruncated = cleanText.includes(truncationMarker)
  const hasUnclosedFix = /<fix(?:\s[^>]*)?>(?![\s\S]*<\/fix>)/.test(cleanText)
  if (hasUnclosedFix) {
    cleanText = cleanText.replace(/<fix(?:\s[^>]*)?>[\s\S]*$/, "")
  }
  if (wasTruncated) {
    cleanText = cleanText.replace(truncationMarker, "").trimEnd() + "\n\n> ⚠️ Odpoveď bola skrátená (limit dĺžky výstupu). Skúste otázku zúžiť alebo pokračovať."
  }

  const [localApplied, setLocalApplied] = useState<Set<number>>(new Set())

  // If text is still empty while streaming, show subtle typing placeholder dots
  if ((!cleanText || cleanText.trim() === "") && isAiStreaming) {
    return (
      <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
        <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
        <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
        <span className="size-1.5 rounded-full bg-current animate-bounce" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:bg-card prose-pre:border prose-pre:border-border max-w-none text-[12px]">
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex]}
        >
          {cleanText}
        </ReactMarkdown>
      </div>

      {fixes.map((fixContent, i) => {
        const hash = fixContent.length + "_" + fixContent.slice(0, 20).replace(/\s+/g, "")
        const isApplied =
          localApplied.has(i) ||
          (typeof window !== "undefined" && localStorage.getItem(`fix_${hash}`) === "1")

        // The fix is bound to the card that was selected when the answer was
        // generated (server annotates <fix card="…">); fall back to the current
        // selection only for legacy unbound fixes.
        const targetCardId = fixTargets[i] ?? selectedCardId
        const targetCard = activeOutput?.cards.find((c) => c.id === targetCardId)
        const targetMissing = Boolean(fixTargets[i]) && !targetCard
        const unsafeLatexIssues = hasUnsafeLatex(fixContent)
        const validationMsgs = targetCard
          ? validateCard({ ...targetCard, content: fixContent })
          : []
        const hasValidationErrors =
          unsafeLatexIssues.length > 0 || validationMsgs.some((m) => m.level === "error")

        return (
          <Button
            key={i}
            size="sm"
            variant={isApplied ? "ghost" : "outline"}
            disabled={isApplied || !targetCardId || targetMissing}
            className={cn(
              "mt-2 w-full h-auto py-2 whitespace-normal text-left justify-start gap-2",
              isApplied
                ? "bg-muted/30 text-muted-foreground border-transparent cursor-default"
                : hasValidationErrors
                ? "border-chart-4/50 bg-chart-4/10 text-chart-4 hover:bg-chart-4/20"
                : "border-primary/50 bg-primary/5 text-primary hover:bg-primary/15"
            )}
            onClick={() => {
              if (targetCardId && targetCard && !isApplied) {
                if (hasValidationErrors) {
                  const errorSummary = [
                    ...unsafeLatexIssues,
                    ...validationMsgs.filter((m) => m.level === "error").map((m) => m.message),
                  ].join("; ")

                  const applySingleFix = () => {
                    updateCard(targetCardId, { content: fixContent })
                    pushEvent({
                      kind: hasValidationErrors ? "validate" : "info",
                      status: hasValidationErrors ? "warning" : "done",
                      title: hasValidationErrors ? "Fix applied with warnings" : "Fix applied",
                      detail: hasValidationErrors
                        ? `Applied despite validation warnings: ${errorSummary}`
                        : `Content updated for card ${targetCard?.title}`,
                    })
                  }

                  toast.warning("Validation warnings in proposed fix", {
                    description: errorSummary,
                    duration: 10000,
                    action: {
                      label: "Apply Anyway",
                      onClick: applySingleFix
                    }
                  })
                } else {
                  updateCard(targetCardId, { content: fixContent })
                  pushEvent({
                    kind: "info",
                    status: "done",
                    title: "Fix applied",
                    detail: `Content updated for card ${targetCard?.title}`,
                  })
                }
                setLocalApplied(new Set(localApplied).add(i))
                localStorage.setItem(`fix_${hash}`, "1")
              }
            }}
          >
            {isApplied ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : hasValidationErrors ? (
              <AlertTriangle className="size-4 shrink-0 text-chart-4" />
            ) : (
              <Wrench className="size-4 shrink-0" />
            )}
            <span>
              {isApplied
                ? "Fix applied"
                : targetMissing
                ? "Target card no longer exists"
                : hasValidationErrors
                ? `Apply fix to "${targetCard?.title ?? "card"}" (warnings detected)`
                : `Apply fix to "${targetCard?.title ?? "selected card"}"`}
            </span>
          </Button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chat composer — text input + send button
// ---------------------------------------------------------------------------

function ChatComposer() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { setIsScannerOpen } = useEditor(useShallow((s) => ({ setIsScannerOpen: s.setIsScannerOpen })))

  return (
    <ComposerPrimitive.Root className="flex shrink-0 flex-col border-t border-border bg-card/60">
      <ComposerPrimitive.Input
        ref={textareaRef}
        placeholder='Ask AI… e.g. "Make Card 3 more concise"'
        rows={1}
        autoComplete="off"
        className={cn(
          "min-h-[40px] w-full resize-none bg-transparent px-3 py-2.5 text-[12px] leading-relaxed placeholder:text-muted-foreground",
          "focus:outline-none",
          "max-h-[120px] overflow-y-auto"
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            ;(e.target as HTMLTextAreaElement)
              .closest("form")
              ?.dispatchEvent(new Event("submit", { bubbles: true }))
          }
        }}
      />
      <div className="flex items-center justify-between px-2.5 pb-2">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsScannerOpen(true)}
            className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
            title="Scan Image & OCR (Handwritten math, whiteboard, or screenshot)"
          >
            <Camera className="size-3 text-primary" />
            <span>Scan / OCR</span>
          </Button>
          <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
            Shift+Enter for newline
          </span>
        </div>
        <ComposerPrimitive.Send asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md bg-primary/90 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="size-3" />
            Send
          </button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  )
}

// ---------------------------------------------------------------------------
// Chat thread — messages + viewport
// ---------------------------------------------------------------------------

function ChatThread() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const { isAiStreaming } = useEditor(useShallow((s) => ({ isAiStreaming: s.isAiStreaming })))

  useEffect(() => {
    if (isAiStreaming && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
  }, [isAiStreaming])

  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
      <ThreadPrimitive.Viewport
        ref={viewportRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2"
      >
        <ThreadPrimitive.Empty>
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Sparkles className="size-5 text-muted-foreground/50" />
            <p className="text-[12px] font-medium text-muted-foreground">
              Ask AI anything about your poster
            </p>
            <p className="text-[11px] text-muted-foreground">
              Try: &ldquo;Summarise the selected card&rdquo; or &ldquo;Suggest a
              better title for the Results section&rdquo;
            </p>
          </div>
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{
            UserMessage: UserMessageBubble,
            AssistantMessage: AssistantMessageBubble,
          }}
        />

        {/* Scroll anchor */}
        <ThreadPrimitive.ScrollToBottom className="sr-only" />
      </ThreadPrimitive.Viewport>

      {/* Composer */}
      <ChatComposer />
    </ThreadPrimitive.Root>
  )
}

// ---------------------------------------------------------------------------
// AgentPanelInner — needs to be inside AssistantRuntimeProvider
// ---------------------------------------------------------------------------

function AgentPanelInner({
  agentEvents,
  generatingIds,
  jobs,
  onCancelJob,
  onCollapse,
}: {
  agentEvents: AgentEvent[]
  generatingIds: string[]
  jobs: Job[]
  onCancelJob: (id: string) => void
  onCollapse: () => void
}) {
  const { hydrateUi, updateProject, isAiStreaming, projectId } = useEditor(
    useShallow((s) => ({
      hydrateUi: s.hydrateUi,
      updateProject: s.updateProject,
      isAiStreaming: s.isAiStreaming,
      projectId: s.project.id,
    }))
  )

  const [tab, setTab] = useState<"chat" | "research">("chat")
  const [confirmClear, setConfirmClear] = useState(false)
  const [panelMode, setPanelMode] = useState<"chat" | "inbox">("chat")
  const [pendingCount, setPendingCount] = useState(0)

  // Periodically check pending changes count for badge
  useEffect(() => {
    let mounted = true
    const checkPending = async () => {
      try {
        const res = await fetch(`/api/workspaces/${projectId}/agent-changes?status=pending`)
        if (res.ok && mounted) {
          const data = await res.json()
          setPendingCount((data.changes || []).length)
        }
      } catch {}
    }
    checkPending()
    const interval = setInterval(checkPending, 15_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [projectId])

  return (
    <>
    <aside
      aria-label="Agent panel"
      className="flex w-full shrink-0 flex-col border-l border-border bg-sidebar lg:w-80"
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-2.5">
        <div className="flex items-center gap-1">
          <div className="flex bg-muted/60 p-0.5 rounded-md border border-border/50 text-[10px]">
            <button
              onClick={() => setPanelMode("chat")}
              className={cn(
                "px-2 py-0.5 rounded font-semibold transition-colors flex items-center gap-1",
                panelMode === "chat" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Cpu className="size-3 text-primary" />
              Chat
              {isAiStreaming && (
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setPanelMode("inbox")}
              className={cn(
                "px-2 py-0.5 rounded font-semibold transition-colors flex items-center gap-1 relative",
                panelMode === "inbox" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="size-3 text-amber-500" />
              Inbox
              {pendingCount > 0 && (
                <span className="px-1 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white dark:text-black leading-none">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {panelMode === "chat" && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Clear agent history"
              title="Clear history"
              onClick={() => setConfirmClear(true)}
            >
              <XCircle className="size-3.5 text-muted-foreground" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Collapse agent panel"
            onClick={onCollapse}
            className="hidden lg:inline-flex"
          >
            <PanelRightClose className="size-3.5" />
          </Button>
        </div>
      </div>

      {panelMode === "chat" ? (
        <>
          {/* Status strip (collapsible event log) */}
          <StatusStrip agentEvents={agentEvents} generatingIds={generatingIds} />

          {/* Tab switcher: chat (single-shot) vs deep research (DeerFlow) */}
          <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-2">
            <button
              type="button"
              onClick={() => setTab("chat")}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                tab === "chat" && "bg-accent text-foreground"
              )}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setTab("research")}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                tab === "research" && "bg-accent text-foreground"
              )}
            >
              Deep research
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            {tab === "chat" ? <ChatThread /> : <DeerflowPanel projectId={projectId} />}
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <ApprovalInbox
            workspaceId={projectId}
            onApplySuccess={() => {
              setPendingCount((c) => Math.max(0, c - 1))
              if (typeof window !== "undefined") {
                window.location.reload()
              }
            }}
          />
        </div>
      )}
    </aside>
    <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Clear History?</DialogTitle>
          <DialogDescription>
            Are you sure you want to clear this chat history and all AI events? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-4 -mb-4">
          <Button variant="outline" size="sm" onClick={() => setConfirmClear(false)}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={() => {
            hydrateUi([], [])
            updateProject({})
            setConfirmClear(false)
          }}>
            Clear History
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// AgentPanel (main export) — manages runtime lifecycle
// ---------------------------------------------------------------------------

export function AgentPanel() {
  const { agentEvents, generatingIds, jobs, cancelJob, projectId, selectedCardId, pendingAiPrompt, setPendingAiPrompt, chatMessages, setChatMessages, isAiStreaming, setIsAiStreaming } = useEditor(
    useShallow((s) => ({
      agentEvents: s.agentEvents,
      generatingIds: s.generatingIds,
      jobs: s.jobs,
      cancelJob: s.cancelJob,
      projectId: s.project.id,
      selectedCardId: s.selectedCardId,
      pendingAiPrompt: s.pendingAiPrompt,
      setPendingAiPrompt: s.setPendingAiPrompt,
      chatMessages: s.chatMessages,
      setChatMessages: s.setChatMessages,
      isAiStreaming: s.isAiStreaming,
      setIsAiStreaming: s.setIsAiStreaming,
    }))
  )

  const [collapsed, setCollapsed] = useState(false)

  const selectedCardIdRef = useRef(selectedCardId)
  useEffect(() => {
    selectedCardIdRef.current = selectedCardId
  }, [selectedCardId])

  const adapter = useMemo(
    // eslint-disable-next-line react-hooks/refs
    () => makeChatAdapter(projectId, () => selectedCardIdRef.current, setIsAiStreaming),
    [projectId, setIsAiStreaming]
  )

  const runtime = useLocalRuntime(adapter, { initialMessages: chatMessages })

  useEffect(() => {
    if (!runtime?.thread?.subscribe) return
    return runtime.thread.subscribe(() => {
      const msgs = (runtime.thread as any)?.messages ?? []
      setTimeout(() => setChatMessages([...msgs]), 0)
    })
  }, [runtime, setChatMessages])

  useEffect(() => {
    if (pendingAiPrompt && runtime?.thread?.append) {
      setCollapsed(false)
      runtime.thread.append({ role: "user", content: [{ type: "text", text: pendingAiPrompt }] })
      setPendingAiPrompt(null)
    }
  }, [pendingAiPrompt, runtime, setPendingAiPrompt])

  if (collapsed) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center gap-3 border-l border-border bg-sidebar py-2.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Expand agent panel"
                onClick={() => setCollapsed(false)}
              >
                <Cpu className="size-4" />
              </Button>
            }
          />
          <TooltipContent side="left">AI Chat</TooltipContent>
        </Tooltip>
        {generatingIds.length > 0 || isAiStreaming ? (
          <Loader2 className="size-3.5 animate-spin text-primary" />
        ) : (
          <CircleDot className="size-3.5 text-chart-3" />
        )}
        <span
          className="font-mono text-[10px] tracking-wide text-muted-foreground"
          style={{ writingMode: "vertical-rl" }}
        >
          AI CHAT
        </span>
      </aside>
    )
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AgentPanelInner
        agentEvents={agentEvents}
        generatingIds={generatingIds}
        jobs={jobs}
        onCancelJob={cancelJob}
        onCollapse={() => setCollapsed(true)}
      />
    </AssistantRuntimeProvider>
  )
}
