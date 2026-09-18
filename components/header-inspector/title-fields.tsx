"use client"

import { RotateCcw } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface TitleFieldsProps {
  outputTypeLabel: string
  activeOutput: any
  metadata: {
    isTitleOverridden: boolean
    defaultTitle: string
  }
  updateActiveOutput: (patch: any) => void
}

export function TitleFields({
  outputTypeLabel,
  activeOutput,
  metadata,
  updateActiveOutput,
}: TitleFieldsProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-foreground">
          {outputTypeLabel} Title
        </Label>
        {metadata.isTitleOverridden ? (
          <button
            type="button"
            onClick={() => updateActiveOutput({ title: "" })}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
          >
            <RotateCcw className="size-3" /> Reset to default
          </button>
        ) : (
          <span className="text-xs font-mono text-muted-foreground">
            (Inherited)
          </span>
        )}
      </div>
      <Textarea
        aria-label="Output title"
        value={activeOutput?.title ?? ""}
        onChange={(e) => updateActiveOutput({ title: e.target.value })}
        placeholder={metadata.defaultTitle}
        className="min-h-16 resize-none text-sm font-medium leading-normal bg-background"
      />
      <p className="text-xs text-muted-foreground leading-normal">
        Leave blank to inherit global title:{" "}
        <span className="font-semibold text-foreground">{metadata.defaultTitle}</span>
      </p>
    </div>
  )
}
