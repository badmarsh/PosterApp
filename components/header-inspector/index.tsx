"use client"

import {
  Lock,
  LayoutTemplate,
  Info,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { OUTPUT_TYPE_LABELS, getTemplateDef, getTemplatesForType } from "@/lib/output-types"
import { resolveOutputMetadata } from "@/lib/poster-types"
import type { OutputType } from "@/lib/output-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { OperationsSection } from "./operations-section"
import { TitleFields } from "./title-fields"
import { AuthorsManager } from "./authors-manager"
import { VenueStyling } from "./venue-styling"
import { TemplateBranding } from "./template-branding"

export function HeaderInspector() {
  const {
    project,
    updateActiveOutput,
    updateActiveThemeColor,
    autoFillAllCardsAction,
    generateNewOutputStructure,
    aiReview,
    pushEvent,
    setHeaderUnlocked,
    generatingIds,
  } = useEditor(
    useShallow((s) => ({
      project: s.project,
      updateActiveOutput: s.updateActiveOutput,
      updateActiveThemeColor: s.updateActiveThemeColor,
      autoFillAllCardsAction: s.autoFillAllCardsAction,
      generateNewOutputStructure: s.generateNewOutputStructure,
      aiReview: s.aiReview,
      pushEvent: s.pushEvent,
      setHeaderUnlocked: s.setHeaderUnlocked,
      generatingIds: s.generatingIds,
    }))
  )

  const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)
  const activeOutputType = (activeOutput?.outputType ?? "poster") as OutputType
  const templateDef = getTemplateDef(activeOutput?.templateId ?? "atlas")
  const outputTypeLabel = OUTPUT_TYPE_LABELS[activeOutputType]

  const metadata = resolveOutputMetadata(project, activeOutput)

  return (
    <section aria-label="Header Inspector" className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <LayoutTemplate className="size-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-none">
              {outputTypeLabel} Header &amp; Actions
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Overrides project defaults for this {activeOutputType}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setHeaderUnlocked(false)}
          title="Lock template header"
        >
          <Lock className="size-3.5" />
          Lock
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-6 p-4">
          {/* Section: Operations */}
          <OperationsSection
            project={project}
            activeOutput={activeOutput}
            activeOutputType={activeOutputType}
            outputTypeLabel={outputTypeLabel}
            generatingIds={generatingIds}
            updateActiveOutput={updateActiveOutput}
            autoFillAllCardsAction={autoFillAllCardsAction}
            generateNewOutputStructure={generateNewOutputStructure}
            aiReview={aiReview}
          />

          {/* Section: Header Overrides */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Document &amp; Header Settings
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="size-3.5" /> Inherits from left panel
              </span>
            </div>

            {/* Template Switcher */}
            <div className="space-y-1.5 pb-2 border-b border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-foreground">
                  Active Template
                </Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {getTemplatesForType(activeOutputType).length} available
                </span>
              </div>
              <Select
                value={activeOutput?.templateId ?? "atlas"}
                onValueChange={(val) => {
                  if (val) updateActiveOutput({ templateId: val })
                }}
              >
                <SelectTrigger className="w-full h-8 text-xs bg-background" aria-label="Active template">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {getTemplatesForType(activeOutputType).map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id} className="text-xs">
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span>{tmpl.label}</span>
                        {tmpl.category === "institutional" && (
                          <span className="rounded bg-warning/15 dark:bg-warning/20 px-1 py-px text-[10px] font-bold text-warning dark:text-warning">
                            {tmpl.id.includes("atlas") ? "ATLAS" : "Institutional"}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templateDef && (
                <p className="text-xs text-muted-foreground leading-snug">
                  {templateDef.description}
                </p>
              )}
            </div>

            {/* Title */}
            <TitleFields
              outputTypeLabel={outputTypeLabel}
              activeOutput={activeOutput}
              metadata={metadata}
              updateActiveOutput={updateActiveOutput}
            />

            {/* Authors */}
            <AuthorsManager
              activeOutput={activeOutput}
              metadata={metadata}
              updateActiveOutput={updateActiveOutput}
            />

            {/* Venue */}
            <VenueStyling
              activeOutput={activeOutput}
              metadata={metadata}
              updateActiveOutput={updateActiveOutput}
            />

            {/* Logo, Theme Color, QR Code */}
            <TemplateBranding
              project={project}
              activeOutput={activeOutput}
              templateDef={templateDef}
              metadata={metadata}
              updateActiveOutput={updateActiveOutput}
              updateActiveThemeColor={updateActiveThemeColor}
              pushEvent={pushEvent}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex flex-col gap-2 border-t border-border bg-muted/30 p-3 shrink-0">
        <Button
          size="sm"
          className="w-full justify-center h-8 text-xs font-medium"
          onClick={() => setHeaderUnlocked(false)}
        >
          <Check className="size-3.5 mr-1.5" /> Done &amp; Lock Header
        </Button>
      </div>
    </section>
  )
}
