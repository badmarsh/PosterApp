"use client"

/**
 * ThesisMetadataPanel — sidebar form for entering review metadata.
 *
 * Supports both Academic Thesis Assessments and Scientific Paper Peer Reviews
 * with reporting guideline selection (CONSORT, PRISMA, STROBE, ML).
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
import { Loader2, FileText, Sparkles, AlertCircle, ShieldCheck, Lock } from "lucide-react"
import { useThesisReviewStore } from "./use-thesis-review-store"
import { RagIndexStatusPanel } from "./rag-index-status-panel"
import type { ThesisMetadata } from "@/lib/ai/thesis-rubric"
import type { ReviewKind, ReportingStandard } from "@/lib/ai/review-types"

interface Props {
  workspaceId: string
}

const LANGUAGES = [
  { value: "sk", label: "Slovenčina" },
  { value: "cs", label: "Čeština" },
  { value: "en", label: "English" },
]

const REVIEW_KINDS = [
  { value: "thesis", sk: "Záverečná práca (BSc/MSc/PhD)", cs: "Závěrečná práce", en: "Academic Thesis" },
  { value: "paper", sk: "Vedecký článok / Peer Review", cs: "Vědecký článek / Peer Review", en: "Scientific Paper / Peer Review" },
  { value: "grant", sk: "Projektový / Grantový návrh", cs: "Projektový / Grantový návrh", en: "Grant / Project Proposal" },
]

const THESIS_TYPES = [
  { value: "bachelor", sk: "Bakalárska práca", cs: "Bakalářská práce", en: "Bachelor's thesis" },
  { value: "master", sk: "Diplomová práca", cs: "Diplomová práce", en: "Master's thesis" },
  { value: "phd", sk: "Dizertačná práca", cs: "Dizertační práce", en: "PhD dissertation" },
]

const REPORTING_STANDARDS = [
  { value: "none", label: "Všeobecné akademické hodnotenie" },
  { value: "consort", label: "CONSORT 2025 (Klinické štúdie)" },
  { value: "prisma", label: "PRISMA 2020 (Systematické prehľady)" },
  { value: "strobe", label: "STROBE (Observačné štúdie)" },
  { value: "ml_reproducibility", label: "ML Reproducibility (Strojové učenie)" },
]

const REVIEWER_ROLES = [
  { value: "opponent", sk: "Oponent/ka / Peer Reviewer", cs: "Oponent/ka", en: "Opponent / Reviewer" },
  { value: "supervisor", sk: "Vedúci/a práce", cs: "Vedoucí práce", en: "Supervisor" },
  { value: "editor", sk: "Editor / Vedúci komisie", cs: "Editor / Vedoucí komise", en: "Editor / Committee Chair" },
]

export function ThesisMetadataPanel({ workspaceId }: Props) {
  const {
    generateReview,
    generateAnalysisPlan,
    isGenerating,
    isGeneratingPlan,
    generateError,
    clearErrors,
    activeReview,
  } = useThesisReviewStore()

  const [lang, setLang] = useState<"sk" | "cs" | "en">("sk")
  const [reviewKind, setReviewKind] = useState<ReviewKind>("thesis")
  const [reportingStandard, setReportingStandard] = useState<ReportingStandard>("none")
  const [targetVenue, setTargetVenue] = useState("STEM / Fyzika")
  const [confidentialityAgreed, setConfidentialityAgreed] = useState(true)
  const [metadata, setMetadata] = useState<ThesisMetadata>({
    studentName: "",
    thesisTitle: "",
    thesisType: "phd", // Default to PhD based on previous request
    reviewerRole: "opponent",
    reviewerName: "",
    institution: "Prírodovedecká fakulta",
    department: "Katedra Fyziky (STEM)",
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
      metadata: {
        ...metadata,
        language: lang,
        reviewKind,
        targetVenue: targetVenue.trim() || undefined,
        reportingStandard,
      },
      skipCitationAudit,
      professionalMode: reviewKind === "paper" || reportingStandard !== "none",
    })
  }

  const isValid = metadata.studentName.trim() && metadata.thesisTitle.trim() && confidentialityAgreed

  const thesisTypeLabel = (val?: string | null) =>
    val ? (THESIS_TYPES.find((t) => t.value === val)?.[lang] ?? val) : ""
  const roleLabel = (val?: string | null) =>
    val ? (REVIEWER_ROLES.find((r) => r.value === val)?.[lang] ?? val) : ""
  const kindLabel = (val?: string | null) =>
    val ? (REVIEW_KINDS.find((k) => k.value === val)?.[lang] ?? val) : ""

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-sm font-semibold">
            {reviewKind === "paper" ? "Posudok vedeckého článku" : "Posudok záverečnej práce"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Nastavte parametre a spustite analytické hodnotenie
          </p>
        </div>
      </div>

      {activeReview && (
        <div className="rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          ✓ Posudok vygenerovaný: <strong>{activeReview.studentName}</strong>
          {activeReview.grade && <Badge variant="outline" className="ml-2">{activeReview.grade}</Badge>}
        </div>
      )}

      <Separator />

      {/* Review Kind */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Režim posudzovania</Label>
        <Select value={reviewKind} onValueChange={(v) => { if (v) setReviewKind(v as ReviewKind) }}>
          <SelectTrigger className="h-8 text-xs font-semibold">
            <SelectValue>{kindLabel(reviewKind)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {REVIEW_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value} className="text-xs font-medium">
                {k[lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Language selector */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Jazyk posudku</Label>
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

      {/* Thesis type / Scope */}
      {reviewKind === "thesis" ? (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Úroveň záverečnej práce</Label>
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
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Reporting Guideline (EQUATOR Network)</Label>
          <Select value={reportingStandard} onValueChange={(v) => { if (v) setReportingStandard(v as ReportingStandard) }}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORTING_STANDARDS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Target Venue / Journal / University */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {reviewKind === "paper" ? "Cieľový časopis / Konferencia" : "Univerzita / Fakulta"}
        </Label>
        <Input
          className="h-8 text-xs"
          placeholder={reviewKind === "paper" ? "Nature Communications / IEEE Trans..." : "STU v Bratislave, FIIT"}
          value={targetVenue}
          onChange={(e) => setTargetVenue(e.target.value)}
        />
      </div>

      {/* Reviewer role */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Rola hodnotiteľa</Label>
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

      {/* Student / Author name */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Meno autora/autorky *</Label>
        <Input
          className="h-8 text-xs"
          placeholder="Ján Novák"
          value={metadata.studentName}
          onChange={(e) => update("studentName", e.target.value)}
        />
      </div>

      {/* Thesis / Document title */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Názov práce / článku *</Label>
        <Input
          className="h-8 text-xs"
          placeholder="Návrh a experimentálne vyhodnotenie…"
          value={metadata.thesisTitle}
          onChange={(e) => update("thesisTitle", e.target.value)}
        />
      </div>

      {/* Reviewer name */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Meno recenzenta/ky</Label>
        <Input
          className="h-8 text-xs"
          placeholder="doc. Ing. Peter Novák, PhD."
          value={metadata.reviewerName ?? ""}
          onChange={(e) => update("reviewerName", e.target.value)}
        />
      </div>

      <Separator />

      {/* Confidentiality and AI Ethics Pledge */}
      <div className="rounded-lg border bg-muted/30 p-2.5 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 text-foreground font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>COPE & Dôvernosť</span>
        </div>
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            id="confidentiality"
            checked={confidentialityAgreed}
            onChange={(e) => setConfidentialityAgreed(e.target.checked)}
            className="mt-0.5 rounded"
          />
          <label htmlFor="confidentiality" className="cursor-pointer leading-tight">
            Potvrdzujem, že rukopis je posudzovaný v súlade s etickými pravidlami COPE a recenzent nesie osobnú zodpovednosť za finálny posudok.
          </label>
        </div>
      </div>

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
          Preskočiť overovanie citácií (rýchlejšie)
        </label>
      </div>

      {/* Error */}
      {generateError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{generateError}</span>
        </div>
      )}

      {/* Generate buttons */}
      <div className="space-y-2 pt-1">
        <Button
          onClick={handleGenerate}
          disabled={!isValid || isGenerating || isGeneratingPlan}
          className="w-full gap-2 font-semibold text-xs"
          size="sm"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generujem odborný posudok…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Vygenerovať odborný posudok
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={async () => {
            clearErrors()
            await generateAnalysisPlan(workspaceId, {
              ...metadata,
              language: lang,
              reviewKind,
              targetVenue: targetVenue.trim() || undefined,
              reportingStandard,
            })
          }}
          disabled={!isValid || isGenerating || isGeneratingPlan}
          className="w-full gap-2 text-xs"
          size="sm"
        >
          {isGeneratingPlan ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyzujem štruktúru…
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5 text-primary" />
              Predanalýza a plánovanie (Pre-flight)
            </>
          )}
        </Button>
      </div>

      {!isValid && (
        <p className="text-center text-xs text-muted-foreground">
          * Vyplňte meno autora, názov práce a potvrďte zásady dôvernosti
        </p>
      )}

      {/* RAG vector index diagnostics */}
      <RagIndexStatusPanel workspaceId={workspaceId} />
    </div>
  )
}
