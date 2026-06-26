"use client"

import { useRef, useState } from "react"
import { RotateCw, Trash2, UploadCloud } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/ingestion"
import {
  MethodBadge,
  ParseStatusBadge,
} from "@/components/ingestion/ingestion-badges"

export function UploadZone() {
  const { ingestFiles, uploadFiles, retryFile, removeFile } = useEditor()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFiles(list: FileList | null) {
    if (!list || !list.length) return
    uploadFiles(
      Array.from(list).map((f) => ({ name: f.name, size: f.size })),
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload PDFs — drag and drop or browse"
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
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50",
        )}
      >
        <UploadCloud
          className={cn(
            "size-5",
            dragging ? "text-primary" : "text-muted-foreground",
          )}
        />
        <p className="text-[12px] font-medium">
          Drop PDFs here or{" "}
          <span className="text-primary underline-offset-2 hover:underline">
            browse
          </span>
        </p>
        <p className="text-[10px] text-muted-foreground">
          Source papers, posters, or reference docs · routed to MinerU / Pandoc
          automatically
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {ingestFiles.length > 0 && (
        <ul className="flex flex-col gap-1.5">
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
                    onClick={() => retryFile(file.id)}
                  >
                    <RotateCw className="size-3.5" />
                  </Button>
                )}
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Remove ${file.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeFile(file.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
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

              {file.status === "failed" && file.error && (
                <p className="mt-1 text-[10px] text-destructive">{file.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
