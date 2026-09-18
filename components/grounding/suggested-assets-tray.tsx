"use client"

import { ImagePlus, Paperclip, Sparkles, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SuggestedAsset } from "@/lib/poster-types"
import { cn } from "@/lib/utils"

export function SuggestedAssetsTray({
  assets,
  attachedIds = [],
  onAttach,
  className,
}: {
  assets: SuggestedAsset[]
  attachedIds?: string[]
  onAttach: (assetId: string) => void
  className?: string
}) {
  if (!assets.length) return null
  return (
    <section className={cn("rounded-lg border border-primary/20 bg-primary/5 p-2.5", className)} aria-label="Suggested figures">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-foreground">Suggested Figures</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{assets.length}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {assets.map((asset) => {
          const attached = attachedIds.includes(asset.id)
          const isTable = asset.kind === "table"
          return (
            <div key={asset.id} className="flex min-w-[10.5rem] max-w-[14rem] flex-1 flex-col gap-1.5 rounded-md border border-border bg-card p-2 shadow-xs">
              <div className="flex h-12 items-center justify-center overflow-hidden rounded border border-dashed border-border bg-muted/40">
                {asset.id && !isTable && asset.filename ? (
                  <span className="truncate px-2 text-center font-mono text-[9px] text-muted-foreground">{asset.filename}</span>
                ) : isTable ? (
                  <Table2 className="size-5 text-muted-foreground" />
                ) : (
                  <ImagePlus className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium text-foreground" title={asset.caption || asset.filename || asset.id}>
                  {asset.caption || asset.filename || asset.id}
                </p>
                <p className="truncate text-[9px] text-muted-foreground">
                  {asset.kind} · {Math.round(asset.score * 100)}% match
                </p>
              </div>
              <Button
                type="button"
                size="xs"
                variant={attached ? "secondary" : "outline"}
                className="h-6 gap-1 text-[10px]"
                disabled={attached}
                onClick={() => onAttach(asset.id)}
              >
                <Paperclip className="size-3" />
                {attached ? "Attached" : "Attach to Card"}
              </Button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
