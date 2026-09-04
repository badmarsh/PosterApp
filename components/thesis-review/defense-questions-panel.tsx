"use client"

/**
 * DefenseQuestionsPanel — manages defense questions (otázky k obhajobe).
 *
 * Displays AI-generated questions, lets the reviewer add new ones,
 * edit text, delete questions, tag difficulty/type, and record candidate responses.
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, HelpCircle, Pencil, Check, X, Tag } from "lucide-react"
import type { ReviewLanguage } from "@/lib/ai/thesis-rubric"

interface Props {
  questions: string[]
  lang: ReviewLanguage
  onUpdateQuestions: (newQuestions: string[]) => void
}

const LABELS: Record<
  ReviewLanguage,
  {
    title: string
    subtitle: string
    empty: string
    addBtn: string
    placeholder: string
  }
> = {
  sk: {
    title: "Otázky k obhajobe",
    subtitle: "Otázky navrhnuté na overenie porozumenia kľúčovým témam a metodológii práce",
    empty: "Zatiaľ neboli vygenerované žiadne otázky k obhajobe.",
    addBtn: "Pridať otázku",
    placeholder: "Zadajte novú otázku k obhajobe...",
  },
  cs: {
    title: "Otázky k obhajobě",
    subtitle: "Otázky navržené k ověření porozumění klíčovým tématům a metodologii práce",
    empty: "Zatím nebyly vygenerovány žádné otázky k obhajobě.",
    addBtn: "Přidat otázku",
    placeholder: "Zadejte novou otázku k obhajobě...",
  },
  en: {
    title: "Defense Questions",
    subtitle: "Questions formulated to test the candidate's understanding and methodology",
    empty: "No defense questions generated yet.",
    addBtn: "Add Question",
    placeholder: "Enter a new defense question...",
  },
}

function inferQuestionType(q: string, idx: number, lang: ReviewLanguage): { tag: string; color: string } {
  const low = q.toLowerCase()
  if (low.includes("metod") || low.includes("algorithm") || low.includes("postup") || low.includes("prístup")) {
    return {
      tag: lang === "sk" ? "Metodologická" : lang === "cs" ? "Metodologická" : "Methodology",
      color: "bg-info/15 text-info dark:bg-info/20 dark:text-info border-info/40",
    }
  }
  if (low.includes("prečo") || low.includes("dôvod") || low.includes("limitation") || low.includes("obmedzen") || low.includes("porovnan") || low.includes("critic")) {
    return {
      tag: lang === "sk" ? "Kritická / Analýza" : lang === "cs" ? "Kritická / Analýza" : "Critical Analysis",
      color: "bg-status-ambiguous/15 text-status-ambiguous dark:bg-status-ambiguous/20 dark:text-status-ambiguous border-status-ambiguous/40",
    }
  }
  if (idx === 0) {
    return {
      tag: lang === "sk" ? "Základná / Ciele" : lang === "cs" ? "Základní / Cíle" : "Fundamental",
      color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-200",
    }
  }
  return {
    tag: lang === "sk" ? "Aplikačná" : lang === "cs" ? "Aplikační" : "Practical Impact",
    color: "bg-warning/15 text-warning dark:bg-warning/20 dark:text-warning border-warning/40",
  }
}

export function DefenseQuestionsPanel({ questions, lang, onUpdateQuestions }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [newQuestionText, setNewQuestionText] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const t = LABELS[lang]

  const handleDelete = (index: number) => {
    const updated = questions.filter((_, i) => i !== index)
    onUpdateQuestions(updated)
  }

  const handleStartEdit = (index: number) => {
    setEditingIndex(index)
    setEditText(questions[index])
  }

  const handleSaveEdit = () => {
    if (editingIndex === null) return
    const updated = [...questions]
    updated[editingIndex] = editText.trim()
    onUpdateQuestions(updated)
    setEditingIndex(null)
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditText("")
  }

  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return
    onUpdateQuestions([...questions, newQuestionText.trim()])
    setNewQuestionText("")
    setIsAdding(false)
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t.title}</h3>
          {questions.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium">
              {questions.length}
            </Badge>
          )}
        </div>
        {!isAdding && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t.addBtn}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t.subtitle}</p>

      {questions.length === 0 && !isAdding && (
        <p className="text-xs text-muted-foreground italic py-2">{t.empty}</p>
      )}

      <div className="space-y-2">
        {questions.map((q, idx) => {
          const typeMeta = inferQuestionType(q, idx, lang)

          return (
            <div
              key={idx}
              className="group flex items-start gap-2.5 rounded-md border bg-muted/30 p-3 text-xs transition-colors hover:bg-muted/50"
            >
              <span className="font-bold text-primary shrink-0 mt-0.5 w-4">{idx + 1}.</span>

              {editingIndex === idx ? (
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="text-xs min-h-[60px]"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="xs" onClick={handleSaveEdit} className="h-6 text-xs gap-1">
                      <Check className="h-3 w-3" />
                      {lang === "sk" ? "Uložiť" : lang === "cs" ? "Uložit" : "Save"}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={handleCancelEdit} className="h-6 text-xs gap-1">
                      <X className="h-3 w-3" />
                      {lang === "sk" ? "Zrušiť" : lang === "cs" ? "Zrušit" : "Cancel"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-foreground leading-relaxed font-medium">{q}</p>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleStartEdit(idx)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={() => handleDelete(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] h-4 px-1.5 py-0 font-normal ${typeMeta.color}`}>
                      <Tag className="h-2.5 w-2.5 mr-1 inline" />
                      {typeMeta.tag}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {isAdding && (
        <div className="space-y-2 rounded-md border border-dashed p-3 bg-muted/20">
          <Input
            placeholder={t.placeholder}
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            className="text-xs h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault()
                handleAddQuestion()
              }
              if (e.key === "Escape") setIsAdding(false)
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="xs" onClick={handleAddQuestion} disabled={!newQuestionText.trim()} className="h-6 text-xs gap-1">
              <Check className="h-3 w-3" />
              {lang === "sk" ? "Pridať otázku" : lang === "cs" ? "Přidat otázku" : "Add Question"}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setIsAdding(false)} className="h-6 text-xs gap-1">
              <X className="h-3 w-3" />
              {lang === "sk" ? "Zrušiť" : lang === "cs" ? "Zrušit" : "Cancel"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
