"use client"

/**
 * FacultyAdminPanel — Department Oversight & Cross-Workspace Review Management.
 *
 * Provides department heads and faculty administrators with an aggregated view of:
 *  - Department-wide thesis submissions & review progress
 *  - Active faculty rubric templates & weight configurations
 *  - Reviewer workload distribution (Supervisor / Opponent assignments)
 *  - 1-click batch export to AIS2 and CSV grade roster
 */

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Building2,
  Users,
  FileCheck2,
  Download,
  SlidersHorizontal,
  FileSpreadsheet,
  Layers,
  GraduationCap,
} from "lucide-react"
import { FACULTY_RUBRIC_TEMPLATES } from "@/lib/ai/rubric-templates"
import { generateCsvGradeRoster } from "@/lib/export/export-templates"
import type { ThesisReviewListItem } from "./use-thesis-review-store"

interface Props {
  workspaceId: string
  reviews: ThesisReviewListItem[]
  onOpenBatchDialog?: () => void
  onOpenRubricModal?: () => void
}

export function FacultyAdminPanel({
  workspaceId,
  reviews,
  onOpenBatchDialog,
  onOpenRubricModal,
}: Props) {
  const [selectedFaculty, setSelectedFaculty] = useState("Univerzita Komenského — Prírodovedecká fakulta")

  const handleExportCsv = () => {
    const csvContent = generateCsvGradeRoster(reviews)
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `hodnotenie-prac-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 lg:p-6">
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary/40 text-primary">
                  <Building2 className="size-3 mr-1" />
                  Katedrová administrácia
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Správa štátnic
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <GraduationCap className="size-5 text-primary" />
                Administrácia záverečných prác a oponentských posudkov
              </CardTitle>
              <CardDescription>
                Centrálny prehľad odovzdaných prác, priradených posudzovateľov, fakultných šablón a exportov pre študijné oddelenie.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handleExportCsv}
              >
                <FileSpreadsheet className="size-3.5" />
                Exportovať CSV súpisku
              </Button>
              {onOpenBatchDialog && (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs h-8 font-semibold"
                  onClick={onOpenBatchDialog}
                >
                  <Layers className="size-3.5" />
                  Dávkový import PDF
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border bg-muted/30 space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Celkový počet prác v katedre</span>
              <p className="text-2xl font-black font-mono text-foreground">{reviews.length}</p>
            </div>
            <div className="p-4 rounded-xl border bg-muted/30 space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Ukončené a potvrdené posudky</span>
              <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {reviews.filter((r) => r.status === "final" || r.confirmedAt).length}
              </p>
            </div>
            <div className="p-4 rounded-xl border bg-muted/30 space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Aktívna fakultná rubrika</span>
              <p className="text-sm font-semibold text-primary truncate">
                UK Prírodovedecká (STEM)
              </p>
            </div>
          </div>

          {/* Department Submissions Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileCheck2 className="size-4 text-primary" />
                Zoznam evidovaných prác ({reviews.length})
              </h4>
              {onOpenRubricModal && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                  onClick={onOpenRubricModal}
                >
                  <SlidersHorizontal className="size-3" />
                  Spravovať váhy rubrík
                </Button>
              )}
            </div>

            <div className="border rounded-xl overflow-hidden text-xs">
              <div className="grid grid-cols-12 bg-muted/60 p-3 font-semibold text-muted-foreground border-b">
                <div className="col-span-4">Študent & Názov práce</div>
                <div className="col-span-3">Posudzovateľ</div>
                <div className="col-span-2">Rola / Typ</div>
                <div className="col-span-2">Navrhnutá známka</div>
                <div className="col-span-1 text-right">Stav</div>
              </div>

              <div className="divide-y max-h-72 overflow-y-auto no-scrollbar">
                {reviews.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground italic">
                    V tomto workspace zatiaľ nie sú evidované žiadne posudky.
                  </div>
                ) : (
                  reviews.map((r) => (
                    <div key={r.id} className="grid grid-cols-12 p-3 items-center hover:bg-muted/20 transition-colors">
                      <div className="col-span-4 min-w-0 pr-2">
                        <p className="font-semibold text-foreground truncate">{r.studentName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{r.thesisTitle}</p>
                      </div>
                      <div className="col-span-3 truncate text-muted-foreground">
                        {r.reviewerName || "Nepriradený"}
                      </div>
                      <div className="col-span-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {r.reviewerRole} • {r.thesisType}
                        </Badge>
                      </div>
                      <div className="col-span-2 font-mono font-bold text-foreground">
                        {r.finalGrade || r.grade || "—"}
                      </div>
                      <div className="col-span-1 text-right">
                        <Badge
                          className={
                            r.status === "final" || r.confirmedAt
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px]"
                              : "bg-muted text-muted-foreground text-[10px]"
                          }
                        >
                          {r.status === "final" || r.confirmedAt ? "Finál" : "Koncept"}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
