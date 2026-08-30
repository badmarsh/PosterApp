"use client"

/**
 * RubricTemplateModal — Interactive Faculty Rubric & Weight Customizer.
 *
 * Allows reviewers to:
 *  - Select faculty-specific weighted rubric presets
 *  - Adjust individual criteria weights with real-time feedback
 *  - Validate that weights sum to exactly 100%
 *  - Normalize weights with 1 click if they diverge
 */

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  FACULTY_RUBRIC_TEMPLATES,
  validateRubricWeights,
  normalizeRubricWeights,
  type FacultyRubricTemplate,
} from "@/lib/ai/rubric-templates"
import { type ThesisCriterion, type ReviewLanguage } from "@/lib/ai/thesis-rubric"
import { SlidersHorizontal, CheckCircle2, AlertTriangle, RefreshCw, GraduationCap, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTemplateId?: string
  currentCriteria?: ThesisCriterion[]
  language?: ReviewLanguage
  onApplyCriteria: (templateId: string, criteria: ThesisCriterion[]) => void
}

export function RubricTemplateModal({
  open,
  onOpenChange,
  currentTemplateId = "uk_prirodovedecka_stem",
  currentCriteria,
  language = "sk",
  onApplyCriteria,
}: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(currentTemplateId)
  const [workingCriteria, setWorkingCriteria] = useState<ThesisCriterion[]>([])

  // Initialize working criteria whenever dialog opens or template changes
  useEffect(() => {
    if (open) {
      if (currentCriteria && currentCriteria.length > 0) {
        setWorkingCriteria(currentCriteria.map((c) => ({ ...c })))
      } else {
        const found = FACULTY_RUBRIC_TEMPLATES.find((t) => t.id === selectedTemplateId) || FACULTY_RUBRIC_TEMPLATES[0]
        setWorkingCriteria(found.criteria.map((c) => ({ ...c })))
      }
    }
  }, [open, selectedTemplateId, currentCriteria])

  const handleSelectTemplate = (template: FacultyRubricTemplate) => {
    setSelectedTemplateId(template.id)
    setWorkingCriteria(template.criteria.map((c) => ({ ...c })))
  }

  const handleWeightChange = (criterionId: string, newWeight: number) => {
    const clamped = Math.max(0, Math.min(100, isNaN(newWeight) ? 0 : newWeight))
    setWorkingCriteria((prev) =>
      prev.map((c) => (c.id === criterionId ? { ...c, weight: clamped } : c))
    )
  }

  const handleNormalize = () => {
    setWorkingCriteria((prev) => normalizeRubricWeights(prev))
  }

  const handleResetToDefault = () => {
    const found = FACULTY_RUBRIC_TEMPLATES.find((t) => t.id === selectedTemplateId) || FACULTY_RUBRIC_TEMPLATES[0]
    setWorkingCriteria(found.criteria.map((c) => ({ ...c, weight: c.defaultWeight })))
  }

  const validation = validateRubricWeights(workingCriteria)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="border-primary/40 text-primary">
              <SlidersHorizontal className="size-3 mr-1" />
              Šablóny a váhy hodnotenia
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            Fakultná knižnica rubrík & Váhy kritérií
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Vyberte akreditovanú šablónu fakulty alebo upravte percentuálne váhy jednotlivých kritérií (súčet musí byť 100%).
          </DialogDescription>
        </DialogHeader>

        {/* Template Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-3">
          {FACULTY_RUBRIC_TEMPLATES.map((tmpl) => {
            const isSelected = tmpl.id === selectedTemplateId
            return (
              <div
                key={tmpl.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectTemplate(tmpl)}
                className={cn(
                  "p-3.5 rounded-lg border text-left transition-all cursor-pointer relative",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                    : "border-border hover:border-muted-foreground/30 bg-card hover:bg-accent/40"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm leading-tight text-foreground">
                    {tmpl.name[language] || tmpl.name.sk}
                  </h4>
                  {isSelected && (
                    <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {tmpl.description[language] || tmpl.description.sk}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-mono">
                    {tmpl.discipline}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {tmpl.criteria.length} kritérií
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Dynamic Weight Editor */}
        <div className="space-y-4 pt-2 border-t">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              Detailné nastavenie váh kritérií
            </h4>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleNormalize}
                disabled={validation.isValid}
              >
                <RefreshCw className="size-3" />
                Normalizovať na 100%
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleResetToDefault}
              >
                Resetovať
              </Button>
            </div>
          </div>

          {/* Real-time Weight Total Bar */}
          <div className="bg-muted/40 p-3 rounded-lg border">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-foreground">Celkový súčet váh:</span>
              <span
                className={cn(
                  "font-bold font-mono px-2 py-0.5 rounded",
                  validation.isValid
                    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                    : "text-amber-700 dark:text-amber-300 bg-amber-500/10"
                )}
              >
                {validation.totalWeight}% / 100%
              </span>
            </div>
            <Progress
              value={Math.min(100, validation.totalWeight)}
              className={cn(
                "h-2",
                validation.isValid ? "[&>div]:bg-emerald-500" : "[&>div]:bg-amber-500"
              )}
            />
            {!validation.isValid && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="size-3 shrink-0" />
                {validation.message}
              </p>
            )}
          </div>

          {/* Criteria Sliders & Number Inputs */}
          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
            {workingCriteria.map((criterion) => {
              const label = criterion.labels[language] || criterion.labels.sk
              return (
                <div
                  key={criterion.id}
                  className="flex items-center justify-between gap-4 p-2 rounded-md hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs font-medium truncate block">
                      {label}
                    </Label>
                    <span className="text-[10px] text-muted-foreground uppercase font-mono">
                      {criterion.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-36">
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={5}
                      value={criterion.weight}
                      onChange={(e) => handleWeightChange(criterion.id, parseInt(e.target.value, 10))}
                      className="w-20 accent-primary cursor-pointer"
                    />
                    <div className="relative w-14">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={criterion.weight}
                        onChange={(e) => handleWeightChange(criterion.id, parseInt(e.target.value, 10))}
                        className="h-7 text-xs text-right pr-4 font-mono font-semibold"
                      />
                      <span className="absolute right-1.5 top-1.5 text-[10px] text-muted-foreground pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zrušiť
          </Button>
          <Button
            onClick={() => {
              onApplyCriteria(selectedTemplateId, workingCriteria)
              onOpenChange(false)
            }}
            disabled={!validation.isValid}
            className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <CheckCircle2 className="size-4" />
            Použiť šablónu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
