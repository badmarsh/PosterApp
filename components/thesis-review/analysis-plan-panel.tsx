"use client"

import React, { useState, useMemo } from "react"
import {
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Scale,
  Calendar,
  Link2,
  Code2,
  Type,
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
  XCircle,
  Hash,
  Compass,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ReviewAnalysisPlan, ReportingStandard, TOCNode } from "@/lib/ai/review-types"
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
  const [tocFilter, setTocFilter] = useState<"all" | "major" | "warnings">("all")
  const [tocSearch, setTocSearch] = useState("")
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({ "root": true })

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const qualityBadge = {
    high: <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800 text-[11px] font-semibold">Vysoká kvalita extrakcie</Badge>,
    medium: <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-[11px] font-semibold">Stredná kvalita</Badge>,
    low: <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 text-[11px] font-semibold">Nízky rozsah textu</Badge>,
  }[plan.extractionQuality]

  const metrics = plan.metrics
  const totalWords = plan.qualityReport?.totalWords || 0

  // Filtered TOC
  const filteredTOC = useMemo(() => {
    const rawNodes = plan.tocTree || []
    if (!tocSearch && tocFilter === "all") return rawNodes

    const filterNode = (node: TOCNode): TOCNode | null => {
      const matchesSearch = !tocSearch || node.title.toLowerCase().includes(tocSearch.toLowerCase())
      const matchesFilter =
        tocFilter === "all" ||
        (tocFilter === "major" && node.level <= 2) ||
        (tocFilter === "warnings" && (node.hasWarning || node.isEmpty))

      const matchingChildren = node.children
        .map(filterNode)
        .filter((c): c is TOCNode => c !== null)

      if ((matchesSearch && matchesFilter) || matchingChildren.length > 0) {
        return {
          ...node,
          children: matchingChildren,
        }
      }
      return null
    }

    return rawNodes.map(filterNode).filter((n): n is TOCNode => n !== null)
  }, [plan.tocTree, tocFilter, tocSearch])

  return (
    <div className="space-y-4 max-w-5xl mx-auto py-3 animate-in fade-in duration-200">
      <div className="border border-border/80 shadow-md rounded-xl bg-card overflow-hidden">
        {/* Header bar */}
        <div className="p-4 pb-3 border-b bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                <Sparkles className="size-4.5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  Predanalytický profil rukopisu a audit pripravenosti
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Hĺbková metrika štruktúry, vyváženosti, citačnej dynamiky a metodologického dizajnu pred spustením recenzie.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {qualityBadge}
              {plan.sourceRevision && (
                <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground bg-card">
                  SHA: {plan.sourceRevision}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-5 text-xs">
          {/* Discipline Archetype & Topic Tags Banner */}
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Compass className="size-4 text-primary shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                  Klasifikácia odboru & Metodologický archetyp
                </span>
              </div>
              <Badge className="bg-primary/20 hover:bg-primary/25 text-primary border-primary/30 text-[10px] font-mono">
                Presnosť: {Math.round((plan.classification?.confidence || 0.85) * 100)}%
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <p className="text-sm font-bold text-foreground">
                  {plan.discipline}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Metodológia: <span className="font-medium text-foreground">{plan.detailedThesisType || plan.studyDesign}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 justify-start md:justify-end">
                {plan.disciplineScoreBreakdown?.[0]?.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-[10px] bg-background/80 border border-border">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {plan.classification?.rationale && (
              <p className="text-[11px] text-muted-foreground/90 border-t border-primary/15 pt-2 italic">
                {plan.classification.rationale}
              </p>
            )}
          </div>

          {/* Key Academic Metrics Grid (5 Visual Cards) */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              Kľúčové akademické metriky & Diagnostika
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* 1. Theory vs Practical Balance */}
              <div className="p-3 rounded-xl border bg-card/70 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                      <Scale className="size-3.5 text-blue-500" />
                      Vyváženosť teórie a praxe
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${
                        metrics?.balance.status === "balanced"
                          ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-400/30"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-400/30"
                      }`}
                    >
                      {metrics?.balance.status === "balanced" ? "Optimálne" : metrics?.balance.status === "theory_heavy" ? "Prevaha teórie" : "Silná prax"}
                    </Badge>
                  </div>

                  {metrics?.balance && (
                    <div className="space-y-1.5 mt-2">
                      <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                        <span>Teória: {Math.round(metrics.balance.theoryRatio * 100)}% ({metrics.balance.theoryWordCount.toLocaleString()} s.)</span>
                        <span>Prax: {Math.round(metrics.balance.practicalRatio * 100)}% ({metrics.balance.practicalWordCount.toLocaleString()} s.)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                        <div
                          className="bg-blue-500 transition-all"
                          style={{ width: `${Math.max(5, Math.min(95, metrics.balance.theoryRatio * 100))}%` }}
                          title={`Teória: ${Math.round(metrics.balance.theoryRatio * 100)}%`}
                        />
                        <div
                          className="bg-emerald-500 transition-all"
                          style={{ width: `${Math.max(5, Math.min(95, metrics.balance.practicalRatio * 100))}%` }}
                          title={`Prax / Výsledky: ${Math.round(metrics.balance.practicalRatio * 100)}%`}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight pt-1">
                        {metrics.balance.summary}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Citation Recency & Dynamics */}
              <div className="p-3 rounded-xl border bg-card/70 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                      <Calendar className="size-3.5 text-purple-500" />
                      Citačná dynamika & Čerstvosť
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${
                        metrics?.citations.recencyStatus === "fresh"
                          ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-400/30"
                          : metrics?.citations.recencyStatus === "adequate"
                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-400/30"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-400/30"
                      }`}
                    >
                      {metrics?.citations.recencyStatus === "fresh" ? "Aktuálna rešerš" : metrics?.citations.recencyStatus === "adequate" ? "Priemerná" : "Staršie zdroje"}
                    </Badge>
                  </div>

                  {metrics?.citations && (
                    <div className="space-y-1.5 mt-2">
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="p-1.5 rounded bg-muted/40 border">
                          <span className="text-muted-foreground block">Medián roku:</span>
                          <span className="font-bold text-foreground text-[11px]">{metrics.citations.medianPublicationYear || "N/A"}</span>
                        </div>
                        <div className="p-1.5 rounded bg-muted/40 border">
                          <span className="text-muted-foreground block">Zdroje &lt; 5 rokov:</span>
                          <span className="font-bold text-foreground text-[11px]">{Math.round(metrics.citations.recency5YearsRatio * 100)}%</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {Object.entries(metrics.citations.decadeBreakdown).map(([decade, count]) => (
                          <span key={decade} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border">
                            {decade}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Cross-Referencing & Visual Assets */}
              <div className="p-3 rounded-xl border bg-card/70 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                      <Link2 className="size-3.5 text-amber-500" />
                      Krížové odkazy & Prílohy
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${
                        (metrics?.crossReferencing.integrityScore || 100) >= 90
                          ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-400/30"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-400/30"
                      }`}
                    >
                      Integrita {metrics?.crossReferencing.integrityScore ?? 100}%
                    </Badge>
                  </div>

                  {metrics?.crossReferencing && (
                    <div className="space-y-1.5 mt-2">
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="p-1.5 rounded bg-muted/40 border">
                          <span className="text-muted-foreground block">Obrázky:</span>
                          <span className="font-semibold text-foreground">
                            {metrics.crossReferencing.figuresReferenced} / {metrics.crossReferencing.figuresTotal}
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-muted/40 border">
                          <span className="text-muted-foreground block">Tabuľky:</span>
                          <span className="font-semibold text-foreground">
                            {metrics.crossReferencing.tablesReferenced} / {metrics.crossReferencing.tablesTotal}
                          </span>
                        </div>
                      </div>

                      {metrics.crossReferencing.orphanedItems.length > 0 ? (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          ⚠️ {metrics.crossReferencing.orphanedItems.join(", ")}
                        </p>
                      ) : (
                        <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                          ✓ Všetky vizuálne prílohy sú prepojené s textom.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Lexical Richness & Formality */}
              <div className="p-3 rounded-xl border bg-card/70 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                      <Type className="size-3.5 text-indigo-500" />
                      Lexika & Akademický štýl
                    </span>
                    <Badge variant="outline" className="text-[9px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-400/30">
                      TTR: {metrics?.lexical.typeTokenRatio ?? 0.4}
                    </Badge>
                  </div>

                  {metrics?.lexical && (
                    <div className="space-y-1 mt-2 text-[10px]">
                      <div className="flex justify-between py-0.5 border-b border-border/50">
                        <span className="text-muted-foreground">Formálnosť štýlu:</span>
                        <span className="font-semibold text-foreground">{metrics.lexical.academicFormalityScore} / 100</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-border/50">
                        <span className="text-muted-foreground">Priem. dĺžka vety:</span>
                        <span className="font-semibold text-foreground">{metrics.lexical.avgSentenceLengthWords} slov</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Slovná zásoba:</span>
                        <span className="font-semibold capitalize text-foreground">{metrics.lexical.vocabularyRichness}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Technical Rigor & Code */}
              <div className="p-3 rounded-xl border bg-card/70 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                      <Code2 className="size-3.5 text-rose-500" />
                      Technická formalizácia
                    </span>
                    <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-400/30">
                      {metrics?.formalization.technicalRigorLevel === "high" ? "Vysoká formalizácia" : metrics?.formalization.technicalRigorLevel === "medium" ? "Stredná formalizácia" : "Textový charakter"}
                    </Badge>
                  </div>

                  {metrics?.formalization && (
                    <div className="space-y-1 mt-2 text-[10px]">
                      <div className="flex justify-between py-0.5 border-b border-border/50">
                        <span className="text-muted-foreground">Matematické vzorce:</span>
                        <span className="font-semibold text-foreground">{metrics.formalization.equationsCount}</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-border/50">
                        <span className="text-muted-foreground">Programový kód & pseudokód:</span>
                        <span className="font-semibold text-foreground">{metrics.formalization.codeBlocksCount} blokov</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Hustota formalizácie:</span>
                        <span className="font-semibold text-foreground">{metrics.formalization.codeDensityPer10k + metrics.formalization.equationsDensityPer10k} / 10k slov</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Document Overview / Metadata */}
              <div className="p-3 rounded-xl border bg-card/70 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                      <FileText className="size-3.5 text-cyan-500" />
                      Rozsah & Objem textu
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      {totalWords.toLocaleString()} slov
                    </Badge>
                  </div>

                  <div className="space-y-1 mt-2 text-[10px]">
                    <div className="flex justify-between py-0.5 border-b border-border/50">
                      <span className="text-muted-foreground">Znaky:</span>
                      <span className="font-semibold text-foreground">{(plan.qualityReport?.totalChars || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-border/50">
                      <span className="text-muted-foreground">Počet kapitol:</span>
                      <span className="font-semibold text-foreground">{plan.qualityReport?.sectionCount || plan.detectedSections.length}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">Zoznam literatúry:</span>
                      <span className="font-semibold text-foreground">{plan.citationAvailability}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* IMRaD & Research Lifecycle Completeness Bar */}
          {metrics?.imrad && (
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  Kontrola fáz vedeckej metodológie (IMRaD)
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold bg-card">
                  Pokrytie: {metrics.imrad.completenessScore}%
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
                {metrics.imrad.phases.map((p) => (
                  <div
                    key={p.key}
                    className={`p-2 rounded-lg border text-[10px] flex flex-col justify-between ${
                      p.status === "complete"
                        ? "bg-green-500/10 border-green-500/30 text-green-800 dark:text-green-300"
                        : p.status === "partial"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                        : "bg-muted/40 border-dashed text-muted-foreground opacity-60"
                    }`}
                  >
                    <span className="font-semibold truncate block" title={p.name}>
                      {p.name.split(" ")[1] || p.name}
                    </span>
                    <div className="flex items-center justify-between pt-1 text-[9px]">
                      <span>{p.percentage}%</span>
                      <span>{p.status === "complete" ? "✓" : p.status === "partial" ? "~" : "✗"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reporting Guideline Selection */}
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                <span className="text-[11px] font-bold uppercase tracking-wider">AI-assisted reporting guideline pre-check</span>
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

          {/* Hierarchical Interactive Table of Contents (TOC) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Hash className="size-3.5 text-primary" />
                Hierarchická štruktúra kapitol ({plan.tocTree?.length || plan.detectedSections.length} hlavných vetiev)
              </span>

              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Search className="size-3 absolute left-2 top-2 text-muted-foreground" />
                  <Input
                    value={tocSearch}
                    onChange={(e) => setTocSearch(e.target.value)}
                    placeholder="Hľadať kapitolu..."
                    className="h-7 text-[11px] pl-6 w-36 sm:w-48 bg-background"
                  />
                </div>

                <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border">
                  <button
                    onClick={() => setTocFilter("all")}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      tocFilter === "all" ? "bg-card shadow-2xs text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Všetky
                  </button>
                  <button
                    onClick={() => setTocFilter("major")}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      tocFilter === "major" ? "bg-card shadow-2xs text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Iba hlavné
                  </button>
                  <button
                    onClick={() => setTocFilter("warnings")}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      tocFilter === "warnings" ? "bg-card shadow-2xs text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Varovania
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card/60 p-2 max-h-56 overflow-y-auto space-y-1 divide-y divide-border/30">
              {filteredTOC.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-4">
                  Nenašli sa žiadne kapitoly vyhovujúce zadanému filtru.
                </p>
              ) : (
                filteredTOC.map((node) => (
                  <TOCNodeRow
                    key={node.id}
                    node={node}
                    expandedNodes={expandedNodes}
                    onToggle={toggleNode}
                  />
                ))
              )}
            </div>
          </div>

          {/* Rubric Applicability Matrix */}
          {plan.applicableCriteria && plan.applicableCriteria.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Aplikovateľné kritériá rubriky ({plan.recommendedRubric || "sk-academic-v1"})</span>
                <span className="text-[10px] text-muted-foreground font-normal">Váha / Status</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {plan.applicableCriteria.map((c) => (
                  <div
                    key={c.criterionKey}
                    className={`flex items-center justify-between p-2 rounded-lg border text-[11px] ${
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

          {/* Limitations & Warnings */}
          {plan.limitations.length > 0 && (
            <div className="p-3 rounded-xl border border-amber-300/40 bg-amber-500/5 space-y-1">
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

        {/* Action Footer */}
        <div className="p-4 pt-3 pb-3 border-t bg-muted/10 flex items-center justify-between">
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

function TOCNodeRow({
  node,
  expandedNodes,
  onToggle,
}: {
  node: TOCNode
  expandedNodes: Record<string, boolean>
  onToggle: (id: string) => void
}) {
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedNodes[node.id] ?? false

  const kindColors: Record<string, string> = {
    introduction: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
    literature: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20",
    methodology: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    results: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    discussion: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    conclusion: "text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20",
    references: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    appendix: "text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20",
    preamble: "text-muted-foreground bg-muted border-border",
    unknown: "text-muted-foreground bg-muted border-border",
  }

  return (
    <div className="pt-1">
      <div
        className="flex items-center justify-between p-1 rounded-md hover:bg-muted/40 transition-colors text-[11px]"
        style={{ paddingLeft: `${(node.level - 1) * 12 + 4}px` }}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {hasChildren ? (
            <button
              onClick={() => onToggle(node.id)}
              className="p-0.5 hover:bg-muted rounded text-muted-foreground"
            >
              {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
          ) : (
            <span className="size-3 inline-block" />
          )}

          <span className="font-medium text-foreground truncate" title={node.title}>
            {node.title}
          </span>

          {node.hasWarning && (
            <span className="text-amber-500 text-[9px] font-semibold" title="Krátka alebo prázdna sekcia">
              ⚠️
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`text-[8px] py-0 px-1 border capitalize ${kindColors[node.kind] || kindColors.unknown}`}>
            {node.kind}
          </Badge>
          <span className="text-[10px] font-mono text-muted-foreground w-16 text-right">
            {node.wordCount} s. ({node.percentOfTotal}%)
          </span>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <TOCNodeRow
              key={child.id}
              node={child}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

