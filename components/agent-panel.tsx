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
} from "lucide-react"
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
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import type { Job } from "@/lib/job-queue"
import type { AgentEvent } from "@/lib/poster-types"
import { cn } from "@/lib/utils"
import { makeChatAdapter } from "@/components/agent-chat-adapter"
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
        {event.tips && event.tips.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {event.tips.map((tip: any, i: number) => {
              const severityColor =
                tip.severity === "error"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : tip.severity === "warning"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"

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
                          "inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
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
                      <Sparkles className="size-3.5 mt-0.5 text-amber-500 dark:text-amber-400 shrink-0" />
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
          <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                {event.fixesApplied
                  ? "✓ Fixes Applied"
                  : `${event.fixes.length} AI Fix${event.fixes.length === 1 ? "" : "es"} Available`}
              </span>
              {!event.fixesApplied && (
                <Button
                  size="sm"
                  className="h-6 px-2.5 text-[10px] font-semibold bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:text-black dark:hover:bg-amber-400 border-0"
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

                    if (validationErrors.length > 0) {
                      const proceed = confirm(
                        `Warning: Some proposed fixes contain LaTeX or validation issues:\n\n${validationErrors.join("\n")}\n\nDo you want to apply them anyway?`
                      )
                      if (!proceed) return
                    }

                    event.fixes?.forEach((fix) => {
                      updateCard(fix.id, { content: fix.content })
                    })
                    updateEvent(event.id, {
                      fixesApplied: true,
                      status: "done",
                      detail: "Fixes applied. Recompiling…",
                    })
                    await saveProject()
                    compileProject()
                  }}
                >
                  <Sparkles className="size-3 mr-1" />
                  Apply Fixes
                </Button>
              )}
            </div>
          </div>
        )}
        <span className="mt-0.5 block min-h-[12px] font-mono text-[9px] text-muted-foreground/70">
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
            <span className="ml-1 shrink-0 font-mono text-[9px] text-muted-foreground">
              {generatingIds[0]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="rounded bg-muted px-1 font-mono text-[9px]">
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
          <span className="inline-flex items-center gap-0.5 ml-0.5" title="AI rozmýšľa / odpovedá…">
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
  const selectedCard = activeOutput?.cards.find((c) => c.id === selectedCardId)

  const fixRegex = /<fix>([\s\S]*?)<\/fix>/g
  let cleanText = text
  const fixes: string[] = []

  cleanText = text.replace(fixRegex, (fullMatch, content) => {
    fixes.push(content.trim())
    return ""
  })

  const [localApplied, setLocalApplied] = useState<Set<number>>(new Set())

  // If text is still empty while streaming, show subtle typing placeholder dots
  if ((!cleanText || cleanText.trim() === "") && isAiStreaming) {
    return (
      <div className="flex items-center gap-1.5 py-1 text-muted-foreground/60">
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

        const unsafeLatexIssues = hasUnsafeLatex(fixContent)
        const validationMsgs = selectedCard
          ? validateCard({ ...selectedCard, content: fixContent })
          : []
        const hasValidationErrors =
          unsafeLatexIssues.length > 0 || validationMsgs.some((m) => m.level === "error")

        return (
          <Button
            key={i}
            size="sm"
            variant={isApplied ? "ghost" : "outline"}
            disabled={isApplied || !selectedCardId}
            className={cn(
              "mt-2 w-full h-auto py-2 whitespace-normal text-left justify-start gap-2",
              isApplied
                ? "bg-muted/30 text-muted-foreground border-transparent cursor-default"
                : hasValidationErrors
                ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                : "border-primary/50 bg-primary/5 text-primary hover:bg-primary/15"
            )}
            onClick={() => {
              if (selectedCardId && !isApplied) {
                if (hasValidationErrors) {
                  const errorSummary = [
                    ...unsafeLatexIssues,
                    ...validationMsgs.filter((m) => m.level === "error").map((m) => m.message),
                  ].join("; ")
                  if (
                    !confirm(
                      `Upozornenie: Navrhovaná oprava môže obsahovať chyby v LaTeXe (${errorSummary}). Chcete ju napriek tomu aplikovať?`
                    )
                  ) {
                    return
                  }
                }

                updateCard(selectedCardId, { content: fixContent })
                pushEvent({
                  kind: hasValidationErrors ? "validate" : "info",
                  status: hasValidationErrors ? "warning" : "done",
                  title: hasValidationErrors ? "Oprava aplikovaná s varovaním" : "Fix applied",
                  detail: hasValidationErrors
                    ? `Aplikované s upozorneniami: ${[
                        ...unsafeLatexIssues,
                        ...validationMsgs.map((m) => m.message),
                      ].join("; ")}`
                    : "Card content was updated by AI.",
                })
                setLocalApplied(new Set(localApplied).add(i))
                localStorage.setItem(`fix_${hash}`, "1")
              }
            }}
          >
            {isApplied ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : hasValidationErrors ? (
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
            ) : (
              <Wrench className="size-4 shrink-0" />
            )}
            <span>
              {isApplied
                ? "Oprava aplikovaná"
                : hasValidationErrors
                ? "Aplikovať opravu (zistené varovania)"
                : "Aplikovať opravu na vybranú kartu"}
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

  return (
    <ComposerPrimitive.Root className="flex shrink-0 flex-col border-t border-border bg-card/60">
      <ComposerPrimitive.Input
        ref={textareaRef}
        placeholder='Ask AI… e.g. "Make Card 3 more concise"'
        rows={1}
        autoComplete="off"
        className={cn(
          "min-h-[40px] w-full resize-none bg-transparent px-3 py-2.5 text-[12px] leading-relaxed placeholder:text-muted-foreground/60",
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
        <span className="text-[10px] text-muted-foreground/50">
          Shift+Enter for newline
        </span>
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
            <p className="text-[11px] text-muted-foreground/70">
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
  const { hydrateUi, updateProject, isAiStreaming } = useEditor(
    useShallow((s) => ({
      hydrateUi: s.hydrateUi,
      updateProject: s.updateProject,
      isAiStreaming: s.isAiStreaming,
    }))
  )

  return (
    <aside
      aria-label="Agent panel"
      className="flex w-full shrink-0 flex-col border-l border-border bg-sidebar lg:w-72"
    >
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1.5">
          <Cpu className="size-4 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wide">
            AI Assistant
          </span>
          {isAiStreaming ? (
            <span className="size-1.5 rounded-full bg-primary animate-pulse" title="Generuje…" />
          ) : (
            <span className="size-1.5 rounded-full bg-chart-3/80" title="Pripravený" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            title="Vyčistiť históriu (Clear history)"
            onClick={() => {
              if (confirm("Naozaj chceš vymazať históriu tohto chatu a udalostí?")) {
                hydrateUi([], [])
                updateProject({})
              }
            }}
          >
            <XCircle className="size-3.5 text-muted-foreground/70" />
          </Button>
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

      {/* Status strip (collapsible event log) */}
      <StatusStrip agentEvents={agentEvents} generatingIds={generatingIds} />

      <div className="flex-1 min-h-0 flex flex-col">
        <ChatThread />
      </div>
    </aside>
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
    return runtime.thread.subscribe(() => {
      const msgs = (runtime.thread as any).messages ?? []
      setTimeout(() => setChatMessages([...msgs]), 0)
    })
  }, [runtime, setChatMessages])

  useEffect(() => {
    if (pendingAiPrompt) {
      setCollapsed(false)
      runtime.thread.append({ role: "user", content: [{ type: "text", text: pendingAiPrompt }] })
      setPendingAiPrompt(null)
    }
  }, [pendingAiPrompt, runtime.thread, setPendingAiPrompt])

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
