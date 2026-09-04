"use client"

import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CheckCircle2, Calculator } from "lucide-react"
import {
  computeOverallScore,
  getCriterionById,
  scoreToEctsGrade,
  type ReviewLanguage,
  type ThesisSection,
} from "@/lib/ai/thesis-rubric"
import type { ReviewFinding } from "@/lib/ai/review-types"

const T = {
  sk: {
    how: "Ako vznikla známka",
    rubric: "Vážený priemer kritérií (sk-academic-v1)",
    findings: "Zrážky za zistenia",
    rubricScore: "Skóre rubriky",
    findingsScore: "Skóre zo zistení",
    proposed: "Navrhnutý rozsah",
    confirmed: "Potvrdená známka recenzentom",
    noRating: "bez hodnotenia",
    weight: "váha",
    deductions: "kritické −20 · závažné −8 · drobné −2 · návrhy −0,5 (len prijaté a upravené zistenia)",
    note: "Známka je návrh. Konečné rozhodnutie potvrdzuje recenzent tlačidlom „Potvrdiť známku“.",
    thresholds: "Prahy ECTS: A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · E ≥ 50 · inak FX",
  },
  cs: {
    how: "Jak vznikla známka",
    rubric: "Vážený průměr kritérií (sk-academic-v1)",
    findings: "Srážky za zjištění",
    rubricScore: "Skóre rubriky",
    findingsScore: "Skóre ze zjištění",
    proposed: "Navržený rozsah",
    confirmed: "Potvrzená známka recenzentem",
    noRating: "bez hodnocení",
    weight: "váha",
    deductions: "kritická −20 · závažná −8 · drobná −2 · návrhy −0,5 (jen přijatá a upravená zjištění)",
    note: "Známka je návrh. Konečné rozhodnutí potvrzuje recenzent tlačítkem „Potvrdit známku“.",
    thresholds: "Prahy ECTS: A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · E ≥ 50 · jinak FX",
  },
  en: {
    how: "How this grade was derived",
    rubric: "Weighted criteria average (sk-academic-v1)",
    findings: "Deductions from findings",
    rubricScore: "Rubric score",
    findingsScore: "Findings score",
    proposed: "Proposed range",
    confirmed: "Grade confirmed by reviewer",
    noRating: "not rated",
    weight: "weight",
    deductions: "critical −20 · major −8 · minor −2 · suggestion −0.5 (accepted and edited findings only)",
    note: "The grade is a proposal. The reviewer confirms the final decision with “Confirm grade”.",
    thresholds: "ECTS thresholds: A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · E ≥ 50 · otherwise FX",
  },
} as const

/** Mirrors computeScoreFromFindings in lib/ai/review-engine.ts (kept client-safe here). */
const FINDING_DEDUCTIONS: Record<string, number> = { critical: 20, major: 8, minor: 2, suggestion: 0.5 }
function scoreFromFindings(findings: ReviewFinding[]): number {
  let score = 100
  for (const f of findings) score -= FINDING_DEDUCTIONS[f.severity as string] ?? 0
  return Math.min(100, Math.max(10, score))
}

export function GradeDerivationPopover({
  grade,
  sections,
  findings,
  proposedGradeRange,
  confirmed,
  lang,
}: {
  grade: string
  sections: ThesisSection[]
  findings: ReviewFinding[]
  proposedGradeRange?: string | null
  confirmed: boolean
  lang: ReviewLanguage
}) {
  const t = T[lang] ?? T.sk
  const rubricScore = computeOverallScore(sections)
  const countedFindings = findings.filter((f) => f.status === "accepted" || f.status === "edited")
  const findingsScore = scoreFromFindings(countedFindings)
  const ectsMap: Record<string, number> = { A: 95, B: 85, C: 75, D: 65, E: 55, FX: 20 }

  const rows = sections
    .map((s) => {
      const crit = getCriterionById(s.criterionId || s.sectionId || s.id)
      if (!crit || crit.weight === 0) return null
      const score =
        typeof s.numericScore === "number"
          ? Math.min(100, Math.max(0, s.numericScore))
          : s.rating && s.rating !== "pending"
            ? ectsMap[s.rating]
            : null
      return { label: crit.labels[lang] ?? crit.labels.sk, weight: crit.weight, score, rating: s.rating }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex"
        aria-label={t.how}
      >
        <Badge variant={confirmed ? "default" : "outline"} className="text-xs font-bold shrink-0 gap-1 cursor-help">
          {confirmed && <CheckCircle2 className="h-3 w-3 text-success" />}
          ECTS: {grade}
          <Calculator className="h-3 w-3 opacity-60" />
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[380px] text-xs space-y-3">
        <div className="font-bold text-sm">{t.how}</div>

        <div className="space-y-1">
          <div className="font-semibold text-muted-foreground">{t.rubric}</div>
          <table className="w-full text-[11px]">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/40 last:border-0">
                  <td className="py-0.5 pr-2">{r.label}</td>
                  <td className="py-0.5 pr-2 text-muted-foreground whitespace-nowrap">{t.weight} {r.weight}%</td>
                  <td className="py-0.5 text-right font-mono">
                    {r.score == null ? <span className="text-muted-foreground">{t.noRating}</span> : `${r.rating ?? ""} (${r.score})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between font-semibold pt-1">
            <span>{t.rubricScore}</span>
            <span className="font-mono">{rubricScore == null ? "—" : `${rubricScore} → ${scoreToEctsGrade(rubricScore)}`}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="font-semibold text-muted-foreground">{t.findings}</div>
          <div className="text-[11px] text-muted-foreground">{t.deductions}</div>
          <div className="flex justify-between font-semibold">
            <span>{t.findingsScore} ({countedFindings.length})</span>
            <span className="font-mono">{findingsScore} → {scoreToEctsGrade(findingsScore)}</span>
          </div>
        </div>

        {proposedGradeRange && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.proposed}</span>
            <span className="font-mono font-semibold">{proposedGradeRange}</span>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground">{t.thresholds}</div>
        <div className="text-[10px] text-muted-foreground border-t pt-2">{confirmed ? t.confirmed : t.note}</div>
      </PopoverContent>
    </Popover>
  )
}
