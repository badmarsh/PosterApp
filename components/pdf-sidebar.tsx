"use client"

import { useState, useRef } from "react"
import dynamic from "next/dynamic"
import { Minus, Download, Plus, FileDown, Loader2, ChevronDownIcon, Maximize } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { cn } from "@/lib/utils"

function CompileLog({ log, ok }: { log: string; ok: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="shrink-0 border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between px-3 py-1.5 text-left text-[10px] font-mono font-semibold uppercase tracking-wide transition-colors hover:bg-muted/40",
          ok ? "text-success" : "text-destructive",
        )}
      >
        <span>{ok ? "✓ Compile succeeded" : "✗ Compile failed"} — log</span>
        <ChevronDownIcon
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <pre
          className={cn(
            "max-h-48 overflow-auto px-3 py-2 font-mono text-[10px] leading-relaxed",
            ok
              ? "text-success/80"
              : "text-destructive",
          )}
        >
          {log || "(no output)"}
        </pre>
      )}
    </div>
  )
}

const PdfViewerComponent = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
)

const ZOOM_OPTIONS: { value: number | "auto"; label: string }[] = [
  { value: "auto", label: "Fit Width" },
  { value: 0.25, label: "25%" },
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 1, label: "100%" },
  { value: 1.25, label: "125%" },
  { value: 1.5, label: "150%" },
  { value: 2, label: "200%" },
  { value: 3, label: "300%" },
  { value: 4, label: "400%" },
]

export function PdfSidebar() {
  const { pdfData, compileLog, compileOk, compiling, projectId } = useEditor(
    useShallow((s) => ({
      pdfData: s.pdfData,
      compileLog: s.compileLog,
      compileOk: s.compileOk,
      compiling: s.compiling,
      projectId: s.project.id,
    }))
  )

  const [scale, setScale] = useState<number | "auto">("auto")
  const [numPages, setNumPages] = useState(0)

  const zoomIn = () => {
    const idx = ZOOM_OPTIONS.findIndex((z) => z.value === scale)
    if (idx !== -1) {
      const next = ZOOM_OPTIONS[Math.min(idx + 1, ZOOM_OPTIONS.length - 1)]
      if (next) setScale(next.value)
    }
  }
  const zoomOut = () => {
    const idx = ZOOM_OPTIONS.findIndex((z) => z.value === scale)
    if (idx !== -1) {
      const prev = ZOOM_OPTIONS[Math.max(idx - 1, 0)]
      if (prev) setScale(prev.value)
    }
  }

  const containerRef = useRef<HTMLDivElement>(null)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err)
      })
    } else {
      document.exitFullscreen()
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-background" ref={containerRef}>
      {/* Zoom toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/10 px-3 h-10">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale === ZOOM_OPTIONS[0].value || !pdfData}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            aria-label="Zoom out"
          >
            <Minus className="size-3.5" />
          </button>
          <select
            value={scale}
            disabled={!pdfData}
            onChange={(e) => {
              const val = e.target.value
              setScale(val === "auto" ? "auto" : Number(val))
            }}
            className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]"
          >
            {ZOOM_OPTIONS.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={zoomIn}
            disabled={scale === ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1].value || !pdfData}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            aria-label="Zoom in"
          >
            <Plus className="size-3.5" />
          </button>
          {numPages > 0 && (
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              {numPages} page{numPages !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {pdfData && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
              aria-label="Toggle Fullscreen"
            >
              <Maximize className="size-3" />
              Fullscreen
            </button>
            <a
              href={`/api/workspaces/${projectId}/pdf?t=${pdfData.byteLength || 0}`}
              download="poster.pdf"
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
            >
              <Download className="size-3" />
              Download
            </a>
          </div>
        )}
      </div>

      {/* PDF render area */}
      <div className="relative min-h-0 flex-1 bg-muted/20">
        {compiling && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-[11px] text-muted-foreground">Compiling with pdflatex…</span>
          </div>
        )}
        {pdfData ? (
          <PdfViewerComponent
            data={pdfData}
            scale={scale}
            onLoadSuccess={setNumPages}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <FileDown className="size-8 opacity-30" />
              <span className="text-[11px]">
                No PDF yet — click <strong>Compile</strong>.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Compile log (shown when there is output) */}
      {compileLog !== null && compileOk !== null && (
        <CompileLog log={compileLog} ok={compileOk} />
      )}
    </div>
  )
}
