"use client"

import { ExternalLink, Quote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { CardCitation } from "@/lib/poster-types"
import { cn } from "@/lib/utils"

/**
 * Small, keyboard-accessible provenance badge used by both the canvas and the
 * inspector. The source quote is rendered as text (never HTML) and the jump
 * event is deliberately framework-agnostic so SourceMarkdownView can consume
 * it even when it lives in another workspace pane.
 */
export function EvidenceChip({
  citation,
  className,
  compact = false,
}: {
  citation: CardCitation
  className?: string
  compact?: boolean
}) {
  const evidence = citation.evidence?.[0]
  if (!evidence) return null

  const jumpToSource = () => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("posterapp:source-jump", {
      detail: {
        quote: evidence.quote,
        anchor: evidence.anchor,
        chunkId: evidence.chunkId,
      },
    }))
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
            aria-label={`Evidence reference ${citation.bulletIndex + 1}`}
          />
        }
      >
        <Quote className="size-2.5" />
        {compact ? "Ref" : "Ref"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Quote className="size-3 text-primary" />
            Source evidence
          </div>
          {evidence.heading && (
            <span className="max-w-[11rem] truncate text-[10px] text-muted-foreground" title={evidence.heading}>
              {evidence.heading}
            </span>
          )}
        </div>
        <blockquote className="max-h-32 overflow-y-auto rounded-md border-l-2 border-primary/50 bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-foreground/90">
          “{evidence.quote}”
        </blockquote>
        <Button type="button" size="xs" variant="outline" className="w-full gap-1.5 text-[11px]" onClick={jumpToSource}>
          <ExternalLink className="size-3" />
          Jump to source excerpt
        </Button>
      </PopoverContent>
    </Popover>
  )
}
