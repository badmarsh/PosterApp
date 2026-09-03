"use client"

/**
 * SupervisorSignoffPanel — Advisor Assessment & Pre-Review Notes.
 *
 * Captures the thesis supervisor's evaluation of the student's initiative,
 * independence, regularity of consultations, and lab diligence before opponent review.
 */

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  UserCheck,
  CheckCircle2,
  Save,
  GraduationCap,
  Sparkles,
  Info,
  Clock,
  Award,
} from "lucide-react"

export interface SupervisorSignoffData {
  supervisorName: string
  consultationRegularity: "regular" | "sporadic" | "minimal"
  studentIndependence: "high" | "average" | "low"
  initiativeRating: "excellent" | "satisfactory" | "insufficient"
  labDiligenceScore: number // 1 - 5
  preliminaryGradeRecommendation: "A" | "B" | "C" | "D" | "E" | "FX"
  confidentialAdvisorNotes: string
  publicAdvisorComment: string
  signedAt?: string
}

interface Props {
  workspaceId: string
  initialData?: Partial<SupervisorSignoffData>
  onSaveSignoff?: (data: SupervisorSignoffData) => void
  onContinue?: () => void
}

export function SupervisorSignoffPanel({
  workspaceId,
  initialData,
  onSaveSignoff,
  onContinue,
}: Props) {
  const [data, setData] = useState<SupervisorSignoffData>({
    supervisorName: initialData?.supervisorName || "doc. RNDr. Martin Kováč, PhD.",
    consultationRegularity: initialData?.consultationRegularity || "regular",
    studentIndependence: initialData?.studentIndependence || "high",
    initiativeRating: initialData?.initiativeRating || "excellent",
    labDiligenceScore: initialData?.labDiligenceScore || 5,
    preliminaryGradeRecommendation: initialData?.preliminaryGradeRecommendation || "A",
    confidentialAdvisorNotes: initialData?.confidentialAdvisorNotes || "Študent pracoval mimoriadne samostatne, navrhol vlastné rozšírenie modelu a experimenty validoval na klastri.",
    publicAdvisorComment: initialData?.publicAdvisorComment || "Práca bola vypracovaná v súlade so zadaním a odporúčam ju na obhajobu s hodnotením výborne.",
    signedAt: initialData?.signedAt || new Date().toISOString(),
  })

  const [isSaved, setIsSaved] = useState(false)

  const handleSave = () => {
    onSaveSignoff?.(data)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 lg:p-6">
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary/40 text-primary">
                  <UserCheck className="size-3 mr-1" />
                  Krok 1C: Stanovisko školiteľa
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Interné hodnotenie
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <GraduationCap className="size-5 text-primary" />
                Posúdenie prístupu a samostatnosti študenta školiteľom
              </CardTitle>
              <CardDescription>
                Tieto informácie slúžia ako vstupný kontext pre oponenta a komisiu pre štátne záverečné skúšky.
              </CardDescription>
            </div>

            <Button onClick={handleSave} className="gap-1.5 font-semibold">
              <Save className="size-4" />
              {isSaved ? "Uložené ✓" : "Uložiť stanovisko"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Supervisor Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Meno vedúceho práce</Label>
              <Input
                value={data.supervisorName}
                onChange={(e) => setData({ ...data, supervisorName: e.target.value })}
                placeholder="Titul, Meno, Priezvisko"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Predbežný návrh známky školiteľa</Label>
              <Select
                value={data.preliminaryGradeRecommendation}
                onValueChange={(val: any) => setData({ ...data, preliminaryGradeRecommendation: val })}
              >
                <SelectTrigger className="text-sm font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A — Výborne (100–91%)</SelectItem>
                  <SelectItem value="B">B — Veľmi dobre (90–81%)</SelectItem>
                  <SelectItem value="C">C — Dobre (80–71%)</SelectItem>
                  <SelectItem value="D">D — Uspokojivo (70–61%)</SelectItem>
                  <SelectItem value="E">E — Dostatočne (60–51%)</SelectItem>
                  <SelectItem value="FX">FX — Nedostatočne (&lt;50%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Qualitative Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Pravidelnosť konzultácií</Label>
              <Select
                value={data.consultationRegularity}
                onValueChange={(val: any) => setData({ ...data, consultationRegularity: val })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Pravidelné (týždenne)</SelectItem>
                  <SelectItem value="sporadic">Sporadické (mesačne)</SelectItem>
                  <SelectItem value="minimal">Minimálne / Na poslednú chvíľu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Miera samostatnosti</Label>
              <Select
                value={data.studentIndependence}
                onValueChange={(val: any) => setData({ ...data, studentIndependence: val })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Vysoká samostatnosť</SelectItem>
                  <SelectItem value="average">Štandardné vedenie</SelectItem>
                  <SelectItem value="low">Vyžadoval detailné inštrukcie</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Vlastná iniciatíva</Label>
              <Select
                value={data.initiativeRating}
                onValueChange={(val: any) => setData({ ...data, initiativeRating: val })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Vynikajúca (aktívne nápady)</SelectItem>
                  <SelectItem value="satisfactory">Priemerná (plnil zadanie)</SelectItem>
                  <SelectItem value="insufficient">Pasívny prístup</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Public & Confidential Notes */}
          <div className="space-y-4 pt-2 border-t">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Verejný komentár školiteľa do posudku
              </Label>
              <Textarea
                rows={3}
                value={data.publicAdvisorComment}
                onChange={(e) => setData({ ...data, publicAdvisorComment: e.target.value })}
                placeholder="Zhrnutie spolupráce, ktoré sa objaví v oficiálnom tlačive posudku..."
                className="text-sm leading-relaxed"
              />
            </div>

            <div className="space-y-1.5 bg-amber-500/5 p-3 rounded-lg border border-amber-500/20">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <Info className="size-3.5" />
                Dôverné poznámky školiteľa pre oponenta a komisiu
              </div>
              <Textarea
                rows={2}
                value={data.confidentialAdvisorNotes}
                onChange={(e) => setData({ ...data, confidentialAdvisorNotes: e.target.value })}
                placeholder="Tieto poznámky nebudú súčasťou verejného posudku študenta..."
                className="text-xs bg-background/80"
              />
            </div>
          </div>
        </CardContent>

        {onContinue && (
          <CardFooter className="flex justify-end border-t pt-4">
            <Button onClick={onContinue} className="gap-2 font-semibold">
              Pokračovať na Porozumenie textu
              <CheckCircle2 className="size-4" />
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
