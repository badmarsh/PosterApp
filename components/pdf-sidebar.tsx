"use client"

import { useMemo, useState, useRef } from "react"
import dynamic from "next/dynamic"
import {
  Minus,
  Download,
  Plus,
  FileDown,
  Loader2,
  ChevronDownIcon,
  Maximize,
  XCircle,
  AlertTriangle,
  Info,
  CornerUpLeft,
} from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { cn } from "@/lib/utils"
import {
  parseCompileLog,
  attributeIssuesToCards,
  type LatexLogIssue,
} from "@/lib/latex/log-parser"

const KIND_HINTS: Partial<Record<LatexLogIssue["kind"], string>> = {
  "undefined-control-sequence": "Unknown \\command — check spelling or wrap it in $…$ if it is math.",
  math: "Unbalanced $…$ math delimiters.",
  "file-not-found": "A referenced file (figure/logo) is missing from the workspace assets.",
  bibtex: "BibTeX failed — check references.bib and the cite keys.",
  overfull: "Content sticks out past the column edge; shorten the text or shrink the figure.",
  underfull: "Loose spacing — usually cosmetic.",
}

function IssueRow({ issue, cardTitle, onJump }: { issue: LatexLogIssue; cardTitle?: string; onJump?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = issue.severity === "error" ? XCircle : issue.severity === "warning" ? AlertTriangle : Info
  const color =
    issue.severity === "error"
      ? "text-destructive"
      : issue.severity === "warning"
        ? "text-warning"
        : "text-muted-foreground"

  return (
    <li className="flex items-start gap-1.5 rounded-md border border-border bg-card px-2 py-1.5">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", color)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => issue.detail.length > 0 && setExpanded((v) => !v)}
          disabled={issue.detail.length === 0}
          className="w-full text-left text-[11px] leading-snug text-foreground disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-expanded={expanded}
        >
          <span className="line-clamp-2">{issue.message}</span>
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          {issue.line !== undefined && (
            <span className="rounded bg-muted px-1 py-px font-mono">l.{issue.line}</span>
          )}
          {cardTitle && onJump && (
            <button
              type="button"
              onClick={onJump}
              className="inline-flex items-center gap-0.5 rounded px-1 py-px font-medium text-primary hover:bg-primary/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Open card ${cardTitle}`}
              title="Open the card this error likely came from"
            >
              <CornerUpLeft className="size-3" aria-hidden="true" />
              {cardTitle}
            </button>
          )}
          {KIND_HINTS[issue.kind] && <span className="line-clamp-1">{KIND_HINTS[issue.kind]}</span>}
        </div>
        {expanded && issue.detail.length > 0 && (
          <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted/50 p-1.5 font-mono text-[10px] text-muted-foreground">
            {issue.detail.join("\n")}
          </pre>
        )}
      </div>
    </li>
  )
}

function CompileLog({ log, ok }: { log: string; ok: boolean }) {
  const [open, setOpen] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const cards = useEditor(
    useShallow((s) => {
      const active = s.project.outputs?.find((o) => o.id === s.project.activeOutputId)
      return active?.cards ?? []
    })
  )
  const selectCard = useEditor((s) => s.selectCard)
  const setInspectorTab = useEditor((s) => s.setInspectorTab)

  const parsed = useMemo(() => parseCompileLog(log), [log])
  const attributed = useMemo(
    () => (cards.length ? attributeIssuesToCards(parsed.issues, cards) : parsed.issues),
    [parsed.issues, cards],
  )
  const cardTitleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of cards) map.set(c.id, c.title || "Untitled card")
    return map
  }, [cards])

  // Errors first, then warnings, then cosmetic box hints.
  const sortedIssues = useMemo(() => {
    const rank = { error: 0, warning: 1, info: 2 } as const
    return [...attributed].sort((a, b) => rank[a.severity] - rank[b.severity])
  }, [attributed])
  const visibleIssues = sortedIssues.slice(0, 12)

  return (
    <div className="shrink-0 border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between px-3 py-1.5 text-left text-[10px] font-mono font-semibold uppercase tracking-wide transition-colors hover:bg-muted/40",
          ok ? "text-success" : "text-destructive",
        )}
        aria-expanded={open}
        aria-label={ok ? "Compile succeeded — show log details" : "Compile failed — show error details"}
      >
        <span>
          {ok ? "✓ Compile succeeded" : "✗ Compile failed"}
          <span className="ml-2 font-sans font-medium normal-case tracking-normal">
            {parsed.errorCount > 0 && `${parsed.errorCount} error${parsed.errorCount === 1 ? "" : "s"}`}
            {parsed.errorCount > 0 && parsed.warningCount > 0 && " · "}
            {parsed.warningCount > 0 && `${parsed.warningCount} warning${parsed.warningCount === 1 ? "" : "s"}`}
            {parsed.errorCount === 0 && parsed.warningCount === 0 && "no issues parsed"}
          </span>
        </span>
        <ChevronDownIcon
          className={cn("size-3 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="max-h-56 overflow-auto px-3 py-2">
          {sortedIssues.length > 0 ? (
            <>
              <ul className="flex flex-col gap-1.5">
                {visibleIssues.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    cardTitle={issue.cardId ? cardTitleById.get(issue.cardId) : undefined}
                    onJump={
                      issue.cardId
                        ? () => {
                            selectCard(issue.cardId!)
                            setInspectorTab("validation")
                          }
                        : undefined
                    }
                  />
                ))}
              </ul>
              {sortedIssues.length > visibleIssues.length && (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  +{sortedIssues.length - visibleIssues.length} more in the raw log.
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {ok ? "No warnings or errors in the log." : "Compiler reported a failure without a parseable error block — see the raw log."}
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="mt-2 text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            aria-expanded={showRaw}
          >
            {showRaw ? "Hide raw log" : "Show raw log"}
          </button>
          {showRaw && (
            <pre
              className={cn(
                "mt-1 max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-[10px] leading-relaxed",
                ok ? "text-success/80" : "text-destructive",
              )}
            >
              {log || "(no output)"}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

const PdfViewerComponent = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full flex-col gap-2 p-4" role="status" aria-label="Loading PDF viewer">
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="flex-1 animate-pulse rounded bg-muted" />
        <span className="sr-only">Loading PDF viewer…</span>
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
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground border border-border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Toggle Fullscreen"
            >
              <Maximize className="size-3" />
              Fullscreen
            </button>
            <a
              href={`/api/workspaces/${projectId}/pdf?t=${pdfData.byteLength || 0}`}
              download="poster.pdf"
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground border border-border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            <div
              className="relative flex items-center justify-center size-9"
              style={{ willChange: "transform", transform: "translateZ(0)" }}
            >
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"
                style={{
                  animation: "spin 0.9s linear infinite",
                  transformOrigin: "center",
                  willChange: "transform",
                }}
              />
              <Loader2
                className="size-4 text-primary animate-spin"
                style={{
                  animation: "spin 1.4s linear infinite",
                  transformOrigin: "center",
                  willChange: "transform",
                }}
              />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-medium text-foreground/80">
                Compiling with pdflatex…
              </span>
              <div
                className="h-1 w-28 overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
              >
                <div
                  className="h-full w-1/3 rounded-full bg-primary"
                  style={{
                    animation: "compile-shimmer 1.5s ease-in-out infinite",
                    willChange: "transform",
                  }}
                />
              </div>
            </div>
            <span className="sr-only">Compiling PDF</span>
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
