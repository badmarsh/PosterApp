"use client"

import { CheckCircle2, Clock, FileWarning, Info, XCircle } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import type { Card, ValidationMessage } from "@/lib/poster-types"
import { levelFromMessages, validateCard } from "@/lib/latex"
import { cn } from "@/lib/utils"
import { QuickFixesPanel } from "./quick-fixes-panel"

const LEVEL_ICON = {
  error: { Icon: XCircle, className: "text-destructive" },
  warning: { Icon: FileWarning, className: "text-warning" },
  info: { Icon: Info, className: "text-muted-foreground" },
} as const

function Section({ title, items }: { title: string; items: ValidationMessage[] }) {
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
              <span className="font-mono text-[11px] text-muted-foreground">{m.field}</span>
              <p className="text-xs leading-snug">{m.message}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ValidationTab({ card }: { card: Card }) {
  const project = useEditor((s) => s.project)
  if (card.validation === "pending") {
    return (
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2">
          <Clock className="size-4 text-warning shrink-0" />
          <div>
            <p className="text-xs font-medium text-warning">Placeholder Card</p>
            <p className="text-[11px] text-muted-foreground">
              This card is a pending experiment placeholder. It will become validated once an agent proposes results or you edit it manually.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)
  const msgs = validateCard(card, activeOutput?.templateId, activeOutput?.cards)
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
        <span className="text-xs font-medium">
          {level === "valid"
            ? "Card input is well-formed and ready to generate."
            : level === "warning"
              ? `${msgs.length} non-blocking warning${msgs.length === 1 ? "" : "s"}.`
              : "Blocking errors — fix before generation."}
        </span>
      </div>
      <QuickFixesPanel card={card} />
      <Section title="Field validation" items={other} />
      <Section title="LaTeX safety" items={safety} />
      <Section title="Overflow estimate" items={overflow} />
      {!msgs.length && (
        <p className="text-center text-[11px] text-muted-foreground">No issues found.</p>
      )}
    </div>
  )
}

