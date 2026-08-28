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
import { Progress } from "@/components/ui/progress"
import type { Job } from "@/lib/job-queue"
import type { AgentEvent } from "@/lib/poster-types"
import { cn } from "@/lib/utils"
import { makeChatAdapter } from "@/components/agent-chat-adapter"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import "katex/dist/katex.min.css"

// ---------------------------------------------------------------------------
// Status event log helpers (unchanged from previous implementation)
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
  const Icon = KIND_ICON[event.kind]
  const [mounted, setMounted] = useState(false)
  const [elapsed, setElapsed] = useState("")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {event.detail}
          </p>
        )}
        {event.tips && event.tips.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {event.tips.map((tip, i) => {
              const severityColor =
                tip.severity === "error"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : tip.severity === "warning"
                    ? "bg-chart-4/10 text-chart-4 border-chart-4/20"
                    : "bg-chart-3/10 text-chart-3 border-chart-3/20"
              return (
                <div
                  key={i}
                  className="flex flex-col gap-0.5 rounded-md border bg-card p-1.5 shadow-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-sm border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                        severityColor
                      )}
                    >
                      {tip.severity}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {tip.category}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-foreground">
                    {tip.message}
                  </p>
                </div>
              )
            })}
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

  // Auto-open the strip when something is actively running
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  return (
    <MessagePrimitive.Root className="flex flex-col gap-1 px-3 py-1">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          AI
        </span>
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
  const { updateCard, selectedCardId, pushEvent } = useEditor(
    useShallow((s) => ({
      updateCard: s.updateCard,
      selectedCardId: s.selectedCardId,
      pushEvent: s.pushEvent,
    }))
  )

  const fixRegex = /<fix>([\s\S]*?)<\/fix>/g
  let cleanText = text
  const fixes: string[] = []

  cleanText = text.replace(fixRegex, (fullMatch, content) => {
    fixes.push(content.trim())
    return ""
  })

  // Local state for applied fixes to quickly re-render
  const [localApplied, setLocalApplied] = useState<Set<number>>(new Set())

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
        const hash = fixContent.length + "_" + fixContent.slice(0, 20).replace(/\s+/g, '')
        const isApplied = localApplied.has(i) || (typeof window !== "undefined" && localStorage.getItem(`fix_${hash}`) === "1")
        
        return (
          <Button
            key={i}
            size="sm"
            variant={isApplied ? "ghost" : "outline"}
            disabled={isApplied}
            className={cn(
              "mt-2 w-full h-auto py-2 whitespace-normal text-left justify-start gap-2",
              isApplied 
                ? "bg-muted/30 text-muted-foreground border-transparent cursor-default" 
                : "border-primary/50 bg-primary/5 text-primary hover:bg-primary/15"
            )}
            onClick={() => {
              if (selectedCardId && !isApplied) {
                updateCard(selectedCardId, { content: fixContent })
                pushEvent({
                  kind: "info",
                  status: "done",
                  title: "Fix applied",
                  detail: "Card content was updated by AI.",
                })
                setLocalApplied(new Set(localApplied).add(i))
                localStorage.setItem(`fix_${hash}`, "1")
              }
            }}
          >
            {isApplied ? <CheckCircle2 className="size-4 shrink-0" /> : <Wrench className="size-4 shrink-0" />}
            <span>{isApplied ? "Oprava aplikovaná" : "Aplikovať opravu na vybranú kartu"}</span>
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
          // Grow up to 5 lines
          "max-h-[120px] overflow-y-auto",
        )}
        onKeyDown={(e) => {
          // Submit on Enter (no shift), allow Shift+Enter for newlines
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

  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
      {/* Scrollable messages area */}
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
  const { hydrateUi, updateProject } = useEditor(
    useShallow((s) => ({ hydrateUi: s.hydrateUi, updateProject: s.updateProject }))
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
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            title="Vyčistiť históriu (Clear history)"
            onClick={() => {
              if (confirm("Naozaj chceš vymazať históriu tohto chatu a udalostí?")) {
                hydrateUi([], [])
                // Mark project as dirty to ensure the empty state is saved
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
  const { agentEvents, generatingIds, jobs, cancelJob, projectId, selectedCardId, pendingAiPrompt, setPendingAiPrompt, chatMessages, setChatMessages } = useEditor(
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
    }))
  )

  const [collapsed, setCollapsed] = useState(false)

  // Keep a stable ref to selectedCardId so the adapter closure always reads
  // the latest value without needing to be recreated.
  const selectedCardIdRef = useRef(selectedCardId)
  useEffect(() => {
    selectedCardIdRef.current = selectedCardId
  }, [selectedCardId])

  // Recreate the adapter (and thus runtime) when the workspace changes so
  // each workspace gets a fresh ephemeral thread.
  const adapter = useMemo(
    // eslint-disable-next-line react-hooks/refs
    () => makeChatAdapter(projectId, () => selectedCardIdRef.current),
     
    [projectId]
  )

  const runtime = useLocalRuntime(adapter, { initialMessages: chatMessages })

  // Observe and sync chat messages back to the global store
  useEffect(() => {
    return runtime.thread.subscribe(() => {
      // @assistant-ui/react v0.15+ moved messages off the direct ThreadRuntime type;
      // access via type assertion until the API stabilises.
      const msgs = (runtime.thread as any).messages ?? []
      // Simple debounce to avoid spamming the store
      // In a real app we might use a dedicated debouncer, but a short timeout is fine here
      setTimeout(() => setChatMessages([...msgs]), 0)
    })
  }, [runtime, setChatMessages])

  useEffect(() => {
    if (pendingAiPrompt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        {generatingIds.length > 0 ? (
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
