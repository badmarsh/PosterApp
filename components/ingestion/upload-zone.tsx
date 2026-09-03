"use client"

import { useRef, useState } from "react"
import { RotateCw, Trash2, X, Globe, Sparkles, Loader2, ArrowRight } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/ingestion"
import { apiFetch } from "@/lib/api-fetch"
import {
  MethodBadge,
  ParseStatusBadge,
} from "@/components/ingestion/ingestion-badges"

function DocProcessingIllustration({ dragging = false }: { dragging?: boolean }) {
  return (
    <svg
      viewBox="0 0 240 64"
      className={cn(
        "h-14 w-auto max-w-full shrink-0 transition-transform duration-300",
        dragging ? "scale-105" : "hover:scale-102"
      )}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* === 1. LEFT: GREY-SCALE MULTI-DOCUMENT FAN === */}
      {/* Doc 3: PPT / Slide */}
      <g transform="translate(6, 16) rotate(-8)">
        <rect x="0" y="0" width="26" height="32" rx="2" className="fill-muted/50 stroke-border/70" strokeWidth="0.8" />
        <rect x="2.5" y="2.5" width="8" height="3" rx="0.5" className="fill-muted-foreground/20" />
        <text x="3.2" y="4.8" fontSize="2.2" fontWeight="bold" className="fill-muted-foreground/70 font-mono">PPT</text>
        <rect x="3.5" y="8" width="19" height="11" rx="0.8" className="fill-muted/60 stroke-border/50" strokeWidth="0.5" />
      </g>

      {/* Doc 2: DOCX / TEX */}
      <g transform="translate(14, 10) rotate(-3)">
        <rect x="0" y="0" width="28" height="38" rx="2" className="fill-muted/70 stroke-border" strokeWidth="0.8" />
        <rect x="2.5" y="2.5" width="10" height="3" rx="0.5" className="fill-muted-foreground/25" />
        <text x="3.2" y="4.8" fontSize="2.2" fontWeight="bold" className="fill-muted-foreground/80 font-mono">DOCX</text>
        <line x1="3" y1="8" x2="25" y2="8" stroke="currentColor" strokeWidth="0.6" className="text-muted-foreground/25" />
        <line x1="3" y1="11" x2="25" y2="11" stroke="currentColor" strokeWidth="0.6" className="text-muted-foreground/25" />
        <line x1="3" y1="14" x2="25" y2="14" stroke="currentColor" strokeWidth="0.6" className="text-muted-foreground/25" />
      </g>

      {/* Primary Foreground Doc 1: PDF Paper */}
      <g transform="translate(24, 4)">
        <rect x="0" y="0" width="32" height="46" rx="2.5" className="fill-card stroke-border shadow-xs" strokeWidth="1" />
        {/* Grey PDF Badge */}
        <rect x="3" y="3" width="9" height="3.5" rx="0.8" className="fill-muted-foreground/25" />
        <text x="4" y="5.8" fontSize="2.5" fontWeight="bold" className="fill-foreground/80 font-mono">PDF</text>
        <rect x="14" y="3.5" width="14" height="2" rx="0.5" className="fill-muted-foreground/20" />
        
        {/* Title & Structure */}
        <rect x="3" y="9" width="26" height="1.5" rx="0.5" className="fill-foreground/60" />
        <rect x="3" y="12" width="18" height="1.2" rx="0.4" className="fill-muted-foreground/30" />

        {/* 2-column layout */}
        <rect x="3" y="15" width="12" height="1.2" rx="0.4" className="fill-muted-foreground/25" />
        <rect x="3" y="17.5" width="12" height="8" rx="0.8" className="fill-muted/60 stroke-border/60" strokeWidth="0.5" />
        <rect x="3" y="27" width="12" height="1.2" rx="0.4" className="fill-muted-foreground/25" />
        <rect x="3" y="29.5" width="9" height="1.2" rx="0.4" className="fill-muted-foreground/25" />

        <rect x="17" y="15" width="12" height="1.2" rx="0.4" className="fill-muted-foreground/25" />
        <rect x="17" y="17.5" width="12" height="1.2" rx="0.4" className="fill-muted-foreground/25" />
        <rect x="17" y="20" width="12" height="6" rx="0.8" className="fill-muted/60 stroke-border/60" strokeWidth="0.5" />
        <rect x="17" y="27.5" width="12" height="1.2" rx="0.4" className="fill-muted-foreground/25" />
      </g>

      {/* === 2. CENTER: MINIMAL PROCESSING FLOW === */}
      {/* Stream Flow */}
      <path d="M64 26 C 78 26, 88 32, 106 32 C 122 32, 130 26, 144 26" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" className="text-muted-foreground/40" />

      {/* Central Processing Node */}
      <g transform="translate(98, 22)">
        <circle cx="8" cy="8" r="9.5" className="fill-card stroke-border shadow-xs" strokeWidth="1" />
        <circle cx="8" cy="8" r="7" className="fill-muted/50" />
        <path d="M8 3.5L8.9 6.2L11.5 7L8.9 7.8L8 10.5L7.1 7.8L4.5 7L7.1 6.2L8 3.5Z" className="fill-amber-500" />
      </g>

      {/* === 3. RIGHT: MONOCHROME STRUCTURED OUTPUTS === */}
      {/* 1. Equations (Σ Eq) */}
      <g transform="translate(152, 4)">
        <rect x="0" y="0" width="36" height="15" rx="2" className="fill-card stroke-border" strokeWidth="0.8" />
        <rect x="2.5" y="2.5" width="9" height="4" rx="0.6" className="fill-muted" />
        <text x="3.5" y="5.5" fontSize="2.5" fontWeight="bold" className="fill-foreground/70 font-mono">Σ Eq</text>
        <text x="14" y="5.8" fontSize="2.6" className="fill-muted-foreground font-mono">E=mc²</text>
        <rect x="2.5" y="9" width="28" height="1" rx="0.3" className="fill-muted-foreground/20" />
        <rect x="2.5" y="11.5" width="18" height="1" rx="0.3" className="fill-muted-foreground/20" />
      </g>

      {/* 2. Figures (Fig) */}
      <g transform="translate(192, 4)">
        <rect x="0" y="0" width="38" height="23" rx="2" className="fill-card stroke-border" strokeWidth="0.8" />
        <rect x="2.5" y="2.5" width="10" height="4" rx="0.6" className="fill-muted" />
        <text x="3.5" y="5.5" fontSize="2.5" fontWeight="bold" className="fill-foreground/70 font-mono">🖼 Fig</text>
        <rect x="2.5" y="8" width="33" height="10" rx="0.8" className="fill-muted/40 stroke-border/40" strokeWidth="0.5" />
        <path d="M5 16L12 10L18 14L24 9L31 16H5Z" className="fill-muted-foreground/30" />
        <circle cx="9" cy="11" r="1.2" className="fill-muted-foreground/40" />
        <rect x="2.5" y="19.5" width="20" height="1" rx="0.3" className="fill-muted-foreground/20" />
      </g>

      {/* 3. Tables (Tab) */}
      <g transform="translate(152, 22)">
        <rect x="0" y="0" width="36" height="19" rx="2" className="fill-card stroke-border" strokeWidth="0.8" />
        <rect x="2.5" y="2.5" width="11" height="4" rx="0.6" className="fill-muted" />
        <text x="3.5" y="5.5" fontSize="2.5" fontWeight="bold" className="fill-foreground/70 font-mono">⊞ Tab</text>
        <rect x="2.5" y="8" width="31" height="8.5" rx="0.5" className="fill-muted/30 stroke-border/40" strokeWidth="0.4" />
        <line x1="2.5" y1="12" x2="33.5" y2="12" stroke="currentColor" strokeWidth="0.4" className="text-muted-foreground/30" />
        <line x1="13" y1="8" x2="13" y2="16.5" stroke="currentColor" strokeWidth="0.4" className="text-muted-foreground/30" />
        <line x1="23" y1="8" x2="23" y2="16.5" stroke="currentColor" strokeWidth="0.4" className="text-muted-foreground/30" />
      </g>

      {/* 4. Citations (Bib) */}
      <g transform="translate(152, 44)">
        <rect x="0" y="0" width="36" height="16" rx="2" className="fill-card stroke-border" strokeWidth="0.8" />
        <rect x="2.5" y="2.5" width="10" height="4" rx="0.6" className="fill-muted" />
        <text x="3.5" y="5.5" fontSize="2.5" fontWeight="bold" className="fill-foreground/70 font-mono">❝ Bib</text>
        <text x="15" y="5.5" fontSize="2.4" className="fill-muted-foreground font-mono">@cite</text>
        <rect x="2.5" y="8.5" width="28" height="1" rx="0.3" className="fill-muted-foreground/20" />
        <rect x="2.5" y="11" width="18" height="1" rx="0.3" className="fill-muted-foreground/20" />
      </g>

      {/* 5. Structured Text (RAG) */}
      <g transform="translate(192, 30)">
        <rect x="0" y="0" width="38" height="30" rx="2" className="fill-card stroke-border" strokeWidth="0.8" />
        <rect x="2.5" y="2.5" width="12" height="4" rx="0.6" className="fill-muted" />
        <text x="3.5" y="5.5" fontSize="2.5" fontWeight="bold" className="fill-foreground/70 font-mono">≡ RAG</text>
        
        <rect x="2.5" y="8.5" width="18" height="1.2" rx="0.3" className="fill-foreground/50" />
        <circle cx="4" cy="13" r="0.6" className="fill-muted-foreground/50" />
        <rect x="6.5" y="12.4" width="26" height="1" rx="0.3" className="fill-muted-foreground/30" />
        <circle cx="4" cy="16.5" r="0.6" className="fill-muted-foreground/50" />
        <rect x="6.5" y="15.9" width="22" height="1" rx="0.3" className="fill-muted-foreground/25" />
        <circle cx="4" cy="20" r="0.6" className="fill-muted-foreground/50" />
        <rect x="6.5" y="19.4" width="24" height="1" rx="0.3" className="fill-muted-foreground/25" />

        {/* Small subtle checkmark */}
        <circle cx="34" cy="4" r="2.8" className="fill-emerald-500/20 stroke-emerald-500/60" strokeWidth="0.6" />
        <path d="M32.8 4L33.6 4.8L35.2 3.2" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400" />
      </g>
    </svg>
  )
}

export function UploadZone() {
  const { project, uploadFiles, retryFile, removeFile, dismissFile, pushEvent } = useEditor(
    useShallow((s) => ({
      project: s.project,
      uploadFiles: s.uploadFiles,
      retryFile: s.retryFile,
      removeFile: s.removeFile,
      dismissFile: s.dismissFile,
      pushEvent: s.pushEvent,
    }))
  )
  const ingestFiles = (project.ingestFiles || []).filter((f) => !f.dismissed)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [retryingIds, setRetryingIds] = useState<string[]>([])

  // arXiv / DOI URL import state
  const [arxivUrl, setArxivUrl] = useState("")
  const [isImportingUrl, setIsImportingUrl] = useState(false)

  async function handleRetry(fileId: string) {
    if (retryingIds.includes(fileId)) return
    setRetryingIds((prev) => [...prev, fileId])
    try {
      await Promise.resolve(retryFile(fileId))
    } finally {
      setRetryingIds((prev) => prev.filter((id) => id !== fileId))
    }
  }

  function handleFiles(list: FileList | null) {
    if (!list || !list.length) return
    uploadFiles(Array.from(list))
  }

  async function handleImportUrl() {
    if (!arxivUrl.trim() || isImportingUrl) return
    setIsImportingUrl(true)
    try {
      const res = await apiFetch(`/api/ingestion/import-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: project.id, url: arxivUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to import paper from URL")
      }

      // Convert base64 into standard File object
      const byteCharacters = atob(data.pdfBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: "application/pdf" })
      const file = new File([blob], data.filename, { type: "application/pdf" })

      uploadFiles([file])
      setArxivUrl("")

      if (data.metadata?.title) {
        pushEvent({
          kind: "info",
          status: "done",
          title: "Paper Downloaded",
          detail: `Imported "${data.metadata.title.slice(0, 60)}..." into sources`,
        })
      }
    } catch (err: unknown) {
      pushEvent({
        kind: "info",
        status: "error",
        title: "URL Import Failed",
        detail: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsImportingUrl(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Section 1: Import from arXiv / DOI / URL */}
      <section>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
          Import from arXiv / DOI / URL
        </h3>
        <div className="rounded-lg border border-border bg-card p-2.5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <Globe className="size-3.5 text-primary" />
              <span>Direct Preprint Fetch</span>
            </div>
            <span className="text-[9px] font-mono text-muted-foreground">Zero-file download</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Input
              value={arxivUrl}
              onChange={(e) => setArxivUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleImportUrl()}
              placeholder="e.g. https://arxiv.org/abs/2301.12345 or DOI"
              className="h-7 text-xs bg-background"
            />
            <Button
              size="sm"
              onClick={handleImportUrl}
              disabled={!arxivUrl.trim() || isImportingUrl}
              className="h-7 text-xs px-2.5 gap-1 shrink-0 shadow-xs"
            >
              {isImportingUrl ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <ArrowRight className="size-3.5" />
                  Fetch
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Section 2: Upload (Drag & Drop Multi-Format Box) */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
          Upload
        </h3>
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload documents — drag and drop or browse"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
          className={cn(
            "group flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed px-3 py-3.5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            dragging
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50",
          )}
        >
          {/* Minimalist Monochrome Illustration */}
          <DocProcessingIllustration dragging={dragging} />
          
          <div className="space-y-1">
            <p className="text-[12px] font-medium text-foreground">
              Drop documents here or{" "}
              <span className="text-primary underline-offset-2 hover:underline">
                browse
              </span>
            </p>
            
            {/* Clean Subtle Grey Format Badges */}
            <div className="flex flex-wrap items-center justify-center gap-1 pt-0.5">
              {["PDF", "DOCX", "TEX", "PPTX", "IMG / Scan"].map((fmt) => (
                <span
                  key={fmt}
                  className="rounded px-1.5 py-0.5 text-[9px] font-medium font-mono bg-muted text-muted-foreground border border-border/60"
                >
                  {fmt}
                </span>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground">
              Extracts figures, tables, equations &amp; citations automatically
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf,.docx,.doc,.pptx,.ppt,.tex,.txt,.md,image/png,image/jpeg,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ""
            }}
          />
        </div>

        {ingestFiles.length > 0 && (
          <ul className="flex flex-col gap-1.5 mt-1">
            {ingestFiles.map((file) => (
              <li
                key={file.id}
                className="rounded-md border border-border bg-card p-2"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium" title={file.name}>
                      {file.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {formatBytes(file.size)}
                      </span>
                      <MethodBadge method={file.method} />
                    </div>
                  </div>
                  <ParseStatusBadge status={file.status} />
                  {file.status === "failed" && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Retry parsing ${file.name}`}
                      disabled={retryingIds.includes(file.id)}
                      onClick={() => handleRetry(file.id)}
                    >
                      <RotateCw className={cn("size-3.5", retryingIds.includes(file.id) && "animate-spin opacity-50")} />
                    </Button>
                  )}
                  {file.status === "done" ? (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Dismiss ${file.name}`}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => dismissFile(file.id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  ) : (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={file.status === "parsing" || file.status === "queued" ? `Cancel parsing ${file.name}` : `Remove ${file.name}`}
                      title={file.status === "parsing" || file.status === "queued" ? "Cancel parsing" : "Remove file"}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(file.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                {(file.status === "parsing" || file.status === "queued") && (
                  <div
                    className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={file.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.max(8, file.progress)}%` }}
                    />
                  </div>
                )}
                {(file.status === "parsing" || file.status === "queued") && file.stage && (
                  <p className="mt-1 text-[10px] text-muted-foreground truncate" aria-live="polite">{file.stage}</p>
                )}

                {file.status === "failed" && file.error && (
                  <p className="mt-1 text-[10px] text-destructive">{file.error}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
