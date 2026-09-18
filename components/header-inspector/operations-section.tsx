"use client"

import { useState } from "react"
import { Sparkles, Download, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { generateFullTemplate } from "@/lib/latex"
import type { OutputType } from "@/lib/output-types"
import {
  ITEM_UNITS,
  ITEM_COUNT_DEFAULTS,
  ScaffoldIllustration,
  FillEmptyIllustration,
  AiReviewIllustration,
  ExportIllustration,
  RagSourcesIllustration,
  SKIP_PATTERNS,
} from "./shared"

interface OperationsSectionProps {
  project: any
  activeOutput: any
  activeOutputType: OutputType
  outputTypeLabel: string
  generatingIds: string[]
  updateActiveOutput: (patch: any) => void
  autoFillAllCardsAction: () => Promise<void>
  generateNewOutputStructure: (type: OutputType, count: number) => Promise<void>
  aiReview: () => Promise<void>
}

export function OperationsSection({
  project,
  activeOutput,
  activeOutputType,
  outputTypeLabel,
  generatingIds,
  updateActiveOutput,
  autoFillAllCardsAction,
  generateNewOutputStructure,
  aiReview,
}: OperationsSectionProps) {
  const [itemCount, setItemCount] = useState<number>(ITEM_COUNT_DEFAULTS[activeOutputType])
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const unit = ITEM_UNITS[activeOutputType]

  const isBulkRunning =
    generatingIds.includes("all") || generatingIds.includes("scaffold")

  const emptyCardsCount = (activeOutput?.cards || []).filter(
    (c: any) => !SKIP_PATTERNS.has(c.pattern) && (!c.content || c.content.trim() === "")
  ).length

  function exportTex() {
    const targetOutput = activeOutput || project.outputs?.[0]
    if (!targetOutput) return
    const tex = generateFullTemplate(project, targetOutput, project.id)
    const blob = new Blob([tex], { type: "text/x-tex" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${project.id}_${targetOutput.outputType}.tex`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleGenerateNew() {
    setConfirmGenerate(true)
  }

  return (
    <>
      <div className="space-y-3">
        {/* Operation 1: Generate New Document */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground">
              Generate New {outputTypeLabel}
            </Label>
            <span className="text-[11px] font-medium tracking-wide text-warning dark:text-warning font-mono">
              (Replaces all {unit.plural})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-9 shrink-0">
              <ScaffoldIllustration outputType={activeOutputType} />
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Replaces existing {unit.plural} with a fresh {outputTypeLabel.toLowerCase()} structure and fills it with content from your sources.
            </p>
          </div>

          <div className="pt-0.5 space-y-1.5">
            {activeOutputType === "paper" && (
              <p className="text-xs text-muted-foreground italic leading-snug">
                Sections include Abstract + numbered body sections + References.
              </p>
            )}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {activeOutputType === "paper" ? "Sections:" : activeOutputType === "slides" ? "Slides:" : "Cards:"}
                </span>
                <Input
                  aria-label={`${activeOutputType === "paper" ? "Sections" : activeOutputType === "slides" ? "Slides" : "Cards"} count`}
                  type="number"
                  min={3}
                  max={activeOutputType === "slides" ? 25 : activeOutputType === "poster" ? 15 : 12}
                  value={itemCount}
                  onChange={(e) => {
                    const maxVal = activeOutputType === "slides" ? 25 : activeOutputType === "poster" ? 15 : 12
                    setItemCount(
                      Math.max(3, Math.min(maxVal, parseInt(e.target.value) || 3))
                    )
                  }}
                  className="h-7 w-12 text-center text-xs bg-background px-1 font-mono"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 flex-1 justify-center gap-1.5 text-xs"
                onClick={handleGenerateNew}
                disabled={isBulkRunning}
              >
                <Sparkles className="size-3.5 text-warning dark:text-warning" />
                Generate New {outputTypeLabel}
              </Button>
            </div>
          </div>
        </div>

        {/* Operation 2: Generate contents for empty items */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground">
              Generate Contents for Empty Items
            </Label>
            {emptyCardsCount > 0 && (
              <span className="text-[11px] font-medium tracking-wide text-info dark:text-info font-mono">
                ({emptyCardsCount} empty)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-9 shrink-0">
              <FillEmptyIllustration />
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Fills empty {unit.plural} on canvas with content based on your structure and sources.
            </p>
          </div>

          <div className="pt-0.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center gap-1.5 text-xs h-7"
              onClick={() => autoFillAllCardsAction()}
              disabled={isBulkRunning}
            >
              <Sparkles className="size-3.5 text-info dark:text-info" />
              Generate contents for empty {unit.plural}
            </Button>
          </div>
        </div>

        {/* Operation 3: Run AI Review */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground">
              AI Quality Review
            </Label>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-9 shrink-0">
              <AiReviewIllustration />
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Reviews layout balance, overflows, missing citations, and posts actionable suggestions to the AI Assistant.
            </p>
          </div>

          <div className="pt-0.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center gap-1.5 text-xs h-7"
              onClick={() => aiReview()}
            >
              <Sparkles className="size-3.5 text-primary" />
              Run AI Review
            </Button>
          </div>
        </div>

        {/* Operation: Data Sources for Autofill */}
        {(project.ingestFiles || []).length > 0 && (
          <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Data Sources for Autofill
              </Label>
              {activeOutput?.sourceIds && activeOutput.sourceIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => updateActiveOutput({ sourceIds: [] })}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
                >
                  <RotateCcw className="size-3" /> Use all files
                </button>
              ) : (
                <span className="text-[11px] font-medium font-mono text-muted-foreground">
                  (All files active)
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-9 shrink-0">
                <RagSourcesIllustration />
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Restrict the Gemini RAG context to these specific files. All {unit.plural} inherit this setting.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/50">
              {(project.ingestFiles || []).map((file: any) => {
                const outputSources = activeOutput?.sourceIds || []
                const isSelected = outputSources.length === 0 || outputSources.includes(file.id)

                return (
                  <div key={file.id} className="flex items-center justify-between gap-2 py-0.5">
                    <span className="truncate text-xs text-foreground font-medium" title={file.name}>
                      {file.name}
                    </span>
                    <Switch
                      size="sm"
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        let next: string[]
                        if (outputSources.length === 0) {
                          next = checked
                            ? []
                            : (project.ingestFiles || []).filter((f: any) => f.id !== file.id).map((f: any) => f.id)
                        } else {
                          next = checked
                            ? [...outputSources, file.id]
                            : outputSources.filter((id: string) => id !== file.id)
                        }
                        if (next.length === (project.ingestFiles || []).length) {
                          next = []
                        }
                        updateActiveOutput({ sourceIds: next })
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Operation 4: Export Document */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground">
              Export Document
            </Label>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-9 shrink-0">
              <ExportIllustration />
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Downloads the complete standalone LaTeX source file ready for compilation.
            </p>
          </div>

          <div className="pt-0.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center gap-1.5 text-xs h-7"
              onClick={exportTex}
            >
              <Download className="size-3.5 text-primary" />
              Export LaTeX ({activeOutputType}.tex)
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Generate New {activeOutputType}?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This will replace existing {unit.plural} with a fresh structure tailored to your RAG sources, and fill it with grounded content.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-4 -mb-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmGenerate(false)}>Cancel</Button>
            <Button size="sm" onClick={async () => {
              setConfirmGenerate(false)
              await generateNewOutputStructure(activeOutputType, itemCount)
            }}>
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
