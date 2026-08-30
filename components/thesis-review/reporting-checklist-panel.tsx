"use client"

/**
 * ReportingChecklistPanel — Displays adherence checks for EQUATOR reporting guidelines
 * (CONSORT 2025, PRISMA 2020, STROBE, ML Reproducibility).
 */

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { ReportingGuidelineCheck, ReportingStandard } from "@/lib/ai/review-types"
import { REPORTING_STANDARDS_INFO } from "@/lib/ai/review-types"

interface Props {
  standard: ReportingStandard
  checks: ReportingGuidelineCheck[]
  onUpdateCheck?: (index: number, updates: Partial<ReportingGuidelineCheck>) => void
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  compliant: { label: "Splnené", color: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30", icon: CheckCircle2 },
  partial: { label: "Čiastočne", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", icon: AlertCircle },
  missing: { label: "Chýba", color: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30", icon: XCircle },
  not_applicable: { label: "Nerelevantné", color: "bg-muted text-muted-foreground border-muted-foreground/30", icon: HelpCircle },
}

export function ReportingChecklistPanel({ standard, checks, onUpdateCheck }: Props) {
  const [isOpen, setIsOpen] = useState(true)
  const info = REPORTING_STANDARDS_INFO[standard]

  if (standard === "none" || checks.length === 0) return null

  const compliantCount = checks.filter((c) => c.status === "compliant").length
  const totalCount = checks.length
  const percent = Math.round((compliantCount / totalCount) * 100)

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              {info?.name ?? standard} — AI Pre-Check
              <Badge variant="outline" className="text-[10px] font-mono">
                {compliantCount}/{totalCount} splnené ({percent}%)
              </Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Informatívny AI predbežný audit odporúčaných smerníc — vyžaduje odborné posúdenie recenzenta.
            </p>
          </div>
        </div>

        <Button size="icon" variant="ghost" className="h-7 w-7">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Checklist items */}
      {isOpen && (
        <div className="space-y-2.5 pt-1">
          {checks.map((chk, idx) => {
            const conf = STATUS_CONFIG[chk.status] || STATUS_CONFIG.compliant
            const Icon = conf.icon

            return (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 p-2.5 rounded-lg border bg-muted/20 text-xs">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{chk.item}</span>
                    <Badge variant="secondary" className="text-[9px] uppercase">
                      {chk.category}
                    </Badge>
                  </div>
                  {chk.notes && (
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      {chk.notes}
                    </p>
                  )}
                  {chk.evidenceQuote && (
                    <p className="italic font-serif text-[10px] text-foreground/80 pl-2 border-l border-primary/40">
                      &ldquo;{chk.evidenceQuote}&rdquo;
                    </p>
                  )}
                </div>

                <Badge variant="outline" className={`shrink-0 text-[10px] font-semibold gap-1 px-2 py-0.5 ${conf.color}`}>
                  <Icon className="h-3 w-3" />
                  {conf.label}
                </Badge>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
