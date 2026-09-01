"use client"

/**
 * ThesisReviewPanel — main view for inspecting, editing, and exporting thesis reviews.
 *
 * Integrates:
 *  - Review metadata header & grade summary
 *  - Visual Score Analytics (Radar chart + ECTS breakdown)
 *  - Per-criterion cards (ThesisCriteriaCard with single-criterion AI regeneration)
 *  - Defense questions (DefenseQuestionsPanel)
 *  - Academic connector citation audit (CitationIssuesPanel)
 *  - Save & PDF Export buttons
 */

import { useEffect, useMemo, useState } from "react"
import { useThesisReviewStore, normalizeFormMetadataToThesisMetadata } from "./use-thesis-review-store"
import { ThesisMetadataPanel } from "./thesis-metadata-panel"
import { ExpertReviewWorkspace } from "./expert-review-workspace"
import { AnalysisPlanPanel } from "./analysis-plan-panel"
import { RagIndexStatusPanel, type RagStats } from "./rag-index-status-panel"
import { ThesisWorkflowStepper } from "./thesis-workflow-stepper"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useEditor } from "@/components/editor-store"
import {
  GraduationCap,
  Trash2,
  FileCheck2,
  Loader2,
  Sparkles,
} from "lucide-react"

interface Props {
  workspaceId: string
}

export function ThesisReviewPanel({ workspaceId }: Props) {
  const {
    reviews,
    activeReview,
    analysisPlan,
    setAnalysisPlan,
    generateReview,
    generateAnalysisPlan,
    isGenerating,
    isGeneratingPlan,
    generateError,
    clearErrors,
    sourceMarkdown: storeSourceMarkdown,
    isMetadataValid,
    formMetadata,
    confidentialityAgreed,
    setConfidentialityAgreed,
    skipCitationAudit,
    setSkipCitationAudit,
    professionalModeOverride,
    setProfessionalModeOverride,
    selectedFileId,
    loadReviews,
    loadReview,
    loadSourceDocument,
    deleteReview,
  } = useThesisReviewStore()

  // Real RAG index diagnostics, mirrored from RagIndexStatusPanel's own fetch
  const [ragStats, setRagStats] = useState<RagStats | null>(null)

  const project = useEditor((s) => s.project)

  // Construct source markdown text fallback from text assets and ingest files
  const assetSourceMarkdown = useMemo(() => {
    const assets = project?.assets ?? []
    const ingestFiles = project?.ingestFiles ?? []

    const textSnippets = (assets as any[])
      .filter((a) => a.kind === "text" || a.snippet)
      .map((a) => `## ${a.heading || a.filename}\n\n${a.snippet || ""}`)
      .join("\n\n")

    if (textSnippets.trim()) return textSnippets
    if (ingestFiles.length > 0) {
      return `# Dokument: ${ingestFiles[0].name}\n\n(Text dokumentu bol spracovaný cez MinerU pipeline)`
    }
    return ""
  }, [project])

  const effectiveMarkdown = storeSourceMarkdown || assetSourceMarkdown
  const ingestFiles = project?.ingestFiles ?? []
  const effectiveFileId = selectedFileId || ingestFiles[0]?.id || undefined
  const hasDocument = ingestFiles.length > 0 || !!effectiveMarkdown
  const isParsing = ingestFiles.some((f) => f.status === "parsing" || f.status === "queued")

  const chunkCount = ragStats?.totalChunks ?? 0
  const isIndexed = !!ragStats && chunkCount > 0 && ragStats.hnswIndexReady
  const currentStep = !hasDocument
    ? 1
    : isParsing || !isMetadataValid
    ? 2
    : !isIndexed
    ? 3
    : Boolean(analysisPlan)
    ? 3
    : Boolean(activeReview)
    ? 5
    : 4

  const isReadyToGenerate = Boolean(hasDocument && !isParsing && isMetadataValid)

  useEffect(() => {
    loadReviews(workspaceId)
    loadSourceDocument(workspaceId, effectiveFileId)
  }, [workspaceId, effectiveFileId, loadReviews, loadSourceDocument])

  const handleGenerate = async () => {
    clearErrors()
    await generateReview({
      workspaceId,
      sourceFileId: effectiveFileId,
      metadata: normalizeFormMetadataToThesisMetadata(formMetadata),
      skipCitationAudit,
      professionalMode: professionalModeOverride || formMetadata.reviewKind === "paper" || formMetadata.reportingStandard !== "none",
    })
  }

  const handlePreflight = async () => {
    clearErrors()
    await generateAnalysisPlan(
      workspaceId,
      normalizeFormMetadataToThesisMetadata(formMetadata),
      effectiveFileId
    )
  }

  if (activeReview) {
    return (
      <ExpertReviewWorkspace
        workspaceId={workspaceId}
        sourceMarkdown={effectiveMarkdown}
      />
    )
  }

  if (analysisPlan) {
    return (
      <div className="p-4 lg:p-6 overflow-y-auto h-full w-full bg-background">
        <AnalysisPlanPanel
          plan={analysisPlan}
          selectedStandard={analysisPlan.recommendedReportingGuideline}
          onSelectStandard={(std) => {
            setAnalysisPlan({ ...analysisPlan, recommendedReportingGuideline: std })
          }}
          onConfirmPlan={async () => {
            await generateReview({
              workspaceId,
              sourceFileId: effectiveFileId,
              metadata: {
                studentName: formMetadata.studentName || analysisPlan.documentTitle,
                thesisTitle: formMetadata.thesisTitle || analysisPlan.documentTitle,
                thesisType: formMetadata.thesisType || (analysisPlan.detectedType === "paper" ? "phd" : "master") as any,
                reviewerRole: formMetadata.reviewerRole || "opponent",
                reviewerName: formMetadata.reviewerName,
                institution: formMetadata.institution,
                department: formMetadata.department,
                language: analysisPlan.language || formMetadata.language,
                reviewKind: analysisPlan.detectedType || formMetadata.reviewKind,
                reportingStandard: analysisPlan.recommendedReportingGuideline,
              },
            })
            setAnalysisPlan(null)
          }}
          onCancel={() => setAnalysisPlan(null)}
          isGenerating={isGenerating}
        />
      </div>
    )
  }

  return (
    <div className="flex-1 h-full w-full min-h-0 overflow-y-auto p-4 lg:p-8 bg-background">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Odborný posudok záverečnej práce</h2>
          <p className="text-xs text-muted-foreground">
            Sémantická analýza rukopisu, ukotvenie dôkazov v texte a automatické hodnotenie podľa akademických štandardov.
          </p>
        </div>

        {/* Hero Action Card */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-2xs overflow-hidden">
          <div className="p-5 space-y-4">
            {isGenerating || isGeneratingPlan ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center animate-fade-in">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-xl bg-[#8B2635]/20 animate-pulse" />
                  <Loader2 className="size-12 text-[#8B2635] animate-spin relative z-10" />
                </div>
                <div className="space-y-1 max-w-md">
                  <h3 className="text-base font-bold text-foreground">
                    {isGeneratingPlan
                      ? "Analyzujem štruktúru a pripravujem plán posudku…"
                      : "Umelá inteligencia generuje odborný posudok…"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isGeneratingPlan
                      ? "Kontrola výskumných cieľov, metodiky a odporúčaných štandardov."
                      : "Prechádzanie vektorových dôkazov cez 12 rubrík, audit citácií a formulácia otázok na obhajobu (60 – 90 s)."}
                  </p>
                </div>
                <div className="w-full max-w-sm space-y-2 pt-2">
                  <div className="h-2 w-full bg-muted overflow-hidden rounded-full">
                    <div className="h-full w-2/3 bg-[#8B2635] animate-pulse rounded-full" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Spracovávam sémantický kontext…</span>
                </div>
              </div>
            ) : (
              <>
                {/* Document & Author Summary */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="size-4 text-[#8B2635] dark:text-[#E06D7B] shrink-0" />
                      <h3 className="text-sm font-bold text-foreground truncate">
                        {formMetadata.studentName || formMetadata.thesisTitle
                          ? `${formMetadata.studentName || 'Autor'} — ${formMetadata.thesisTitle || 'Záverečná práca'}`
                          : "Nový posudok"}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="capitalize">
                        {formMetadata.thesisType === "phd" ? "Dizertačná práca (PhD)" : formMetadata.thesisType === "master" ? "Diplomová práca (Ing./Mgr.)" : "Bakalárska práca (Bc.)"}
                      </span>
                      {formMetadata.department && (
                        <>
                          <span>·</span>
                          <span className="truncate">{formMetadata.department}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {isReadyToGenerate ? (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold text-xs py-1 px-2.5 shrink-0 self-start sm:self-center">
                      <FileCheck2 className="size-3.5 mr-1" />
                      Pripravené
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs py-1 px-2.5 shrink-0 text-amber-600 dark:text-amber-400 self-start sm:self-center">
                      {!hasDocument ? "Nahrajte PDF" : "Doplňte metadáta"}
                    </Badge>
                  )}
                </div>

                {/* Generation options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <label
                    htmlFor="active-confidentiality"
                    className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/20 hover:bg-muted/30 p-2.5 rounded-lg border cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      id="active-confidentiality"
                      checked={confidentialityAgreed}
                      onChange={(e) => setConfidentialityAgreed(e.target.checked)}
                      className="mt-0.5 rounded accent-[#8B2635] cursor-pointer shrink-0"
                    />
                    <span className="leading-tight text-[11px] select-none text-foreground/90">
                      Posudzovanie v súlade s etickými pravidlami
                    </span>
                  </label>

                  <label
                    htmlFor="active-professional-mode"
                    className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/20 hover:bg-muted/30 p-2.5 rounded-lg border cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      id="active-professional-mode"
                      checked={professionalModeOverride}
                      onChange={(e) => setProfessionalModeOverride(e.target.checked)}
                      className="mt-0.5 rounded accent-[#8B2635] cursor-pointer shrink-0"
                    />
                    <span className="leading-tight text-[11px] select-none text-foreground/90">
                      Odborný režim (rozšírené hodnotenie a overovanie dôkazov)
                    </span>
                  </label>
                  <label
                    htmlFor="active-skip-cite-audit"
                    className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/20 hover:bg-muted/30 p-2.5 rounded-lg border cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      id="active-skip-cite-audit"
                      checked={skipCitationAudit}
                      onChange={(e) => setSkipCitationAudit(e.target.checked)}
                      className="mt-0.5 rounded accent-[#8B2635] cursor-pointer shrink-0"
                    />
                    <span className="leading-tight text-[11px] select-none text-foreground/90">
                      Preskočiť citačný audit (rýchlejšie)
                    </span>
                  </label>
                </div>

                {/* Error display with retry */}
                {generateError && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <span>{generateError}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-destructive/40 hover:bg-destructive/10 cursor-pointer"
                      onClick={handleGenerate}
                    >
                      Skúsiť znova
                    </Button>
                  </div>
                )}

                {/* Primary & Secondary Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                  <Button
                    onClick={handleGenerate}
                    disabled={!isReadyToGenerate || isGenerating || isGeneratingPlan || isParsing}
                    className="flex-1 h-10 gap-2 font-semibold text-xs bg-[#8B2635] hover:bg-[#741E2B] text-white shadow-xs transition-all cursor-pointer rounded-lg"
                  >
                    <Sparkles className="size-4" />
                    Vygenerovať posudok (AI + RAG)
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handlePreflight}
                    disabled={!hasDocument || isGenerating || isGeneratingPlan || isParsing}
                    className="h-10 text-xs text-foreground hover:bg-muted font-medium cursor-pointer shrink-0 rounded-lg"
                  >
                    <Sparkles className="size-3.5 mr-1.5 text-[#8B2635] dark:text-[#E06D7B]" />
                    Predanalýza (Pre-flight)
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* RAG vector index diagnostics */}
        <RagIndexStatusPanel workspaceId={workspaceId} onRefresh={setRagStats} />

        {/* 2.6 Saved Reviews List with Rich Distinguishing Metadata */}
        {reviews.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Uložené posudky v tomto projekte ({reviews.length})
              </h3>
            </div>
            <div className="grid gap-3">
              {reviews.map((rev, index) => {
                const formattedTime = new Intl.DateTimeFormat("sk-SK", {
                  day: "numeric",
                  month: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(rev.createdAt))

                return (
                  <div
                    key={rev.id}
                    onClick={() => loadReview(workspaceId, rev.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        loadReview(workspaceId, rev.id)
                      }
                    }}
                    className="cursor-pointer group flex items-center justify-between rounded-xl border bg-card p-4 transition-all hover:border-[#8B2635]/50 hover:shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-full bg-[#8B2635]/10 text-[#8B2635] dark:text-[#E06D7B] shrink-0">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-muted-foreground">
                          #{reviews.length - index}
                        </Badge>
                        <span className="font-semibold text-sm text-foreground truncate max-w-md">
                          {rev.thesisTitle && rev.thesisTitle !== rev.studentName ? rev.thesisTitle : rev.studentName}
                        </span>
                        {(rev.finalGrade || rev.grade) && (
                          <Badge variant="outline" className="text-xs font-bold border-foreground/30 px-2 py-0">
                            {rev.finalGrade || rev.grade}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px] uppercase font-mono px-2 py-0">
                          {rev.reviewKind === "paper" ? "PAPER" : rev.thesisType?.toUpperCase() || "MASTER"}
                        </Badge>
                        {rev.status === "final" || rev.confirmedAt ? (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 px-2 py-0">
                            Potvrdený
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground px-2 py-0">
                            Koncept
                          </Badge>
                        )}
                      </div>

                      {rev.thesisTitle && rev.thesisTitle !== rev.studentName && rev.studentName && (
                        <p className="text-xs text-muted-foreground line-clamp-1 pl-9">
                          Autor: <strong className="text-foreground/90 font-medium">{rev.studentName}</strong>
                        </p>
                      )}

                      <p className="text-[11px] text-muted-foreground pl-9">
                        <span className="font-medium text-foreground/80">
                          {rev.reviewerRole === "supervisor" ? "Vedúci práce" : "Oponent / Recenzent"}
                        </span>
                        {rev.reviewerName && ` (${rev.reviewerName})`} • Vytvorené: {formattedTime}
                      </p>

                      {rev.recommendation && (
                        <p className="text-xs text-muted-foreground/90 italic line-clamp-1 pl-9 pt-0.5">
                          „{rev.recommendation}“
                        </p>
                      )}
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteReview(workspaceId, rev.id)
                      }}
                      title="Odstrániť posudok"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted mx-auto text-muted-foreground">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold">Žiadny vypracovaný posudok</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Vyplňte formulár vľavo s údajmi o rukopise. Systém načíta text z nahraného PDF a vytvorí podrobný odborný posudok s overením dôkazov v texte.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
