"use client"

import { AlertTriangle, Lightbulb, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { notify } from "@/lib/notify"
import type { Card } from "@/lib/poster-types"
import { deriveQuickFixes, findDanglingCiteKeys, findDanglingRefKeys } from "@/lib/latex/quick-fixes"
import { useEditor } from "@/components/editor-store"

/** Isolated, testable quick-fix surface shared by the validation tab. */
export function QuickFixesPanel({ card }: { card: Card }) {
  const updateCard = useEditor((s) => s.updateCard)
  const bibKeys = useEditor((s) => s.bibKeys)
  const allCardContents = useEditor((s) => (s.project.outputs?.find((o) => o.id === s.project.activeOutputId)?.cards ?? []).map((c) => c.content))
  const quickFixes = deriveQuickFixes(card)
  const danglingCites = findDanglingCiteKeys(card.content, bibKeys)
  const danglingRefs = findDanglingRefKeys(card.content, allCardContents)

  if (!quickFixes.length && !danglingCites.length && !danglingRefs.length) return null

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-primary/20 bg-primary/5 p-2.5">
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
        <Lightbulb className="size-3.5" /> Quick fixes
      </span>
      {quickFixes.map((fix) => (
        <div key={fix.id} className="flex flex-col gap-1 rounded-md border border-border bg-card px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">{fix.label}</span>
            <Button
              size="xs"
              variant="outline"
              className="gap-1 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => {
                updateCard(card.id, { content: fix.apply(card.content) })
                notify.success("Quick fix applied", { description: `${fix.label} — review the result in the Content tab.` })
              }}
              aria-label={`Apply quick fix: ${fix.label}`}
            >
              <Wand2 className="size-3" /> Apply
            </Button>
          </div>
          <p className="text-[10px] leading-snug text-muted-foreground">{fix.description}</p>
        </div>
      ))}
      {danglingCites.length > 0 && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          <AlertTriangle className="mr-1 inline size-3 text-warning" />
          Citation key{danglingCites.length === 1 ? "" : "s"} not in references.bib: <span className="font-mono">{danglingCites.join(", ")}</span>
        </p>
      )}
      {danglingRefs.length > 0 && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          <AlertTriangle className="mr-1 inline size-3 text-warning" />
          Cross-reference{danglingRefs.length === 1 ? "" : "s"} without a matching label: <span className="font-mono">{danglingRefs.join(", ")}</span>
        </p>
      )}
    </div>
  )
}
