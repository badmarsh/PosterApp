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

import { useEffect, useMemo } from "react"
import { useThesisReviewStore } from "./use-thesis-review-store"
import { ThesisMetadataPanel } from "./thesis-metadata-panel"
import { ExpertReviewWorkspace } from "./expert-review-workspace"
import { AnalysisPlanPanel } from "./analysis-plan-panel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useEditor } from "@/components/editor-store"
import {
  GraduationCap,
  Trash2,
  FileCheck2,
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
    isGenerating,
    sourceMarkdown: storeSourceMarkdown,
    loadReviews,
    loadReview,
    loadSourceDocument,
    deleteReview,
  } = useThesisReviewStore()

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

  useEffect(() => {
    loadReviews(workspaceId)
    loadSourceDocument(workspaceId)
  }, [workspaceId, loadReviews, loadSourceDocument])

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
              metadata: {
                studentName: analysisPlan.documentTitle,
                thesisTitle: analysisPlan.documentTitle,
                thesisType: (analysisPlan.detectedType === "paper" ? "phd" : "master") as any,
                reviewerRole: "opponent",
                language: analysisPlan.language,
                reviewKind: analysisPlan.detectedType,
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
    <div className="flex flex-col lg:flex-row h-full w-full overflow-y-auto lg:overflow-hidden">
      {/* Left: Metadata form */}
      <div className="w-full lg:w-[360px] border-b lg:border-b-0 lg:border-r shrink-0 bg-background/50">
        <ThesisMetadataPanel workspaceId={workspaceId} />
      </div>

      {/* Right: Existing reviews list / empty state */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Odborné posudky a hodnotenia</h2>
            <p className="text-sm text-muted-foreground">
              Vygenerujte nový odborný posudok pomocou RAG a akademického konektora alebo otvorte existujúci.
            </p>
          </div>

          {reviews.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Uložené posudky v tomto projekte:</h3>
              <div className="grid gap-3">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    onClick={() => loadReview(workspaceId, rev.id)}
                    className="cursor-pointer group flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">{rev.studentName}</span>
                        {rev.grade && (
                          <Badge variant="outline" className="text-xs font-bold">
                            {rev.grade}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                          {rev.reviewKind || rev.thesisType}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{rev.thesisTitle}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {rev.reviewerRole === "supervisor" ? "Vedúci práce" : "Oponent / Recenzent"} • {new Date(rev.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 text-destructive h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteReview(workspaceId, rev.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
              <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="text-base font-semibold">Žiadny vypracovaný posudok</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Vyplňte formulár vľavo s údajmi o rukopise. Systém načíta text z nahraného PDF a vytvorí podrobný odborný posudok s overením dôkazov v texte.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
