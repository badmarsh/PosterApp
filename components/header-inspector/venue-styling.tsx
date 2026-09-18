"use client"

import { RotateCcw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface VenueStylingProps {
  activeOutput: any
  metadata: {
    isVenueOverridden: boolean
    defaultVenue: string | null
  }
  updateActiveOutput: (patch: any) => void
}

export function VenueStyling({
  activeOutput,
  metadata,
  updateActiveOutput,
}: VenueStylingProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-foreground">
          Conference / Venue
        </Label>
        {metadata.isVenueOverridden ? (
          <button
            type="button"
            onClick={() => updateActiveOutput({ venue: null })}
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
      <Input
        aria-label="Venue"
        value={activeOutput?.venue ?? ""}
        onChange={(e) => updateActiveOutput({ venue: e.target.value })}
        placeholder={metadata.defaultVenue || "e.g. CoRL 2026"}
        className="h-8 text-xs bg-background"
      />
      <p className="text-xs text-muted-foreground leading-normal">
        Leave blank to inherit global venue:{" "}
        <span className="font-semibold text-foreground">
          {metadata.defaultVenue || "None configured"}
        </span>
      </p>
    </div>
  )
}
