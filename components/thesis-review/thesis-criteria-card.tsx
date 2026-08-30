"use client"

/**
 * ThesisCriteriaCard — displays and allows editing of a single criterion section.
 *
 * Shows the AI-generated assessment text for one criterion, its rating,
 * numeric score, and suggestions. Allows manual editing and rating override.
 */

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react"
import type { ThesisSection, ThesisCriterion, ReviewLanguage, CriterionRating } from "@/lib/ai/thesis-rubric"
import { cn } from "@/lib/utils"

interface Props {
  criterion: ThesisCriterion
  section: ThesisSection
  lang: ReviewLanguage
  onUpdate: (updates: Partial<ThesisSection>) => void
}

const RATING_OPTIONS: CriterionRating[] = ["A", "B", "C", "D", "E", "FX", "pending"]

const RATING_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-200",
  B: "bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-900/30 dark:text-lime-200",
  C: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200",
  D: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200",
  E: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200",
  FX: "bg-red-200 text-red-900 border-red-400 dark:bg-red-900/50 dark:text-red-100",
  pending: "bg-muted text-muted-foreground border-border",
}

const SUGGESTIONS_LABELS: Record<ReviewLanguage, string> = {
  sk: "Návrhy na zlepšenie",
  cs: "Návrhy na zlepšení",
  en: "Improvement suggestions",
}

export function ThesisCriteriaCard({ criterion, section, lang, onUpdate }: Props) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(section.text)

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
              className={cn("text-xs font-bold tabular-nums", RATING_COLORS[rating])}
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
          {/* Rating selector */}
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
                    {r === "pending" ? (lang === "sk" ? "Nezadané" : lang === "cs" ? "Nezadáno" : "Not set") : r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {section.numericScore != null && (
              <span className="text-xs text-muted-foreground ml-auto">
                {section.numericScore}/100
              </span>
            )}
          </div>

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
                <Button size="xs" variant="ghost" onClick={handleCancelEdit} className="gap-1 h-6 text-xs px-2">
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
                onClick={() => { setEditText(section.text); setIsEditing(true) }}
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
                    <span className="text-blue-500 shrink-0">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
