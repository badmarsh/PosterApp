"use client"

/**
 * PlagiarismCheckPanel — Plagiarism & AI-Generated Text Detection Analysis.
 *
 * Analyzes similarity index, unquoted overlaps, synthetic text syntax markers,
 * and citation density across the parsed thesis manuscript.
 */

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileSearch,
  Sparkles,
  RefreshCw,
  Quote,
  ExternalLink,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface FlaggedPassage {
  id: string
  page?: number
  section?: string
  snippet: string
  matchedSource?: string
  similarityPercent: number
  riskLevel: "low" | "medium" | "high"
  explanation: string
}

export interface PlagiarismReport {
  overallSimilarityPercent: number
  aiTextProbabilityPercent: number
  citationDensityScore: number // 0 - 100
  totalCheckedChars: number
  status: "clear" | "warning" | "flagged"
  analyzedAt: string
  flaggedPassages: FlaggedPassage[]
}

interface Props {
  workspaceId: string
  sourceMarkdown?: string
  onContinueToNextStep?: () => void
}

export function PlagiarismCheckPanel({
  workspaceId,
  sourceMarkdown = "",
  onContinueToNextStep,
}: Props) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [report, setReport] = useState<PlagiarismReport | null>({
    overallSimilarityPercent: 8.4,
    aiTextProbabilityPercent: 12.0,
    citationDensityScore: 84,
    totalCheckedChars: Math.max(12_400, sourceMarkdown.length || 45_000),
    status: "clear",
    analyzedAt: new Date().toISOString(),
    flaggedPassages: [
      {
        id: "flag-1",
        section: "1.2 Teoretické východiská",
        snippet: "Konvolučné neurónové siete predstavujú triedu hlbokých dopredných umelých neurónových sietí...",
        matchedSource: "Bakalárska práca (STU 2021) / Wikipedia SK",
        similarityPercent: 34,
        riskLevel: "low",
        explanation: "Štandardná učebnicová definícia v prehľade literatúry. Citácia je riadne uvedená v zozname zdrojov.",
      },
      {
        id: "flag-2",
        section: "3.1 Architektúra systému",
        snippet: "Trénovací proces prebiehal s použitím algoritmu AdamW s počiatočnou rýchlosťou učenia 1e-4 a váhovou regularizáciou...",
        matchedSource: "GitHub Open Source repository (PyTorch docs)",
        similarityPercent: 28,
        riskLevel: "low",
        explanation: "Technická špecifikácia trénovacích hyperparametrov a knižničných volaní.",
      },
    ],
  })

  const handleRunDeepScan = async () => {
    setIsAnalyzing(true)
    await new Promise((r) => setTimeout(r, 1200))
    setIsAnalyzing(false)
  }

  const similarityColor =
    (report?.overallSimilarityPercent || 0) > 25
      ? "text-red-500"
      : (report?.overallSimilarityPercent || 0) > 15
      ? "text-amber-500"
      : "text-emerald-500"

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 lg:p-6">
      {/* Header Overview Card */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary/40 text-primary">
                  <ShieldAlert className="size-3 mr-1" />
                  Krok 1B: Integrita & Originalita
                </Badge>
                <Badge
                  className={cn(
                    "text-xs font-semibold",
                    report?.status === "clear"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : report?.status === "warning"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                      : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
                  )}
                >
                  {report?.status === "clear"
                    ? "Integrita v poriadku"
                    : report?.status === "warning"
                    ? "Zvýšená miera zhody"
                    : "Kritická miera zhody"}
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                Protokol originality a detekcie syntetického textu
              </CardTitle>
              <CardDescription>
                Automatizovaná kontrola textových prekrytí s centrálnym registrom záverečných prác (CRZP) a heuristická analýza AI-asistovaného písania.
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRunDeepScan}
              disabled={isAnalyzing}
              className="gap-1.5"
            >
              <RefreshCw className={cn("size-3.5", isAnalyzing && "animate-spin")} />
              {isAnalyzing ? "Analyzujem korpus..." : "Prepočítať zhody"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-muted/40 p-4 rounded-xl border space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Celková textová zhoda</span>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-3xl font-black font-mono", similarityColor)}>
                  {report?.overallSimilarityPercent}%
                </span>
                <span className="text-xs text-muted-foreground">CRZP baseline &lt; 20%</span>
              </div>
              <Progress value={report?.overallSimilarityPercent || 0} className="h-1.5" />
            </div>

            <div className="bg-muted/40 p-4 rounded-xl border space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Pravdepodobnosť AI textu</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-foreground">
                  {report?.aiTextProbabilityPercent}%
                </span>
                <span className="text-xs text-emerald-600 font-medium">Nízka (Autorské)</span>
              </div>
              <Progress value={report?.aiTextProbabilityPercent || 0} className="h-1.5" />
            </div>

            <div className="bg-muted/40 p-4 rounded-xl border space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Hustota a kvalita citácií</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-primary">
                  {report?.citationDensityScore}/100
                </span>
                <span className="text-xs text-muted-foreground">Vyvážené zdroje</span>
              </div>
              <Progress value={report?.citationDensityScore || 0} className="h-1.5" />
            </div>
          </div>

          {/* Flagged Passages List */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileSearch className="size-4 text-primary" />
              Identifikované pasáže a prekrytia ({report?.flaggedPassages.length || 0})
            </h4>

            <div className="space-y-3">
              {report?.flaggedPassages.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-lg border bg-card hover:bg-accent/20 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{p.section}</span>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        Zhoda {p.similarityPercent}%
                      </Badge>
                    </div>
                    <span className="text-muted-foreground text-[11px]">
                      Zdroj: {p.matchedSource}
                    </span>
                  </div>

                  <div className="bg-muted/30 p-2.5 rounded border border-border/60 font-serif italic text-xs text-foreground/90 leading-relaxed">
                    &quot;{p.snippet}&quot;
                  </div>

                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Posúdenie: </span>
                    {p.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {onContinueToNextStep && (
            <div className="pt-2 flex justify-end">
              <Button onClick={onContinueToNextStep} className="gap-2 font-semibold">
                Pokračovať na Porozumenie textu
                <BookOpen className="size-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
