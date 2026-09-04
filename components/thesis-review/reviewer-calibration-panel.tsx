"use client"

/**
 * ReviewerCalibrationPanel — Multi-Reviewer Consensus & Calibration Diff.
 *
 * Compares two or more reviews for the same thesis (e.g. Supervisor vs. Opponent).
 * Automatically calculates grade distance, flags divergent criteria (> 1 ECTS grade step),
 * and proposes a defensible consensus resolution for the state exam committee.
 */

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Scale,
  GitCompare,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  UserCheck,
  Award,
  ArrowRight,
  Info,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type ThesisReviewListItem,
  getAllThesisStoresForWorkspace,
  getWorkspaceSharedThesis,
} from "./use-thesis-review-store"

const ECTS_GRADE_VALUES: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  FX: 6,
}

const ECTS_SCORE_MAP: Record<string, number> = {
  A: 95,
  B: 83,
  C: 73,
  D: 63,
  E: 53,
  FX: 30,
}

export interface CriterionDiffItem {
  criterionId: string
  criterionLabel: string
  supervisorScore?: number
  supervisorGrade?: string
  opponentScore?: number
  opponentGrade?: string
  delta: number
  isDivergent: boolean
}

interface Props {
  workspaceId: string
  reviews: ThesisReviewListItem[]
}

export function ReviewerCalibrationPanel({ workspaceId, reviews }: Props) {
  const workspaceStores = useMemo(() => getAllThesisStoresForWorkspace(workspaceId), [workspaceId])
  const sharedThesis = useMemo(() => getWorkspaceSharedThesis(workspaceId), [workspaceId])

  const combinedReviews = useMemo(() => {
    const list: any[] = [...reviews]
    for (const { outputId, store } of workspaceStores) {
      const state = store.getState()
      if (state.activeReview) {
        const idx = list.findIndex((r) => r.id === state.activeReview!.id)
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...state.activeReview }
        } else {
          list.unshift(state.activeReview)
        }
      } else if (state.formMetadata.studentName || state.formMetadata.thesisTitle) {
        const draftId = `draft-${outputId}`
        if (!list.some((r) => r.id === draftId)) {
          list.push({
            id: draftId,
            studentName: state.formMetadata.studentName || sharedThesis?.studentName || "Študent",
            thesisTitle: state.formMetadata.thesisTitle || sharedThesis?.thesisTitle || "Záverečná práca",
            reviewerRole: state.formMetadata.reviewerRole,
            reviewerName: state.formMetadata.reviewerName || (state.formMetadata.reviewerRole === "supervisor" ? "Školiteľ" : "Oponent"),
            grade: null,
            recommendation: null,
            sections: [],
          })
        }
      }
    }
    return list
  }, [reviews, workspaceStores, sharedThesis])

  const supervisorReview = useMemo(() => {
    return combinedReviews.find((r) => r.reviewerRole === "supervisor") || combinedReviews[0] || {
      id: "rev-sup",
      studentName: sharedThesis?.studentName || "Ján Novák",
      thesisTitle: sharedThesis?.thesisTitle || "Neurónové siete pre fyzikálne simulácie",
      reviewerRole: "supervisor",
      reviewerName: "prof. RNDr. Peter Varga, DrSc.",
      grade: "A",
      recommendation: "Odporúčam na obhajobu.",
    }
  }, [combinedReviews, sharedThesis])

  const opponentReview = useMemo(() => {
    return combinedReviews.find((r) => r.reviewerRole === "opponent" && r.id !== supervisorReview.id) || combinedReviews[1] || {
      id: "rev-opp",
      studentName: sharedThesis?.studentName || supervisorReview.studentName || "Ján Novák",
      thesisTitle: sharedThesis?.thesisTitle || supervisorReview.thesisTitle || "Neurónové siete pre fyzikálne simulácie",
      reviewerRole: "opponent",
      reviewerName: "doc. Ing. Elena Horváthová, PhD.",
      grade: "B",
      recommendation: "Odporúčam na obhajobu.",
    }
  }, [combinedReviews, supervisorReview, sharedThesis])

  const supGrade = supervisorReview?.finalGrade || supervisorReview?.grade || "A"
  const oppGrade = opponentReview?.finalGrade || opponentReview?.grade || "B"

  const supVal = ECTS_GRADE_VALUES[supGrade] || 1
  const oppVal = ECTS_GRADE_VALUES[oppGrade] || 2
  const gradeDelta = Math.abs(supVal - oppVal)
  const isGradeDivergent = gradeDelta >= 2

  const criterionDiffs = useMemo<CriterionDiffItem[]>(() => {
    const sSections = supervisorReview?.sections || []
    const oSections = opponentReview?.sections || []

    if (sSections.length > 0 && oSections.length > 0) {
      return sSections.map((sSec: any) => {
        const critId = sSec.criterionId || sSec.sectionId || sSec.id
        const oSec = oSections.find((o: any) => (o.criterionId || o.sectionId || o.id) === critId)

        const sScore = sSec.numericScore ?? (sSec.rating ? ECTS_SCORE_MAP[sSec.rating] ?? 80 : 80)
        const oScore = oSec?.numericScore ?? (oSec?.rating ? ECTS_SCORE_MAP[oSec.rating] ?? 75 : 75)
        const sGrade = sSec.rating || "B"
        const oGrade = oSec?.rating || "C"

        const delta = Math.abs(sScore - oScore)
        const sVal = ECTS_GRADE_VALUES[sGrade] || 2
        const oVal = ECTS_GRADE_VALUES[oGrade] || 3
        const isDivergent = delta >= 15 || Math.abs(sVal - oVal) >= 2

        return {
          criterionId: critId,
          criterionLabel: sSec.title || critId,
          supervisorGrade: sGrade,
          supervisorScore: sScore,
          opponentGrade: oGrade,
          opponentScore: oScore,
          delta,
          isDivergent,
        }
      })
    }

    // No real criterion-level data available — return empty so the UI can
    // show a clear placeholder instead of fabricated numbers.
    return []
  }, [supervisorReview, opponentReview, supGrade, oppGrade, gradeDelta])

  const recommendationText = useMemo(() => {
    if (isGradeDivergent) {
      return `Vzhľadom na výrazný rozdiel medzi hodnotením školiteľa (${supGrade}) a oponenta (${oppGrade}) odporúčame štátnicovej komisii dôkladne preskúmať sporné kritériá a položiť študentovi doplňujúce otázky pri obhajobe.`
    }
    if (supGrade === oppGrade) {
      return `Medzi školiteľom a oponentom panuje plná zhoda na výslednej známke ${supGrade}. Obhajoba môže prebehnúť štandardným spôsobom.`
    }
    return `Medzi školiteľom (${supGrade}) a oponentom (${oppGrade}) je mierny rozdiel jedného klasifikačného stupňa (Δ = ${gradeDelta}). Odporúčame komisii zamerať diskusiu na kvalitu dosiahnutých výsledkov.`
  }, [isGradeDivergent, supGrade, oppGrade, gradeDelta])

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 lg:p-6">
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary/40 text-primary">
                  <Scale className="size-3 mr-1" />
                  Kalibrácia a konsenzus posudzovateľov
                </Badge>
                <Badge
                  className={cn(
                    "text-xs font-semibold",
                    isGradeDivergent
                      ? "bg-destructive/100/10 text-destructive dark:text-destructive border-destructive/40"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  )}
                >
                  {isGradeDivergent ? "Vysoká diskrepancia (≥ 2 stupne)" : "Vysoká zhoda posudkov"}
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <GitCompare className="size-5 text-primary" />
                Diferenčná analýza: Školiteľ vs. Oponent
              </CardTitle>
              <CardDescription className="flex flex-col gap-0.5">
                <span>Porovnanie hodnotení dvoch nezávislých posudzovateľov na identifikáciu sporných bodov pred zasadnutím komisie.</span>
                {(supervisorReview.studentName || supervisorReview.thesisTitle) && (
                  <span className="text-xs font-medium text-foreground pt-0.5">
                    {supervisorReview.studentName} — <span className="italic">{supervisorReview.thesisTitle}</span>
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Grade Comparison Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Supervisor Card */}
            <div className="p-4 rounded-xl border bg-card space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Vedúci práce (Školiteľ)</span>
                <Badge variant="secondary" className="text-[10px]">Školiteľ</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{supervisorReview.reviewerName || "Školiteľ"}</p>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-3xl font-black text-primary font-mono">{supGrade}</span>
                <span className="text-xs text-muted-foreground font-medium">Navrhnutá známka</span>
              </div>
            </div>

            {/* Delta / Consensus Center */}
            <div className="p-4 rounded-xl border bg-muted/40 flex flex-col justify-center items-center text-center space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Rozdiel hodnotení</span>
              <div className="flex items-center gap-2 font-mono font-bold text-lg text-foreground">
                <span>{supGrade}</span>
                <ArrowRight className="size-4 text-muted-foreground" />
                <span>{oppGrade}</span>
              </div>
              <Badge variant="outline" className="text-[10px] mt-1 font-mono">
                Δ = {gradeDelta} ECTS stupeň
              </Badge>
            </div>

            {/* Opponent Card */}
            <div className="p-4 rounded-xl border bg-card space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Oponent práce</span>
                <Badge variant="secondary" className="text-[10px]">Oponent</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{opponentReview.reviewerName || "Oponent"}</p>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-3xl font-black text-primary font-mono">{oppGrade}</span>
                <span className="text-xs text-muted-foreground font-medium">Navrhnutá známka</span>
              </div>
            </div>
          </div>

          {/* Criterion Level Diff Table */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Scale className="size-4 text-primary" />
              Porovnanie jednotlivých hodnotiacich kritérií
            </h4>

            <div className="space-y-2.5">
              {criterionDiffs.length > 0 ? criterionDiffs.map((diff) => (
                <div
                  key={diff.criterionId}
                  className={cn(
                    "p-3 rounded-lg border text-xs flex items-center justify-between gap-4 transition-colors",
                    diff.isDivergent
                      ? "border-warning/40 bg-warning/100/5 ring-1 ring-warning/20"
                      : "border-border bg-card"
                  )}
                >
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm truncate">
                        {diff.criterionLabel}
                      </span>
                      {diff.isDivergent && (
                        <Badge className="bg-warning/100/10 text-warning dark:text-warning text-[10px]">
                          <AlertTriangle className="size-2.5 mr-1" />
                          Rozdielne hodnotenie (&gt; 15 b)
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 font-mono">
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block">Školiteľ</span>
                      <span className="font-bold text-foreground">{diff.supervisorGrade} ({diff.supervisorScore}b)</span>
                    </div>
                    <span className="text-muted-foreground text-xs">vs</span>
                    <div className="text-left">
                      <span className="text-[10px] text-muted-foreground block">Oponent</span>
                      <span className="font-bold text-foreground">{diff.opponentGrade} ({diff.opponentScore}b)</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  <BookOpen className="size-5 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="font-medium">Kriteriálne hodnotenie nie je k dispozícii</p>
                  <p className="text-[11px] mt-1">Vygenerujte aspoň jeden posudok s vyplnenými sekciami pre porovnanie na úrovni kritérií.</p>
                </div>
              )}
            </div>
          </div>

          {/* Consensus Advice Card */}
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Info className="size-4" />
              Odporúčanie pre predsedu skúšobnej komisie
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {recommendationText}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
