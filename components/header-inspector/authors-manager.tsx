"use client"

import { RotateCcw } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface AuthorsManagerProps {
  activeOutput: any
  metadata: {
    isAuthorsOverridden: boolean
    defaultAuthors: string | null
  }
  updateActiveOutput: (patch: any) => void
}

export function AuthorsManager({
  activeOutput,
  metadata,
  updateActiveOutput,
}: AuthorsManagerProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-foreground">
          Authors &amp; Affiliations
        </Label>
        {metadata.isAuthorsOverridden ? (
          <button
            type="button"
            onClick={() => updateActiveOutput({ authors: null })}
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
        aria-label="Authors"
        value={activeOutput?.authors ?? ""}
        onChange={(e) => updateActiveOutput({ authors: e.target.value })}
        placeholder={metadata.defaultAuthors || "e.g. A. Reyes, M. Okafor"}
        className="min-h-16 resize-none text-xs leading-normal bg-background"
      />
      <p className="text-xs text-muted-foreground leading-normal">
        Leave blank to inherit global authors:{" "}
        <span className="font-semibold text-foreground">
          {metadata.defaultAuthors || "None configured"}
        </span>
      </p>
    </div>
  )
}
