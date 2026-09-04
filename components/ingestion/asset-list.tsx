"use client"

import { useState, useMemo, memo } from "react"
import {
  Trash2,
  ListFilter,
  Sparkles,
  Loader2,
  Search,
  XCircle,
  Quote,
  Copy,
  Check,
  BookOpen,
  PlusCircle,
  FileStack,
} from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import type { ExtractedAsset as Asset } from "@/lib/ingestion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { cn, decodeHtmlEntities } from "@/lib/utils"
import katex from "katex"
import "katex/dist/katex.min.css"
import {
  ASSET_KIND_LABEL,
  type AssetKind,
  type ExtractedAsset,
} from "@/lib/ingestion"
import type { BibEntry } from "@/lib/bib-types"
import { formatBibEntry } from "@/lib/bib-types"
import {
  AssetKindIcon,
  ConfidenceMeter,
} from "@/components/ingestion/ingestion-badges"
import { FigureEditor } from "@/components/ingestion/figure-editor"
import { PromotePopover } from "@/components/ingestion/promote-popover"

export type IngestionTabFilter = "all" | "figure" | "table" | "equation" | "citation"

const KIND_ORDER: AssetKind[] = ["figure", "table", "equation", "text"]

function OriginLabel({ asset }: { asset: ExtractedAsset }) {
  const parts = [`p.${asset.page}`]
  if (asset.section && asset.section.length <= 40 && !asset.section.includes("\n") && !asset.section.startsWith("#")) {
    parts.push(asset.section)
  }
  if (asset.bbox && (asset.bbox.startsWith("[") || asset.bbox.length <= 30) && !asset.bbox.includes("\n")) {
    parts.push(asset.bbox)
  }
  return (
    <span className="font-mono text-[10px] font-normal text-muted-foreground">
      {parts.join(" · ")}
    </span>
  )
}

function EquationPreview({ formula }: { formula: string }) {
  const html = useMemo(() => {
    try {
      const clean = formula
        .replace(/^\$\$|\$\$$/g, "")
        .replace(/^\\\[|\\\]$/g, "")
        .replace(/\\tag\{[^}]+\}/g, "")
        .trim()
      return katex.renderToString(clean, {
        throwOnError: false,
        displayMode: true,
      })
    } catch {
      return null
    }
  }, [formula])

  if (!html) {
    return (
      <div className="overflow-x-auto rounded border border-border/80 bg-muted/40 px-2 py-1 font-mono text-[10px] text-foreground select-all whitespace-pre-wrap">
        {formula}
      </div>
    )
  }

  return (
    <div
      className="my-1 overflow-x-auto rounded border border-border/60 bg-muted/20 px-2 py-1 text-center text-foreground [&_.katex-display]:my-0 select-all"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function TablePreview({ rows }: { rows: string[][] | string | undefined | null }) {
  let parsedRows: string[][] = []
  if (Array.isArray(rows)) {
    parsedRows = rows
      .filter((r) => Array.isArray(r))
      .map((r) => r.map((cell) => decodeHtmlEntities(String(cell ?? ""))))
  } else if (typeof rows === "string") {
    try {
      const parsed = JSON.parse(rows)
      if (Array.isArray(parsed)) {
        parsedRows = parsed
          .filter((r) => Array.isArray(r))
          .map((r) => r.map((cell) => decodeHtmlEntities(String(cell ?? ""))))
      }
    } catch {
      parsedRows = []
    }
  }

  if (!parsedRows || parsedRows.length === 0) {
    return (
      <div className="rounded border border-border bg-muted/20 px-2 py-1 text-[10px] text-muted-foreground italic">
        Table data extracted
      </div>
    )
  }

  const preview = parsedRows.slice(0, 3)
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
                  {String(cell ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {parsedRows.length > 3 && (
        <p className="bg-card px-1 py-0.5 text-[9px] text-muted-foreground">
          +{parsedRows.length - 3} more rows
        </p>
      )}
    </div>
  )
}

const CitationRow = memo(function CitationRow({ entry }: { entry: BibEntry }) {
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedBib, setCopiedBib] = useState(false)
  const { selectedCardId, insertCitation, pushEvent } = useEditor(
    useShallow((s) => ({
      selectedCardId: s.selectedCardId,
      insertCitation: s.insertCitation,
      pushEvent: s.pushEvent,
    }))
  )

  const handleCopyCite = () => {
    navigator.clipboard.writeText(`\\cite{${entry.key}}`)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 1500)
    pushEvent({
      kind: "info",
      status: "done",
      title: "Citation Copied",
      detail: `\\cite{${entry.key}} copied to clipboard`,
    })
  }

  const handleCopyBibTeX = () => {
    const raw = formatBibEntry(entry)
    navigator.clipboard.writeText(raw)
    setCopiedBib(true)
    setTimeout(() => setCopiedBib(false), 1500)
    pushEvent({
      kind: "info",
      status: "done",
      title: "BibTeX Copied",
      detail: `@${entry.type || "article"}{${entry.key}} copied to clipboard`,
    })
  }

  const handleInsert = () => {
    if (!selectedCardId) return
    insertCitation(selectedCardId, entry.key)
  }

  return (
    <div className="rounded-md border border-border bg-card p-2.5 transition-colors hover:border-muted-foreground/30 shadow-2xs space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/25">
              @{entry.type || "article"}
            </span>
            <span className="font-mono text-[10px] font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
              {entry.key}
            </span>
            {entry.year && (
              <span className="font-mono text-[10px] text-muted-foreground">
                ({entry.year})
              </span>
            )}
          </div>

          <h5 className="mt-1 text-[11px] font-medium text-foreground leading-tight line-clamp-2">
            {entry.title || "Untitled Paper"}
          </h5>

          {(entry.authorString || (entry.authors && entry.authors.length > 0)) && (
            <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
              {entry.authorString || entry.authors.join(", ")}
            </p>
          )}

          {(entry.journal || entry.booktitle) && (
            <p className="mt-0.5 text-[9px] italic text-muted-foreground/80 line-clamp-1">
              {entry.journal || entry.booktitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/60">
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant="outline"
            className="h-6 px-1.5 text-[9px] gap-1"
            onClick={handleCopyCite}
            title="Copy LaTeX cite command"
          >
            {copiedKey ? <Check className="size-2.5 text-chart-3" /> : <Copy className="size-2.5" />}
            <span>\cite</span>
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="h-6 px-1.5 text-[9px] gap-1 text-muted-foreground hover:text-foreground"
            onClick={handleCopyBibTeX}
            title="Copy raw BibTeX entry"
          >
            {copiedBib ? <Check className="size-2.5 text-chart-3" /> : <Copy className="size-2.5" />}
            <span>BibTeX</span>
          </Button>
        </div>

        {selectedCardId ? (
          <Button
            size="xs"
            variant="secondary"
            className="h-6 px-2 text-[10px] gap-1 font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
            onClick={handleInsert}
          >
            <PlusCircle className="size-3" />
            <span>Cite in Card</span>
          </Button>
        ) : (
          <span className="text-[9px] text-muted-foreground italic">
            Select a card to insert
          </span>
        )}
      </div>
    </div>
  )
})

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
                  <OriginLabel asset={asset} /> <span className="ml-1">{decodeHtmlEntities(asset.caption)}</span>
                </p>
              ) : (
                <div className="mt-0.5"><OriginLabel asset={asset} /></div>
              )}
              {asset.snippet && (
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                  {decodeHtmlEntities(asset.snippet)}
                </p>
              )}
            </>
          )}
          {asset.kind === "table" && (
            <div className="mt-0.5">
              {asset.caption ? (
                <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-tight">
                  <OriginLabel asset={asset} /> <span className="ml-1">{decodeHtmlEntities(asset.caption)}</span>
                </p>
              ) : (
                <div className="mb-1"><OriginLabel asset={asset} /></div>
              )}
              {asset.snippet && (
                <p className="mt-0.5 mb-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                  {decodeHtmlEntities(asset.snippet)}
                </p>
              )}
              <TablePreview rows={asset.tableRows ?? []} />
            </div>
          )}
          {asset.kind === "equation" && (
            <div className="mt-1">
              <div className="mb-1 flex items-center gap-1.5 flex-wrap">
                <OriginLabel asset={asset} />
                {asset.heading && (
                  <span className="font-mono text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-px rounded border border-primary/20">
                    {asset.heading}
                  </span>
                )}
                {asset.caption && (
                  <span className="text-[11px] font-medium text-foreground">
                    {asset.caption}
                  </span>
                )}
              </div>
              <EquationPreview formula={asset.snippet || asset.caption || ""} />
            </div>
          )}
        </div>

        {/* actions */}
        <div className="flex shrink-0 items-center gap-1">
          {asset.kind === "figure" && (
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Edit figure"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(true)}
            >
              <Sparkles className="size-3" />
            </Button>
          )}
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
  const {
    project,
    bibEntries,
    removeFile,
    removeAllLegacyAssets,
    backfillCaptions,
    setIsBibManagerOpen,
  } = useEditor(
    useShallow((s) => ({
      project: s.project,
      bibEntries: s.bibEntries || [],
      removeFile: s.removeFile,
      removeAllLegacyAssets: s.removeAllLegacyAssets,
      backfillCaptions: s.backfillCaptions,
      setIsBibManagerOpen: s.setIsBibManagerOpen,
    }))
  )

  const [isBackfilling, setIsBackfilling] = useState(false)
  const assets = project.assets || []
  const ingestFiles = project.ingestFiles || []

  const [activeTab, setActiveTab] = useState<IngestionTabFilter>("all")
  const [fileFilters, setFileFilters] = useState<Record<string, IngestionTabFilter>>({})
  const [searchQuery, setSearchQuery] = useState("")

  const getFilter = (id: string) => fileFilters[id] || activeTab || "all"

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const matchesSearch = (a: Asset) => {
    if (!normalizedQuery) return true
    const captionMatch = a.caption?.toLowerCase().includes(normalizedQuery)
    const snippetMatch = a.snippet?.toLowerCase().includes(normalizedQuery)
    const headingMatch = a.heading?.toLowerCase().includes(normalizedQuery)
    const filenameMatch = a.filename?.toLowerCase().includes(normalizedQuery)
    const pageMatch = a.page ? `p.${a.page}`.includes(normalizedQuery) || `page ${a.page}`.includes(normalizedQuery) || String(a.page) === normalizedQuery : false
    const tableMatch = a.tableRows ? JSON.stringify(a.tableRows).toLowerCase().includes(normalizedQuery) : false
    return Boolean(captionMatch || snippetMatch || headingMatch || filenameMatch || pageMatch || tableMatch)
  }

  const matchesBibSearch = (b: BibEntry) => {
    if (!normalizedQuery) return true
    const keyMatch = b.key.toLowerCase().includes(normalizedQuery)
    const titleMatch = b.title?.toLowerCase().includes(normalizedQuery)
    const authorMatch = (b.authorString || b.authors?.join(", "))?.toLowerCase().includes(normalizedQuery)
    const journalMatch = (b.journal || b.booktitle)?.toLowerCase().includes(normalizedQuery)
    const yearMatch = b.year?.toLowerCase().includes(normalizedQuery)
    return Boolean(keyMatch || titleMatch || authorMatch || journalMatch || yearMatch)
  }

  const handleBackfill = async () => {
    setIsBackfilling(true)
    try {
      await backfillCaptions()
    } finally {
      setIsBackfilling(false)
    }
  }

  // Filtered citations
  const filteredBibEntries = useMemo(() => {
    return bibEntries.filter(matchesBibSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bibEntries, normalizedQuery])

  // Count stats
  const figuresCount = assets.filter((a) => a.kind === "figure").length
  const tablesCount = assets.filter((a) => a.kind === "table").length
  const equationsCount = assets.filter((a) => a.kind === "equation").length
  const textCount = assets.filter((a) => a.kind === "text").length
  const citationsCount = bibEntries.length

  // Group assets by fileId
  const groups = ingestFiles
    .map((file) => {
      const allItems = assets.filter((a: Asset) => a.fileId === file.id)
      let items = allItems.filter(matchesSearch)
      const fKind = getFilter(file.id)
      if (fKind !== "all" && fKind !== "citation") {
        items = items.filter((a) => a.kind === fKind)
      }
      return {
        file,
        items,
        totalCount: allItems.length,
        filteredCount: items.length,
        figuresCount: allItems.filter((a) => a.kind === "figure").length,
        tablesCount: allItems.filter((a) => a.kind === "table").length,
        equationsCount: allItems.filter((a) => a.kind === "equation").length,
        textCount: allItems.filter((a) => a.kind === "text").length,
      }
    })
    .filter((g) => g.totalCount > 0)

  const allLegacyAssets = assets.filter(
    (a: Asset) => !a.fileId || !ingestFiles.find((f) => f.id === a.fileId),
  )
  let legacyAssets = allLegacyAssets.filter(matchesSearch)
  const legacyFilter = getFilter("legacy")
  if (legacyFilter !== "all" && legacyFilter !== "citation") {
    legacyAssets = legacyAssets.filter((a) => a.kind === legacyFilter)
  }

  const matchingAssetsCount =
    groups.reduce((acc, g) => acc + g.filteredCount, 0) +
    legacyAssets.length +
    (activeTab === "citation" || activeTab === "all" ? filteredBibEntries.length : 0)

  const defaultOpen = groups.length > 0 ? groups[0].file.id : "legacy"
  const [openSection, setOpenSection] = useState<string | null>(defaultOpen)

  const tabOptions: { id: IngestionTabFilter; label: string; count: number; icon: React.ReactNode }[] = [
    { id: "all", label: "All", count: assets.length + citationsCount, icon: <ListFilter className="size-3" /> },
    { id: "figure", label: "Figures", count: figuresCount, icon: <AssetKindIcon kind="figure" className="size-3" /> },
    { id: "table", label: "Tables", count: tablesCount, icon: <AssetKindIcon kind="table" className="size-3" /> },
    { id: "equation", label: "Equations", count: equationsCount, icon: <AssetKindIcon kind="equation" className="size-3" /> },
    { id: "citation", label: "Citations", count: citationsCount, icon: <AssetKindIcon kind="citation" className="size-3" /> },
  ]

  if (!assets.length && !citationsCount) {
    return (
      <EmptyState
        variant="inline"
        icon={FileStack}
        title="No extracted assets yet"
        description="Upload a paper or preprint above — figures, tables, equations, citations, and text will appear here."
      />
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
            <span className="font-mono text-[9px]">({items.length})</span>
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
      {/* 1. Global Search and Backfill Bar */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search figures, tables, equations, citations..."
            className="h-8 pl-8 pr-8 text-xs bg-card"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear asset search"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
            >
              <XCircle className="size-3.5" />
            </button>
          )}
        </div>

        {/* 2. Interactive Modality Filter Tabs (Figures, Tables, Equations, Citations, Text, All) */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {tabOptions.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <Button
                key={tab.id}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 px-2 text-[11px] shrink-0 gap-1.5 border transition-all",
                  isActive
                    ? "bg-card border-border font-medium text-foreground shadow-2xs"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                onClick={() => {
                  setActiveTab(tab.id)
                  // Synchronize per-group filters
                  setFileFilters({})
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span className={cn(
                  "font-mono text-[9px] px-1 py-0.5 rounded-full",
                  isActive ? "bg-primary/15 text-primary font-semibold" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              </Button>
            )
          })}
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            {searchQuery
              ? `${matchingAssetsCount} matching items`
              : `${assets.length} assets · ${citationsCount} citations`}
          </span>
          <div className="flex items-center gap-1.5">
            {citationsCount > 0 && (
              <Button
                size="xs"
                variant="ghost"
                className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setIsBibManagerOpen(true)}
              >
                <BookOpen className="size-3" />
                <span>Bib Manager</span>
              </Button>
            )}
            <Button
              size="xs"
              variant="outline"
              className="h-6 gap-1 px-2 text-[10px]"
              disabled={isBackfilling || assets.length === 0}
              onClick={handleBackfill}
            >
              {isBackfilling ? (
                <Loader2 className="size-3 animate-spin text-primary" />
              ) : (
                <Sparkles className="size-3 text-primary" />
              )}
              {isBackfilling ? "Backfilling..." : "Backfill captions"}
            </Button>
          </div>
        </div>
      </div>

      {searchQuery && matchingAssetsCount === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center">
          <p className="text-xs font-medium text-foreground">No items match &ldquo;{searchQuery}&rdquo;</p>
          <Button size="xs" variant="outline" onClick={() => setSearchQuery("")}>
            Clear Search
          </Button>
        </div>
      )}

      {/* 3. If Citations Tab is Active -> Render Dedicated Citations Stream */}
      {activeTab === "citation" && (
        <div className="flex flex-col gap-2">
          {filteredBibEntries.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No citations found matching the query.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Quote className="size-3.5 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    Extracted BibTeX References ({filteredBibEntries.length})
                  </span>
                </div>
              </div>
              {filteredBibEntries.map((entry) => (
                <CitationRow key={entry.key} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Document-Grouped Assets (when activeTab is all, figure, table, equation, or text) */}
      {activeTab !== "citation" && (
        <>
          {groups.map((g) => {
            const isOpen = openSection === g.file.id
            const currentFilter = getFilter(g.file.id)
            return (
              <div key={g.file.id} className="rounded-md border border-border bg-muted/10">
                <div className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-muted/30">
                  <button
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${g.file.name}`}
                    className="flex flex-1 items-center gap-2 overflow-hidden rounded text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
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
                    {/* Per-document filter tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-2 no-scrollbar">
                      {(["all", "figure", "table", "equation"] as const).map((k) => {
                        const isActive = currentFilter === k
                        const count =
                          k === "all"
                            ? g.totalCount
                            : k === "figure"
                            ? g.figuresCount
                            : k === "table"
                            ? g.tablesCount
                            : g.equationsCount
                        if (count === 0 && k !== "all") return null
                        return (
                          <Button
                            key={k}
                            variant={isActive ? "secondary" : "ghost"}
                            size="sm"
                            className={cn(
                              "h-6 px-1.5 text-[10px] gap-1 shrink-0",
                              isActive ? "font-medium text-foreground" : "text-muted-foreground"
                            )}
                            onClick={() => setFileFilters((prev) => ({ ...prev, [g.file.id]: k }))}
                          >
                            {k === "all" ? <ListFilter className="size-2.5" /> : <AssetKindIcon kind={k as AssetKind} className="size-2.5" />}
                            <span>{k === "all" ? "All" : ASSET_KIND_LABEL[k as AssetKind]}</span>
                            <span className="font-mono text-[9px] opacity-70">({count})</span>
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
                  <div className="flex items-center gap-1 overflow-x-auto pb-2 no-scrollbar">
                    {(["all", "figure", "table", "equation"] as const).map((k) => {
                      const isActive = legacyFilter === k
                      return (
                        <Button
                          key={k}
                          variant={isActive ? "secondary" : "ghost"}
                          size="sm"
                          className={cn(
                            "h-6 px-1.5 text-[10px] gap-1 shrink-0",
                            isActive ? "font-medium text-foreground" : "text-muted-foreground"
                          )}
                          onClick={() => setFileFilters((prev) => ({ ...prev, legacy: k }))}
                        >
                          {k === "all" ? <ListFilter className="size-2.5" /> : <AssetKindIcon kind={k as AssetKind} className="size-2.5" />}
                          <span>{k === "all" ? "All" : ASSET_KIND_LABEL[k as AssetKind]}</span>
                        </Button>
                      )
                    })}
                  </div>
                  {renderGroupAssets(legacyAssets)}
                </div>
              )}
            </div>
          )}

          {/* If on "all" tab, also display citations summary below if present */}
          {activeTab === "all" && filteredBibEntries.length > 0 && (
            <div className="mt-2 rounded-md border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Quote className="size-3.5 text-primary" />
                  <h5 className="text-[10px] font-semibold uppercase tracking-wide">
                    Extracted References ({filteredBibEntries.length})
                  </h5>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  className="h-6 px-1.5 text-[9px] text-muted-foreground hover:text-foreground"
                  onClick={() => setActiveTab("citation")}
                >
                  View All
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                {filteredBibEntries.slice(0, 3).map((entry) => (
                  <CitationRow key={entry.key} entry={entry} />
                ))}
              </div>
              {filteredBibEntries.length > 3 && (
                <Button
                  size="xs"
                  variant="outline"
                  className="w-full h-6 text-[10px] text-muted-foreground"
                  onClick={() => setActiveTab("citation")}
                >
                  +{filteredBibEntries.length - 3} more citations
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
