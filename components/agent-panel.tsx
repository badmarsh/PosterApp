"use client"

import { useEffect, useState, memo, useMemo } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Cpu,
  FileCode2,
  Lightbulb,
  Loader2,
  PanelRightClose,
  ShieldCheck,
  Terminal,
  XCircle,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
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

const EventRow = memo(function EventRow({ event, last }: { event: AgentEvent; last: boolean }) {
  const Icon = KIND_ICON[event.kind]
  // Timestamps are locale/clock-dependent, so only reveal them after mount to
  // avoid a server/client hydration mismatch.
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
        <span className="mt-0.5 block min-h-[12px] font-mono text-[9px] text-muted-foreground/70">
          {mounted ? event.ts : ""}
        </span>
      </div>
    </div>
  )
})

export function AgentPanel() {
  const { agentEvents, generatingId } = useEditor(
    useShallow((s) => ({
      agentEvents: s.agentEvents,
      generatingId: s.generatingId,
    }))
  )
  const [collapsed, setCollapsed] = useState(false)

  const running = agentEvents.filter((e) => e.status === "running")
  const current =
    running[running.length - 1] ?? agentEvents[agentEvents.length - 1]
  const ordered = useMemo(() => [...agentEvents].reverse(), [agentEvents])

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
          <TooltipContent side="left">Agent activity</TooltipContent>
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
          AGENT
        </span>
      </aside>
    )
  }

  return (
    <aside
      aria-label="Agent activity"
      className="flex w-full shrink-0 flex-col border-l border-border bg-sidebar lg:w-72"
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1.5">
          <Cpu className="size-4 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wide">
            Agent activity
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Collapse agent panel"
          onClick={() => setCollapsed(true)}
          className="hidden lg:inline-flex"
        >
          <PanelRightClose className="size-3.5" />
        </Button>
      </div>

      {/* current task status */}
      <div className="shrink-0 border-b border-border bg-card/60 p-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Current task
        </span>
        <div className="mt-1 flex items-start gap-1.5">
          {current && <StatusGlyph status={current.status} />}
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium leading-tight">
              {current?.title ?? "Idle"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {generatingId
                ? `Generating in isolated scope · ${generatingId}`
                : running.length
                  ? "Working…"
                  : "Coding agent idle — waiting for a task"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-muted-foreground">
        <ChevronRight className="size-3" />
        <span className="font-mono uppercase tracking-wide">status timeline</span>
        <span className="ml-auto rounded bg-muted px-1 font-mono">
          {agentEvents.length}
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div
          className="px-3 pt-1 pb-4"
          role="log"
          aria-live="polite"
          aria-label="Agent status timeline"
        >
          {ordered.length ? (
            ordered.map((e, i) => (
              <EventRow key={e.id} event={e} last={i === ordered.length - 1} />
            ))
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-2 py-8 text-center">
              <CircleDot className="size-4 text-muted-foreground" />
              <p className="text-[12px] font-medium">No activity yet</p>
              <p className="text-[11px] text-muted-foreground">
                Validate or generate a card to see the agent timeline here.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border p-2.5">
        <p className="text-[10px] leading-snug text-muted-foreground">
          The agent validates and generates one selected card at a time, then patches
          its <span className="font-mono text-foreground">{"\\block{}"}</span> into the
          fixed template by stable ID.
        </p>
      </div>
    </aside>
  )
}
