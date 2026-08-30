"use client"

/**
 * ThesisReviewPanel — main view for inspecting, editing, and exporting thesis reviews.
 *
 * Integrates:
 *  - Review metadata header & grade summary
 *  - Per-criterion cards (ThesisCriteriaCard)
 *  - Defense questions (DefenseQuestionsPanel)
 *  - Academic connector citation audit (CitationIssuesPanel)
 *  - Save & PDF Export buttons
 */

import { useEffect } from "react"
import { useThesisReviewStore, type ThesisReviewRecord } from "./use-thesis-review-store"
import { ThesisMetadataPanel } from "./thesis-metadata-panel"
import { ThesisCriteriaCard } from "./thesis-criteria-card"
import { DefenseQuestionsPanel } from "./defense-questions-panel"
import { CitationIssuesPanel } from "./citation-issues-panel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  THESIS_CRITERIA,
  type ReviewLanguage,
  type CriterionRating,
  type ThesisSection,
  computeOverallScore,
  scoreToEctsGrade,
} from "@/lib/ai/thesis-rubric"
import {
  FileDown,
  Save,
  PlusCircle,
  Trash2,
  FileCheck2,
  GraduationCap,
  Sparkles,
  Loader2,
} from "lucide-react"

interface Props {
  workspaceId: string
}

const GRADES = ["A", "B", "C", "D", "E", "FX"]

export function ThesisReviewPanel({ workspaceId }: Props) {
  const {
    reviews,
    activeReview,
    loadReviews,
    loadReview,
    updateReviewLocally,
    saveReview,
    exportReviewPdf,
    deleteReview,
    isExporting,
    setActiveReview,
  } = useThesisReviewStore()

  useEffect(() => {
    loadReviews(workspaceId)
  }, [workspaceId, loadReviews])

  const lang: ReviewLanguage = activeReview?.language ?? "sk"

  const handleSectionUpdate = (sectionId: string, updates: Partial<ThesisSection>) => {
    if (!activeReview) return
    const updatedSections = activeReview.sections.map((s) =>
      s.sectionId === sectionId || s.criterionId === sectionId ? { ...s, ...updates } : s
    )
    
    // Check if auto-recalculate grade makes sense
    const newScore = computeOverallScore(updatedSections)
    const newGrade = newScore != null ? scoreToEctsGrade(newScore) : activeReview.grade

    updateReviewLocally({
      sections: updatedSections,
      grade: newGrade,
    })
  }

  const handleQuestionsUpdate = (newQuestions: string[]) => {
    updateReviewLocally({ defenseQuestions: newQuestions })
  }

  if (!activeReview) {
    return (
      <div className="flex h-full w-full">
        {/* Left: Metadata form */}
        <div className="w-[360px] border-r shrink-0 bg-background/50">
          <ThesisMetadataPanel workspaceId={workspaceId} />
        </div>

        {/* Right: Existing reviews list / empty state */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Posudky záverečných prác</h2>
              <p className="text-sm text-muted-foreground">
                Vygenerujte nový posudok pomocou RAG a akademického konektora alebo vyberte existujúci.
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
                              Známka: {rev.grade}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{rev.thesisTitle}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {rev.reviewerRole === "supervisor" ? "Vedúci práce" : "Oponent"} • {new Date(rev.createdAt).toLocaleDateString()}
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
                  Vyplňte formulár vľavo s menom študenta a názvom diplomovej práce. Systém načíta text z nahraného PDF a vytvorí podrobný posudok s overením citácií.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Active review editing mode
  const calculatedScore = computeOverallScore(activeReview.sections)

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Main editor content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top bar with actions */}
        <div className="flex items-center justify-between border-b px-6 py-3 bg-background/95 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveReview(null)}
              className="text-xs h-8"
            >
              ← Zoznam posudkov
            </Button>
            <div className="h-4 w-px bg-border" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{activeReview.studentName}</span>
                <Badge variant="secondary" className="text-[11px]">
                  {activeReview.thesisType}
                </Badge>
                {activeReview.grade && (
                  <Badge variant="default" className="text-xs font-bold">
                    {activeReview.grade}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-md">
                {activeReview.thesisTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => saveReview(workspaceId, activeReview.id)}
              className="text-xs h-8 gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              Uložiť
            </Button>

            <Button
              size="sm"
              onClick={() => exportReviewPdf(workspaceId, activeReview.id)}
              disabled={isExporting}
              className="text-xs h-8 gap-1.5"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Kompilujem PDF…
                </>
              ) : (
                <>
                  <FileDown className="h-3.5 w-3.5" />
                  Exportovať PDF
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Scrollable document body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
          {/* Summary card */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold">Celkové hodnotenie a záver</h3>
              </div>
              <div className="flex items-center gap-3">
                {calculatedScore != null && (
                  <span className="text-xs text-muted-foreground">
                    Vážené skóre: <strong>{calculatedScore}/100</strong>
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">Klasifikácia:</span>
                  <Select
                    value={activeReview.grade ?? ""}
                    onValueChange={(v) => updateReviewLocally({ grade: v })}
                  >
                    <SelectTrigger className="h-7 w-20 text-xs font-bold">
                      <SelectValue placeholder="---" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADES.map((g) => (
                        <SelectItem key={g} value={g} className="text-xs font-bold">
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Záverečné odporúčanie k obhajobe:
              </label>
              <Textarea
                value={activeReview.recommendation ?? ""}
                onChange={(e) => updateReviewLocally({ recommendation: e.target.value })}
                className="text-xs min-h-[60px]"
                placeholder="Prácu odporúčam na obhajobu..."
              />
            </div>
          </div>

          {/* Criteria cards list */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-tight text-muted-foreground uppercase text-xs">
              Hodnotenie jednotlivých kritérií
            </h3>
            {THESIS_CRITERIA.filter((c) => c.category !== "defense").map((criterion) => {
              const sec = activeReview.sections.find(
                (s) => s.criterionId === criterion.id || s.sectionId === criterion.id
              ) ?? {
                id: criterion.id,
                sectionId: criterion.id,
                criterionId: criterion.id,
                text: "",
                rating: "pending" as CriterionRating,
                suggestions: [],
              }

              return (
                <ThesisCriteriaCard
                  key={criterion.id}
                  criterion={criterion}
                  section={sec}
                  lang={lang}
                  onUpdate={(updates) => handleSectionUpdate(criterion.id, updates)}
                />
              )
            })}
          </div>

          {/* Defense Questions Panel */}
          <DefenseQuestionsPanel
            questions={activeReview.defenseQuestions}
            lang={lang}
            onUpdateQuestions={handleQuestionsUpdate}
          />

          {/* Citation issues & Academic Connector panel */}
          <CitationIssuesPanel
            issues={activeReview.citationIssues}
            lang={lang}
          />
        </div>
      </div>
    </div>
  )
}
