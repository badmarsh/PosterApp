"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import {
  THESIS_CRITERIA,
  type ThesisSection,
  type ReviewLanguage,
  computeOverallScore,
  scoreToEctsGrade,
} from "@/lib/ai/thesis-rubric"
import { TrendingUp, AlertCircle, Award, BarChart3 } from "lucide-react"

interface Props {
  sections: ThesisSection[]
  lang: ReviewLanguage
  currentGrade?: string | null
}

const ECTS_MAP: Record<string, number> = {
  A: 95,
  B: 85,
  C: 75,
  D: 65,
  E: 55,
  FX: 20,
}

const CATEGORY_NAMES: Record<string, Record<ReviewLanguage, string>> = {
  formal: { sk: "Formálna úprava", cs: "Formální úprava", en: "Formal Quality" },
  content: { sk: "Odborný obsah & Výsledky", cs: "Odborný obsah & Výsledky", en: "Content & Results" },
  language: { sk: "Jazyk a štylistika", cs: "Jazyk a stylistika", en: "Language & Style" },
  citations: { sk: "Citácie a literatúra", cs: "Citace a literatura", en: "Citations & References" },
}

export function ThesisScoreAnalytics({ sections, lang, currentGrade }: Props) {
  const overallScore = computeOverallScore(sections) ?? 0
  const computedGrade = scoreToEctsGrade(overallScore)
  const displayGrade = currentGrade || computedGrade

  // Filter weighted criteria
  const weightedCriteria = THESIS_CRITERIA.filter((c) => c.weight > 0 && c.category !== "defense")

  // Prepare radar points
  const totalAxes = weightedCriteria.length
  const center = 100
  const radius = 70

  const points = weightedCriteria.map((c, i) => {
    const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2
    const sec = sections.find((s) => s.criterionId === c.id || s.sectionId === c.id)
    const score =
      sec?.numericScore != null
        ? sec.numericScore
        : sec?.rating && sec.rating !== "pending"
        ? ECTS_MAP[sec.rating] ?? 50
        : 50

    const r = (score / 100) * radius
    const x = center + r * Math.cos(angle)
    const y = center + r * Math.sin(angle)
    return { x, y, score, angle, label: c.labels[lang], id: c.id, weight: c.weight }
  })

  const polygonPath = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")

  // Category aggregates
  const categories = ["content", "formal", "language", "citations"] as const
  const categoryStats = categories.map((cat) => {
    const catCriteria = weightedCriteria.filter((c) => c.category === cat)
    const catWeight = catCriteria.reduce((sum, c) => sum + c.weight, 0)
    let weightedCatSum = 0
    let evaluatedWeight = 0

    for (const c of catCriteria) {
      const sec = sections.find((s) => s.criterionId === c.id || s.sectionId === c.id)
      const score =
        sec?.numericScore != null
          ? sec.numericScore
          : sec?.rating && sec.rating !== "pending"
          ? ECTS_MAP[sec.rating] ?? null
          : null

      if (score != null) {
        weightedCatSum += score * c.weight
        evaluatedWeight += c.weight
      }
    }

    const avg = evaluatedWeight > 0 ? Math.round(weightedCatSum / evaluatedWeight) : 0
    return {
      category: cat,
      title: CATEGORY_NAMES[cat][lang],
      weight: catWeight,
      avgScore: avg,
      grade: scoreToEctsGrade(avg),
    }
  })

  // Weakest and strongest criteria
  const evaluatedPoints = points.filter((p) => {
    const sec = sections.find((s) => s.criterionId === p.id || s.sectionId === p.id)
    return sec?.rating && sec.rating !== "pending"
  })

  const sorted = [...evaluatedPoints].sort((a, b) => b.score - a.score)
  const strongest = sorted[0]
  const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : null

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">
            {lang === "sk" ? "Analytika a vážené hodnotenie" : lang === "cs" ? "Analytika a vážené hodnocení" : "Score Analytics & Distribution"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-semibold">
            {lang === "sk" ? "Skóre:" : lang === "cs" ? "Skóre:" : "Score:"} {overallScore}/100
          </Badge>
          <Badge
            className={`text-xs font-bold ${
              displayGrade === "A"
                ? "bg-green-600 hover:bg-green-700"
                : displayGrade === "B"
                ? "bg-lime-600 hover:bg-lime-700"
                : displayGrade === "C"
                ? "bg-amber-600 hover:bg-amber-700"
                : displayGrade === "D"
                ? "bg-orange-600 hover:bg-orange-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            ECTS: {displayGrade}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Radar Chart Visualizer */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-2">
          <svg viewBox="0 0 200 200" className="w-48 h-48 overflow-visible">
            {/* Background concentric webs */}
            {[0.25, 0.5, 0.75, 1.0].map((level, idx) => {
              const levelRadius = radius * level
              const webPoints = weightedCriteria
                .map((_, i) => {
                  const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2
                  const x = center + levelRadius * Math.cos(angle)
                  const y = center + levelRadius * Math.sin(angle)
                  return `${x.toFixed(1)},${y.toFixed(1)}`
                })
                .join(" ")
              return (
                <polygon
                  key={idx}
                  points={webPoints}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.75"
                  className="text-muted-foreground/20"
                />
              )
            })}

            {/* Axes lines */}
            {points.map((p, i) => {
              const edgeX = center + radius * Math.cos(p.angle)
              const edgeY = center + radius * Math.sin(p.angle)
              return (
                <line
                  key={i}
                  x1={center}
                  y1={center}
                  x2={edgeX}
                  y2={edgeY}
                  stroke="currentColor"
                  strokeWidth="0.75"
                  className="text-muted-foreground/30"
                />
              )
            })}

            {/* Data Polygon */}
            {points.length > 0 && (
              <polygon
                points={polygonPath}
                className="fill-primary/20 stroke-primary stroke-[1.5]"
                strokeLinejoin="round"
              />
            )}

            {/* Vertices */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="3"
                className="fill-primary stroke-background stroke-[1.5]"
              />
            ))}
          </svg>
          <span className="text-[11px] text-muted-foreground mt-1">
            {lang === "sk" ? "Profil kritérií (Radar)" : lang === "cs" ? "Profil kritérií (Radar)" : "Criteria Radar Profile"}
          </span>
        </div>

        {/* Category Breakdown Bars */}
        <div className="md:col-span-7 space-y-2.5">
          {categoryStats.map((stat) => (
            <div key={stat.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{stat.title}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">({stat.weight}%)</span>
                  <span className="font-bold">{stat.avgScore}/100</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 font-bold">
                    {stat.grade}
                  </Badge>
                </div>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    stat.avgScore >= 85
                      ? "bg-green-500"
                      : stat.avgScore >= 70
                      ? "bg-blue-500"
                      : stat.avgScore >= 55
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${Math.max(5, Math.min(100, stat.avgScore))}%` }}
                />
              </div>
            </div>
          ))}

          {/* Strongest & Weakest Insights */}
          <div className="pt-2 grid grid-cols-2 gap-2 border-t mt-3 text-[11px]">
            {strongest && (
              <div className="flex items-start gap-1 text-green-700 dark:text-green-300">
                <Award className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div className="truncate">
                  <span className="font-semibold block">{lang === "sk" ? "Silná stránka" : "Strength"}:</span>
                  <span className="truncate">{strongest.label} ({strongest.score}%)</span>
                </div>
              </div>
            )}
            {weakest && weakest.score < 80 && (
              <div className="flex items-start gap-1 text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div className="truncate">
                  <span className="font-semibold block">{lang === "sk" ? "K zlepšeniu" : "Focus area"}:</span>
                  <span className="truncate">{weakest.label} ({weakest.score}%)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
