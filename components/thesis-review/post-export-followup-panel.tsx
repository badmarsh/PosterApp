"use client"

/**
 * PostExportFollowupPanel — Resubmission & Revision Tracking.
 *
 * Tracks whether the author/student successfully addressed the "Návrhy na zlepšenie"
 * (actionable improvement recommendations) in subsequent revisions or camera-ready drafts.
 */

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  GitCompare,
  CheckCircle2,
  AlertCircle,
  Clock,
  Save,
  FileCheck2,
  Filter,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type RevisionTaskStatus = "resolved" | "partially_resolved" | "unresolved" | "dismissed"

export interface RevisionTaskItem {
  id: string
  criterionId: string
  criterionTitle: string
  recommendationText: string
  status: RevisionTaskStatus
  authorNote?: string
  reviewerVerificationNote?: string
}

interface Props {
  workspaceId: string
  suggestions?: string[]
}

export function PostExportFollowupPanel({ workspaceId, suggestions = [] }: Props) {
  const [tasks, setTasks] = useState<RevisionTaskItem[]>([
    {
      id: "task-1",
      criterionId: "methodology",
      criterionTitle: "Metodológia a postup riešenia",
      recommendationText: "Doplniť popis hyperparametrov trénovania a špecifikáciu hardvéru.",
      status: "resolved",
      authorNote: "Zapracované do podkapitoly 3.2 (strana 28) vrátane tabuľky GPU prostredia.",
    },
    {
      id: "task-2",
      criterionId: "results",
      criterionTitle: "Výsledky a ich vyhodnotenie",
      recommendationText: "Pridať stĺpcový graf porovnania s baseline modelom ResNet-50.",
      status: "partially_resolved",
      authorNote: "Graf bol pridaný ako Obrázok 4.3, chýba však presné percentuálne vyčíslenie v texte.",
    },
    {
      id: "task-3",
      criterionId: "citations_bibliography",
      criterionTitle: "Práca s literatúrou a citáciami",
      recommendationText: "Doplniť DOI identifikátory pri online článkoch podľa normy ISO 690.",
      status: "resolved",
      authorNote: "Všetky záznamy v zozname literatúry boli aktualizované o platné DOI odkazy.",
    },
  ])

  const resolvedCount = tasks.filter((t) => t.status === "resolved").length
  const progressPercent = Math.round((resolvedCount / Math.max(1, tasks.length)) * 100)

  const handleUpdateStatus = (id: string, status: RevisionTaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 lg:p-6">
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary/40 text-primary">
                  <GitCompare className="size-3 mr-1" />
                  Post-Export Sledovanie
                </Badge>
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  {resolvedCount} / {tasks.length} zapracovaných
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <FileCheck2 className="size-5 text-primary" />
                Sledovanie zapracovania pripomienok oponenta (Redline audit)
              </CardTitle>
              <CardDescription>
                Evidencia a overenie zapracovania jednotlivých návrhov na zlepšenie študentom pred finálnou obhajobou.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Bar Header */}
          <div className="bg-muted/40 p-4 rounded-xl border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Miera zapracovania odporúčaní:</span>
              <span className="font-bold font-mono text-primary">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-xl border bg-card hover:bg-accent/10 transition-colors space-y-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                      {task.criterionTitle}
                    </span>
                    <h4 className="font-semibold text-sm text-foreground">
                      {task.recommendationText}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant={task.status === "resolved" ? "default" : "outline"}
                      className={cn(
                        "h-7 text-xs gap-1",
                        task.status === "resolved" && "bg-emerald-600 hover:bg-emerald-700 text-white"
                      )}
                      onClick={() => handleUpdateStatus(task.id, "resolved")}
                    >
                      <CheckCircle2 className="size-3" />
                      Zapracované
                    </Button>
                    <Button
                      size="sm"
                      variant={task.status === "partially_resolved" ? "default" : "outline"}
                      className={cn(
                        "h-7 text-xs gap-1",
                        task.status === "partially_resolved" && "bg-amber-600 hover:bg-amber-700 text-white"
                      )}
                      onClick={() => handleUpdateStatus(task.id, "partially_resolved")}
                    >
                      <Clock className="size-3" />
                      Čiastočne
                    </Button>
                  </div>
                </div>

                {task.authorNote && (
                  <div className="bg-muted/40 p-2.5 rounded-lg border border-border/60 text-muted-foreground">
                    <span className="font-medium text-foreground">Poznámka študenta: </span>
                    {task.authorNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
