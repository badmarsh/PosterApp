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
} as const

function statusColor(status: AgentEvent["status"]) {
  switch (status) {
    case "running":
      return "text-primary"
    case "done":
      return "text-chart-3"
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
  useEffect(() => setMounted(true), [])
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
          {mounted ? event.ts : ""}
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
  generatingId,
}: {
  agentEvents: AgentEvent[]
  generatingId: string | null
}) {
  const running = agentEvents.filter((e) => e.status === "running")
  const current =
    running[running.length - 1] ?? agentEvents[agentEvents.length - 1]
  const ordered = useMemo(() => [...agentEvents].reverse(), [agentEvents])
  const [open, setOpen] = useState(false)

  // Auto-open the strip when something is actively running
  useEffect(() => {
    if (running.length > 0) setOpen(true)
  }, [running.length])

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
          {generatingId && (
            <span className="ml-1 shrink-0 font-mono text-[9px] text-muted-foreground">
              {generatingId}
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
          {ordered.length ? (
            ordered.map((e, i) => (
              <EventRow key={e.id} event={e} last={i === ordered.length - 1} />
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

      {fixes.map((fixContent, i) => (
        <Button
          key={i}
          size="sm"
          variant="outline"
          className="mt-1 w-full gap-2 border-primary/50 bg-primary/5 text-primary hover:bg-primary/15"
          onClick={() => {
            if (selectedCardId) {
              updateCard(selectedCardId, { content: fixContent })
              pushEvent({
                kind: "info",
                status: "done",
                title: "Fix applied",
                detail: "Card content was updated by AI.",
              })
            }
          }}
        >
          <Wrench className="size-3.5" />
          Aplikovať opravu na vybranú kartu
        </Button>
      ))}
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
  generatingId,
  onCollapse,
}: {
  agentEvents: AgentEvent[]
  generatingId: string | null
  onCollapse: () => void
}) {
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
            AI Chat
          </span>
        </div>
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

      {/* Status strip (collapsible event log) */}
      <StatusStrip agentEvents={agentEvents} generatingId={generatingId} />

      {/* Chat thread */}
      <ChatThread />
    </aside>
  )
}

// ---------------------------------------------------------------------------
// AgentPanel (main export) — manages runtime lifecycle
// ---------------------------------------------------------------------------

export function AgentPanel() {
  const { agentEvents, generatingId, projectId, selectedCardId, pendingAiPrompt, setPendingAiPrompt, chatMessages, setChatMessages } = useEditor(
    useShallow((s) => ({
      agentEvents: s.agentEvents,
      generatingId: s.generatingId,
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
    () => makeChatAdapter(projectId, () => selectedCardIdRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId]
  )

  const runtime = useLocalRuntime(adapter, { initialMessages: chatMessages })

  // Observe and sync chat messages back to the global store
  useEffect(() => {
    return runtime.thread.subscribe(() => {
      const msgs = runtime.thread.messages
      // Simple debounce to avoid spamming the store
      // In a real app we might use a dedicated debouncer, but a short timeout is fine here
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
        {generatingId ? (
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
        generatingId={generatingId}
        onCollapse={() => setCollapsed(true)}
      />
    </AssistantRuntimeProvider>
  )
}
