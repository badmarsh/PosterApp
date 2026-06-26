"use client"

import { useState } from "react"
import { Trash2, Wand2 } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  ASSET_KIND_LABEL,
  type AssetKind,
  type ExtractedAsset,
} from "@/lib/ingestion"
import {
  AssetKindIcon,
  ConfidenceMeter,
} from "@/components/ingestion/ingestion-badges"
import { FigureEditor } from "@/components/ingestion/figure-editor"
import { PromotePopover } from "@/components/ingestion/promote-popover"

const KIND_ORDER: AssetKind[] = ["text", "figure", "table"]

function OriginLabel({ asset }: { asset: ExtractedAsset }) {
  const parts = [`p.${asset.page}`]
  if (asset.section) parts.push(asset.section)
  if (asset.bbox) parts.push(asset.bbox)
  return (
    <span className="truncate font-mono text-[9px] text-muted-foreground/80">
      {parts.join(" · ")}
    </span>
  )
}

function TablePreview({ rows }: { rows: string[][] }) {
  const preview = rows.slice(0, 3)
  return (
    <div className="overflow-hidden rounded border border-border">
      <table className="w-full border-collapse text-[9px]">
        <tbody>
          {preview.map((row, ri) => (
            <tr key={ri} className={ri === 0 ? "bg-muted font-medium" : ""}>
              {row.slice(0, 4).map((cell, ci) => (
                <td
                  key={ci}
                  className="truncate border border-border px-1 py-0.5"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 3 && (
        <p className="bg-card px-1 py-0.5 text-[8px] text-muted-foreground">
          +{rows.length - 3} more rows
        </p>
      )}
    </div>
  )
}

function AssetRow({ asset }: { asset: ExtractedAsset }) {
  const { discardAsset } = useEditor()
  const [editing, setEditing] = useState(false)

  return (
    <div
      className={cn(
        "rounded-md border bg-card p-2 transition-colors",
        asset.assignedCardId
          ? "border-primary/30"
          : "border-border hover:border-muted-foreground/30",
      )}
    >
      <div className="flex items-start gap-2">
        {/* preview */}
        {asset.kind === "figure" ? (
          <img
            src={asset.thumbnailUrl || "/placeholder.svg"}
            alt={asset.caption || "Extracted figure"}
            crossOrigin="anonymous"
            className="h-12 w-16 shrink-0 rounded border border-border object-cover"
          />
        ) : (
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
            <AssetKindIcon kind={asset.kind} className="size-3.5" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <OriginLabel asset={asset} />
            <ConfidenceMeter level={asset.confidence} />
          </div>

          {/* body */}
          {asset.kind === "text" && (
            <>
              {asset.heading && (
                <p className="mt-0.5 text-[11px] font-medium leading-tight">
                  {asset.heading}
                </p>
              )}
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                {asset.snippet}
              </p>
            </>
          )}
          {asset.kind === "figure" && (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
              {asset.caption}
            </p>
          )}
          {asset.kind === "table" && (
            <div className="mt-1">
              <TablePreview rows={asset.tableRows ?? []} />
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="mt-2 flex items-center gap-1.5">
        {asset.kind === "figure" && (
          <Button
            size="xs"
            variant="outline"
            className="h-6 gap-1 px-1.5 text-[10px]"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
          >
            <Wand2 className="size-3" />
            Edit
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <PromotePopover asset={asset} />
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Discard asset"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => discardAsset(asset.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {asset.kind === "figure" && editing && (
        <FigureEditor asset={asset} onClose={() => setEditing(false)} />
      )}
    </div>
  )
}

export function AssetList() {
  const { assets } = useEditor()

  if (!assets.length) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed border-border px-4 py-10 text-center">
        <p className="text-[12px] font-medium">No extracted assets yet</p>
        <p className="text-[11px] text-muted-foreground">
          Upload a PDF above — parsed text, figures, and tables will appear here
          ready to promote into cards.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {KIND_ORDER.map((kind) => {
        const group = assets.filter((a) => a.kind === kind)
        if (!group.length) return null
        return (
          <section key={kind}>
            <div className="mb-1 flex items-center gap-1.5">
              <AssetKindIcon kind={kind} className="size-3 text-muted-foreground" />
              <h4 className="text-[11px] font-semibold uppercase tracking-wide">
                {ASSET_KIND_LABEL[kind]}
              </h4>
              <span className="font-mono text-[10px] text-muted-foreground">
                {group.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {group.map((a) => (
                <AssetRow key={a.id} asset={a} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
