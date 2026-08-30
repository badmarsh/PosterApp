"use client"

/**
 * ThesisMetadataPanel — sidebar form for entering thesis review metadata.
 *
 * Fields: studentName, thesisTitle, thesisType, reviewerRole, reviewerName,
 *         institution, department, language, academicYear.
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileText, Sparkles, AlertCircle } from "lucide-react"
import { useThesisReviewStore } from "./use-thesis-review-store"
import type { ThesisMetadata } from "@/lib/ai/thesis-rubric"

interface Props {
  workspaceId: string
}

const LANGUAGES = [
  { value: "sk", label: "Slovenčina" },
  { value: "cs", label: "Čeština" },
  { value: "en", label: "English" },
]

const THESIS_TYPES = [
  { value: "bachelor", sk: "Bakalárska práca", cs: "Bakalářská práce", en: "Bachelor's thesis" },
  { value: "master", sk: "Diplomová práca", cs: "Diplomová práce", en: "Master's thesis" },
  { value: "phd", sk: "Dizertačná práca", cs: "Dizertační práce", en: "PhD dissertation" },
]

const REVIEWER_ROLES = [
  { value: "opponent", sk: "Oponent/ka", cs: "Oponent/ka", en: "Opponent" },
  { value: "supervisor", sk: "Vedúci/a práce", cs: "Vedoucí práce", en: "Supervisor" },
]

export function ThesisMetadataPanel({ workspaceId }: Props) {
  const { generateReview, isGenerating, generateError, clearErrors, activeReview } = useThesisReviewStore()

  const [lang, setLang] = useState<"sk" | "cs" | "en">("sk")
  const [metadata, setMetadata] = useState<ThesisMetadata>({
    studentName: "",
    thesisTitle: "",
    thesisType: "master",
    reviewerRole: "opponent",
    reviewerName: "",
    institution: "",
    department: "",
    language: "sk",
    academicYear: "",
  })
  const [skipCitationAudit, setSkipCitationAudit] = useState(false)

  const update = (field: keyof ThesisMetadata, value: string) =>
    setMetadata((prev) => ({ ...prev, [field]: value }))

  const handleGenerate = async () => {
    clearErrors()
    await generateReview({
      workspaceId,
      metadata: { ...metadata, language: lang },
      skipCitationAudit,
    })
  }

  const isValid = metadata.studentName.trim() && metadata.thesisTitle.trim()

  const thesisTypeLabel = (val?: string | null) =>
    val ? (THESIS_TYPES.find((t) => t.value === val)?.[lang] ?? val) : ""
  const roleLabel = (val?: string | null) =>
    val ? (REVIEWER_ROLES.find((r) => r.value === val)?.[lang] ?? val) : ""

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-blue-600" />
        <div>
          <h2 className="text-sm font-semibold">
            {lang === "sk" ? "Posudok záverečnej práce" : lang === "cs" ? "Posudek závěrečné práce" : "Thesis Assessment"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {lang === "sk" ? "Vyplňte metadáta a vygenerujte posudok" : lang === "cs" ? "Vyplňte metadata a vygenerujte posudek" : "Fill metadata and generate the review"}
          </p>
        </div>
      </div>

      {activeReview && (
        <div className="rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          ✓ {lang === "sk" ? "Posudok vygenerovaný" : lang === "cs" ? "Posudek vygenerován" : "Review generated"}: <strong>{activeReview.studentName}</strong>
          {activeReview.grade && <Badge variant="outline" className="ml-2">{activeReview.grade}</Badge>}
        </div>
      )}

      <Separator />

      {/* Language selector */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {lang === "sk" ? "Jazyk posudku" : lang === "cs" ? "Jazyk posudku" : "Review language"}
        </Label>
        <Select value={lang} onValueChange={(v) => { if (v) { setLang(v as "sk" | "cs" | "en"); update("language", v) } }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value} className="text-xs">{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Thesis type */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {lang === "sk" ? "Typ práce" : lang === "cs" ? "Typ práce" : "Thesis type"}
        </Label>
        <Select value={metadata.thesisType} onValueChange={(v) => { if (v) update("thesisType", v) }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue>{thesisTypeLabel(metadata.thesisType)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {THESIS_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">{t[lang]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Reviewer role */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {lang === "sk" ? "Rola hodnotiteľa" : lang === "cs" ? "Role hodnotitele" : "Reviewer role"}
        </Label>
        <Select value={metadata.reviewerRole} onValueChange={(v) => { if (v) update("reviewerRole", v) }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue>{roleLabel(metadata.reviewerRole)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {REVIEWER_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value} className="text-xs">{r[lang]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Student name */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {lang === "sk" ? "Meno autora/autorky *" : lang === "cs" ? "Jméno autora/autorky *" : "Student name *"}
        </Label>
        <Input
          className="h-8 text-xs"
          placeholder={lang === "sk" ? "Ján Novák" : lang === "cs" ? "Jan Novák" : "Jane Smith"}
          value={metadata.studentName}
          onChange={(e) => update("studentName", e.target.value)}
        />
      </div>

      {/* Thesis title */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {lang === "sk" ? "Názov práce *" : lang === "cs" ? "Název práce *" : "Thesis title *"}
        </Label>
        <Input
          className="h-8 text-xs"
          placeholder={lang === "sk" ? "Návrh a implementácia…" : lang === "cs" ? "Návrh a implementace…" : "Design and Implementation of…"}
          value={metadata.thesisTitle}
          onChange={(e) => update("thesisTitle", e.target.value)}
        />
      </div>

      {/* Reviewer name */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {lang === "sk" ? "Meno hodnotiteľa/ky" : lang === "cs" ? "Jméno hodnotitele/ky" : "Reviewer name"}
        </Label>
        <Input
          className="h-8 text-xs"
          placeholder={lang === "sk" ? "Prof. Ing. Mária Kováčová, PhD." : "Prof. Dr. …"}
          value={metadata.reviewerName ?? ""}
          onChange={(e) => update("reviewerName", e.target.value)}
        />
      </div>

      {/* Institution */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {lang === "sk" ? "Inštitúcia" : lang === "cs" ? "Instituce" : "Institution"}
        </Label>
        <Input
          className="h-8 text-xs"
          placeholder={lang === "sk" ? "Slovenská technická univerzita" : "Czech Technical University"}
          value={metadata.institution ?? ""}
          onChange={(e) => update("institution", e.target.value)}
        />
      </div>

      {/* Department */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {lang === "sk" ? "Katedra/Ústav" : lang === "cs" ? "Katedra/Ústav" : "Department"}
        </Label>
        <Input
          className="h-8 text-xs"
          placeholder={lang === "sk" ? "Katedra informatiky" : "Department of Computer Science"}
          value={metadata.department ?? ""}
          onChange={(e) => update("department", e.target.value)}
        />
      </div>

      {/* Academic year */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {lang === "sk" ? "Akademický rok" : lang === "cs" ? "Akademický rok" : "Academic year"}
        </Label>
        <Input
          className="h-8 text-xs"
          placeholder="2025/2026"
          value={metadata.academicYear ?? ""}
          onChange={(e) => update("academicYear", e.target.value)}
        />
      </div>

      <Separator />

      {/* Options */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          id="skipCiteAudit"
          checked={skipCitationAudit}
          onChange={(e) => setSkipCitationAudit(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="skipCiteAudit" className="cursor-pointer">
          {lang === "sk" ? "Preskočiť overovanie citácií (rýchlejšie)" : lang === "cs" ? "Přeskočit ověřování citací (rychlejší)" : "Skip citation audit (faster)"}
        </label>
      </div>

      {/* Error */}
      {generateError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{generateError}</span>
        </div>
      )}

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={!isValid || isGenerating}
        className="w-full gap-2"
        size="sm"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {lang === "sk" ? "Generujem posudok…" : lang === "cs" ? "Generuji posudek…" : "Generating review…"}
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            {lang === "sk" ? "Vygenerovať posudok" : lang === "cs" ? "Vygenerovat posudek" : "Generate review"}
          </>
        )}
      </Button>

      {!isValid && (
        <p className="text-center text-xs text-muted-foreground">
          {lang === "sk" ? "* Vyplňte meno autora a názov práce" : lang === "cs" ? "* Vyplňte jméno autora a název práce" : "* Fill in student name and thesis title"}
        </p>
      )}
    </div>
  )
}
