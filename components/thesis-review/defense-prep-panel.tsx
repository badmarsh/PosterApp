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

export interface DefensePrepItem {
  id: string
  category: string
  questionText: string
  difficulty: "standard" | "probing" | "challenging"
  derivedFromFindingTitle?: string
  suggestedTalkingPoints: string[]
  recommendedEvidenceQuote?: string
}

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
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  {prepItems.length} cielených otázok
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
          {prepItems.map((item, idx) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border bg-card hover:bg-accent/10 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      Otázka #{idx + 1}
                    </Badge>
                    <span className="font-medium text-muted-foreground">{item.category}</span>
                    {item.difficulty === "challenging" && (
                      <Badge className="bg-destructive/100/10 text-destructive dark:text-destructive text-[10px]">
                        Náročná otázka
                      </Badge>
                    )}
                    {item.difficulty === "probing" && (
                      <Badge className="bg-warning/100/10 text-warning dark:text-warning text-[10px]">
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
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
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
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
