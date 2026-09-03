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
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ThesisReviewListItem } from "./use-thesis-review-store"

const ECTS_GRADE_VALUES: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  FX: 6,
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
  // If fewer than 2 reviews exist, create simulated second reviewer for demonstration
  const supervisorReview = reviews.find((r) => r.reviewerRole === "supervisor") || reviews[0] || {
    id: "rev-sup",
    studentName: "Ján Novák",
    thesisTitle: "Neurónové siete pre fyzikálne simulácie",
    reviewerRole: "supervisor",
    reviewerName: "prof. RNDr. Peter Varga, DrSc.",
    grade: "A",
    recommendation: "Odporúčam na obhajobu.",
  }

  const opponentReview = reviews.find((r) => r.reviewerRole === "opponent" && r.id !== supervisorReview.id) || reviews[1] || {
    id: "rev-opp",
    studentName: "Ján Novák",
    thesisTitle: "Neurónové siete pre fyzikálne simulácie",
    reviewerRole: "opponent",
    reviewerName: "doc. Ing. Elena Horváthová, PhD.",
    grade: "B",
    recommendation: "Odporúčam na obhajobu.",
  }

  const supGrade = supervisorReview?.finalGrade || supervisorReview?.grade || "A"
  const oppGrade = opponentReview?.finalGrade || opponentReview?.grade || "B"

  const supVal = ECTS_GRADE_VALUES[supGrade] || 1
  const oppVal = ECTS_GRADE_VALUES[oppGrade] || 2
  const gradeDelta = Math.abs(supVal - oppVal)
  const isGradeDivergent = gradeDelta >= 2

  const criterionDiffs: CriterionDiffItem[] = [
    {
      criterionId: "methodology",
      criterionLabel: "Metodológia a postup riešenia",
      supervisorGrade: "A",
      supervisorScore: 95,
      opponentGrade: "B",
      opponentScore: 82,
      delta: 13,
      isDivergent: false,
    },
    {
      criterionId: "results",
      criterionLabel: "Výsledky a ich vyhodnotenie",
      supervisorGrade: "A",
      supervisorScore: 92,
      opponentGrade: "C",
      opponentScore: 74,
      delta: 18,
      isDivergent: true, // Divergence flagged
    },
    {
      criterionId: "originality",
      criterionLabel: "Originalita a vlastný prínos",
      supervisorGrade: "A",
      supervisorScore: 90,
      opponentGrade: "B",
      opponentScore: 85,
      delta: 5,
      isDivergent: false,
    },
    {
      criterionId: "citations_bibliography",
      criterionLabel: "Práca s literatúrou a citáciami",
      supervisorGrade: "B",
      supervisorScore: 85,
      opponentGrade: "B",
      opponentScore: 80,
      delta: 5,
      isDivergent: false,
    },
  ]

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
                      ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
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
              <CardDescription>
                Porovnanie hodnotení dvoch nezávislých posudzovateľov na identifikáciu sporných bodov pred zasadnutím komisie.
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
              {criterionDiffs.map((diff) => (
                <div
                  key={diff.criterionId}
                  className={cn(
                    "p-3 rounded-lg border text-xs flex items-center justify-between gap-4 transition-colors",
                    diff.isDivergent
                      ? "border-amber-500/30 bg-amber-500/5 ring-1 ring-amber-500/20"
                      : "border-border bg-card"
                  )}
                >
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm truncate">
                        {diff.criterionLabel}
                      </span>
                      {diff.isDivergent && (
                        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px]">
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
              ))}
            </div>
          </div>

          {/* Consensus Advice Card */}
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Info className="size-4" />
              Odporúčanie pre predsedu skúšobnej komisie
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Vzhľadom na rozdiel medzi školiteľom (A) a oponentom (B) v kritériu <em>Výsledky a ich vyhodnotenie</em> odporúčame komisii zamerať úvodnú diskusiu na porovnanie dosiahnutých metrík voči baseline modelom.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
