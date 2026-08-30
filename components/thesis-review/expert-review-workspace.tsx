"use client"

/**
 * ExpertReviewWorkspace — Master split-view interface for professional peer review
 * and evidence-anchored thesis assessment.
 *
 * Left: Source Document & Evidence Viewer (synced quote highlighting & search)
 * Right: Interactive Review Workspace & Triage (Executive summary, Prioritized queue,
 *        Reporting guidelines audit, Human-in-the-loop decision, Multi-format export).
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useThesisReviewStore } from "./use-thesis-review-store"
import { EvidenceViewer } from "./evidence-viewer"
import { FindingCard } from "./finding-card"
import { ReportingChecklistPanel } from "./reporting-checklist-panel"
import { DefenseQuestionsPanel } from "./defense-questions-panel"
import { CitationIssuesPanel } from "./citation-issues-panel"
import { ThesisCriteriaCard } from "./thesis-criteria-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileDown,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Copy,
  PlusCircle,
  Sparkles,
  Loader2,
  FileCheck,
  Eye,
  SlidersHorizontal,
  Lock,
  Columns,
  Search,
  Keyboard,
  ShieldCheck,
  Award,
  AlertCircle,
  HelpCircle,
} from "lucide-react"
import {
  formatReviewToMarkdown,
  formatReviewToPlainText,
} from "@/lib/export/review-formatters"
import { generateThesisReviewDocx } from "@/lib/docx/generator-review"
import { composeFullReviewNarrative } from "@/lib/ai/review-composer"
import { cn } from "@/lib/utils"
import { sortFindingsByPriority, calculateFindingPriority } from "@/lib/ai/review-priorities"
import { THESIS_CRITERIA, type ThesisSection, type ReviewLanguage } from "@/lib/ai/thesis-rubric"
import type { ReviewFinding, ReviewSeverity, FindingStatus, FindingAudience } from "@/lib/ai/review-types"

interface Props {
  workspaceId: string
  sourceMarkdown?: string
}

type FilterTab = "priority" | "unreviewed" | "major" | "missing_evidence" | "reporting" | "export" | "resolved" | "all"

export function ExpertReviewWorkspace({ workspaceId, sourceMarkdown = "" }: Props) {
  const {
    activeReview,
    sourceMarkdown: storeSourceMarkdown,
    isLoadingSource,
    selectedEvidence,
    setSelectedEvidence,
    updateReviewLocally,
    acceptFinding,
    rejectFinding,
    editFinding,
    addCustomFinding,
    toggleFindingExport,
    confirmFinalDecision,
    saveReview,
    exportReviewPdf,
    isSaving,
    isExporting,
    setActiveReview,
  } = useThesisReviewStore()

  const [activeTab, setActiveTab] = useState<FilterTab>("priority")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedAudience, setSelectedAudience] = useState<string>("all")
  const [mobileView, setMobileView] = useState<"document" | "review">("review")
  const [selectedFindingIndex, setSelectedFindingIndex] = useState<number>(0)
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  const [showFinalDecisionModal, setShowFinalDecisionModal] = useState(false)
  const [showNarrativeModal, setShowNarrativeModal] = useState(false)

  const [isAddingFinding, setIsAddingFinding] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newExplanation, setNewExplanation] = useState("")
  const [newCategory, setNewCategory] = useState<any>("methodology")
  const [newSeverity, setNewSeverity] = useState<ReviewSeverity>("major")
  const [newRecommendation, setNewRecommendation] = useState("")
  const [newAudience, setNewAudience] = useState<FindingAudience>("author")

  const [confirmedGrade, setConfirmedGrade] = useState(activeReview?.finalGrade || activeReview?.grade || "B")
  const [confirmedRecommendation, setConfirmedRecommendation] = useState(
    activeReview?.finalRecommendation || activeReview?.recommendation || "Prácu odporúčam na obhajobu."
  )

  const [copiedNotification, setCopiedNotification] = useState(false)
  const [isExportingDocx, setIsExportingDocx] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const effectiveSourceMarkdown = storeSourceMarkdown || sourceMarkdown
  const lang: ReviewLanguage = activeReview?.language || "sk"
  const rawFindings = activeReview?.findings

  // Memoize findings
  const findings = useMemo(() => rawFindings ?? [], [rawFindings])

  // Count stats for queue
  const majorCount = findings.filter((f) => f.severity === "critical" || f.severity === "major").length
  const unreviewedCount = findings.filter((f) => f.status === "unreviewed").length
  const missingEvidenceCount = findings.filter(
    (f) => f.evidenceState === "unverified" || f.evidenceState === "stale" || f.evidenceState === "ambiguous" || !f.evidence?.every((e) => e.verified)
  ).length
  const reportingCount = findings.filter((f) => f.category === "reproducibility" || f.category === "statistics").length
  const exportCount = findings.filter((f) => f.includeInExport !== false && f.status !== "rejected").length
  const resolvedCount = findings.filter((f) => f.status === "accepted" || f.status === "resolved" || f.status === "rejected").length
  const openMajorBlockers = findings.filter(
    (f) => (f.severity === "critical" || f.severity === "major") && f.status === "unreviewed"
  ).length

  // Filter and prioritize findings stream
  const filteredFindings = useMemo(() => {
    let list = [...findings]

    // 1. Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.explanation.toLowerCase().includes(q) ||
          f.recommendation?.toLowerCase().includes(q) ||
          f.reviewerNotes?.toLowerCase().includes(q) ||
          f.evidence?.some((e) => e.quote.toLowerCase().includes(q))
      )
    }

    // 2. Category filter
    if (selectedCategory !== "all") {
      list = list.filter((f) => f.category === selectedCategory)
    }

    // 3. Audience filter
    if (selectedAudience !== "all") {
      list = list.filter((f) => (f.audience || "author") === selectedAudience)
    }

    // 4. Tab filter
    if (activeTab === "unreviewed") {
      return list.filter((f) => f.status === "unreviewed")
    }
    if (activeTab === "major") {
      return list.filter((f) => f.severity === "critical" || f.severity === "major")
    }
    if (activeTab === "missing_evidence") {
      return list.filter(
        (f) => f.evidenceState === "unverified" || f.evidenceState === "stale" || f.evidenceState === "ambiguous" || !f.evidence?.every((e) => e.verified)
      )
    }
    if (activeTab === "reporting") {
      return list.filter((f) => f.category === "reproducibility" || f.category === "statistics")
    }
    if (activeTab === "export") {
      return list.filter((f) => f.includeInExport !== false && f.status !== "rejected")
    }
    if (activeTab === "resolved") {
      return list.filter((f) => f.status === "accepted" || f.status === "resolved" || f.status === "rejected")
    }
    if (activeTab === "priority") {
      return sortFindingsByPriority(list, lang)
    }

    return list
  }, [findings, activeTab, searchQuery, selectedCategory, selectedAudience, lang])

  // Keyboard navigation shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input or textarea
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        if (e.key === "Escape") {
          target.blur()
        }
        return
      }

      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (e.key === "?") {
        e.preventDefault()
        setShowShortcutsModal((prev) => !prev)
        return
      }

      if (filteredFindings.length === 0) return

      const current = filteredFindings[selectedFindingIndex] || filteredFindings[0]

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedFindingIndex((prev) => Math.min(prev + 1, filteredFindings.length - 1))
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedFindingIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "a" && current) {
        e.preventDefault()
        acceptFinding(current.id)
      } else if (e.key === "r" && current) {
        e.preventDefault()
        rejectFinding(current.id)
      } else if (e.key === "v" && current?.evidence?.[0]) {
        e.preventDefault()
        setSelectedEvidence(current.evidence[0])
      }
    },
    [filteredFindings, selectedFindingIndex, acceptFinding, rejectFinding, setSelectedEvidence]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  if (!activeReview) return null

  const handleCreateCustomFinding = () => {
    if (!newTitle.trim() || !newExplanation.trim()) return
    addCustomFinding({
      title: newTitle.trim(),
      explanation: newExplanation.trim(),
      recommendation: newRecommendation.trim(),
      category: newCategory,
      severity: newSeverity,
      confidence: 1.0,
      evidence: selectedEvidence ? [selectedEvidence] : [],
      status: "accepted",
      audience: newAudience,
      includeInExport: true,
    })
    setNewTitle("")
    setNewExplanation("")
    setNewRecommendation("")
    setIsAddingFinding(false)
  }

  const handleCopyClipboard = async () => {
    const text = formatReviewToPlainText(activeReview, { onlyAcceptedFindings: true })
    await navigator.clipboard.writeText(text)
    setCopiedNotification(true)
    setTimeout(() => setCopiedNotification(false), 2500)
  }

  const handleDownloadMarkdown = () => {
    const md = formatReviewToMarkdown(activeReview, { onlyAcceptedFindings: true })
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `posudok-${activeReview.studentName.replace(/\s+/g, "-")}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadDocx = async () => {
    setIsExportingDocx(true)
    try {
      const blob = await generateThesisReviewDocx(activeReview)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `posudok-${activeReview.studentName.replace(/\s+/g, "-")}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("DOCX generation failed:", err)
    } finally {
      setIsExportingDocx(false)
    }
  }

  const handleDownloadTex = async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review/${activeReview.id}/export?format=tex`)
      if (!res.ok) throw new Error("Failed to export TeX")
      const tex = await res.text()
      const blob = new Blob([tex], { type: "text/x-tex;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `posudok-${activeReview.studentName.replace(/\s+/g, "-")}.tex`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("TeX export failed:", err)
    }
  }

  const handleConfirmDecision = () => {
    confirmFinalDecision(confirmedGrade, confirmedRecommendation)
    setShowFinalDecisionModal(false)
    void saveReview(workspaceId, activeReview.id)
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* Top Navbar & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between border-b px-4 py-2.5 bg-background/95 shrink-0 gap-2">
        {/* Left: Back & Title info */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveReview(null)}
            className="text-xs h-7 shrink-0"
          >
            ← Späť
          </Button>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm truncate">{activeReview.studentName}</span>
              <Badge variant="secondary" className="text-[10px] uppercase font-mono shrink-0">
                {activeReview.reviewKind || activeReview.thesisType}
              </Badge>
              {activeReview.grade && (
                <Badge
                  variant={activeReview.confirmedAt ? "default" : "outline"}
                  className="text-xs font-bold shrink-0 gap-1"
                >
                  {activeReview.confirmedAt && <CheckCircle2 className="h-3 w-3 text-green-400" />}
                  ECTS: {activeReview.grade}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate max-w-xs sm:max-w-md">
              {activeReview.thesisTitle}
            </p>
          </div>
        </div>

        {/* Center: Mobile view toggle */}
        <div className="flex lg:hidden items-center rounded-lg border bg-muted p-0.5">
          <button
            onClick={() => setMobileView("document")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
              mobileView === "document" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Dokument
          </button>
          <button
            onClick={() => setMobileView("review")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
              mobileView === "review" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Posudok ({findings.length})
          </button>
        </div>

        {/* Right: Decision confirmation, Save & Multi-Format Export */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowShortcutsModal(true)}
            className="text-xs h-8 w-8 p-0 text-muted-foreground hover:text-foreground hidden sm:inline-flex items-center justify-center rounded-lg border-border/80"
            title="Klávesové skratky (?)"
          >
            <Keyboard className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFinalDecisionModal(true)}
            className={cn(
              "text-xs h-8 px-3 gap-1.5 font-medium rounded-lg shadow-2xs transition-all",
              activeReview.confirmedAt
                ? "border-emerald-500/40 text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                : "border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
            )}
          >
            <Award className={cn("h-3.5 w-3.5", activeReview.confirmedAt ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")} />
            {activeReview.confirmedAt ? "Rozhodnutie potvrdené ✓" : "Potvrdiť známku"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => saveReview(workspaceId, activeReview.id)}
            disabled={isSaving}
            className="text-xs h-8 px-3 gap-1.5 font-medium rounded-lg border-border/80 hover:bg-muted/80 shadow-2xs"
          >
            <Save className="h-3.5 w-3.5 text-muted-foreground" />
            {isSaving ? "Ukladám..." : "Uložiť"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm" className="text-xs h-8 px-3.5 gap-1.5 font-semibold bg-[#8B2635] hover:bg-[#741E2B] text-white rounded-lg shadow-xs transition-all cursor-pointer">
                  <FileDown className="h-3.5 w-3.5" />
                  Exportovať posudok
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56 text-xs">
              <DropdownMenuItem onClick={() => setShowNarrativeModal(true)}>
                <FileText className="h-4 w-4 mr-2 text-primary" />
                Náhľad uceleného posudku (12 sekcií)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => exportReviewPdf(workspaceId, activeReview.id)} disabled={isExporting}>
                <FileCheck className="h-4 w-4 mr-2 text-primary" />
                {isExporting ? "Kompilujem PDF..." : "Exportovať PDF (LaTeX)"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadTex}>
                <FileText className="h-4 w-4 mr-2 text-primary" />
                Stiahnuť zdrojový LaTeX (.TEX)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadDocx} disabled={isExportingDocx}>
                <FileText className="h-4 w-4 mr-2 text-blue-600" />
                {isExportingDocx ? "Generujem Word..." : "Stiahnuť Word (.DOCX)"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopyClipboard}>
                <Copy className="h-4 w-4 mr-2 text-muted-foreground" />
                {copiedNotification ? "Skopírované! ✓" : "Kopírovať text do schránky"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadMarkdown}>
                <FileDown className="h-4 w-4 mr-2 text-muted-foreground" />
                Stiahnuť Markdown (.MD)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Diagnostics Alert Banner if recovery fallbacks were applied */}
      {activeReview.diagnostics && activeReview.diagnostics.corruptedFields.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs flex items-center justify-between text-amber-900 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Niektoré polia posudku boli obnovené so záchranným formátom (
              {activeReview.diagnostics.corruptedFields.join(", ")}). Vaša manuálna práca bola zachovaná.
            </span>
          </div>
        </div>
      )}

      {/* Split Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Document Source & Evidence Viewer */}
        <div
          className={`w-full lg:w-[48%] h-full flex flex-col no-scrollbar ${
            mobileView === "document" ? "flex" : "hidden lg:flex"
          }`}
        >
          <EvidenceViewer
            workspaceId={workspaceId}
            sourceMarkdown={effectiveSourceMarkdown}
            selectedEvidence={selectedEvidence}
            isLoading={isLoadingSource}
            onAddFindingFromSelection={(quote, heading) => {
              setSelectedEvidence({ quote, sectionHeading: heading, verified: true, state: "verified" })
              setIsAddingFinding(true)
              setNewTitle(`Pripomienka k sekcii ${heading || "v texte"}`)
            }}
          />
        </div>

        {/* Right Panel: Review Workspace & Findings Stream */}
        <div
          className={`w-full lg:w-[52%] h-full flex flex-col overflow-y-auto p-4 sm:p-6 space-y-6 ${
            mobileView === "review" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Executive Overview Card */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold">1. Zhrnutie práce a hlavný prínos</h3>
              </div>
              {activeReview.grade && (
                <Badge variant="outline" className="font-bold text-xs">
                  ECTS: {activeReview.grade}
                </Badge>
              )}
            </div>

            <Textarea
              value={activeReview.summary ?? ""}
              onChange={(e) => updateReviewLocally({ summary: e.target.value })}
              placeholder="Stručne zhrňte ciele, metódy a dosiahnuté výsledky práce..."
              className="text-xs min-h-[70px] leading-relaxed"
            />

            {/* Key Strengths list */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Silné stránky práce (Key Strengths):
              </label>
              {(activeReview.strengths || []).map((str, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-foreground/90 pl-1">
                  <span className="text-primary font-bold">•</span>
                  <span>{str}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reporting Guidelines Compliance (CONSORT / PRISMA / STROBE / ML) */}
          {activeReview.reportingStandard && activeReview.reportingStandard !== "none" && (
            <ReportingChecklistPanel
              standard={activeReview.reportingStandard}
              checks={activeReview.reportingGuidelineChecks || []}
            />
          )}

          {/* Structured Findings Stream & Triage Header */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                  <span>Štruktúrované pripomienky ({findings.length})</span>
                  {openMajorBlockers > 0 && (
                    <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                      {openMajorBlockers} otvorených zásadných
                    </Badge>
                  )}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Zásadné metodologické body a drobné pripomienky viazané na overené dôkazy.
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs font-semibold gap-1"
                onClick={() => setIsAddingFinding(true)}
              >
                <PlusCircle className="h-3.5 w-3.5 text-primary" />
                Pridať pripomienku
              </Button>
            </div>

            {/* Search and Filters Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrovať v pripomienkach a dôkazoch (/)"
                  className="h-7 text-xs pl-7"
                />
              </div>

              <Select value={selectedCategory} onValueChange={(val) => setSelectedCategory(val || "all")}>
                <SelectTrigger className="h-7 text-xs w-32">
                  <SelectValue placeholder="Kategória" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Všetky kategórie</SelectItem>
                  <SelectItem value="methodology" className="text-xs">Metodológia</SelectItem>
                  <SelectItem value="results" className="text-xs">Výsledky</SelectItem>
                  <SelectItem value="statistics" className="text-xs">Štatistika</SelectItem>
                  <SelectItem value="literature" className="text-xs">Literatúra</SelectItem>
                  <SelectItem value="reproducibility" className="text-xs">Reprodukovateľnosť</SelectItem>
                  <SelectItem value="formal" className="text-xs">Formálna úprava</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedAudience} onValueChange={(val) => setSelectedAudience(val || "all")}>
                <SelectTrigger className="h-7 text-xs w-28">
                  <SelectValue placeholder="Príjemca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Všetci</SelectItem>
                  <SelectItem value="author" className="text-xs">Pre autora</SelectItem>
                  <SelectItem value="editor" className="text-xs">Dôverné</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Tabs Bar (Segmented Pill Style) */}
            <div className="flex items-center gap-1 p-1 bg-muted/50 dark:bg-muted/30 rounded-xl border border-border/50 overflow-x-auto no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("priority")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer",
                  activeTab === "priority"
                    ? "bg-background text-foreground font-semibold shadow-2xs border border-border/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                Prioritná fronta
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unreviewed")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                  activeTab === "unreviewed"
                    ? "bg-background text-amber-800 dark:text-amber-300 font-semibold shadow-2xs border border-amber-500/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <span>Na posúdenie</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                  activeTab === "unreviewed" ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold" : "bg-muted text-muted-foreground"
                )}>
                  {unreviewedCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("major")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                  activeTab === "major"
                    ? "bg-background text-red-700 dark:text-red-300 font-semibold shadow-2xs border border-red-500/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <span>Zásadné</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                  activeTab === "major" ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-muted text-muted-foreground"
                )}>
                  {majorCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("missing_evidence")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                  activeTab === "missing_evidence"
                    ? "bg-background text-purple-700 dark:text-purple-300 font-semibold shadow-2xs border border-purple-500/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <span>Chýbajúci dôkaz</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                  activeTab === "missing_evidence" ? "bg-purple-500/15 text-purple-700 dark:text-purple-300" : "bg-muted text-muted-foreground"
                )}>
                  {missingEvidenceCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("reporting")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                  activeTab === "reporting"
                    ? "bg-background text-foreground font-semibold shadow-2xs border border-border/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <span>Reporting</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-muted text-muted-foreground">
                  {reportingCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("export")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                  activeTab === "export"
                    ? "bg-background text-foreground font-semibold shadow-2xs border border-border/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <span>V exporte</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-muted text-muted-foreground">
                  {exportCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("resolved")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                  activeTab === "resolved"
                    ? "bg-background text-emerald-700 dark:text-emerald-300 font-semibold shadow-2xs border border-emerald-500/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <span>Vyriešené</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                  activeTab === "resolved" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                )}>
                  {resolvedCount}
                </span>
              </button>
            </div>

            {/* Inline Custom Finding Form */}
            {isAddingFinding && (
              <div className="rounded-lg border-2 border-primary/40 bg-card p-4 space-y-3 shadow-md animate-in fade-in">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-xs flex items-center gap-1.5 text-primary">
                    <PlusCircle className="h-4 w-4" /> Nová odborná pripomienka
                  </span>
                  <div className="flex items-center gap-2">
                    <Select value={newSeverity} onValueChange={(v) => setNewSeverity(v as ReviewSeverity)}>
                      <SelectTrigger className="h-6 text-[11px] w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical" className="text-xs font-bold text-destructive">Kritická (Critical)</SelectItem>
                        <SelectItem value="major" className="text-xs font-bold text-orange-600">Zásadná (Major)</SelectItem>
                        <SelectItem value="minor" className="text-xs font-bold text-blue-600">Drobná (Minor)</SelectItem>
                        <SelectItem value="suggestion" className="text-xs text-muted-foreground">Návrh (Suggestion)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Názov pripomienky (napr. Chýbajúce porovnanie s baseline modelmi)"
                  className="text-xs font-semibold"
                />

                <Textarea
                  value={newExplanation}
                  onChange={(e) => setNewExplanation(e.target.value)}
                  placeholder="Podrobné odborné odôvodnenie..."
                  className="text-xs min-h-[60px]"
                />

                <Input
                  value={newRecommendation}
                  onChange={(e) => setNewRecommendation(e.target.value)}
                  placeholder="Odporúčaná náprava pre autora (voliteľné)"
                  className="text-xs"
                />

                {selectedEvidence?.quote && (
                  <div className="rounded bg-muted/40 p-2 text-[11px] italic font-serif border-l-2 border-primary">
                    Dôkaz: &ldquo;{selectedEvidence.quote.slice(0, 120)}...&rdquo;
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setIsAddingFinding(false)} className="h-7 text-xs">
                    Zrušiť
                  </Button>
                  <Button size="sm" onClick={handleCreateCustomFinding} className="h-7 text-xs font-semibold">
                    Pridať pripomienku
                  </Button>
                </div>
              </div>
            )}

            {/* Findings List */}
            {filteredFindings.length > 0 ? (
              <div className="space-y-3">
                {filteredFindings.map((finding, idx) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    lang={lang}
                    isSelected={idx === selectedFindingIndex}
                    onSelectEvidence={(ev) => setSelectedEvidence(ev)}
                    onAccept={acceptFinding}
                    onReject={rejectFinding}
                    onEdit={editFinding}
                    onToggleExport={toggleFindingExport}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                V tomto filtri nie sú žiadne pripomienky.
              </div>
            )}
          </div>

          {/* Standard Criteria Cards fallback if no discrete findings */}
          {findings.length === 0 && activeReview.sections?.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Hodnotenie kritérií záverečnej práce
              </h3>
              {THESIS_CRITERIA.filter((c) => c.category !== "defense").map((criterion) => {
                const sec = activeReview.sections.find(
                  (s) => s.criterionId === criterion.id || s.sectionId === criterion.id
                ) ?? {
                  id: criterion.id,
                  sectionId: criterion.id,
                  criterionId: criterion.id,
                  text: "",
                  rating: "pending" as any,
                  suggestions: [],
                }
                return (
                  <ThesisCriteriaCard
                    key={criterion.id}
                    criterion={criterion}
                    section={sec}
                    lang={lang}
                    workspaceId={workspaceId}
                    reviewId={activeReview.id}
                    onUpdate={(updates) => {
                      const updatedSections = activeReview.sections.map((s) =>
                        s.criterionId === criterion.id ? { ...s, ...updates } : s
                      )
                      updateReviewLocally({ sections: updatedSections })
                    }}
                  />
                )
              })}
            </div>
          )}

          {/* Questions for Authors / Defense Questions Panel */}
          <DefenseQuestionsPanel
            questions={activeReview.questionsForAuthors || activeReview.defenseQuestions || []}
            lang={lang}
            onUpdateQuestions={(newQuestions) => {
              updateReviewLocally({
                questionsForAuthors: newQuestions,
                defenseQuestions: newQuestions,
              })
            }}
          />

          {/* Confidential Comments for Editor / Committee */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 border-dashed">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div>
                <h3 className="text-xs font-bold text-foreground">
                  Dôverné komentáre pre editora / komisiu
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Tieto poznámky nebudú odoslané autorovi článku (COPE štandard).
                </p>
              </div>
            </div>

            <Textarea
              value={activeReview.confidentialComments ?? ""}
              onChange={(e) => updateReviewLocally({ confidentialComments: e.target.value })}
              placeholder="Uveďte interné odporúčanie, podozrenia z etického pochybenia alebo poznámky k prijateľnosti..."
              className="text-xs min-h-[60px]"
            />
          </div>

          {/* Academic Connector Citation Audit */}
          <CitationIssuesPanel
            issues={activeReview.citationIssues || []}
            lang={lang}
            workspaceId={workspaceId}
          />
        </div>
      </div>

      {/* Decision Confirmation Modal (Human in the loop) */}
      {showFinalDecisionModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-sm">Finálne rozhodnutie recenzenta</h3>
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowFinalDecisionModal(false)}>
                ✕
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Systém nikdy neuzatvára posudok automaticky. Skontrolujte a výslovne potvrďte navrhované hodnotenie.
            </p>

            <div className="space-y-3 bg-muted/30 p-3 rounded-lg border text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">AI návrh známky:</span>
                <Badge variant="outline" className="font-mono font-bold">
                  {activeReview.suggestedGrade || activeReview.grade || "N/A"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Otvorené zásadné pripomienky:</span>
                <span className={`font-bold ${openMajorBlockers > 0 ? "text-destructive" : "text-green-600"}`}>
                  {openMajorBlockers}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold">Finálna ECTS známka:</label>
              <Select value={confirmedGrade} onValueChange={(val) => setConfirmedGrade(val || "B")}>
                <SelectTrigger className="h-8 text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A" className="text-xs font-bold">A — Výborne (91-100 b)</SelectItem>
                  <SelectItem value="B" className="text-xs font-bold">B — Veľmi dobre (81-90 b)</SelectItem>
                  <SelectItem value="C" className="text-xs font-bold">C — Dobre (71-80 b)</SelectItem>
                  <SelectItem value="D" className="text-xs font-bold">D — Uspokojivo (61-70 b)</SelectItem>
                  <SelectItem value="E" className="text-xs font-bold">E — Dostatočne (51-60 b)</SelectItem>
                  <SelectItem value="FX" className="text-xs font-bold text-destructive">FX — Nedostatočne (0-50 b)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold">Formálne odporúčanie k obhajobe:</label>
              <Input
                value={confirmedRecommendation}
                onChange={(e) => setConfirmedRecommendation(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button size="sm" variant="outline" onClick={() => setShowFinalDecisionModal(false)} className="text-xs">
                Zrušiť
              </Button>
              <Button size="sm" onClick={handleConfirmDecision} className="text-xs font-bold gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Potvrdiť a uložiť
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Narrative Review Synthesis Modal */}
      {showNarrativeModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-bold text-sm">Ucelený syntetizovaný posudok (12 sekcií)</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Zostavené z {(activeReview.findings ?? []).filter((f) => f.includeInExport !== false && f.status !== "rejected").length} schválených pripomienok.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowNarrativeModal(false)}>
                ✕
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs font-serif leading-relaxed">
              {composeFullReviewNarrative(activeReview, "author", lang).sections.map((sec) => (
                <div key={sec.id} className="p-3 rounded-lg border bg-muted/20 space-y-1.5 font-sans">
                  <h4 className="font-bold text-xs text-foreground tracking-tight">{sec.title}</h4>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-foreground/90 leading-relaxed">
                    {sec.content}
                  </pre>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t shrink-0">
              <span className="text-[11px] text-muted-foreground">
                Rešpektuje etické štandardy COPE a anonymitu recenzenta.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const full = composeFullReviewNarrative(activeReview, "author", lang).plainText
                    navigator.clipboard.writeText(full)
                    setCopiedNotification(true)
                    setTimeout(() => setCopiedNotification(false), 2000)
                  }}
                  className="text-xs gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedNotification ? "Skopírované! ✓" : "Kopírovať celý text"}
                </Button>
                <Button size="sm" onClick={() => setShowNarrativeModal(false)} className="text-xs">
                  Zavrieť
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-sm w-full p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-xs">Klávesové skratky</h3>
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowShortcutsModal(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">Ďalšia pripomienka</span>
                <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">J</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">Predchádzajúca pripomienka</span>
                <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">K</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">Prijať pripomienku</span>
                <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">A</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">Odmietnuť pripomienku</span>
                <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">R</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">Zobraziť dôkaz v texte</span>
                <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">V</kbd>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Hľadať v pripomienkach</span>
                <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">/</kbd>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="secondary" onClick={() => setShowShortcutsModal(false)} className="text-xs">
                Zavrieť
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
