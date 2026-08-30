"use client"

/**
 * ThesisMetadataPanel — Clean, streamlined sidebar for selecting thesis documents,
 * viewing auto-extracted metadata, and launching AI-grounded reviews.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
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
import {
  Loader2,
  FileText,
  Sparkles,
  AlertCircle,
  UploadCloud,
  FileCheck2,
  FileUp,
  GraduationCap,
  BookOpen,
} from "lucide-react"
import { useThesisReviewStore, normalizeFormMetadataToThesisMetadata } from "./use-thesis-review-store"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import type { ThesisMetadata, ThesisType, ReviewerRole, ReviewLanguage } from "@/lib/ai/thesis-rubric"
import type { ReviewKind, ReportingStandard } from "@/lib/ai/review-types"
import { formatBytes, formatDocumentDisplayName } from "@/lib/ingestion"

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
  { value: "paper", sk: "Vedecký článok / Peer Review", cs: "Vědecký článek", en: "Scientific Paper" },
]

const THESIS_TYPES = [
  { value: "master", sk: "Diplomová práca (Ing./Mgr.)", cs: "Diplomová práce", en: "Master's thesis" },
  { value: "bachelor", sk: "Bakalárska práca (Bc.)", cs: "Bakalářská práce", en: "Bachelor's thesis" },
  { value: "phd", sk: "Dizertačná práca (PhD.)", cs: "Dizertační práce", en: "PhD dissertation" },
]

const REVIEWER_ROLES = [
  { value: "opponent", sk: "Oponent/ka práce", cs: "Oponent/ka", en: "Opponent" },
  { value: "supervisor", sk: "Vedúci/a práce", cs: "Vedoucí práce", en: "Supervisor" },
  { value: "reviewer", sk: "Recenzent / Peer Reviewer", cs: "Recenzent", en: "Reviewer" },
]

export function formatCleanThesisTitle(raw: string): string {
  const trimmed = raw.replace(/[*_#`]/g, "").trim()
  if (!trimmed) return ""
  // If title is predominantly uppercase (e.g. from title page ATX header), convert to clean title case
  const letters = trimmed.replace(/[^a-zA-ZáäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/g, "")
  if (letters.length > 5 && letters === letters.toUpperCase()) {
    const lower = trimmed.toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }
  return trimmed
}

export function extractSmartThesisMetadata(text: string, filename?: string) {
  let title = ""
  let studentName = ""
  let thesisType: "bachelor" | "master" | "phd" = "master"
  let reviewKind: ReviewKind = "thesis"
  let reviewerRole = "opponent"
  let reviewerName = ""
  let institution = ""
  let department = ""
  let academicYear = ""

  const frontMatter = text.slice(0, 4500)

  // 1. Student / Author extraction
  const studentMatch = frontMatter.match(/(?:Študent(?:ka)?|Student|Autor(?:ka)?|Author|Vypracoval(?:a)?|Diplomant(?:ka)?|Bakalant(?:ka)?|Predkladá|Kandidát(?:ka)?|Meno autora|Meno študenta)\s*[:]\s*(?:(?:Bc\.|Ing\.|Mgr\.|MSc\.|BSc\.|RNDr\.|doc\.|prof\.)\s+)?([^\n\r,]+)/i)
  if (studentMatch && studentMatch[1].trim().length > 2) {
    studentName = studentMatch[1].replace(/[*_#`]/g, "").trim()
  } else {
    const directBcMatch = frontMatter.match(/\b(Bc\.|Ing\.|Mgr\.|MSc\.|BSc\.)\s+([A-ZÁČĎÉÍĽĹŇÓÔŔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+\s+[A-ZÁČĎÉÍĽĹŇÓÔŔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+)/)
    if (directBcMatch) {
      studentName = directBcMatch[1] + " " + directBcMatch[2]
    }
  }

  // 2. Title: Look for explicit 'Názov práce:', 'Názov:', 'Title:' first
  const explicitTitleMatch = frontMatter.match(/(?:Názov práce|Názov záverečnej práce|Názov diplomovej práce|Názov bakalárskej práce|Názov dizertačnej práce|Názov|Title)\s*[:]\s*([^\n\r]+)/i)
  if (explicitTitleMatch && explicitTitleMatch[1].trim().length > 5) {
    title = formatCleanThesisTitle(explicitTitleMatch[1])
  } else {
    const headings = [...frontMatter.matchAll(/^#+\s+(.+)$/gm)].map((m) => m[1].replace(/[*_#`]/g, "").trim())
    for (const h of headings) {
      if (/univerzita|fakulta|vysoká škola|zadanie|obsah|úvod|abstrakt|abstract|čestné vyhlásenie/i.test(h)) continue
      let cleanH = h.replace(/^(?:Bc\.|Ing\.|Mgr\.)\s+[A-ZÁČĎÉÍĽĹŇÓÔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+\s+[A-ZÁČĎÉÍĽĹŇÓÔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+\s+/i, "")
      cleanH = cleanH.replace(/\s+(?:Diplomová práca|Bakalárska práca|Dizertačná práca|Záverečná práca)$/i, "")
      if (cleanH.length > 5) {
        title = formatCleanThesisTitle(cleanH)
        break
      }
    }
    if (!title && filename) {
      title = formatCleanThesisTitle(filename.replace(/\.(pdf|md|docx|tex)$/i, "").replace(/[-_]/g, " "))
    }
  }

  // 3. Supervisor / Vedúci práce
  const supervisorMatch = frontMatter.match(/(?:Vedúci práce|Vedúci|Supervisor|Tutor|Školiteľ|Konzultant)\s*[:]\s*([^\n\r,]+)/i)
  if (supervisorMatch && supervisorMatch[1].trim().length > 2) {
    reviewerName = supervisorMatch[1].replace(/[*_#`]/g, "").trim()
  }

  // 4. Institution / University (ignore bibliography references)
  const uniMatches = [...frontMatter.matchAll(/^#*\s*([^\n\r]+(?:univerzita|vysoká škola)[^\n\r]*)/gim)]
  for (const m of uniMatches) {
    const raw = m[1].replace(/[*_#`]/g, "").trim()
    if (/^\d+[\.\)]|^\[\d+\]|doi:|isbn:|issn:|str\.|pp\.|ročník/i.test(raw)) continue
    if (raw.length > 5 && raw.length < 80) {
      institution = raw
      break
    }
  }
  if (!institution) {
    institution = "Slovenská technická univerzita v Bratislave"
  }

  // 5. Faculty / Department
  const deptMatch = frontMatter.match(/(?:Miesto vypracovania|Pracovisko|Katedra|Ústav)\s*[:]\s*([^\n\r]+)/i)
  if (deptMatch) {
    department = deptMatch[1].replace(/[*_#`]/g, "").trim()
  } else {
    const facMatch = frontMatter.match(/(Fakulta\s+[^\n\r]+)/i)
    if (facMatch) {
      department = facMatch[1].replace(/[*_#`]/g, "").trim()
    }
  }
  if (!department) {
    department = "FIIT - Ústav počítačového inžinierstva a aplikovanej informatiky"
  }

  // 6. Degree / Type
  const lower = text.toLowerCase()
  if (lower.includes("bakalársk") || lower.includes("bachelor")) {
    thesisType = "bachelor"
  } else if (lower.includes("diplomov") || lower.includes("master thesis") || lower.includes("magistersk") || lower.includes("diplomová práca")) {
    thesisType = "master"
  } else if (lower.includes("dizertač") || lower.includes("dissertation") || lower.includes("phd") || lower.includes("dizertačná práca")) {
    thesisType = "phd"
  }

  // 7. Academic Year / Date
  const yearMatch = frontMatter.match(/(?:máj|jún|január|február|marec|apríl|júl|august|september|október|november|december)?\s*\b(202[0-9](?:\/202[0-9])?)\b/i)
  if (yearMatch) {
    academicYear = yearMatch[0].trim()
  }

  return { title, studentName, thesisType, reviewKind, reviewerRole, reviewerName, institution, department, academicYear }
}

export function ThesisMetadataPanel({ workspaceId }: Props) {
  const {
    generateReview,
    generateAnalysisPlan,
    isGenerating,
    isGeneratingPlan,
    generateError,
    clearErrors,
    activeReview,
    sourceMarkdown,
    loadSourceDocument,
    isMetadataValid,
    formMetadata,
    updateFormMetadata,
    confidentialityAgreed,
    skipCitationAudit,
    selectedFileId,
    setSelectedFileId,
  } = useThesisReviewStore()

  const { ingestFiles, uploadFiles } = useEditor(
    useShallow((s) => ({
      ingestFiles: s.project?.ingestFiles ?? [],
      uploadFiles: s.uploadFiles,
    }))
  )

  const [isFormCollapsed, setIsFormCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [autoExtractedSuccess, setAutoExtractedSuccess] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Default to Bednár file if present, otherwise first ingest file
  const defaultFileId = useMemo(() => {
    const bednarFile = ingestFiles.find((f) => /bednar|debnar|grant/i.test(f.name) || f.id.includes("mtfrbmoo"))
    return bednarFile?.id || ingestFiles[0]?.id || ""
  }, [ingestFiles])

  const activeFileId = selectedFileId || defaultFileId
  const activeFile = ingestFiles.find((f) => f.id === activeFileId) || ingestFiles[0]
  const isParsing = ingestFiles.some((f) => f.status === "parsing" || f.status === "queued")

  // Load document and auto-extract when active file changes
  useEffect(() => {
    if (activeFileId) {
      loadSourceDocument(workspaceId, activeFileId)
    }
  }, [workspaceId, activeFileId, loadSourceDocument])

  // Smart auto-fill from document text
  const applyExtraction = useCallback((text: string, filename?: string) => {
    if (!text.trim()) return
    const ext = extractSmartThesisMetadata(text, filename)
    updateFormMetadata({
      thesisTitle: ext.title || formMetadata.thesisTitle,
      studentName: ext.studentName || formMetadata.studentName,
      thesisType: ext.thesisType || formMetadata.thesisType,
      reviewerName: ext.reviewerName || formMetadata.reviewerName,
      institution: ext.institution || formMetadata.institution,
      department: ext.department || formMetadata.department,
      academicYear: ext.academicYear || formMetadata.academicYear,
    })
    setAutoExtractedSuccess(true)
    setTimeout(() => setAutoExtractedSuccess(false), 3000)
  }, [updateFormMetadata, formMetadata])

  // Auto-fill on initial load or source update if form is pristine
  useEffect(() => {
    if (sourceMarkdown && (!formMetadata.studentName || !formMetadata.thesisTitle)) {
      applyExtraction(sourceMarkdown, activeFile?.name)
    }
  }, [sourceMarkdown, activeFile, formMetadata.studentName, formMetadata.thesisTitle, applyExtraction])

  const handleFileUpload = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    const pdfFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf") || f.type.includes("pdf"))
    if (pdfFiles.length > 0) {
      uploadFiles(pdfFiles)
      loadSourceDocument(workspaceId)
    }
  }

  const handleGenerate = async () => {
    clearErrors()
    await generateReview({
      workspaceId,
      sourceFileId: activeFileId || undefined,
      metadata: normalizeFormMetadataToThesisMetadata(formMetadata),
      skipCitationAudit,
      professionalMode: formMetadata.reviewKind === "paper" || formMetadata.reportingStandard !== "none",
    })
  }

  const lang = formMetadata.language || "sk"
  const isComplete = Boolean(formMetadata.studentName?.trim()) && Boolean(formMetadata.thesisTitle?.trim())

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto no-scrollbar bg-background">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#8B2635]/10 text-[#8B2635] dark:text-[#E06D7B] border border-[#8B2635]/20">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Posudok záverečnej práce
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Parametre a spustenie AI hodnotenia
            </p>
          </div>
        </div>

        {sourceMarkdown && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px] font-medium text-[#8B2635] dark:text-[#E06D7B] hover:bg-[#8B2635]/10 gap-1 cursor-pointer"
            onClick={() => applyExtraction(sourceMarkdown, activeFile?.name)}
            title="Znovu načítať metadáta z PDF"
          >
            <Sparkles className="h-3 w-3" />
            <span>Načítať z PDF</span>
          </Button>
        )}
      </div>

      {activeReview && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">Posudok: <strong>{activeReview.studentName}</strong></span>
          </div>
          {activeReview.grade && (
            <Badge variant="outline" className="font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shrink-0 ml-1.5">
              {activeReview.grade}
            </Badge>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* 1. Document Selection (Always visible) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-[#8B2635] dark:text-[#E06D7B]" />
            Zdrojový dokument
          </Label>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] gap-1 border-dashed hover:border-solid cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-3 w-3" />
            Nahrať PDF
          </Button>
        </div>

        {ingestFiles.length > 0 ? (
          <div className="space-y-1.5">
            {ingestFiles.length > 1 ? (
              <Select
                value={activeFileId}
                onValueChange={(val) => {
                  if (val) {
                    setSelectedFileId(val)
                    loadSourceDocument(workspaceId, val)
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs w-full bg-card border-border/80 shadow-2xs font-medium">
                  <SelectValue placeholder="Vyberte prácu...">
                    {formatDocumentDisplayName(activeFile?.name, formMetadata.thesisTitle)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ingestFiles.map((f) => {
                    const isBednar = /bednar|grant/i.test(f.name) || f.id.includes("mtfrbmoo")
                    return (
                      <SelectItem key={f.id} value={f.id} className="text-xs py-2">
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-foreground">
                            {isBednar
                              ? "Bc. Maroš Bednár — Systém na granty"
                              : formatDocumentDisplayName(f.name)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {f.name} • {formatBytes(f.size)}
                          </span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-lg border bg-card/60 p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-[#8B2635] dark:text-[#E06D7B] shrink-0" />
                  <div className="min-w-0 truncate">
                    <p className="font-medium text-foreground truncate">{formatDocumentDisplayName(activeFile?.name, formMetadata.thesisTitle)}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{activeFile?.name} • {formatBytes(activeFile?.size || 0)}</p>
                  </div>
                </div>
              </div>
            )}

            {autoExtractedSuccess && (
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 animate-fade-in">
                <Sparkles className="h-3 w-3" />
                <span>Údaje úspešne načítané z dokumentu</span>
              </div>
            )}

            {isParsing && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-md">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>MinerU spracováva PDF…</span>
              </div>
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              handleFileUpload(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all ${
              isDragging ? "border-[#8B2635] bg-[#8B2635]/10" : "border-border/60 hover:border-[#8B2635]/60 hover:bg-muted/40"
            }`}
          >
            <UploadCloud className="h-6 w-6 text-[#8B2635] mx-auto mb-1 opacity-80" />
            <p className="text-xs font-semibold">Nahrajte PDF práce</p>
            <p className="text-[10px] text-muted-foreground">Presuňte súbor sem</p>
          </div>
        )}
      </div>

      <Separator />

      {/* 2. Metadata Section — Collapsible on complete (2.7) */}
      {isComplete && isFormCollapsed ? (
        <div className="rounded-xl border bg-muted/20 p-3 space-y-2 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <FileCheck2 className="h-4 w-4" />
              Metadáta pripravené
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] font-medium text-primary hover:bg-muted cursor-pointer"
              onClick={() => setIsFormCollapsed(false)}
            >
              Upraviť
            </Button>
          </div>
          <p className="text-xs font-semibold text-foreground line-clamp-2" title={formMetadata.thesisTitle}>
            {formMetadata.thesisTitle}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{formMetadata.studentName}</span>
            <span>•</span>
            <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
              {THESIS_TYPES.find((t) => t.value === formMetadata.thesisType)?.[lang] || "Diplomová práca"}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground">
              Údaje o záverečnej práci
            </Label>
            {isComplete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setIsFormCollapsed(true)}
              >
                Zbaliť
              </Button>
            )}
          </div>

          {/* Thesis Title */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Názov práce *
            </Label>
            <Input
              className="h-8 text-xs bg-card"
              placeholder="Napr. Systém na automatizované vyhľadávanie a asistenciu pri príprave grantov"
              value={formMetadata.thesisTitle}
              onChange={(e) => updateFormMetadata({ thesisTitle: e.target.value })}
            />
          </div>

          {/* Student Name */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Meno autora/autorky *
            </Label>
            <Input
              className="h-8 text-xs bg-card"
              placeholder="Napr. Bc. Maroš Bednár"
              value={formMetadata.studentName}
              onChange={(e) => updateFormMetadata({ studentName: e.target.value })}
            />
          </div>

          {/* Degree & Language */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Úroveň práce</Label>
              <Select
                value={formMetadata.thesisType}
                onValueChange={(v) => { if (v) updateFormMetadata({ thesisType: v as any }) }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue>{THESIS_TYPES.find((t) => t.value === formMetadata.thesisType)?.[lang] || "Diplomová práca"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {THESIS_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Jazyk posudku</Label>
              <Select
                value={lang}
                onValueChange={(v) => {
                  if (v) {
                    updateFormMetadata({ language: v as "sk" | "cs" | "en" })
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue>{LANGUAGES.find((l) => l.value === lang)?.label ?? "Slovenčina"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value} className="text-xs">
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reviewer Role & Name */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Rola recenzenta</Label>
              <Select
                value={formMetadata.reviewerRole}
                onValueChange={(v) => { if (v) updateFormMetadata({ reviewerRole: v as ReviewerRole }) }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue>{REVIEWER_ROLES.find((r) => r.value === formMetadata.reviewerRole)?.[lang] || "Oponent práce"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REVIEWER_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="text-xs">
                      {r[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Meno recenzenta</Label>
              <Input
                className="h-8 text-xs bg-card"
                placeholder="Ing. Richard Marko, PhD."
                value={formMetadata.reviewerName ?? ""}
                onChange={(e) => updateFormMetadata({ reviewerName: e.target.value })}
              />
            </div>
          </div>

          {/* Institution & Department */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Univerzita a fakulta</Label>
            <Input
              className="h-8 text-xs bg-card"
              placeholder="Slovenská technická univerzita v Bratislave, FIIT"
              value={formMetadata.institution ?? ""}
              onChange={(e) => updateFormMetadata({ institution: e.target.value })}
            />
          </div>
        </div>
      )}

      <Separator />

      {/* Pre-flight plan link (always accessible) */}
      <div className="space-y-2">
        <Button
          variant="outline"
          onClick={async () => {
            clearErrors()
            await generateAnalysisPlan(workspaceId, normalizeFormMetadataToThesisMetadata(formMetadata))
          }}
          disabled={!isComplete || isGenerating || isGeneratingPlan || isParsing}
          className="w-full h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1.5"
          size="sm"
        >
          {isGeneratingPlan ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzujem štruktúru…
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3 text-[#8B2635] dark:text-[#E06D7B]" />
              <span>Predanalýza a plánovanie (Pre-flight)</span>
            </>
          )}
        </Button>
      </div>

      {!isMetadataValid && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center">
          Doplňte názov práce a meno autora pre spustenie posudku.
        </p>
      )}
    </div>
  )
}

