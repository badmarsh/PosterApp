"use client"

/**
 * DefenseQuestionsPanel — manages defense questions (otázky k obhajobe).
 *
 * Displays AI-generated questions, lets the reviewer add new ones,
 * edit text, delete questions, and reorder them.
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, HelpCircle, Pencil, Check, X } from "lucide-react"
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
    subtitle: "Otázky navrhnuté na overenie porozumenia kľúčovým témam práce",
    empty: "Zatiaľ neboli vygenerované žiadne otázky k obhajobe.",
    addBtn: "Pridať otázku",
    placeholder: "Zadajte novú otázku k obhajobe...",
  },
  cs: {
    title: "Otázky k obhajobě",
    subtitle: "Otázky navržené k ověření porozumění klíčovým tématům práce",
    empty: "Zatím nebyly vygenerovány žádné otázky k obhajobě.",
    addBtn: "Přidat otázku",
    placeholder: "Zadejte novou otázku k obhajobě...",
  },
  en: {
    title: "Defense Questions",
    subtitle: "Questions formulated to test the candidate's understanding",
    empty: "No defense questions generated yet.",
    addBtn: "Add Question",
    placeholder: "Enter a new defense question...",
  },
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
        {questions.map((q, idx) => (
          <div
            key={idx}
            className="group flex items-start gap-2 rounded-md border bg-muted/30 p-2.5 text-xs"
          >
            <span className="font-semibold text-primary shrink-0 mt-0.5">{idx + 1}.</span>

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
                    Uložiť
                  </Button>
                  <Button size="xs" variant="ghost" onClick={handleCancelEdit} className="h-6 text-xs gap-1">
                    <X className="h-3 w-3" />
                    Zrušiť
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-start justify-between gap-2">
                <p className="text-foreground leading-relaxed">{q}</p>
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
            )}
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="space-y-2 rounded-md border border-dashed p-2.5 bg-muted/20">
          <Input
            placeholder={t.placeholder}
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            className="text-xs h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddQuestion()
              if (e.key === "Escape") setIsAdding(false)
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="xs" onClick={handleAddQuestion} disabled={!newQuestionText.trim()} className="h-6 text-xs gap-1">
              <Check className="h-3 w-3" />
              Pridať
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setIsAdding(false)} className="h-6 text-xs gap-1">
              <X className="h-3 w-3" />
              Zrušiť
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
