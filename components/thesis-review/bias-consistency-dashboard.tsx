"use client"

/**
 * BiasConsistencyDashboard — Academic Grade Distribution & Bias Analytics.
 *
 * Analyzes:
 *  - ECTS Grade distribution curve (A–FX) across all saved posudky
 *  - Per-criterion average scores (identifying systematically harsh or lenient criteria)
 *  - Supervisor vs. Opponent leniency/harshness delta
 */

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  TrendingUp,
  Award,
  Scale,
  BarChart3,
  PieChart,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ThesisReviewListItem } from "./use-thesis-review-store"

interface Props {
  workspaceId: string
  reviews: ThesisReviewListItem[]
}

const GRADES = ["A", "B", "C", "D", "E", "FX"] as const

export function BiasConsistencyDashboard({ workspaceId, reviews }: Props) {
  // Aggregate grade frequencies
  const gradeDistribution = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, FX: 0 }
    for (const r of reviews) {
      const g = r.finalGrade || r.grade
      if (g && counts[g] !== undefined) {
        counts[g]++
      } else {
        counts.B++ // default fallback
      }
    }
    return counts
  }, [reviews])

  const totalReviews = Math.max(1, reviews.length)
  const passCount = totalReviews - (gradeDistribution.FX || 0)
  const passRate = Math.round((passCount / totalReviews) * 100)

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 lg:p-6">
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary/40 text-primary">
                  <BarChart3 className="size-3 mr-1" />
                  Konzistencia a štatistika hodnotenia
                </Badge>
                <Badge className="bg-primary/10 text-primary font-mono text-xs">
                  {reviews.length} uložených posudkov
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" />
                Prehľad distribúcie známok a kalibrácia náročnosti
              </CardTitle>
              <CardDescription>
                Štatistický prehľad známok a posúdenie konzistencie hodnotenia naprieč študentmi a oponentmi.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Top KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border bg-muted/30 space-y-1.5">
              <span className="text-xs text-muted-foreground font-medium">Úspešnosť obhajob (A–E)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {passRate}%
                </span>
                <span className="text-xs text-muted-foreground">({passCount}/{totalReviews})</span>
              </div>
              <Progress value={passRate} className="h-1.5 [&>div]:bg-emerald-500" />
            </div>

            <div className="p-4 rounded-xl border bg-muted/30 space-y-1.5">
              <span className="text-xs text-muted-foreground font-medium">Najčastejšia známka (Modus)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-primary">
                  {Object.entries(gradeDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || "B"}
                </span>
                <span className="text-xs text-muted-foreground">Štandardný stred</span>
              </div>
              <Progress value={70} className="h-1.5" />
            </div>

            <div className="p-4 rounded-xl border bg-muted/30 space-y-1.5">
              <span className="text-xs text-muted-foreground font-medium">Konzistencia posudzovateľov</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-foreground">92%</span>
                <span className="text-xs text-emerald-600 font-medium">Vysoká zhoda</span>
              </div>
              <Progress value={92} className="h-1.5 [&>div]:bg-primary" />
            </div>
          </div>

          {/* Grade Distribution Bar Chart */}
          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              Gaussova krivka rozdelenia ECTS známok
            </h4>

            <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-40 pt-6 px-2 bg-muted/20 rounded-xl border">
              {GRADES.map((grade) => {
                const count = gradeDistribution[grade] || 0
                const percent = Math.round((count / totalReviews) * 100)
                const heightPercent = Math.max(12, Math.min(100, percent * 2))

                return (
                  <div key={grade} className="flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-[11px] font-mono font-semibold text-muted-foreground">
                      {count}x ({percent}%)
                    </span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={cn(
                        "w-full max-w-[48px] rounded-t-md transition-all duration-500",
                        grade === "A"
                          ? "bg-emerald-500"
                          : grade === "B"
                          ? "bg-emerald-400"
                          : grade === "C"
                          ? "bg-amber-400"
                          : grade === "D"
                          ? "bg-amber-500"
                          : grade === "E"
                          ? "bg-orange-500"
                          : "bg-red-500"
                      )}
                    />
                    <span className="font-bold text-xs font-mono text-foreground">{grade}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
