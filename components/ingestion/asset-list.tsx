"use client"

import { useState, memo } from "react"
import { Trash2, Wand2, ListFilter, File } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { Skeleton } from "@/components/ui/skeleton"
import type { ExtractedAsset as Asset } from "@/lib/ingestion"
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
    <span className="font-mono text-[10px] font-normal text-muted-foreground">
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

const AssetRow = memo(function AssetRow({ asset }: { asset: ExtractedAsset }) {
  const discardAsset = useEditor((s) => s.discardAsset)
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
          // eslint-disable-next-line @next/next/no-img-element
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

          {/* body */}
          {asset.kind === "text" && (
            <>
              {asset.heading ? (
                <p className="mt-0.5 text-[11px] font-medium leading-tight">
                  <OriginLabel asset={asset} /> <span className="ml-1">{asset.heading}</span>
                </p>
              ) : (
                <div className="mt-0.5"><OriginLabel asset={asset} /></div>
              )}
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                {asset.snippet}
              </p>
            </>
          )}
          {asset.kind === "figure" && (
            <>
              {asset.caption ? (
                <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-tight">
                  <OriginLabel asset={asset} /> <span className="ml-1">{asset.caption}</span>
                </p>
              ) : (
                <div className="mt-0.5"><OriginLabel asset={asset} /></div>
              )}
              {asset.snippet && (
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                  {asset.snippet}
                </p>
              )}
            </>
          )}
          {asset.kind === "table" && (
            <div className="mt-0.5">
              <div className="mb-1"><OriginLabel asset={asset} /></div>
              <TablePreview rows={asset.tableRows ?? []} />
            </div>
          )}
          {asset.kind === "equation" && (
            <div className="mt-0.5">
              <div className="mb-1"><OriginLabel asset={asset} /></div>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                {asset.snippet}
              </p>
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
            onClick={() => setEditing(true)}
          >
            <Wand2 className="size-3 text-primary" /> Edit
          </Button>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <PromotePopover asset={asset} />
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Discard asset"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => discardAsset(asset.id)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      {asset.kind === "figure" && editing && (
        <FigureEditor asset={asset} onClose={() => setEditing(false)} />
      )}
    </div>
  )
})

export function AssetList() {
  const project = useEditor((s) => s.project)
  const removeFile = useEditor((s) => s.removeFile)
  const removeAllLegacyAssets = useEditor((s) => s.removeAllLegacyAssets)
  const assets = project.assets || []
  const ingestFiles = project.ingestFiles || []

  const [fileFilters, setFileFilters] = useState<Record<string, AssetKind | "all">>({})

  const getFilter = (id: string) => fileFilters[id] || "all"

  // Group assets by fileId
  const groups = ingestFiles
    .map((file) => {
      const allItems = assets.filter((a: Asset) => a.fileId === file.id)
      let items = allItems
      const fKind = getFilter(file.id)
      if (fKind !== "all") {
        items = items.filter((a) => a.kind === fKind)
      }
      return { file, items, totalCount: allItems.length }
    })
    .filter((g) => g.totalCount > 0)

  const allLegacyAssets = assets.filter(
    (a: Asset) => !a.fileId || !ingestFiles.find((f) => f.id === a.fileId),
  )
  let legacyAssets = allLegacyAssets
  const legacyFilter = getFilter("legacy")
  if (legacyFilter !== "all") {
    legacyAssets = legacyAssets.filter((a) => a.kind === legacyFilter)
  }

  const defaultOpen = groups.length > 0 ? groups[0].file.id : "legacy"
  const [openSection, setOpenSection] = useState<string | null>(defaultOpen)

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

  function renderGroupAssets(groupAssets: Asset[]) {
    return KIND_ORDER.map((kind) => {
      let items = groupAssets.filter((a: Asset) => a.kind === kind)
      items = items.sort((a, b) => (a.page || 0) - (b.page || 0))
      if (!items.length) return null
      return (
        <div key={kind} className="mt-3 first:mt-0">
          <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
            <AssetKindIcon kind={kind} className="size-3" />
            <h5 className="text-[10px] font-semibold uppercase tracking-wide">
              {ASSET_KIND_LABEL[kind]}
            </h5>
            <span className="font-mono text-[9px]">{items.length}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {items.map((a) => (
              <AssetRow key={a.id} asset={a} />
            ))}
          </div>
        </div>
      )
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => {
        const isOpen = openSection === g.file.id
        return (
          <div key={g.file.id} className="rounded-md border border-border bg-muted/10">
            <div className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-muted/30">
              <button
                className="flex flex-1 items-center gap-2 overflow-hidden text-left"
                onClick={() => setOpenSection(isOpen ? null : g.file.id)}
              >
                <span className="truncate text-[12px] font-medium">{g.file.name}</span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                  {g.items.length} items
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm("Remove this file and all its extracted assets?")) {
                      removeFile(g.file.id)
                    }
                  }}
                  aria-label="Remove ingested file"
                >
                  <Trash2 className="size-3" />
                </Button>
                <button
                  className="p-1"
                  onClick={() => setOpenSection(isOpen ? null : g.file.id)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn(
                      "size-3.5 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </div>
            </div>
            {isOpen && (
              <div className="border-t border-border p-2">
                <div className="flex items-center gap-1.5 pb-2">
                  {(["all", "figure", "table", "equation"] as const).map((k) => {
                    const isActive = getFilter(g.file.id) === k
                    return (
                      <Button
                        key={k}
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-6 px-2 text-[10px]",
                          isActive ? "font-medium text-foreground" : "text-muted-foreground"
                        )}
                        onClick={() => setFileFilters(prev => ({ ...prev, [g.file.id]: k }))}
                      >
                        {k === "all" ? <ListFilter className="mr-1 size-3" /> : <AssetKindIcon kind={k as AssetKind} className="mr-1 size-3" />}
                        {k === "all" ? "All" : ASSET_KIND_LABEL[k as AssetKind]}
                      </Button>
                    )
                  })}
                </div>
                {renderGroupAssets(g.items)}
              </div>
            )}
          </div>
        )
      })}

      {allLegacyAssets.length > 0 && (
        <div className="rounded-md border border-border bg-muted/10">
          <div className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-muted/30">
            <button
              className="flex flex-1 items-center gap-2 overflow-hidden text-left"
              onClick={() => setOpenSection(openSection === "legacy" ? null : "legacy")}
            >
              <span className="text-[12px] font-medium">Other Assets</span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                {legacyAssets.length} items
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="icon-xs"
                variant="ghost"
                className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm("Remove all other assets?")) {
                    removeAllLegacyAssets()
                  }
                }}
                aria-label="Remove other assets"
              >
                <Trash2 className="size-3" />
              </Button>
              <button
                className="p-1"
                onClick={() => setOpenSection(openSection === "legacy" ? null : "legacy")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    openSection === "legacy" && "rotate-180"
                  )}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>
          {openSection === "legacy" && (
            <div className="border-t border-border p-2">
              <div className="flex items-center gap-1.5 pb-2">
                {(["all", "figure", "table", "equation"] as const).map((k) => {
                  const isActive = getFilter("legacy") === k
                  return (
                    <Button
                      key={k}
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-6 px-2 text-[10px]",
                        isActive ? "font-medium text-foreground" : "text-muted-foreground"
                      )}
                      onClick={() => setFileFilters(prev => ({ ...prev, legacy: k }))}
                    >
                      {k === "all" ? <ListFilter className="mr-1 size-3" /> : <AssetKindIcon kind={k as AssetKind} className="mr-1 size-3" />}
                      {k === "all" ? "All" : ASSET_KIND_LABEL[k as AssetKind]}
                    </Button>
                  )
                })}
              </div>
              {renderGroupAssets(legacyAssets)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
