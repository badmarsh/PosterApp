"use client"

/**
 * FindingCard — Interactive review finding with evidence linking,
 * severity triage (Major vs. Minor), and reviewer annotation.
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
} from "lucide-react"
import type { ReviewFinding, ReviewSeverity, FindingStatus, EvidenceReference } from "@/lib/ai/review-types"
import type { ReviewLanguage } from "@/lib/ai/thesis-rubric"

interface Props {
  finding: ReviewFinding
  lang: ReviewLanguage
  onSelectEvidence: (ev: EvidenceReference) => void
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onEdit: (id: string, updates: Partial<ReviewFinding>) => void
  onToggleExport: (id: string) => void
}

const SEVERITY_COLORS: Record<ReviewSeverity, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  major: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  minor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  suggestion: "bg-muted text-muted-foreground border-muted-foreground/30",
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

  return (
    <div
      className={`rounded-lg border bg-card p-4 transition-all duration-200 space-y-3 ${
        finding.status === "rejected" ? "opacity-60 bg-muted/20" : "shadow-sm hover:border-primary/40"
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
              className={`h-6 text-[11px] font-bold px-2 py-0 border rounded ${SEVERITY_COLORS[finding.severity]}`}
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
              finding.status === "accepted" ? "text-green-600 bg-green-50 dark:bg-green-950/40" : ""
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
            {finding.includeInExport ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 opacity-50" />}
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
            <Button size="sm" onClick={handleSaveEdit} className="h-7 text-xs">
              Uložiť zmeny
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground tracking-tight leading-snug">
            {finding.title}
          </h4>
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
              {primaryEvidence.verified !== false ? (
                <Badge variant="outline" className="text-[9px] py-0 px-1 text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/30">
                  Overený ✓
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] py-0 px-1 text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30">
                  Neoverený ⚠️
                </Badge>
              )}
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
