"use client"

/**
 * ExpertReviewWorkspace — Master split-view interface for professional peer review
 * and evidence-anchored thesis assessment.
 *
 * Left: Source Document & Evidence Viewer (synced quote highlighting & search)
 * Right: Interactive Review Workspace & Triage (Executive summary, Major/Minor findings,
 *        Reporting guidelines audit, Questions for authors, Multi-format export).
 */

import { useState, useMemo, useEffect } from "react"
import { useThesisReviewStore } from "./use-thesis-review-store"
import { EvidenceViewer } from "./evidence-viewer"
import { FindingCard } from "./finding-card"
import { ReportingChecklistPanel } from "./reporting-checklist-panel"
import { DefenseQuestionsPanel } from "./defense-questions-panel"
import { CitationIssuesPanel } from "./citation-issues-panel"
import { ThesisScoreAnalytics } from "./thesis-score-analytics"
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
} from "lucide-react"
import {
  formatReviewToMarkdown,
  formatReviewToPlainText,
} from "@/lib/export/review-formatters"
import { generateThesisReviewDocx } from "@/lib/docx/generator-review"
import { THESIS_CRITERIA, type ThesisSection, type ReviewLanguage } from "@/lib/ai/thesis-rubric"
import type { ReviewFinding, ReviewSeverity } from "@/lib/ai/review-types"

interface Props {
  workspaceId: string
  sourceMarkdown?: string
}

type FilterTab = "all" | "major" | "minor" | "unreviewed" | "accepted"

export function ExpertReviewWorkspace({ workspaceId, sourceMarkdown = "" }: Props) {
  const {
    activeReview,
    selectedEvidence,
    setSelectedEvidence,
    updateReviewLocally,
    acceptFinding,
    rejectFinding,
    editFinding,
    addCustomFinding,
    toggleFindingExport,
    saveReview,
    exportReviewPdf,
    isSaving,
    isExporting,
    setActiveReview,
  } = useThesisReviewStore()

  const [activeTab, setActiveTab] = useState<FilterTab>("all")
  const [mobileView, setMobileView] = useState<"document" | "review">("review")
  const [isAddingFinding, setIsAddingFinding] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newExplanation, setNewExplanation] = useState("")
  const [newCategory, setNewCategory] = useState<any>("methodology")
  const [newSeverity, setNewSeverity] = useState<ReviewSeverity>("major")
  const [newRecommendation, setNewRecommendation] = useState("")
  const [copiedNotification, setCopiedNotification] = useState(false)
  const [isExportingDocx, setIsExportingDocx] = useState(false)

  const lang: ReviewLanguage = activeReview?.language || "sk"
  const rawFindings = activeReview?.findings

  // Memoize findings array to keep hook dependencies stable
  const findings = useMemo(() => rawFindings ?? [], [rawFindings])

  // Count stats
  const majorCount = findings.filter((f) => f.severity === "critical" || f.severity === "major").length
  const minorCount = findings.filter((f) => f.severity === "minor" || f.severity === "suggestion").length
  const unreviewedCount = findings.filter((f) => f.status === "unreviewed").length
  const acceptedCount = findings.filter((f) => f.status === "accepted" || f.status === "edited").length

  // Filtered findings stream
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (activeTab === "major") return f.severity === "critical" || f.severity === "major"
      if (activeTab === "minor") return f.severity === "minor" || f.severity === "suggestion"
      if (activeTab === "unreviewed") return f.status === "unreviewed"
      if (activeTab === "accepted") return f.status === "accepted" || f.status === "edited"
      return true
    })
  }, [findings, activeTab])

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
                <Badge variant="default" className="text-xs font-bold shrink-0">
                  {activeReview.grade}
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

        {/* Right: Save & Multi-Format Export */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => saveReview(workspaceId, activeReview.id)}
            disabled={isSaving}
            className="text-xs h-8 gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Ukladám..." : "Uložiť"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm" className="text-xs h-8 gap-1.5 font-semibold">
                  <FileDown className="h-3.5 w-3.5" />
                  Exportovať posudok
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56 text-xs">
              <DropdownMenuItem onClick={() => exportReviewPdf(workspaceId, activeReview.id)} disabled={isExporting}>
                <FileCheck className="h-4 w-4 mr-2 text-primary" />
                {isExporting ? "Kompilujem PDF..." : "Exportovať PDF (LaTeX)"}
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

      {/* Split Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Document Source & Evidence Viewer */}
        <div
          className={`w-full lg:w-[48%] h-full flex flex-col ${
            mobileView === "document" ? "flex" : "hidden lg:flex"
          }`}
        >
          <EvidenceViewer
            workspaceId={workspaceId}
            sourceMarkdown={sourceMarkdown}
            selectedEvidence={selectedEvidence}
            onAddFindingFromSelection={(quote, heading) => {
              setSelectedEvidence({ quote, sectionHeading: heading })
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

          {/* Structured Findings Stream */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold tracking-tight">
                  Štruktúrované pripomienky ({findings.length})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Zásadné metodologické body a drobné formulačné pripomienky viazané na dôkazy v texte.
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

            {/* Filter Tabs Bar */}
            <div className="flex flex-wrap items-center gap-1.5 border-b pb-2 text-xs">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  activeTab === "all" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Všetky ({findings.length})
              </button>
              <button
                onClick={() => setActiveTab("major")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  activeTab === "major" ? "bg-orange-600 text-white font-semibold" : "text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                }`}
              >
                Zásadné / Major ({majorCount})
              </button>
              <button
                onClick={() => setActiveTab("minor")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  activeTab === "minor" ? "bg-blue-600 text-white font-semibold" : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                }`}
              >
                Drobné / Minor ({minorCount})
              </button>
              <button
                onClick={() => setActiveTab("unreviewed")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  activeTab === "unreviewed" ? "bg-amber-600 text-white font-semibold" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Nepreskúmané ({unreviewedCount})
              </button>
              <button
                onClick={() => setActiveTab("accepted")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  activeTab === "accepted" ? "bg-green-600 text-white font-semibold" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Prijaté ({acceptedCount})
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
                    Dôkaz: &ldquo;{selectedEvidence.quote.slice(0, 100)}...&rdquo;
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
                {filteredFindings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    lang={lang}
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
    </div>
  )
}
