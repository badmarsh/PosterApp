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
import { useScopedThesisReviewStore } from "./thesis-review-provider"
import { normalizeFormMetadataToThesisMetadata } from "./use-thesis-review-store"
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
  // Articles route to reviewKind="paper" (peer-review flow); thesisType is
  // retained for DB compatibility but the level selector shows all four
  // document types in one place.
  { value: "article", sk: "Vedecký článok / Peer Review", cs: "Vědecký článek", en: "Journal article (peer review)" },
]

const REVIEWER_ROLES = [
  { value: "opponent", sk: "Oponent/ka práce", cs: "Oponent/ka", en: "Opponent" },
  { value: "supervisor", sk: "Vedúci/a práce (Školiteľ)", cs: "Vedoucí práce (Školitel)", en: "Supervisor" },
  { value: "self", sk: "Predkonzultačný rozbor", cs: "Předkonzultační rozbor", en: "Pre-consultation triage" },
  { value: "reviewer", sk: "Recenzent / Peer Reviewer", cs: "Recenzent", en: "Reviewer" },
]

/**
 * Front-matter headings that are section labels, never titles, in all three
 * supported languages. Matched as whole-words (case-insensitive) so e.g.
 * "Contents of the dataset" (rare) would still pass but "Contents" / "Table of
 * contents" do not.
 */
const JUNK_HEADING_RE =
  /^(?:table of contents|contents|content|obsah|abstrakt|abstract|úvod|introduction|zadanie|zadání|assignment|čestné vyhlásenie|čestné prohlášení|declaration|predhovor|foreword|poďakovanie|poďakování|acknowledg[e]?ments?|referencie|references|bibliografia|bibliography|obsah práce|list of (?:figures|tables|abbreviations))\b[\s:.\-–—]*$/i

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
      // Skip section labels (Contents/obsah/Abstract…), university/faculty
      // lines, and anything too short to be a real title.
      if (JUNK_HEADING_RE.test(h)) continue
      if (/univerzita|univerzit[aě]|fakulta|fakult[aě]|vysoká škola|vysok[áé] škola|university|faculty|institute of technology/i.test(h)) continue
      let cleanH = h.replace(/^(?:Bc\.|Ing\.|Mgr\.)\s+[A-ZÁČĎÉÍĽĹŇÓÔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+\s+[A-ZÁČĎÉÍĽĹŇÓÔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+\s+/i, "")
      cleanH = cleanH.replace(/\s+(?:Diplomová práca|Diplomová|Bakalárska práca|Bakalářská práce|Dizertačná práca|Dizertační práce|Záverečná práca|Master'?s? thesis|Bachelor'?s? thesis|Doctoral (?:thesis|dissertation)|PhD\.?\s*thesis)$/i, "")
      // A real title is a substantive phrase; skip 1–2 word all-caps labels.
      if (cleanH.length > 8 && cleanH.split(/\s+/).length >= 3) {
        title = formatCleanThesisTitle(cleanH)
        break
      }
    }
    if (!title && filename) {
      const fromName = formatCleanThesisTitle(filename.replace(/\.(pdf|md|docx|tex)$/i, "").replace(/[-_]/g, " "))
      // Never accept junk upload names like "Contents.pdf" as the title.
      if (fromName && !JUNK_HEADING_RE.test(fromName)) title = fromName
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
    institution = ""
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
    department = ""
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
  } = useScopedThesisReviewStore()

  const { ingestFiles, uploadFiles, updateActiveOutput } = useEditor(
    useShallow((s) => ({
      ingestFiles: s.project?.ingestFiles ?? [],
      uploadFiles: s.uploadFiles,
      updateActiveOutput: s.updateActiveOutput,
    }))
  )

  const [isFormCollapsed, setIsFormCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [autoExtractedSuccess, setAutoExtractedSuccess] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastExtractedDocRef = useRef<string | null>(null)

  const defaultFileId = ingestFiles[0]?.id || ""
  const activeFileId = selectedFileId || defaultFileId
  const activeFile = ingestFiles.find((f) => f.id === activeFileId) || ingestFiles[0]
  const isParsing = ingestFiles.some((f) => f.status === "parsing" || f.status === "queued")

  // Synchronize selectedFileId in store if files exist and none selected
  useEffect(() => {
    if (ingestFiles.length > 0 && !selectedFileId) {
      setSelectedFileId(ingestFiles[0].id)
    }
  }, [ingestFiles, selectedFileId, setSelectedFileId])

  // Load document when active file changes
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
      thesisTitle: ext.title,
      studentName: ext.studentName,
      thesisType: ext.thesisType,
      reviewerName: ext.reviewerName,
      institution: ext.institution,
      department: ext.department,
      academicYear: ext.academicYear,
    })
    setAutoExtractedSuccess(true)
    setTimeout(() => setAutoExtractedSuccess(false), 3000)
  }, [updateFormMetadata])

  // Reset or re-extract form when document changes (ONLY once per unique document change, never re-runs on user typing)
  useEffect(() => {
    if (ingestFiles.length === 0) {
      if (lastExtractedDocRef.current !== null) {
        lastExtractedDocRef.current = null
        updateFormMetadata({
          thesisTitle: "",
          studentName: "",
          reviewerName: "",
          institution: "",
          department: "",
          academicYear: "",
        })
      }
      return
    }

    if (activeFileId && sourceMarkdown && lastExtractedDocRef.current !== activeFileId) {
      const isSwitchingDoc = lastExtractedDocRef.current !== null
      lastExtractedDocRef.current = activeFileId
      // Auto-extract whenever switching documents or if metadata is empty
      if (isSwitchingDoc || (!formMetadata.thesisTitle && !formMetadata.studentName)) {
        applyExtraction(sourceMarkdown, activeFile?.name)
      }
    }
  }, [ingestFiles.length, activeFileId, sourceMarkdown, activeFile, applyExtraction, updateFormMetadata, formMetadata.thesisTitle, formMetadata.studentName])


  const handleFileUpload = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    const pdfFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf") || f.type.includes("pdf"))
    if (pdfFiles.length > 0) {
      lastExtractedDocRef.current = null
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
  const isComplete = formMetadata.reviewerRole === "self"
    ? Boolean(formMetadata.thesisTitle?.trim())
    : Boolean(formMetadata.studentName?.trim()) && Boolean(formMetadata.thesisTitle?.trim())

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto no-scrollbar bg-background">
      {/* Header */}
      <div className="flex items-center pb-3 border-b border-border/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs">
            <GraduationCap className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Posudok záverečnej práce
            </h2>
            <p className="text-[11px] text-muted-foreground truncate">
              Parametre a spustenie AI hodnotenia
            </p>
          </div>
        </div>
      </div>

      {activeReview && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <FileCheck2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
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
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <BookOpen className="size-3.5 text-primary" />
          Zdrojový dokument
        </Label>

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
                <SelectTrigger className="h-8.5 text-xs w-full bg-card border-border/80 shadow-2xs font-medium rounded-lg px-3 hover:border-border transition-colors" aria-label="Vyberte prácu">
                  <SelectValue placeholder="Vyberte prácu...">
                    {formatDocumentDisplayName(activeFile?.name)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ingestFiles.map((f) => {
                    return (
                      <SelectItem key={f.id} value={f.id} className="text-xs py-2">
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-foreground">
                            {formatDocumentDisplayName(f.name)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatBytes(f.size)}
                          </span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-xl border bg-card/70 p-2.5 flex items-center justify-between text-xs shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="size-4 text-primary shrink-0" />
                  <div className="min-w-0 truncate">
                    <p className="font-medium text-foreground truncate">{formatDocumentDisplayName(activeFile?.name)}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{formatBytes(activeFile?.size || 0)}</p>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground border-dashed rounded-lg cursor-pointer"
            >
              <UploadCloud className="size-3.5 text-primary" />
              Nahrať ďalšiu prácu (PDF)
            </Button>

            {autoExtractedSuccess && (
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 animate-fade-in pl-0.5">
                <Sparkles className="size-3" />
                <span>Údaje úspešne načítané z dokumentu</span>
              </div>
            )}

            {isParsing && (
              <div className="flex items-center gap-2 text-xs text-warning dark:text-warning bg-warning/100/10 p-2.5 rounded-lg border border-warning/30">
                <Loader2 className="size-3.5 animate-spin shrink-0" />
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
              isDragging ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/60 hover:bg-muted/40"
            }`}
          >
            <UploadCloud className="size-6 text-primary mx-auto mb-1.5 opacity-80" />
            <p className="text-xs font-semibold">Nahrajte PDF práce</p>
            <p className="text-[10px] text-muted-foreground">Presuňte súbor sem</p>
          </div>
        )}
      </div>

      <Separator className="my-0.5 bg-border/60" />

      {/* 2. Metadata Section — Collapsible on complete (2.7) */}
      {isComplete && isFormCollapsed ? (
        <div className="rounded-xl border bg-muted/20 p-3 space-y-2 transition-all shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <FileCheck2 className="size-4" />
              Metadáta pripravené
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] font-medium text-primary hover:bg-muted cursor-pointer rounded-md"
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
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="size-3.5 text-primary" />
              Údaje o záverečnej práci
            </Label>
            {isComplete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer rounded-md"
                onClick={() => setIsFormCollapsed(true)}
              >
                Zbaliť
              </Button>
            )}
          </div>

          {/* Thesis Title */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              {formMetadata.reviewKind === "paper" ? "Názov článku *" : "Názov práce *"}
            </Label>
            <Input
              className="h-8 text-xs bg-card rounded-lg border-border/80"
              placeholder={
                formMetadata.reviewKind === "paper"
                  ? "Napr. Bose-Einstein correlations in pp collisions at 13 TeV"
                  : "Napr. Systém na automatizované vyhľadávanie a asistenciu pri príprave grantov"
              }
              aria-label={formMetadata.reviewKind === "paper" ? "Názov ániku" : "Názov práce"}
              value={formMetadata.thesisTitle}
              onChange={(e) => updateFormMetadata({ thesisTitle: e.target.value })}
            />
          </div>

          {/* Student Name */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              {formMetadata.reviewKind === "paper" ? "Autori článku *" : "Meno autora/autorky *"}
            </Label>
            <Input
              className="h-8 text-xs bg-card rounded-lg border-border/80"
              placeholder={
                formMetadata.reviewKind === "paper"
                  ? "Napr. R. Aštaloš, J. Novák, M. Kováč"
                  : "Napr. Bc. Maroš Bednár"
              }
              aria-label={formMetadata.reviewKind === "paper" ? "Autori ániku" : "Meno autora/autorky"}
              value={formMetadata.studentName}
              onChange={(e) => updateFormMetadata({ studentName: e.target.value })}
            />
          </div>

          {/* Degree & Language */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Typ dokumentu</Label>
              <Select
                value={formMetadata.reviewKind === "paper" ? "article" : formMetadata.thesisType}
                onValueChange={(v) => {
                  if (!v) return
                  if (v === "article") {
                    updateFormMetadata({ reviewKind: "paper" as ReviewKind })
                  } else {
                    updateFormMetadata({ thesisType: v as any, reviewKind: "thesis" as ReviewKind })
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-card rounded-lg border-border/80" aria-label="Typ práce">
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
                <SelectTrigger className="h-8 text-xs bg-card rounded-lg border-border/80" aria-label="Jazyk posudku">
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
                onValueChange={(v) => {
                  if (v) {
                    updateFormMetadata({ reviewerRole: v as ReviewerRole })
                    updateActiveOutput({
                      title: v === "supervisor" ? "Posudok školiteľa" : v === "self" ? "Predkonzultačný rozbor" : v === "opponent" ? "Posudok oponenta" : "Posudok recenzenta",
                    })
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-card rounded-lg border-border/80" aria-label="Rola recenzenta">
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
                aria-label="Meno recenzenta"
                className="h-8 text-xs bg-card rounded-lg border-border/80"
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
              aria-label="Univerzita a fakulta"
              className="h-8 text-xs bg-card rounded-lg border-border/80"
              placeholder="Slovenská technická univerzita v Bratislave, FIIT"
              value={formMetadata.institution ?? ""}
              onChange={(e) => updateFormMetadata({ institution: e.target.value })}
            />
          </div>
        </div>
      )}

      {!isMetadataValid && (
        <p className="text-[10px] text-warning dark:text-warning text-center pt-1">
          Doplňte názov práce a meno autora pre spustenie posudku.
        </p>
      )}
    </div>
  )
}

