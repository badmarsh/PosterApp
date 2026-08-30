"use client"

import React from "react"
import {
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers,
  BookOpen,
  ArrowRight,
  Info,
  ShieldCheck,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ReviewAnalysisPlan, ReportingStandard } from "@/lib/ai/review-types"
import { REPORTING_STANDARDS_INFO } from "@/lib/ai/review-types"

interface Props {
  plan: ReviewAnalysisPlan
  selectedStandard: ReportingStandard
  onSelectStandard: (std: ReportingStandard) => void
  onConfirmPlan: () => void
  onCancel: () => void
  isGenerating?: boolean
}

export function AnalysisPlanPanel({
  plan,
  selectedStandard,
  onSelectStandard,
  onConfirmPlan,
  onCancel,
  isGenerating = false,
}: Props) {
  const qualityBadge = {
    high: <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-300 dark:border-green-800 text-[10px]">Vysoká kvalita extrakcie</Badge>,
    medium: <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 text-[10px]">Stredná kvalita</Badge>,
    low: <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 text-[10px]">Nízky rozsah textu</Badge>,
  }[plan.extractionQuality]

  return (
    <div className="space-y-4 max-w-4xl mx-auto py-2 animate-in fade-in duration-200">
      <div className="border border-border/80 shadow-md rounded-xl bg-card overflow-hidden">
        <div className="p-4 pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Predanalytický plán hodnotenia</h3>
                <p className="text-[11px] text-muted-foreground">
                  Skontrolujte zistenú štruktúru dokumentu a odporúčané štandardy pred spustením hĺbkového auditu.
                </p>
              </div>
            </div>
            {qualityBadge}
          </div>
        </div>

        <div className="p-4 pt-4 space-y-4 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-2.5 rounded-lg border bg-card/60 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                <FileText className="size-3" /> Názov a typ
              </span>
              <p className="font-medium text-foreground truncate" title={plan.documentTitle}>
                {plan.documentTitle}
              </p>
              <p className="text-[11px] text-muted-foreground capitalize font-mono">
                {plan.detectedType} ({plan.language.toUpperCase()})
              </p>
            </div>

            <div className="p-2.5 rounded-lg border bg-card/60 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                <Layers className="size-3" /> Výskumný dizajn
              </span>
              <p className="font-medium text-foreground capitalize">
                {plan.studyDesign.replace("_", " ")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {plan.discipline}
              </p>
            </div>

            <div className="p-2.5 rounded-lg border bg-card/60 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                <BookOpen className="size-3" /> Referencie & Prílohy
              </span>
              <p className="font-medium text-foreground">
                Literatúra: <span className="capitalize">{plan.citationAvailability}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Tabuľky a grafy: {plan.hasTablesAndFigures ? "Detegované ✓" : "Nenájdené"}
              </p>
            </div>
          </div>

          {/* Reporting Guideline Selection */}
          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                <span>AI-assisted reporting guideline pre-check</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Voliteľný štandard</span>
            </div>

            {plan.guidelineReason && (
              <p className="text-[11px] text-muted-foreground italic">
                {plan.guidelineReason}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Select value={selectedStandard} onValueChange={(val: any) => onSelectStandard(val)}>
                <SelectTrigger className="h-8 text-xs bg-background min-w-[260px] max-w-sm">
                  <SelectValue placeholder="Vyberte reporting štandard">
                    {REPORTING_STANDARDS_INFO[selectedStandard]?.name || "Vyberte reporting štandard"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-[360px] max-w-[520px]">
                  <SelectItem value="none">Všeobecné hodnotenie (bez špecifického checklistu)</SelectItem>
                  <SelectItem value="ml_reproducibility">ML Reproducibility Checklist (Strojové učenie)</SelectItem>
                  <SelectItem value="consort">CONSORT 2025 (Klinické / Randomizované štúdie)</SelectItem>
                  <SelectItem value="prisma">PRISMA 2020 (Systematické rešerše a meta-analýzy)</SelectItem>
                  <SelectItem value="strobe">STROBE (Observačné a kohortové štúdie)</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-[11px] text-muted-foreground flex-1 min-w-[200px]">
                {REPORTING_STANDARDS_INFO[selectedStandard]?.description}
              </span>
            </div>
          </div>

          {/* Rubric Applicability Matrix */}
          {plan.applicableCriteria && plan.applicableCriteria.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                <span>Aplikovateľné kritériá rubriky ({plan.recommendedRubric || "sk-academic-v1"})</span>
                <span className="text-[10px] text-muted-foreground font-normal">Váha / Status</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {plan.applicableCriteria.map((c) => (
                  <div
                    key={c.criterionKey}
                    className={`flex items-center justify-between p-2 rounded border text-[11px] ${
                      c.applicability === "not_applicable"
                        ? "bg-muted/20 border-dashed opacity-60"
                        : c.applicability === "partially_applicable"
                        ? "bg-amber-500/5 border-amber-500/20"
                        : "bg-card/60"
                    }`}
                  >
                    <span className="truncate mr-1 font-medium">{c.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] font-mono text-muted-foreground">{c.weight}%</span>
                      <Badge
                        variant="outline"
                        className={`text-[8px] py-0 px-1 ${
                          c.applicability === "applicable"
                            ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
                            : c.applicability === "partially_applicable"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.applicability === "applicable" ? "Plné" : c.applicability === "partially_applicable" ? "Čiast." : "N/A"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section inventory */}
          <div>
            <span className="text-[11px] font-semibold text-foreground mb-1.5 block">
              Zistené kapitoly dokumentu ({plan.detectedSections.length})
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {plan.detectedSections.map((sec) => (
                <div key={sec.id} className="flex items-center justify-between p-1.5 rounded border bg-card/40 text-[11px]">
                  <span className="truncate mr-1 font-medium">{sec.heading}</span>
                  <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                    {Math.round(sec.charCount / 5)} slov
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Structural Quality Signals */}
          {plan.qualityReport?.signals && plan.qualityReport.signals.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-foreground block">
                Štrukturálne signály kvality textu ({plan.qualityReport.signals.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {plan.qualityReport.signals.map((sig) => (
                  <div key={sig.id} className="p-1.5 rounded border bg-card/50 text-[11px] space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-[10px]">{sig.label}</span>
                      <Badge
                        variant="outline"
                        className={`text-[8px] py-0 px-1 ${
                          sig.status === "good"
                            ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
                            : sig.status === "warning"
                            ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
                            : sig.status === "caution"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {String(sig.value)}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{sig.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Limitations & Warnings */}
          {plan.limitations.length > 0 && (
            <div className="p-2.5 rounded-lg border border-amber-300/40 bg-amber-500/5 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[11px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3.5" />
                <span>Identifikované limitácie a chýbajúce sekcie</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted-foreground">
                {plan.limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="p-4 pt-2 pb-3 border-t bg-muted/10 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isGenerating} className="text-xs">
            Späť k úpravám
          </Button>

          <Button
            size="sm"
            onClick={onConfirmPlan}
            disabled={isGenerating || !plan.canProceedToDeepReview}
            className="gap-1.5 text-xs shadow-xs"
          >
            <span>Spustiť expertné hodnotenie</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
