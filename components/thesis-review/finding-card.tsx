"use client"

/**
 * FindingCard — Interactive review finding with evidence linking,
 * severity triage (Major vs. Minor), audience routing, and reviewer annotation.
 */

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit3,
  Search,
  EyeOff,
  Eye,
  MessageSquare,
  Sparkles,
  User,
  Quote,
  Lock,
  HelpCircle,
  AlertCircle,
} from "lucide-react"
import type {
  ReviewFinding,
  ReviewSeverity,
  FindingStatus,
  EvidenceReference,
  EvidenceState,
  FindingAudience,
} from "@/lib/ai/review-types"
import type { ReviewLanguage } from "@/lib/ai/thesis-rubric"
import { StatusBadge } from "./status-badge"
import { SEVERITY_CLASSES, EPISTEMIC_CLASSES, EVIDENCE_CLASSES } from "@/lib/thesis-review/badge-styles"

interface Props {
  finding: ReviewFinding
  lang?: ReviewLanguage
  isSelected?: boolean
  onSelectEvidence: (ev: EvidenceReference) => void
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onEdit: (id: string, updates: Partial<ReviewFinding>) => void
  onToggleExport: (id: string) => void
}

const STATUS_ICONS: Record<FindingStatus, any> = {
  unreviewed: AlertTriangle,
  accepted: CheckCircle2,
  edited: Edit3,
  rejected: XCircle,
  resolved: CheckCircle2,
}

const EVIDENCE_ICONS: Record<EvidenceState, any> = {
  "verified-exact": CheckCircle2,
  "verified-normalized": CheckCircle2,
  approximate: HelpCircle,
  ambiguous: HelpCircle,
  stale: AlertCircle,
  unverified: AlertCircle,
  verified: CheckCircle2,
}

type FindingCardLabels = {
  severityOptions: Record<ReviewSeverity, string>
  severityShort: Record<ReviewSeverity, string>
  audienceOptions: Record<FindingAudience, string>
  audienceShort: Record<FindingAudience, string>
  categoryLabels: Record<string, string>
  originAi: string
  originReviewer: string
  statusLabels: Record<FindingStatus, string>
  toggleExportOn: string
  toggleExportOff: string
  editTitlePlaceholder: string
  editExplanationPlaceholder: string
  editRecommendationPlaceholder: string
  cancelEdit: string
  saveEdit: string
  confidential: string
  recommendationLabel: string
  evidenceLabel: string
  viewInDocument: string
  evidenceStates: Record<EvidenceState, string>
  epistemic: Record<string, { label: string; title: string }>
  reviewerNoteLabel: string
  reviewerNotePlaceholder: string
  accept: string
  reject: string
  edit: string
  hideNote: string
  addNote: string
}

const LABELS: Record<ReviewLanguage, FindingCardLabels> = {
  sk: {
    severityOptions: {
      critical: "Kritická chyba (Critical)",
      major: "Zásadná pripomienka (Major)",
      minor: "Drobná pripomienka (Minor)",
      suggestion: "Návrh / Odporúčanie (Suggestion)",
      info: "Informačná poznámka (Info)",
    },
    severityShort: {
      critical: "Kritická",
      major: "Zásadná",
      minor: "Drobná",
      suggestion: "Návrh",
      info: "Info",
    },
    audienceOptions: { author: "Pre autora", editor: "Dôverné (Editor)", committee: "Pre komisiu", private: "Súkromné" },
    audienceShort: { author: "Pre autora", editor: "Dôverné", committee: "Komisia", private: "Súkromné" },
    categoryLabels: {
      methodology: "Metodológia",
      results: "Výsledky",
      statistics: "Štatistika",
      literature: "Literatúra",
      reproducibility: "Reprodukovateľnosť",
      formal: "Formálna úprava",
      general: "Všeobecné",
      discussion: "Diskusia",
      theory: "Teória",
      objectives: "Ciele",
    },
    originAi: "AI",
    originReviewer: "Recenzent",
    statusLabels: {
      unreviewed: "Nepreskúmané",
      accepted: "Prijaté",
      edited: "Upravené",
      rejected: "Odmietnuté",
      resolved: "Vyriešené",
    },
    toggleExportOn: "Zahrnuté v exporte",
    toggleExportOff: "Vylúčené z exportu",
    editTitlePlaceholder: "Názov zistenia",
    editExplanationPlaceholder: "Podrobné vysvetlenie problému",
    editRecommendationPlaceholder: "Odporúčaná náprava pre autora",
    cancelEdit: "Zrušiť",
    saveEdit: "Uložiť zmeny",
    confidential: "Dôverné",
    recommendationLabel: "Odporúčaná náprava:",
    evidenceLabel: "Dôkaz v texte:",
    viewInDocument: "Zobraziť v dokumente",
    evidenceStates: {
      "verified-exact": "Presný citát ✓",
      "verified-normalized": "Normalizovaný ✓",
      approximate: "Približná zhoda ~",
      ambiguous: "Viacero výskytov ⧉",
      stale: "Zmenená verzia ⚠",
      unverified: "Neoverený",
      verified: "Presný citát ✓",
    },
    epistemic: {
      SUPPORTED_FACT: { label: "Doložený fakt ✓", title: "Doložený fakt: overený priamy citát z rukopisu" },
      SUPPORTED_INTERPRETATION: { label: "Interpretácia", title: "Interpretácia doložená textom práce" },
      REVIEWER_JUDGMENT: { label: "Úsudok", title: "Hodnotenie recenzenta" },
      MISSING_EVIDENCE: { label: "Chýbajúci podklad", title: "Chýbajúci podklad: v dostupnom texte nebolo možné overiť" },
      POSSIBLE_RISK: { label: "Možné riziko", title: "Hodnotenie recenzenta" },
      REQUIRES_HUMAN_VERIFICATION: { label: "Nutné overiť ⚠", title: "Vyžaduje overenie recenzentom v origináli" },
    },
    reviewerNoteLabel: "Vlastná poznámka recenzenta:",
    reviewerNotePlaceholder: "Doplňte vlastné odborné stanovisko k tomuto bodu...",
    accept: "Prijať",
    reject: "Odmietnuť",
    edit: "Upraviť",
    hideNote: "Skryť poznámku",
    addNote: "+ Poznámka recenzenta",
  },
  cs: {
    severityOptions: {
      critical: "Kritická chyba (Critical)",
      major: "Zásadní připomínka (Major)",
      minor: "Drobná připomínka (Minor)",
      suggestion: "Návrh / Doporučení (Suggestion)",
      info: "Informační poznámka (Info)",
    },
    severityShort: {
      critical: "Kritická",
      major: "Zásadní",
      minor: "Drobná",
      suggestion: "Návrh",
      info: "Info",
    },
    audienceOptions: { author: "Pro autora", editor: "Důvěrné (Editor)", committee: "Pro komisi", private: "Soukromé" },
    audienceShort: { author: "Pro autora", editor: "Důvěrné", committee: "Komise", private: "Soukromé" },
    categoryLabels: {
      methodology: "Metodologie",
      results: "Výsledky",
      statistics: "Statistika",
      literature: "Literatura",
      reproducibility: "Reprodukovatelnost",
      formal: "Formální úprava",
      general: "Obecné",
      discussion: "Diskuze",
      theory: "Teorie",
      objectives: "Cíle",
    },
    originAi: "AI",
    originReviewer: "Recenzent",
    statusLabels: {
      unreviewed: "Nepřezkoumáno",
      accepted: "Přijato",
      edited: "Upraveno",
      rejected: "Zamítnuto",
      resolved: "Vyřešeno",
    },
    toggleExportOn: "Zahrnuto v exportu",
    toggleExportOff: "Vyloučeno z exportu",
    editTitlePlaceholder: "Název zjištění",
    editExplanationPlaceholder: "Podrobné vysvětlení problému",
    editRecommendationPlaceholder: "Doporučená náprava pro autora",
    cancelEdit: "Zrušit",
    saveEdit: "Uložit změny",
    confidential: "Důvěrné",
    recommendationLabel: "Doporučená náprava:",
    evidenceLabel: "Důkaz v textu:",
    viewInDocument: "Zobrazit v dokumentu",
    evidenceStates: {
      "verified-exact": "Přesná citace ✓",
      "verified-normalized": "Normalizováno ✓",
      approximate: "Přibližná shoda ~",
      ambiguous: "Více výskytů ⧉",
      stale: "Změněná verze ⚠",
      unverified: "Neověřeno",
      verified: "Přesná citace ✓",
    },
    epistemic: {
      SUPPORTED_FACT: { label: "Doložený fakt ✓", title: "Doložený fakt: ověřená přímá citace z rukopisu" },
      SUPPORTED_INTERPRETATION: { label: "Interpretace", title: "Interpretace doložená textem práce" },
      REVIEWER_JUDGMENT: { label: "Úsudek", title: "Hodnocení recenzenta" },
      MISSING_EVIDENCE: { label: "Chybějící podklad", title: "Chybějící podklad: v dostupném textu nebylo možné ověřit" },
      POSSIBLE_RISK: { label: "Možné riziko", title: "Hodnocení recenzenta" },
      REQUIRES_HUMAN_VERIFICATION: { label: "Nutno ověřit ⚠", title: "Vyžaduje ověření recenzentem v originále" },
    },
    reviewerNoteLabel: "Vlastní poznámka recenzenta:",
    reviewerNotePlaceholder: "Doplňte vlastní odborné stanovisko k tomuto bodu...",
    accept: "Přijmout",
    reject: "Zamítnout",
    edit: "Upravit",
    hideNote: "Skrýt poznámku",
    addNote: "+ Poznámka recenzenta",
  },
  en: {
    severityOptions: {
      critical: "Critical error (Critical)",
      major: "Major comment (Major)",
      minor: "Minor comment (Minor)",
      suggestion: "Suggestion / Recommendation",
      info: "Informational note (Info)",
    },
    severityShort: {
      critical: "Critical",
      major: "Major",
      minor: "Minor",
      suggestion: "Suggestion",
      info: "Info",
    },
    audienceOptions: { author: "For author", editor: "Confidential (Editor)", committee: "For committee", private: "Private" },
    audienceShort: { author: "Author", editor: "Confidential", committee: "Committee", private: "Private" },
    categoryLabels: {
      methodology: "Methodology",
      results: "Results",
      statistics: "Statistics",
      literature: "Literature",
      reproducibility: "Reproducibility",
      formal: "Formal",
      general: "General",
      discussion: "Discussion",
      theory: "Theory",
      objectives: "Objectives",
    },
    originAi: "AI",
    originReviewer: "Reviewer",
    statusLabels: {
      unreviewed: "Unreviewed",
      accepted: "Accepted",
      edited: "Edited",
      rejected: "Rejected",
      resolved: "Resolved",
    },
    toggleExportOn: "Included in export",
    toggleExportOff: "Excluded from export",
    editTitlePlaceholder: "Finding title",
    editExplanationPlaceholder: "Detailed explanation of the issue",
    editRecommendationPlaceholder: "Recommended fix for the author",
    cancelEdit: "Cancel",
    saveEdit: "Save changes",
    confidential: "Confidential",
    recommendationLabel: "Recommended fix:",
    evidenceLabel: "Evidence in text:",
    viewInDocument: "Show in document",
    evidenceStates: {
      "verified-exact": "Exact quote ✓",
      "verified-normalized": "Normalized ✓",
      approximate: "Approximate match ~",
      ambiguous: "Multiple occurrences ⧉",
      stale: "Changed version ⚠",
      unverified: "Unverified",
      verified: "Exact quote ✓",
    },
    epistemic: {
      SUPPORTED_FACT: { label: "Supported fact ✓", title: "Supported fact: verified direct quote from the manuscript" },
      SUPPORTED_INTERPRETATION: { label: "Interpretation", title: "Interpretation supported by the text" },
      REVIEWER_JUDGMENT: { label: "Judgment", title: "Reviewer's assessment" },
      MISSING_EVIDENCE: { label: "Missing evidence", title: "Missing evidence: could not be verified in the available text" },
      POSSIBLE_RISK: { label: "Possible risk", title: "Reviewer's assessment" },
      REQUIRES_HUMAN_VERIFICATION: { label: "Needs verification ⚠", title: "Requires verification by the reviewer in the original" },
    },
    reviewerNoteLabel: "Reviewer's note:",
    reviewerNotePlaceholder: "Add your own expert opinion on this point...",
    accept: "Accept",
    reject: "Reject",
    edit: "Edit",
    hideNote: "Hide note",
    addNote: "+ Reviewer note",
  },
}

export function FindingCard({
  finding,
  lang = "sk",
  isSelected = false,
  onSelectEvidence,
  onAccept,
  onReject,
  onEdit,
  onToggleExport,
}: Props) {
  const L = LABELS[lang]
  const cleanTitle = finding.title.replace(/^\[Critique\]\s*/i, "")
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(cleanTitle)
  const [explanation, setExplanation] = useState(finding.explanation)
  const [recommendation, setRecommendation] = useState(finding.recommendation)
  const [reviewerNotes, setReviewerNotes] = useState(finding.reviewerNotes || "")
  const [isNotesOpen, setIsNotesOpen] = useState(Boolean(finding.reviewerNotes))

  // Sync local edit state when the finding prop changes externally (e.g. Yjs
  // collaboration) — but never clobber fields the reviewer is actively editing.
  useEffect(() => {
    if (isEditing) return
    setTitle(cleanTitle)
    setExplanation(finding.explanation)
    setRecommendation(finding.recommendation)
    setReviewerNotes(finding.reviewerNotes || "")
  }, [cleanTitle, finding.explanation, finding.recommendation, finding.reviewerNotes, isEditing])

  const handleSaveEdit = () => {
    onEdit(finding.id, {
      title,
      explanation,
      recommendation,
      reviewerNotes: reviewerNotes.trim() || undefined,
      status: "edited",
    })
    setIsEditing(false)
  }

  const primaryEvidence = finding.evidence?.[0]
  const StatusIcon = STATUS_ICONS[finding.status] || AlertTriangle

  const renderEvidenceState = (ev?: EvidenceReference) => {
    if (!ev?.quote) return null
    const st: EvidenceState = ev.state || (ev.verified ? "verified-exact" : "unverified")
    const Icon = EVIDENCE_ICONS[st] || AlertCircle
    return (
      <StatusBadge variant={EVIDENCE_CLASSES[st]} icon={<Icon className="h-2.5 w-2.5" />}>
        {L.evidenceStates[st]}
      </StatusBadge>
    )
  }

  return (
    <div
      data-finding-id={finding.id}
      className={`rounded-lg border bg-card p-4 transition-all duration-200 space-y-3 ${
        isSelected ? "ring-2 ring-primary shadow-md" : ""
      } ${
        finding.status === "rejected"
          ? "opacity-60 bg-muted/20"
          : "shadow-sm hover:border-primary/40"
      }`}
    >
      {/* Card Header: Category, Severity, Status & Creator */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Severity selector */}
          <Select
            value={finding.severity}
            onValueChange={(val) => onEdit(finding.id, { severity: val as ReviewSeverity })}
          >
            <SelectTrigger
              size="xs"
              className={`h-6 text-[11px] font-bold px-2 py-0 border rounded-md w-auto shrink-0 ${SEVERITY_CLASSES[finding.severity]}`}
            >
              <SelectValue>
                {L.severityShort[finding.severity] || finding.severity}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical" className="text-xs font-bold text-destructive">
                {L.severityOptions.critical}
              </SelectItem>
              <SelectItem value="major" className="text-xs font-bold text-severity-major">
                {L.severityOptions.major}
              </SelectItem>
              <SelectItem value="minor" className="text-xs font-bold text-status-info">
                {L.severityOptions.minor}
              </SelectItem>
              <SelectItem value="suggestion" className="text-xs text-muted-foreground">
                {L.severityOptions.suggestion}
              </SelectItem>
              <SelectItem value="info" className="text-xs text-muted-foreground">
                {L.severityOptions.info}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Category tag */}
          <Badge
            variant="outline"
            className="h-6 text-[10px] font-medium tracking-normal px-2 py-0 inline-flex items-center rounded-md shrink-0"
          >
            {L.categoryLabels[finding.category] || finding.category}
          </Badge>

          {/* Epistemic Status badge */}
          {finding.epistemicStatus && L.epistemic[finding.epistemicStatus] && (
            <StatusBadge
              size="md"
              variant={EPISTEMIC_CLASSES[finding.epistemicStatus]}
              title={L.epistemic[finding.epistemicStatus].title}
              className="h-6 py-0 px-2 inline-flex items-center rounded-md shrink-0"
            >
              {L.epistemic[finding.epistemicStatus].label}
            </StatusBadge>
          )}

          {/* Audience selector */}
          <Select
            value={finding.audience || "author"}
            onValueChange={(val) => onEdit(finding.id, { audience: val as FindingAudience })}
          >
            <SelectTrigger
              size="xs"
              className="h-6 text-[10px] font-medium px-2 py-0 border rounded-md w-auto shrink-0 text-muted-foreground"
            >
              <SelectValue>
                {L.audienceShort[finding.audience || "author"] || finding.audience}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="author" className="text-xs">{L.audienceOptions.author}</SelectItem>
              <SelectItem value="editor" className="text-xs font-bold text-warning">{L.audienceOptions.editor}</SelectItem>
              <SelectItem value="committee" className="text-xs font-bold text-status-info">{L.audienceOptions.committee}</SelectItem>
              <SelectItem value="private" className="text-xs font-bold text-muted-foreground">{L.audienceOptions.private}</SelectItem>
            </SelectContent>
          </Select>

          {/* AI vs Reviewer origin badge */}
          {finding.createdBy === "ai" ? (
            <Badge
              variant="outline"
              className="h-6 text-[10px] font-mono gap-1 text-muted-foreground border-muted-foreground/30 px-2 py-0 inline-flex items-center rounded-md shrink-0"
            >
              <Sparkles className="h-3 w-3 text-primary/70" /> {L.originAi}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="h-6 text-[10px] font-mono font-bold gap-1 text-primary border-primary/30 bg-primary/5 px-2 py-0 inline-flex items-center rounded-md shrink-0"
            >
              <User className="h-3 w-3" /> {L.originReviewer}
            </Badge>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="secondary"
            className={`h-6 text-[10px] font-semibold gap-1 px-2 py-0 inline-flex items-center rounded-md shrink-0 ${
              finding.status === "accepted"
                ? "text-success bg-success/10"
                : finding.status === "rejected"
                ? "text-destructive bg-destructive/10"
                : ""
            }`}
          >
            <StatusIcon className="h-3 w-3" />
            {L.statusLabels[finding.status]}
          </Badge>

          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground shrink-0"
            title={finding.includeInExport ? L.toggleExportOn : L.toggleExportOff}
            onClick={() => onToggleExport(finding.id)}
          >
            {finding.includeInExport ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 opacity-50" />
            )}
          </Button>
        </div>
      </div>

      {/* Card Body: Title, Explanation & Recommendation */}
      {isEditing ? (
        <div className="space-y-2 pt-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={L.editTitlePlaceholder}
            className="text-xs font-bold"
          />
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder={L.editExplanationPlaceholder}
            className="text-xs min-h-[60px]"
          />
          <Textarea
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            placeholder={L.editRecommendationPlaceholder}
            className="text-xs min-h-[50px]"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="h-7 text-xs">
              {L.cancelEdit}
            </Button>
            <Button size="sm" onClick={handleSaveEdit} className="h-7 text-xs font-semibold">
              {L.saveEdit}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground tracking-tight leading-snug">
              {cleanTitle}
            </h4>
            {finding.audience === "editor" && (
              <Badge variant="outline" className="text-[10px] text-warning border-warning/40 gap-1 shrink-0">
                <Lock className="h-2.5 w-2.5" /> {L.confidential}
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {finding.explanation}
          </p>

          {finding.recommendation && (
            <div className="rounded bg-muted/40 p-2 text-xs border-l-2 border-primary/50 text-foreground/90">
              <span className="font-semibold text-[11px] block text-primary">{L.recommendationLabel}</span>
              {finding.recommendation}
            </div>
          )}
        </div>
      )}

      {/* Evidence Anchor Box */}
      {primaryEvidence?.quote && (
        <div className="rounded bg-muted/30 border p-2.5 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <Quote className="h-3 w-3 text-primary" /> {L.evidenceLabel}
              {primaryEvidence.chunkId && (
                <span
                  className="font-mono text-[10px] px-1.5 py-0 rounded border border-primary/30 bg-primary/10 text-primary tabular-nums"
                  title={`Zdrojový blok RAG indexu: ${primaryEvidence.chunkId}${primaryEvidence.verified ? "" : " — kotva sa nenašla presne; citáciu preverte"}`}
                >
                  [{primaryEvidence.chunkId.slice(0, 8)}]
                </span>
              )}
              {renderEvidenceState(primaryEvidence)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-2 text-[10px] font-semibold gap-1 text-primary hover:bg-primary/10"
              onClick={() => onSelectEvidence(primaryEvidence)}
            >
              <Search className="h-3 w-3" />
              {L.viewInDocument}
            </Button>
          </div>
          <p className="italic font-serif text-[11px] text-foreground/80 pl-2 border-l-2 border-primary/40 line-clamp-2">
            &ldquo;{primaryEvidence.quote}&rdquo;
          </p>
        </div>
      )}

      {/* Reviewer Note / Comment box */}
      {isNotesOpen && (
        <div className="pt-1 space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <MessageSquare className="h-3 w-3 text-primary" /> {L.reviewerNoteLabel}
          </label>
          <Textarea
            value={reviewerNotes}
            onChange={(e) => {
              setReviewerNotes(e.target.value)
              onEdit(finding.id, { reviewerNotes: e.target.value })
            }}
            placeholder={L.reviewerNotePlaceholder}
            className="text-xs min-h-[50px]"
          />
        </div>
      )}

      {/* Triage Action Bar */}
      <div className="flex flex-wrap items-center justify-between pt-2 border-t gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={finding.status === "accepted" ? "default" : "outline"}
            className="h-7 text-xs gap-1"
            onClick={() => onAccept(finding.id)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {L.accept}
          </Button>

          <Button
            size="sm"
            variant={finding.status === "rejected" ? "destructive" : "outline"}
            className="h-7 text-xs gap-1"
            onClick={() => onReject(finding.id)}
          >
            <XCircle className="h-3.5 w-3.5" />
            {L.reject}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit3 className="h-3.5 w-3.5" />
            {L.edit}
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] text-muted-foreground gap-1"
          onClick={() => setIsNotesOpen(!isNotesOpen)}
        >
          <MessageSquare className="h-3 w-3" />
          {isNotesOpen ? L.hideNote : L.addNote}
        </Button>
      </div>
    </div>
  )
}
