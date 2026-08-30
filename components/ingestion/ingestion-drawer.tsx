"use client"

import { useEffect } from "react"
import { FileStack, X } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UploadZone } from "@/components/ingestion/upload-zone"
import { AssetList } from "@/components/ingestion/asset-list"
import { ParseLogPanel } from "@/components/ingestion/parse-log-panel"

export function IngestionDrawer() {
  const { ingestionOpen, closeIngestion, project } = useEditor(
    useShallow((s) => ({
      ingestionOpen: s.ingestionOpen,
      closeIngestion: s.closeIngestion,
      project: s.project,
    }))
  )
  const assets = project.assets || []
  const ingestFiles = project.ingestFiles || []

  useEffect(() => {
    if (!ingestionOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeIngestion()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [ingestionOpen, closeIngestion])

  if (!ingestionOpen) return null

  const assigned = assets.filter((a) => a.assignedCardId).length
  const parsing = ingestFiles.filter(
    (f) => f.status === "parsing" || f.status === "queued",
  ).length

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close ingestion panel"
        onClick={closeIngestion}
        className="absolute inset-0 bg-foreground/30 duration-150 animate-in fade-in"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ingest sources"
        className="relative flex h-full w-full max-w-xl flex-col border-l border-border bg-sidebar shadow-xl duration-200 animate-in slide-in-from-right"
      >
        {/* header */}
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border bg-card px-3 py-2.5">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-7 items-center justify-center rounded bg-primary/10 text-primary">
              <FileStack className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Ingest sources
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Parse PDFs into structured assets, then promote them into card
                slots.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Close ingestion panel"
            onClick={closeIngestion}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* summary strip */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/30 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
          <span>
            {ingestFiles.length} file{ingestFiles.length === 1 ? "" : "s"}
          </span>
          <span aria-hidden>·</span>
          <span>{assets.length} assets</span>
          <span aria-hidden>·</span>
          <span className="text-primary">{assigned} promoted</span>
          {parsing > 0 && (
            <span className="ml-auto flex items-center gap-1 text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              {parsing} parsing
            </span>
          )}
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-3 p-3">
            <UploadZone />

            <section>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
                Extraction results
              </h3>
              <AssetList />
            </section>

            <ParseLogPanel />
          </div>
        </ScrollArea>
      </aside>
    </div>
  )
}
