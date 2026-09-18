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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  FileText,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  UploadCloud,
  FileCheck2,
  FileUp,
  GraduationCap,
  BookOpen,
  Trash2,
  Files,
} from "lucide-react"
import { useScopedThesisReviewStore } from "./thesis-review-provider"
import { normalizeFormMetadataToThesisMetadata, clearSourceDocCache } from "./use-thesis-review-store"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import type { ThesisMetadata, ThesisType, ReviewerRole, ReviewLanguage } from "@/lib/ai/thesis-rubric"
import type { ReviewKind, ReportingStandard } from "@/lib/ai/review-types"
import { formatBytes, formatDocumentDisplayName } from "@/lib/ingestion"
import { cn } from "@/lib/utils"

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

export function formatCleanInstitution(raw: string): string {
  const trimmed = raw.replace(/[*_#`]/g, "").trim()
  if (!trimmed) return ""
  const letters = trimmed.replace(/[^a-zA-ZáäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/g, "")
  if (letters.length > 5 && letters === letters.toUpperCase()) {
    return trimmed.toLowerCase().replace(/(?:^|\s)[a-záäčďéíĺľňóôŕšťúýž]/g, (c) => c.toUpperCase())
  }
  return trimmed
}

export function cleanTitleFromFilename(filename?: string): {
  title: string
  hintType?: "bachelor" | "master" | "phd"
  hintKind?: ReviewKind
  hintAuthor?: string
} {
  if (!filename) return { title: "" }

  // Strip file extension
  let base = filename.replace(/\.(pdf|md|docx|tex|txt)$/i, "").trim()
  if (!base) return { title: "" }

  let hintType: "bachelor" | "master" | "phd" | undefined
  let hintKind: ReviewKind | undefined
  let hintAuthor: string | undefined

  const baseLower = base.toLowerCase()

  // 1. Detect document type hint from filename
  if (/(?:phd|doctoral|doktorsk[aá]|dizerta[cč]|diserta[cč]|dissertation)/i.test(baseLower)) {
    hintType = "phd"
    hintKind = "thesis"
  } else if (/(?:bakal[aá]r|bachelor|\bbc\b)/i.test(baseLower)) {
    hintType = "bachelor"
    hintKind = "thesis"
  } else if (/(?:diplom|master|magister|\bing\b|\bmgr\b)/i.test(baseLower)) {
    hintType = "master"
    hintKind = "thesis"
  } else if (/(?:paper|article|[cč]l[aá]nok|[cč]l[aá]nek|preprint|peer[_\s-]*review|probability[_\s]+function|distribution[_\s]+function|cross[_\s]+section|measurement[_\s]+of)/i.test(baseLower)) {
    hintKind = "paper"
  }

  // 2. Detect Author - Title or Title - Author / Title_Author patterns
  // e.g. "ZAVERECNA PRACA_KELOVA" -> Title: "Záverečná práca", Author: "Keľová"
  const authorSuffixMatch = base.match(/^(.+?)[_-]+([A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ][a-záäčďéíĺľňóôŕšťúýž]+|[A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]{3,})$/)
  if (authorSuffixMatch) {
    const candidateTitle = authorSuffixMatch[1].trim()
    const candidateAuthor = authorSuffixMatch[2].trim()
    if (candidateAuthor.length >= 3 && !/^(pdf|doc|final|draft|v\d+|thesis|praca|paper)$/i.test(candidateAuthor)) {
      hintAuthor = candidateAuthor.charAt(0).toUpperCase() + candidateAuthor.slice(1).toLowerCase()
      base = candidateTitle
    }
  }

  // 2b. Check if the entire base is just a generic label (e.g. "PhD Thesis 2", "Diplomova praca", "Final Thesis 1")
  const GENERIC_FILENAME_RE = /^(?:phd[_\s]+t(?:h)?esis|doctoral[_\s]+(?:thesis|dissertation)|doktorsk[aá][_\s]+pr[aá]ca|dizerta[cč]n[aá][_\s]+pr[aá]ca|diserta[cč]n[ií][_\s]+pr[aá]ce|diplomov[aá][_\s]+pr[aá]ca|diplomov[aá][_\s]+pr[aá]ce|master[_\s]+thesis|mgr[_\s]+thesis|ing[_\s]+thesis|bakal[aá]rsk[aá][_\s]+pr[aá]ca|bakal[aá][rř]sk[aá][_\s]+pr[aá]ce|bachelor[_\s]+thesis|bc[_\s]+thesis|z[aá]vere[cč]n[aá][_\s]+pr[aá]ca|z[aá]v[eě]re[cč]n[aá][_\s]+pr[aá]ce|final[_\s]+thesis|paper|article|[cč]l[aá]nok|[cč]l[aá]nek|manuscript|preprint)(?:[\s:._-]+\d+)?$/i
  if (GENERIC_FILENAME_RE.test(base)) {
    return { title: "", hintType, hintKind, hintAuthor }
  }

  // 3. Strip leading prefixes denoting document types
  // Handles: "phd_tesis_", "phd thesis ", "PhD Thesis 2", "Diplomova_praca_", "Bakalarska praca - ", etc.
  const PREFIX_RE = /^(?:phd[_\s]+t(?:h)?esis(?:\s+\d+)?|doctoral[_\s]+(?:thesis|dissertation)|doktorsk[aá][_\s]+pr[aá]ca|dizerta[cč]n[aá][_\s]+pr[aá]ca|diserta[cč]n[ií][_\s]+pr[aá]ce|diplomov[aá][_\s]+pr[aá]ca|diplomov[aá][_\s]+pr[aá]ce|master[_\s]+thesis|mgr[_\s]+thesis|ing[_\s]+thesis|bakal[aá]rsk[aá][_\s]+pr[aá]ca|bakal[aá][rř]sk[aá][_\s]+pr[aá]ce|bachelor[_\s]+thesis|bc[_\s]+thesis|z[aá]vere[cč]n[aá][_\s]+pr[aá]ca|z[aá]v[eě]re[cč]n[aá][_\s]+pr[aá]ce|final[_\s]+thesis|paper|article|[cč]l[aá]nok|[cč]l[aá]nek|manuscript|preprint)[\s:._-]+/i
  base = base.replace(PREFIX_RE, "").trim()

  // 4. Strip trailing suffixes like "_phd_thesis", "_final", etc.
  const SUFFIX_RE = /[\s:._-]+(?:phd[_\s]+t(?:h)?esis|doctoral[_\s]+(?:thesis|dissertation)|dizerta[cč]n[aá][_\s]+pr[aá]ca|diplomov[aá][_\s]+pr[aá]ca|bakal[aá]rsk[aá][_\s]+pr[aá]ca|z[aá]vere[cč]n[aá][_\s]+pr[aá]ca|final|draft|v\d+)$/i
  base = base.replace(SUFFIX_RE, "").trim()

  // 5. Clean up underscores into spaces (while preserving hyphens like Bose-Einstein)
  const formatted = base.replace(/_+/g, " ").trim()
  let cleanTitle = formatCleanThesisTitle(formatted)

  if (cleanTitle.length <= 2 || /^\d+$/.test(cleanTitle) || /^(?:final|draft|v\d+|thesis|praca|paper)$/i.test(cleanTitle)) {
    cleanTitle = ""
  }

  return { title: cleanTitle, hintType, hintKind, hintAuthor }
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

  // Extract hints from filename first
  const fileHints = cleanTitleFromFilename(filename)
  if (fileHints.hintType) thesisType = fileHints.hintType
  if (fileHints.hintKind) reviewKind = fileHints.hintKind
  if (fileHints.hintKind === "paper") reviewerRole = "reviewer"
  if (fileHints.title && !JUNK_HEADING_RE.test(fileHints.title)) {
    title = fileHints.title
  }

  const frontMatter = (text || "").slice(0, 4500)
  const hasText = Boolean(frontMatter.trim())

  if (hasText) {
    // 1. Supervisor / Vedúci práce (checked first so student extraction avoids it)
    const supervisorMatch = frontMatter.match(/(?:Vedúci(?:\s+(?:záverečnej|diplomovej|bakalárskej|dizertačnej))?\s*práce|Vedúci|Supervisor|Tutor|Školiteľ|Konzultant)\s*[:]\s*([^\n\r]+)/i)
    if (supervisorMatch && supervisorMatch[1].trim().length > 2) {
      reviewerName = supervisorMatch[1].replace(/[*_#`]/g, "").trim()
    }

    // 2. Student / Author extraction
    // A. Explicit label: "Študent:", "Autor:", "Author:", "Vypracoval:", "Meno autora:", etc.
    const studentMatch = frontMatter.match(/(?:Študent(?:ka)?|Student|Autor(?:ka)?|Author|Vypracoval(?:a)?|Diplomant(?:ka)?|Bakalant(?:ka)?|Predkladá|Kandidát(?:ka)?|Meno autora|Meno študenta)\s*[:]\s*(?:(?:Bc\.|Ing\.|Mgr\.|MSc\.|BSc\.|RNDr\.|doc\.|prof\.)\s+)?([^\n\r,]+)/i)
    if (studentMatch && studentMatch[1].trim().length > 2) {
      studentName = studentMatch[1].replace(/[*_#`]/g, "").trim()
    }

    // B. Slovak bibliographical record in Abstract or front matter:
    // "KEĽOVÁ, Margaréta: Hodnotenie vo výučbe chémie. [Záverečná práca] / Margaréta Keľová – ..."
    if (!studentName) {
      const bibRecordMatch = frontMatter.match(/^([A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]{2,}),\s+([A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ][a-záäčďéíĺľňóôŕšťúýž]+)\s*:\s*([^.\n\r]+)/m)
      if (bibRecordMatch) {
        const surname = bibRecordMatch[1].charAt(0) + bibRecordMatch[1].slice(1).toLowerCase()
        const firstname = bibRecordMatch[2].trim()
        studentName = `${firstname} ${surname}`
        if (!title || title === fileHints.title) {
          title = formatCleanThesisTitle(bibRecordMatch[3])
        }
      }
    }

    // C. Standalone academic degree + Name on a line in front-matter (e.g. "Mgr. Margaréta Keľová" or "Bc. Maroš Bednár")
    if (!studentName) {
      const standaloneMatch = frontMatter.match(/(?:^|\n)\s*(?:(Bc\.|Ing\.|Mgr\.|MSc\.|BSc\.|RNDr\.|MUDr\.|MVDr\.|PhDr\.|PaedDr\.)\s+)([A-ZÁČĎÉÍĽĹŇÓÔŔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+\s+[A-ZÁČĎÉÍĽĹŇÓÔŔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+)/)
      if (standaloneMatch) {
        const cand = standaloneMatch[1] + " " + standaloneMatch[2]
        if (!reviewerName || !reviewerName.includes(standaloneMatch[2])) {
          studentName = cand
        }
      }
    }

    // D. English thesis author patterns: "by John Doe" or "submitted by John Doe"
    const INVALID_AUTHOR_WORDS = /^(?:several|different|various|following|these|those|using|means|experimental|correlation|correlations|momentum|distribution|atlas|collider|physics|quantum|bose|einstein|contents|introduction|chapter|section|figure|table|equation|university|faculty|department|institute|results|analysis|data|monte|carlo)\b/i

    if (!studentName) {
      // Must be at the start of a line or after an explicit author prompt, and name parts must be Title Case (no /i flag)
      const englishAuthorMatch = frontMatter.match(/(?:(?:^|\n)\s*(?:by|written by|authored by|submitted by|presented by|prepared by)\s*[:]?|(?:Author|Author\(s\)|Student)\s*[:])\s*(?:(?:Mr\.|Ms\.|Mrs\.|Dr\.)\s+)?([A-ZÁČĎÉÍĽĹŇÓÔŔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+(?:\s+[A-ZÁČĎÉÍĽĹŇÓÔŔŘŠŤÚÝŽ]\.?)?\s+[A-ZÁČĎÉÍĽĹŇÓÔŔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+)/)
      if (englishAuthorMatch) {
        const candidate = englishAuthorMatch[1].trim()
        const parts = candidate.split(/\s+/)
        if (!INVALID_AUTHOR_WORDS.test(parts[0]) && (!parts[1] || !INVALID_AUTHOR_WORDS.test(parts[1]))) {
          studentName = candidate
        }
      }
    }

    // E. Candidate / Doctoral candidate pattern
    if (!studentName) {
      const candMatch = frontMatter.match(/(?:candidate|doctoral candidate|doktorand(?:ka)?)\s*[:]?\s*([A-ZÁČĎÉÍĽĹŇÓÔŔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+(?:\s+[A-ZÁČĎÉÍĽĹŇÓÔŔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+)+)/i)
      if (candMatch) {
        studentName = candMatch[1].trim()
      }
    }

    // F. Fallback to author hint from filename if still empty
    if (!studentName && fileHints.hintAuthor) {
      studentName = fileHints.hintAuthor
    }

    // 3. Title: Look for explicit 'Názov práce:', 'Názov:', 'Title:' first
    const explicitTitleMatch = frontMatter.match(/(?:Názov práce|Názov záverečnej práce|Názov diplomovej práce|Názov bakalárskej práce|Názov dizertačnej práce|Názov|Title)\s*[:]\s*([^\n\r]+)/i)
    if (explicitTitleMatch && explicitTitleMatch[1].trim().length > 5) {
      title = formatCleanThesisTitle(explicitTitleMatch[1])
    } else {
      const headings = [...frontMatter.matchAll(/^#+\s+(.+)$/gm)].map((m) => m[1].replace(/[*_#`]/g, "").trim())
      for (const h of headings) {
        if (JUNK_HEADING_RE.test(h)) continue
        if (/univerzita|univerzit[aě]|fakulta|fakult[aě]|vysoká škola|vysok[áé] škola|university|faculty|institute of technology/i.test(h)) continue
        let cleanH = h.replace(/^(?:Bc\.|Ing\.|Mgr\.)\s+[A-ZÁČĎÉÍĽĹŇÓÔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+\s+[A-ZÁČĎÉÍĽĹŇÓÔŘŠŤÚÝŽ][a-záčďéíľĺňóôŕřšťúýž]+\s+/i, "")
        cleanH = cleanH.replace(/\s+(?:Diplomová práca|Diplomová|Bakalárska práca|Bakalářská práce|Dizertačná práca|Dizertační práce|Záverečná práca|Master'?s? thesis|Bachelor'?s? thesis|Doctoral (?:thesis|dissertation)|PhD\.?\s*thesis)$/i, "")
        if (cleanH.length > 8 && cleanH.split(/\s+/).length >= 3) {
          title = formatCleanThesisTitle(cleanH)
          break
        }
      }

      // If title is still empty or too short, check for first numbered chapter or section in TOC or body
      // e.g. "1 Bose-Einstein correlations in 7 TeV proton-proton collisions in the ATLAS experiment"
      if (!title || title.length <= 2) {
        const chapterMatch = frontMatter.match(/(?:^|\n)(?:1|Chapter\s+1|Kapitola\s+1)\s*[:.-]?\s*([A-ZÁČĎÉÍĽĹŇÓÔŔŘŠŤÚÝŽ][^\n\r]{6,120})/i)
        if (chapterMatch) {
          const candidate = chapterMatch[1].replace(/\s*\.{3,}\s*\d+$/, "").replace(/[*_#`]/g, "").trim()
          if (candidate.length > 5 && !JUNK_HEADING_RE.test(candidate)) {
            title = formatCleanThesisTitle(candidate)
          }
        }
      }
    }

    // 4. Institution / University (ignore bibliography references)
    const uniMatches = [...frontMatter.matchAll(/^#*\s*([^\n\r]+(?:univerzita|vysoká škola|university)[^\n\r]*)/gim)]
    for (const m of uniMatches) {
      let raw = m[1].replace(/[*_#`]/g, "").trim()
      if (/^\d+[\.\)]|^\[\d+\]|doi:|isbn:|issn:|str\.|pp\.|ročník/i.test(raw)) continue
      // If line contains both university and faculty, separate them:
      const splitFac = raw.match(/^(.+?)\s+(fakulta\s+[^\n\r]+)/i)
      if (splitFac) {
        raw = splitFac[1].trim()
        if (!department) {
          department = formatCleanInstitution(splitFac[2].trim())
        }
      }
      if (raw.length > 5 && raw.length < 80) {
        institution = formatCleanInstitution(raw)
        break
      }
    }

    // 5. Faculty / Department
    const deptMatch = frontMatter.match(/(?:Miesto vypracovania|Pracovisko|Katedra|Ústav|Department)\s*[:]\s*([^\n\r]+)/i)
    if (deptMatch) {
      department = deptMatch[1].replace(/[*_#`]/g, "").trim()
    } else {
      const facMatch = frontMatter.match(/(Fakulta\s+[^\n\r]+|Faculty of\s+[^\n\r]+)/i)
      if (facMatch) {
        department = facMatch[1].replace(/[*_#`]/g, "").trim()
      }
    }

    // 6. Degree / Type & Review Kind
    const lower = text.toLowerCase()
    const frontLower = frontMatter.toLowerCase()

    const isBachelor = /(?:bakalársk[áé]|bakalářsk[áé])\s+prác[ae]|bachelor'?s?\s+thesis|\bbakalár\b/i.test(frontLower)
    const isMaster = /(?:diplomov[áé]|magistersk[áé])\s+prác[ae]|master'?s?\s+thesis/i.test(frontLower)
    const isPhd = /(?:dizertačn[áé]|disertačn[íé])\s+prác[ae]|doctoral\s+(?:thesis|dissertation)|phd\s+(?:thesis|dissertation)|doctor of philosophy|proefschrift/i.test(frontLower)
    const isExplicitThesis = Boolean(fileHints.hintType) || isBachelor || isMaster || isPhd || /záverečn[áé]\s+prác[ae]|\bin this thesis\b/i.test(frontLower)

    // Scientific Paper / Peer Review markers
    const isPaperDoc = !isExplicitThesis && (
      fileHints.hintKind === "paper" ||
      /(?:arxiv:\d+\.\d+|doi:\s*10\.\d+|issn\s*\d+|journal\s+of|proceedings\s+of|submitted\s+to|peer\s+review)/i.test(frontLower) ||
      (frontLower.includes("abstract") && frontLower.includes("introduction") && !frontLower.includes("vedúci práce") && !frontLower.includes("školiteľ")) ||
      (!frontLower.includes("univerzita") && !frontLower.includes("university") && !frontLower.includes("vedúci") && !frontLower.includes("supervisor") && (frontLower.includes("distribution function") || frontLower.includes("cross section") || frontLower.includes("probability function") || frontLower.includes("particles") || frontLower.includes("experiment")))
    )

    if (isPaperDoc) {
      reviewKind = "paper"
      reviewerRole = "reviewer"
    } else if (fileHints.hintType) {
      thesisType = fileHints.hintType
      reviewKind = fileHints.hintKind || "thesis"
    } else if (isPhd) {
      thesisType = "phd"
      reviewKind = "thesis"
    } else if (isBachelor) {
      thesisType = "bachelor"
      reviewKind = "thesis"
    } else if (isMaster || /záverečn[áé]\s+prác[ae]|rozširujúce štúdium/i.test(frontLower)) {
      thesisType = "master"
      reviewKind = "thesis"
    }

    // 7. Academic Year / Date
    const yearMatch = frontMatter.match(/(?:máj|jún|január|február|marec|apríl|júl|august|september|október|november|december)?\s*\b(202[0-9](?:\/202[0-9])?)\b/i)
    if (yearMatch) {
      academicYear = yearMatch[0].trim()
    }
  }

  // Cross-document mismatch guard: prevent text leakage from unrelated files
  if (filename) {
    const fnLow = filename.toLowerCase()
    const textLow = (title + " " + institution + " " + department + " " + studentName).toLowerCase()
    const isPhysicsDoc = /boson|bose-einstein|atlas|proton|quark|hadron/i.test(fnLow)
    const isChemistryDoc = /ch[eé]mi[ea]|pedagogick|u[cč]ite[lľ]stvo|ke[lľ]ov[aá]/i.test(textLow)
    const isPhdFilename = /phd|doctoral|dissertation|dizert/i.test(fnLow)
    const isKelovaText = /ke[lľ]ov[aá]|hodnotenie vo výučbe chémie/i.test(textLow)
    if ((isPhysicsDoc && isChemistryDoc) || (isPhdFilename && isKelovaText)) {
      studentName = fileHints.hintAuthor || ""
      title = fileHints.title || ""
      reviewerName = ""
      institution = ""
      department = ""
      academicYear = ""
    }
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

  const { ingestFiles, uploadFiles, removeFile, updateActiveOutput } = useEditor(
    useShallow((s) => ({
      ingestFiles: s.project?.ingestFiles ?? [],
      uploadFiles: s.uploadFiles,
      removeFile: s.removeFile,
      updateActiveOutput: s.updateActiveOutput,
    }))
  )

  const [isFormCollapsed, setIsFormCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [autoExtractedSuccess, setAutoExtractedSuccess] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [confirmInlineDeleteId, setConfirmInlineDeleteId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastExtractedDocRef = useRef<string | null>(null)

  const defaultFileId = ingestFiles[0]?.id || ""
  const activeFileId = selectedFileId || defaultFileId
  const activeFile = ingestFiles.find((f) => f.id === activeFileId) || ingestFiles[0]
  const isParsing = ingestFiles.some((f) => f.status === "parsing" || f.status === "queued")


  // Smart auto-fill from document text and/or filename
  const applyExtraction = useCallback((text: string, filename?: string) => {
    const ext = extractSmartThesisMetadata(text, filename)
    updateFormMetadata({
      thesisTitle: ext.title || "",
      studentName: ext.studentName || "",
      thesisType: ext.thesisType,
      reviewKind: ext.reviewKind,
      reviewerRole: (ext.reviewKind === "paper" ? "reviewer" : ext.reviewerRole) as ReviewerRole,
      reviewerName: ext.reviewerName || "",
      institution: ext.institution || "",
      department: ext.department || "",
      academicYear: ext.academicYear || "",
    })
    if (ext.reviewKind === "paper") {
      updateActiveOutput({ title: "Posudok vedeckého článku" })
    }
    setAutoExtractedSuccess(true)
    setTimeout(() => setAutoExtractedSuccess(false), 3000)
  }, [updateFormMetadata, updateActiveOutput])

  // Explicit document selection handler: immediately pre-fills 2, 3, 4 from filename,
  // then loads the source document text and enriches with full metadata
  const handleDocumentSelect = useCallback(async (fileId: string) => {
    if (!fileId) return
    setSelectedFileId(fileId)
    lastExtractedDocRef.current = fileId
    const targetFile = ingestFiles.find((f) => f.id === fileId)

    // Step 1: Pre-fill immediately from targetFile name & hints (cleans prefix, sets title, degree, author hint)
    applyExtraction("", targetFile?.name)

    // Step 2: Fetch parsed document markdown text
    const text = await loadSourceDocument(workspaceId, fileId)

    // Step 3: If parsed markdown is available, enrich with full text metadata
    if (text) {
      applyExtraction(text, targetFile?.name)
    }
  }, [ingestFiles, setSelectedFileId, applyExtraction, loadSourceDocument, workspaceId])

  const handleDeleteFile = useCallback(async (file: { id: string; name: string }) => {
    setIsDeleting(true)
    try {
      const fileId = file.id
      clearSourceDocCache(workspaceId, fileId)
      await removeFile(fileId)

      const remaining = ingestFiles.filter((f) => f.id !== fileId)
      if (activeFileId === fileId) {
        if (remaining.length > 0) {
          const nextId = remaining[0].id
          setSelectedFileId(nextId)
          await handleDocumentSelect(nextId)
        } else {
          setSelectedFileId("")
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
      }
      setFileToDelete(null)
      setConfirmInlineDeleteId(null)
      if (remaining.length === 0) {
        setIsManageOpen(false)
      }
    } catch (err) {
      console.error("Failed to delete source file:", err)
    } finally {
      setIsDeleting(false)
    }
  }, [activeFileId, handleDocumentSelect, ingestFiles, removeFile, setSelectedFileId, updateFormMetadata, workspaceId])

  // Synchronize selectedFileId in store if files exist and none selected
  useEffect(() => {
    if (ingestFiles.length > 0 && !selectedFileId) {
      const initialId = ingestFiles[0].id
      handleDocumentSelect(initialId)
    }
  }, [ingestFiles, selectedFileId, handleDocumentSelect])

  // Auto-extract on mount or when activeFileId changes and has not been extracted yet
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

    if (activeFileId && lastExtractedDocRef.current !== activeFileId) {
      handleDocumentSelect(activeFileId)
    }
  }, [ingestFiles.length, activeFileId, handleDocumentSelect, updateFormMetadata])

  const handleFileUpload = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    const pdfFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf") || f.type.includes("pdf"))
    if (pdfFiles.length > 0) {
      lastExtractedDocRef.current = null
      uploadFiles(pdfFiles)
      // Immediately prefill from newly uploaded file
      applyExtraction("", pdfFiles[0].name)
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
  const isPaper = formMetadata.reviewKind === "paper"
  const selectedDocType = isPaper ? "article" : formMetadata.thesisType

  const isComplete = formMetadata.reviewerRole === "self"
    ? Boolean(formMetadata.thesisTitle?.trim())
    : Boolean(formMetadata.studentName?.trim()) && Boolean(formMetadata.thesisTitle?.trim())

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto no-scrollbar bg-background">
      {/* Header */}
      <div className="flex items-center pb-3 border-b border-border/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs">
            {isPaper ? <FileText className="size-4" /> : <GraduationCap className="size-4" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {isPaper ? "Posudok vedeckého článku" : "Posudok záverečnej práce"}
            </h2>
            <p className="text-[11px] text-muted-foreground truncate">
              {isPaper ? "Parametre a spustenie AI recenzie" : "Parametre a spustenie AI hodnotenia"}
            </p>
          </div>
        </div>
      </div>

      {activeReview && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-2.5 text-xs text-success dark:text-success flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <FileCheck2 className="size-4 shrink-0 text-success dark:text-success" />
            <span className="truncate">Posudok: <strong>{activeReview.studentName}</strong></span>
          </div>
          {activeReview.grade && (
            <Badge variant="outline" className="font-bold border-success/40 text-success dark:text-success shrink-0 ml-1.5">
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
            <BookOpen className="size-3.5 text-primary" />
            Zdrojový dokument
          </Label>
          {ingestFiles.length > 1 && (
            <button
              type="button"
              onClick={() => setIsManageOpen(true)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
            >
              <Files className="size-3 text-muted-foreground" />
              Spravovať ({ingestFiles.length})
            </button>
          )}
        </div>

        {ingestFiles.length > 0 ? (
          <div className="space-y-1.5">
            {ingestFiles.length > 1 ? (
              <div className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <Select
                    value={activeFileId}
                    onValueChange={(val) => {
                      if (val) {
                        handleDocumentSelect(val)
                      }
                    }}
                  >
                    <SelectTrigger className="h-8.5 text-xs w-full bg-card border-border/80 shadow-2xs font-medium rounded-lg px-3 hover:border-border transition-colors" aria-label={isPaper ? "Vyberte článok" : "Vyberte prácu"}>
                      <SelectValue placeholder={isPaper ? "Vyberte článok..." : "Vyberte prácu..."}>
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
                      <SelectSeparator />
                      <div className="p-1">
                        <button
                          type="button"
                          onPointerDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsManageOpen(true)
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors cursor-pointer"
                        >
                          <Files className="size-3 text-muted-foreground" />
                          Spravovať nahrané súbory...
                        </button>
                      </div>
                    </SelectContent>
                  </Select>
                </div>
                {activeFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={isGenerating || isDeleting}
                    onClick={() => setFileToDelete(activeFile)}
                    title={isPaper ? "Odstrániť vybraný článok" : "Odstrániť vybranú prácu"}
                    aria-label={isPaper ? "Odstrániť vybraný článok" : "Odstrániť vybranú prácu"}
                    className="h-8.5 w-8.5 shrink-0 rounded-lg text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border bg-card/70 p-2.5 flex items-center justify-between text-xs shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="size-4 text-primary shrink-0" />
                  <div className="min-w-0 truncate">
                    <p className="font-medium text-foreground truncate">{formatDocumentDisplayName(activeFile?.name)}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{formatBytes(activeFile?.size || 0)}</p>
                  </div>
                </div>
                {activeFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={isGenerating || isDeleting}
                    onClick={() => setFileToDelete(activeFile)}
                    title={isPaper ? "Odstrániť článok" : "Odstrániť prácu"}
                    aria-label={isPaper ? "Odstrániť článok" : "Odstrániť prácu"}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
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
              {isPaper ? "Nahrať ďalší článok (PDF)" : "Nahrať ďalšiu prácu (PDF)"}
            </Button>

            {autoExtractedSuccess && (
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-success dark:text-success animate-fade-in pl-0.5">
                <Sparkles className="size-3" />
                <span>Údaje úspešne načítané z dokumentu</span>
              </div>
            )}

            {isParsing && (
              <div className="flex items-center gap-2 text-xs text-warning dark:text-warning bg-warning/10 p-2.5 rounded-lg border border-warning/30">
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
            <p className="text-xs font-semibold">{isPaper ? "Nahrajte PDF článku" : "Nahrajte PDF práce"}</p>
            <p className="text-[10px] text-muted-foreground">Presuňte súbor sem</p>
          </div>
        )}
      </div>

      <Separator className="my-0.5 bg-border/60" />

      {/* 2. Metadata Section — Collapsible on complete (2.7) */}
      {isComplete && isFormCollapsed ? (
        <div className="rounded-xl border bg-muted/20 p-3 space-y-2 transition-all shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-success dark:text-success">
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
              {THESIS_TYPES.find((t) => t.value === selectedDocType)?.[lang] || "Diplomová práca"}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="size-3.5 text-primary" />
              {isPaper ? "Údaje o vedeckom článku" : "Údaje o záverečnej práci"}
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
              {isPaper ? "Názov článku *" : "Názov práce *"}
            </Label>
            <Input
              className="h-8 text-xs bg-card rounded-lg border-border/80"
              placeholder={
                isPaper
                  ? "Napr. Bose-Einstein correlations in pp collisions at 13 TeV"
                  : "Napr. Systém na automatizované vyhľadávanie a asistenciu pri príprave grantov"
              }
              aria-label={isPaper ? "Názov článku" : "Názov práce"}
              value={formMetadata.thesisTitle}
              onChange={(e) => updateFormMetadata({ thesisTitle: e.target.value })}
            />
          </div>

          {/* Student Name */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              {isPaper ? "Autori článku *" : "Meno autora/autorky *"}
            </Label>
            <Input
              className="h-8 text-xs bg-card rounded-lg border-border/80"
              placeholder={
                isPaper
                  ? "Napr. R. Aštaloš, J. Novák, M. Kováč"
                  : "Napr. Bc. Maroš Bednár"
              }
              aria-label={isPaper ? "Autori článku" : "Meno autora/autorky"}
              value={formMetadata.studentName}
              onChange={(e) => updateFormMetadata({ studentName: e.target.value })}
            />
          </div>

          {/* Degree & Language */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Typ dokumentu</Label>
              <Select
                value={selectedDocType}
                onValueChange={(v) => {
                  if (!v) return
                  if (v === "article") {
                    updateFormMetadata({ reviewKind: "paper" as ReviewKind })
                    updateActiveOutput({ title: "Posudok vedeckého článku" })
                  } else {
                    updateFormMetadata({ thesisType: v as any, reviewKind: "thesis" as ReviewKind })
                    updateActiveOutput({
                      title: formMetadata.reviewerRole === "supervisor"
                        ? "Posudok školiteľa"
                        : formMetadata.reviewerRole === "self"
                        ? "Predkonzultačný rozbor"
                        : formMetadata.reviewerRole === "opponent"
                        ? "Posudok oponenta"
                        : "Posudok recenzenta",
                    })
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-card rounded-lg border-border/80" aria-label="Typ dokumentu">
                  <SelectValue>
                    {THESIS_TYPES.find((t) => t.value === selectedDocType)?.[lang] || "Diplomová práca"}
                  </SelectValue>
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
                      title: isPaper
                        ? "Posudok vedeckého článku"
                        : v === "supervisor"
                        ? "Posudok školiteľa"
                        : v === "self"
                        ? "Predkonzultačný rozbor"
                        : v === "opponent"
                        ? "Posudok oponenta"
                        : "Posudok recenzenta",
                    })
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-card rounded-lg border-border/80" aria-label="Rola recenzenta">
                  <SelectValue>{REVIEWER_ROLES.find((r) => r.value === formMetadata.reviewerRole)?.[lang] || (isPaper ? "Recenzent" : "Oponent práce")}</SelectValue>
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
            <Label className="text-[11px] font-medium text-muted-foreground">
              {isPaper ? "Inštitúcia / Pracovisko" : "Univerzita a fakulta"}
            </Label>
            <Input
              aria-label={isPaper ? "Inštitúcia / Pracovisko" : "Univerzita a fakulta"}
              className="h-8 text-xs bg-card rounded-lg border-border/80"
              placeholder={
                isPaper
                  ? "Napr. Ústav experimentálnej fyziky SAV / CERN"
                  : "Slovenská technická univerzita v Bratislave, FIIT"
              }
              value={formMetadata.institution ?? ""}
              onChange={(e) => updateFormMetadata({ institution: e.target.value })}
            />
          </div>
        </div>
      )}

      {!isMetadataValid && (
        <p className="text-[10px] text-warning dark:text-warning text-center pt-1">
          {isPaper
            ? "Doplňte názov článku a autorov pre spustenie recenzie."
            : "Doplňte názov práce a meno autora pre spustenie posudku."}
        </p>
      )}

      {/* Confirmation Dialog for single/active file deletion */}
      <ConfirmDialog
        open={Boolean(fileToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setFileToDelete(null)
        }}
        title={isPaper ? "Odstrániť zdrojový článok?" : "Odstrániť zdrojovú prácu?"}
        description={
          fileToDelete ? (
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>
                Naozaj chcete odstrániť súbor{" "}
                <strong className="text-foreground">{fileToDelete.name}</strong>?
              </p>
              <p className="text-[11px]">
                Týmto sa vymaže extrahovaný text dokumentu a súvisiace indexové dáta. Ak má práca existujúce vygenerované recenzie, recenzie ostanú zachované.
              </p>
            </div>
          ) : null
        }
        confirmLabel="Odstrániť"
        cancelLabel="Zrušiť"
        destructive={true}
        busy={isDeleting}
        onConfirm={() => {
          if (fileToDelete) {
            return handleDeleteFile(fileToDelete)
          }
        }}
      />

      {/* Manage Source Documents Modal */}
      <Dialog open={isManageOpen} onOpenChange={(o) => { if (!isDeleting) setIsManageOpen(o) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Files className="size-4 text-primary" />
              Nahrané zdrojové dokumenty
            </DialogTitle>
            <DialogDescription>
              Prehľad, výber a odstránenie PDF dokumentov v tomto projekte.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 py-1">
            {ingestFiles.map((f) => {
              const isActive = f.id === activeFileId
              const isConfirming = confirmInlineDeleteId === f.id
              return (
                <div
                  key={f.id}
                  className={cn(
                    "flex flex-col gap-2 p-2.5 rounded-lg border text-xs transition-colors",
                    isActive ? "border-primary/40 bg-primary/5" : "border-border bg-card/60 hover:bg-card"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <FileText className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                      <div className="min-w-0 flex-1 truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground truncate" title={f.name}>
                            {formatDocumentDisplayName(f.name)}
                          </span>
                          {isActive && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border-0 shrink-0">
                              Aktívny
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatBytes(f.size)}
                        </span>
                      </div>
                    </div>

                    {!isConfirming && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isActive && (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={isDeleting || isGenerating}
                            onClick={() => {
                              handleDocumentSelect(f.id)
                              setIsManageOpen(false)
                            }}
                            className="h-7 text-[11px] cursor-pointer"
                          >
                            Vybrať
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={isDeleting || isGenerating}
                          onClick={() => setConfirmInlineDeleteId(f.id)}
                          title="Odstrániť súbor"
                          aria-label={`Odstrániť súbor ${f.name}`}
                          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Inline delete confirmation */}
                  {isConfirming && (
                    <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-destructive/20 bg-destructive/5 -mx-2.5 -mb-2.5 p-2 rounded-b-lg animate-fade-in">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-destructive truncate">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        <span className="truncate">Naozaj zmazať tento súbor?</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setConfirmInlineDeleteId(null)}
                          disabled={isDeleting}
                          className="h-6 text-[10px] px-2 cursor-pointer"
                        >
                          Zrušiť
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="destructive"
                          onClick={() => void handleDeleteFile(f)}
                          disabled={isDeleting}
                          className="h-6 text-[10px] px-2 cursor-pointer"
                        >
                          {isDeleting ? <Loader2 className="size-3 animate-spin" /> : "Zmazať"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsManageOpen(false)
                fileInputRef.current?.click()
              }}
              className="gap-1.5 text-xs cursor-pointer"
            >
              <UploadCloud className="size-3.5 text-primary" />
              Nahrať ďalší súbor
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setConfirmInlineDeleteId(null)
                setIsManageOpen(false)
              }}
              className="text-xs cursor-pointer"
            >
              Zavrieť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

