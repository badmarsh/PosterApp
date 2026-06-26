"use client"

import { useState } from "react"
import { ChevronRight, ScrollText } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { cn } from "@/lib/utils"
import type { ParseLogEntry } from "@/lib/ingestion"

const LEVEL_COLOR: Record<ParseLogEntry["level"], string> = {
  info: "text-muted-foreground",
  warning: "text-chart-4",
  error: "text-destructive",
}

export function ParseLogPanel() {
  const { parseLog } = useEditor()
  const [open, setOpen] = useState(false)
  const warnings = parseLog.filter((l) => l.level !== "info").length

  return (
    <div className="rounded-md border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
        <ScrollText className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          Parse log
        </span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
          {warnings > 0 && (
            <span className="rounded border border-chart-4/30 bg-chart-4/10 px-1 text-chart-4">
              {warnings} warn/err
            </span>
          )}
          {parseLog.length} lines
        </span>
      </button>

      {open && (
        <div className="max-h-40 overflow-y-auto border-t border-border px-2 py-1.5">
          <ul className="flex flex-col gap-1">
            {parseLog.map((entry) => (
              <li key={entry.id} className="flex gap-1.5 font-mono text-[10px] leading-snug">
                <span className="shrink-0 text-muted-foreground/60">
                  {entry.ts === "loaded" ? "·" : entry.ts}
                </span>
                <span
                  className={cn(
                    "shrink-0 uppercase",
                    LEVEL_COLOR[entry.level],
                  )}
                >
                  {entry.level}
                </span>
                <span className="text-foreground/90">{entry.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
