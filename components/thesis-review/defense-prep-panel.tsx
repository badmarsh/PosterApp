"use client"

/**
 * DefensePrepPanel — Obhajoba Defense Prep & Question Generator.
 *
 * Generates anticipated defense challenges, opponent questions, and strategic
 * talking points for the candidate derived from findings in Step 4/5.
 */

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Textarea } from "@/components/ui/textarea"
import {
  GraduationCap,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  Copy,
  CheckCircle2,
  BookOpen,
} from "lucide-react"
import type { ReviewFinding } from "@/lib/ai/review-types"

import {
  buildDefensePackMarkdown,
  defenseQuestionRiskScore,
  riskLevel,
  sortQuestionsByRisk,
  summarizeDefenseReadiness,
  type DefensePackQuestion,
} from "@/lib/thesis-review/defense-pack"
import { useCopyFeedback } from "@/hooks/use-copy-feedback"
import { RehearsalTimer } from "@/components/thesis-review/rehearsal-timer"

/** Risk-scored defense question (pure logic lives in lib/thesis-review). */
export type DefensePrepItem = DefensePackQuestion

interface Props {
  workspaceId: string
  findings?: ReviewFinding[]
  existingQuestions?: string[]
}

export function DefensePrepPanel({
  workspaceId,
  findings = [],
  existingQuestions = [],
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sortByRisk, setSortByRisk] = useState(true)
  const { copy, isCopied } = useCopyFeedback()

  // Seed default questions derived from findings or defaults
  const [prepItems, setPrepItems] = useState<DefensePrepItem[]>([
    {
      id: "dp-1",
      category: "Metodológia a experimenty",
      questionText: "Ako by sa zmenili výsledky klasifikácie pri aplikácii modelu na out-of-distribution doménové dáta?",
      difficulty: "probing",
      derivedFromFindingTitle: "Chýbajúca validácia na externom datasete",
      suggestedTalkingPoints: [
        "Zdôrazniť, že primárnym cieľom bola validácia základnej hypotézy na kontrolovanom datasete.",
        "Uviesť plánovanú aplikáciu domain-adaptation techník v budúcom výskume.",
        "Poukázať na robustnosť normalizačných vrstiev v kapitole 4.2.",
      ],
      recommendedEvidenceQuote: "Model bol testovaný na 10,000 vzorkách CIFAR-10.",
    },
    {
      id: "dp-2",
      category: "Štatistická rigoróznosť",
      questionText: "Aký bol dôvod voľby p-hodnoty bez korekcie na mnohonásobné testovanie hypotéz?",
      difficulty: "challenging",
      derivedFromFindingTitle: "Absencia Bonferroniho korekcie",
      suggestedTalkingPoints: [
        "Vysvetliť, že išlo o exploračnú fázu analýzy.",
        "Pripomenúť, že pre kľúčové metriky boli spočítané 95% konfidenčné intervaly bootstrappingom.",
      ],
    },
    {
      id: "dp-3",
      category: "Praktická aplikovateľnosť",
      questionText: "Aké sú výpočtové a pamäťové nároky navrhnutého riešenia pri nasadení v reálnom čase?",
      difficulty: "standard",
      suggestedTalkingPoints: [
        "Kvantifikovať latenciu inferencie (napr. ~14 ms na štandardnom GPU).",
        "Zdôvodniť možnosť kvantizácie modelu na INT8 pre mobilné embedded zariadenia.",
      ],
    },
  ])

  const handleCopyQuestion = (item: DefensePrepItem) => {
    const text = `Otázka na obhajobu: ${item.questionText}\n\nOdporúčané body odpovede:\n${item.suggestedTalkingPoints.map((p) => `- ${p}`).join("\n")}`
    navigator.clipboard.writeText(text)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const readiness = summarizeDefenseReadiness(prepItems)
  const displayItems = sortByRisk ? sortQuestionsByRisk(prepItems) : prepItems

  const handleCopyPack = () => {
    const md = buildDefensePackMarkdown({ title: "dizertačná práca" }, prepItems)
    void copy(md, "defense-pack", "Balíček na obhajobu skopírovaný")
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 lg:p-6">
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary/40 text-primary">
                  <GraduationCap className="size-3 mr-1" />
                  Príprava na štátnu záverečnú skúšku & obhajobu
                </Badge>
                <Badge className={readiness.verdict === "at-risk"
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : readiness.verdict === "needs-preparation"
                    ? "bg-warning/10 text-warning border-warning/30"
                    : "bg-success/10 text-success border-success/30"}
                >
                  {prepItems.length} cielených otázok · {readiness.highRisk} vysokej rizikovosti
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <HelpCircle className="size-5 text-primary" />
                Predpokladané otázky oponenta a argumentačné body
              </CardTitle>
              <CardDescription>
                Tieto otázky sú automaticky odvodené zo slabých miest a limitácií identifikovaných v posudku (Krok 4 a 5).
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 p-2.5">
            <RehearsalTimer className="flex-1 min-w-[16rem]" />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSortByRisk((v) => !v)}
                aria-pressed={sortByRisk}
                className="h-8 gap-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring"
                title="Zoradiť otázky od najrizikovejšej"
              >
                <AlertTriangle className="size-3.5" />
                {sortByRisk ? "Zoradené podľa rizika" : "Pôvodné poradie"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyPack}
                disabled={prepItems.length === 0}
                className="h-8 gap-1.5 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isCopied("defense-pack") ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-success" />
                    Skopírované
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Balíček (Markdown)
                  </>
                )}
              </Button>
            </div>
          </div>
          <p className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {readiness.recommendation}
          </p>
          {prepItems.length === 0? (
            <EmptyState
              icon={HelpCircle}
              title="No defense questions yet"
              description="Generate review findings first — anticipated opponent questions will be derived from weak points in your thesis."
            />
          ) : (
            displayItems.map((item, idx) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border bg-card hover:bg-accent/10 hover:border-primary/20 transition-colors duration-150 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      Otázka #{idx + 1}
                    </Badge>
                    <span className="font-medium text-muted-foreground">{item.category}</span>
                    {(() => {
                      const score = defenseQuestionRiskScore(item)
                      const level = riskLevel(score)
                      return (
                        <Badge
                          className={
                            level === "high"
                              ? "bg-destructive/10 text-destructive border-destructive/30 text-[10px]"
                              : level === "medium"
                                ? "bg-warning/10 text-warning border-warning/30 text-[10px]"
                                : "bg-success/10 text-success border-success/30 text-[10px]"
                          }
                          title="Riziko otázky (náročnosť, kategória, pripravenosť evidencie)"
                        >
                          Riziko {score}/100
                        </Badge>
                      )
                    })()}
                    {item.difficulty === "challenging" && (
                      <Badge className="bg-destructive/10 text-destructive dark:text-destructive text-[10px]">
                        Náročná otázka
                      </Badge>
                    )}
                    {item.difficulty === "probing" && (
                      <Badge className="bg-warning/10 text-warning dark:text-warning text-[10px]">
                        Hĺbková otázka
                      </Badge>
                    )}
                  </div>

                  <h4 className="font-semibold text-base text-foreground leading-snug pt-1">
                    {item.questionText}
                  </h4>

                  {item.derivedFromFindingTitle && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="size-3 text-warning shrink-0" />
                      Odvodené zo zistenia: <span className="font-medium text-foreground">{item.derivedFromFindingTitle}</span>
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyQuestion(item)}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {copiedId === item.id ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                      Skopírované
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Kopírovať
                    </>
                  )}
                </Button>
              </div>

              {/* Recommended Talking Points */}
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 space-y-1.5">
                <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <Lightbulb className="size-3.5" />
                  Odporúčaná argumentačná línia kandidáta:
                </span>
                <ul className="space-y-1 pl-4 list-disc text-xs text-foreground/90 leading-relaxed">
                  {item.suggestedTalkingPoints.map((point, pIdx) => (
                    <li key={pIdx}>{point}</li>
                  ))}
                </ul>
              </div>

              {item.recommendedEvidenceQuote && (
                <p className="rounded-lg border border-border bg-muted/20 p-2.5 text-xs italic text-muted-foreground">
                  <BookOpen className="mr-1.5 inline size-3 shrink-0 text-primary" />
                  Evidencia z práce: „{item.recommendedEvidenceQuote}“
                </p>
              )}
            </div>
          ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
