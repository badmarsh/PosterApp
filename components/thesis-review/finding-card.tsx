"use client"

/**
 * FindingCard — Interactive review finding with evidence linking,
 * severity triage (Major vs. Minor), audience routing, and reviewer annotation.
 */

import { useState } from "react"
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
  FindingAudience,
} from "@/lib/ai/review-types"
import type { ReviewLanguage } from "@/lib/ai/thesis-rubric"

interface Props {
  finding: ReviewFinding
  lang: ReviewLanguage
  isSelected?: boolean
  onSelectEvidence: (ev: EvidenceReference) => void
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onEdit: (id: string, updates: Partial<ReviewFinding>) => void
  onToggleExport: (id: string) => void
}

const SEVERITY_CLASSES: Record<ReviewSeverity, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  major: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  minor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  suggestion: "bg-muted text-muted-foreground border-muted-foreground/30",
  info: "bg-muted/60 text-muted-foreground border-muted-foreground/20",
}

const STATUS_ICONS: Record<FindingStatus, any> = {
  unreviewed: AlertTriangle,
  accepted: CheckCircle2,
  edited: Edit3,
  rejected: XCircle,
  resolved: CheckCircle2,
}

export function FindingCard({
  finding,
  lang,
  isSelected = false,
  onSelectEvidence,
  onAccept,
  onReject,
  onEdit,
  onToggleExport,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(finding.title)
  const [explanation, setExplanation] = useState(finding.explanation)
  const [recommendation, setRecommendation] = useState(finding.recommendation)
  const [reviewerNotes, setReviewerNotes] = useState(finding.reviewerNotes || "")
  const [isNotesOpen, setIsNotesOpen] = useState(Boolean(finding.reviewerNotes))

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
    const st = ev.state || (ev.verified ? "verified-exact" : "unverified")

    if (st === "verified-exact" || st === "verified") {
      return (
        <Badge
          variant="outline"
          className="text-[9px] py-0 px-1 text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/30 gap-0.5"
        >
          <CheckCircle2 className="h-2.5 w-2.5" /> Presný citát ✓
        </Badge>
      )
    }
    if (st === "verified-normalized") {
      return (
        <Badge
          variant="outline"
          className="text-[9px] py-0 px-1 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30 gap-0.5"
        >
          <CheckCircle2 className="h-2.5 w-2.5" /> Normalizovaný ✓
        </Badge>
      )
    }
    if (st === "approximate") {
      return (
        <Badge
          variant="outline"
          className="text-[9px] py-0 px-1 text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30 gap-0.5"
        >
          <HelpCircle className="h-2.5 w-2.5" /> Približná zhoda ~
        </Badge>
      )
    }
    if (st === "ambiguous") {
      return (
        <Badge
          variant="outline"
          className="text-[9px] py-0 px-1 text-purple-700 dark:text-purple-400 bg-purple-500/10 border-purple-500/30 gap-0.5"
        >
          <HelpCircle className="h-2.5 w-2.5" /> Viacero výskytov ⧉
        </Badge>
      )
    }
    if (st === "stale") {
      return (
        <Badge
          variant="outline"
          className="text-[9px] py-0 px-1 text-destructive bg-destructive/10 border-destructive/30 gap-0.5"
        >
          <AlertCircle className="h-2.5 w-2.5" /> Zmenená verzia ⚠
        </Badge>
      )
    }
    return (
      <Badge
        variant="outline"
        className="text-[9px] py-0 px-1 text-muted-foreground bg-muted border-border gap-0.5"
      >
        <AlertCircle className="h-2.5 w-2.5" /> Neoverený
      </Badge>
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
        <div className="flex items-center gap-2">
          {/* Severity selector */}
          <Select
            value={finding.severity}
            onValueChange={(val) => onEdit(finding.id, { severity: val as ReviewSeverity })}
          >
            <SelectTrigger
              className={`h-6 text-[11px] font-bold px-2 py-0 border rounded ${SEVERITY_CLASSES[finding.severity]}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical" className="text-xs font-bold text-destructive">
                Kritická chyba (Critical)
              </SelectItem>
              <SelectItem value="major" className="text-xs font-bold text-orange-600">
                Zásadná pripomienka (Major)
              </SelectItem>
              <SelectItem value="minor" className="text-xs font-bold text-blue-600">
                Drobná pripomienka (Minor)
              </SelectItem>
              <SelectItem value="suggestion" className="text-xs text-muted-foreground">
                Návrh / Odporúčanie (Suggestion)
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Category tag */}
          <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
            {finding.category}
          </Badge>

          {/* Epistemic Status badge */}
          {finding.epistemicStatus && (
            <Badge
              variant="outline"
              className={`text-[9px] font-medium py-0 px-1.5 ${
                finding.epistemicStatus === "SUPPORTED_FACT"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : finding.epistemicStatus === "SUPPORTED_INTERPRETATION"
                  ? "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30"
                  : finding.epistemicStatus === "MISSING_EVIDENCE"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  : finding.epistemicStatus === "REQUIRES_HUMAN_VERIFICATION"
                  ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                  : finding.epistemicStatus === "POSSIBLE_RISK"
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                  : "bg-muted text-muted-foreground border-border"
              }`}
              title={
                finding.epistemicStatus === "SUPPORTED_FACT"
                  ? "Doložený fakt: overený priamy citát z rukopisu"
                  : finding.epistemicStatus === "SUPPORTED_INTERPRETATION"
                  ? "Interpretácia doložená textom práce"
                  : finding.epistemicStatus === "MISSING_EVIDENCE"
                  ? "Chýbajúci podklad: v dostupnom texte nebolo možné overiť"
                  : finding.epistemicStatus === "REQUIRES_HUMAN_VERIFICATION"
                  ? "Vyžaduje overenie recenzentom v origináli"
                  : "Hodnotenie recenzenta"
              }
            >
              {finding.epistemicStatus === "SUPPORTED_FACT"
                ? "Doložený fakt ✓"
                : finding.epistemicStatus === "SUPPORTED_INTERPRETATION"
                ? "Interpretácia"
                : finding.epistemicStatus === "MISSING_EVIDENCE"
                ? "Chýbajúci podklad"
                : finding.epistemicStatus === "REQUIRES_HUMAN_VERIFICATION"
                ? "Nutné overiť ⚠"
                : finding.epistemicStatus === "POSSIBLE_RISK"
                ? "Možné riziko"
                : "Úsudok"}
            </Badge>
          )}

          {/* Audience selector */}
          <Select
            value={finding.audience || "author"}
            onValueChange={(val) => onEdit(finding.id, { audience: val as FindingAudience })}
          >
            <SelectTrigger className="h-6 text-[10px] px-1.5 py-0 border rounded w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="author" className="text-xs">Pre autora</SelectItem>
              <SelectItem value="editor" className="text-xs font-bold text-amber-600">Dôverné (Editor)</SelectItem>
              <SelectItem value="committee" className="text-xs font-bold text-blue-600">Pre komisiu</SelectItem>
            </SelectContent>
          </Select>

          {/* AI vs Reviewer origin badge */}
          {finding.createdBy === "ai" ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
              <Sparkles className="h-3 w-3 text-primary/70" /> AI
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-primary font-mono font-bold">
              <User className="h-3 w-3" /> Recenzent
            </span>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className={`text-[10px] font-semibold gap-1 ${
              finding.status === "accepted"
                ? "text-green-600 bg-green-50 dark:bg-green-950/40"
                : finding.status === "rejected"
                ? "text-destructive bg-destructive/10"
                : ""
            }`}
          >
            <StatusIcon className="h-3 w-3" />
            {finding.status === "unreviewed" && "Nepreskúmané"}
            {finding.status === "accepted" && "Prijaté"}
            {finding.status === "edited" && "Upravené"}
            {finding.status === "rejected" && "Odmietnuté"}
            {finding.status === "resolved" && "Vyriešené"}
          </Badge>

          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground"
            title={finding.includeInExport ? "Zahrnuté v exporte" : "Vylúčené z exportu"}
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
            placeholder="Názov zistenia"
            className="text-xs font-bold"
          />
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Podrobné vysvetlenie problému"
            className="text-xs min-h-[60px]"
          />
          <Textarea
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            placeholder="Odporúčaná náprava pre autora"
            className="text-xs min-h-[50px]"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="h-7 text-xs">
              Zrušiť
            </Button>
            <Button size="sm" onClick={handleSaveEdit} className="h-7 text-xs font-semibold">
              Uložiť zmeny
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground tracking-tight leading-snug">
              {finding.title}
            </h4>
            {finding.audience === "editor" && (
              <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300 gap-1 shrink-0">
                <Lock className="h-2.5 w-2.5" /> Dôverné
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {finding.explanation}
          </p>

          {finding.recommendation && (
            <div className="rounded bg-muted/40 p-2 text-xs border-l-2 border-primary/50 text-foreground/90">
              <span className="font-semibold text-[11px] block text-primary">Odporúčaná náprava:</span>
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
              <Quote className="h-3 w-3 text-primary" /> Dôkaz v texte:
              {renderEvidenceState(primaryEvidence)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-2 text-[10px] font-semibold gap-1 text-primary hover:bg-primary/10"
              onClick={() => onSelectEvidence(primaryEvidence)}
            >
              <Search className="h-3 w-3" />
              Zobraziť v dokumente
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
            <MessageSquare className="h-3 w-3 text-primary" /> Vlastná poznámka recenzenta:
          </label>
          <Textarea
            value={reviewerNotes}
            onChange={(e) => {
              setReviewerNotes(e.target.value)
              onEdit(finding.id, { reviewerNotes: e.target.value })
            }}
            placeholder="Doplňte vlastné odborné stanovisko k tomuto bodu..."
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
            Prijať
          </Button>

          <Button
            size="sm"
            variant={finding.status === "rejected" ? "destructive" : "outline"}
            className="h-7 text-xs gap-1"
            onClick={() => onReject(finding.id)}
          >
            <XCircle className="h-3.5 w-3.5" />
            Odmietnuť
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Upraviť
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] text-muted-foreground gap-1"
          onClick={() => setIsNotesOpen(!isNotesOpen)}
        >
          <MessageSquare className="h-3 w-3" />
          {isNotesOpen ? "Skryť poznámku" : "+ Poznámka recenzenta"}
        </Button>
      </div>
    </div>
  )
}
