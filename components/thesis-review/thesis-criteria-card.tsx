"use client"

/**
 * ThesisCriteriaCard — displays and allows editing of a single criterion section.
 *
 * Shows the AI-generated assessment text for one criterion, its rating,
 * numeric score, and suggestions. Allows manual editing, rating override,
 * and single-criterion AI regeneration with custom instructions.
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
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X,
  Sparkles,
  Loader2,
  MessageSquarePlus,
} from "lucide-react"
import type { ThesisSection, ThesisCriterion, ReviewLanguage, CriterionRating } from "@/lib/ai/thesis-rubric"
import { useScopedThesisReviewStore } from "./thesis-review-provider"
import { CriterionComments } from "./criterion-comments"
import { cn } from "@/lib/utils"
import { RATING_CLASSES } from "@/lib/thesis-review/badge-styles"

interface Props {
  criterion: ThesisCriterion
  section: ThesisSection
  lang: ReviewLanguage
  workspaceId?: string
  reviewId?: string
  onUpdate: (updates: Partial<ThesisSection>) => void
}

const RATING_OPTIONS: CriterionRating[] = ["A", "B", "C", "D", "E", "FX", "pending"]

const SUGGESTIONS_LABELS: Record<ReviewLanguage, string> = {
  sk: "Návrhy na zlepšenie",
  cs: "Návrhy na zlepšení",
  en: "Improvement suggestions",
}

export function ThesisCriteriaCard({
  criterion,
  section,
  lang,
  workspaceId,
  reviewId,
  onUpdate,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(section.text)
  const [showRegenPrompt, setShowRegenPrompt] = useState(false)
  const [userInstruction, setUserInstruction] = useState("")

  const { regenerateCriterion, regeneratingCriterionId } = useScopedThesisReviewStore()
  const isRegenerating = regeneratingCriterionId === criterion.id

  const criterionLabel = criterion.labels[lang]
  const rating = section.rating && section.rating !== "pending" ? section.rating : null

  const handleSaveEdit = () => {
    onUpdate({ text: editText })
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditText(section.text)
    setIsEditing(false)
  }

  const handleRegenerate = async () => {
    if (!workspaceId || !reviewId) return
    const updated = await regenerateCriterion(
      workspaceId,
      reviewId,
      criterion.id,
      userInstruction.trim() || undefined
    )
    if (updated) {
      setEditText(updated.text)
      setShowRegenPrompt(false)
      setUserInstruction("")
    }
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center gap-2 p-3"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {criterion.category}
            </span>
            {criterion.weight > 0 && (
              <span className="text-xs text-muted-foreground">({criterion.weight}%)</span>
            )}
          </div>
          <p className="text-sm font-medium truncate">{criterionLabel}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {rating && (
            <Badge
              variant="outline"
              className={cn("text-xs font-bold tabular-nums", RATING_CLASSES[rating])}
            >
              {rating}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-3">
          {/* Action & Rating bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">
                {lang === "sk" ? "Hodnotenie:" : lang === "cs" ? "Hodnocení:" : "Rating:"}
              </span>
              <Select
                value={section.rating ?? "pending"}
                onValueChange={(v) => onUpdate({ rating: v as CriterionRating })}
              >
                <SelectTrigger className="h-6 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATING_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {r === "pending"
                        ? lang === "sk"
                          ? "Nezadané"
                          : lang === "cs"
                          ? "Nezadáno"
                          : "Not set"
                        : r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {section.numericScore != null && (
                <span className="text-xs text-muted-foreground font-mono">
                  {section.numericScore}/100
                </span>
              )}
            </div>

            {workspaceId && reviewId && (
              <Button
                size="xs"
                variant="outline"
                disabled={isRegenerating}
                onClick={() => setShowRegenPrompt((v) => !v)}
                className="h-6 text-[11px] gap-1 px-2"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    {lang === "sk" ? "Generujem…" : "Regenerating…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 text-primary" />
                    {lang === "sk" ? "AI regenerácia" : "Regenerate AI"}
                  </>
                )}
              </Button>
            )}
          </div>

          {/* AI prompt override box */}
          {showRegenPrompt && (
            <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <MessageSquarePlus className="h-3.5 w-3.5" />
                <span>
                  {lang === "sk"
                    ? "Inštrukcia pre AI prehodnotenie (voliteľné)"
                    : "Custom instruction for AI (optional)"}
                </span>
              </div>
              <Input
                placeholder={
                  lang === "sk"
                    ? "Napr. Zameraj sa viac na praktický prínos v kapitole 4..."
                    : "E.g. Focus more on methodology in chapter 3..."
                }
                value={userInstruction}
                onChange={(e) => setUserInstruction(e.target.value)}
                className="text-xs h-7 bg-background"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    handleRegenerate()
                  }
                }}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  size="xs"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="h-6 text-xs gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  {lang === "sk" ? "Spustiť prehodnotenie" : "Run Regeneration"}
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setShowRegenPrompt(false)}
                  className="h-6 text-xs"
                >
                  {lang === "sk" ? "Zavrieť" : "Cancel"}
                </Button>
              </div>
            </div>
          )}

          {/* Assessment text */}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-[100px] text-xs resize-y"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="xs" onClick={handleSaveEdit} className="gap-1 h-6 text-xs px-2">
                  <Check className="h-3 w-3" />
                  {lang === "sk" ? "Uložiť" : lang === "cs" ? "Uložit" : "Save"}
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  className="gap-1 h-6 text-xs px-2"
                >
                  <X className="h-3 w-3" />
                  {lang === "sk" ? "Zrušiť" : lang === "cs" ? "Zrušit" : "Cancel"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {section.text || (
                  <span className="text-muted-foreground italic">
                    {lang === "sk" ? "Žiadny text" : lang === "cs" ? "Žádný text" : "No text generated"}
                  </span>
                )}
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-0 top-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  setEditText(section.text)
                  setIsEditing(true)
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* AI suggestions */}
          {section.suggestions && section.suggestions.length > 0 && (
            <div className="rounded-md bg-muted/50 p-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{SUGGESTIONS_LABELS[lang]}:</p>
              <ul className="space-y-0.5">
                {section.suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-info shrink-0">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Threaded multi-role comments */}
          <CriterionComments criterionId={criterion.id} />
        </div>
      )}
    </div>
  )
}
