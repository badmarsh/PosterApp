"use client"

import { useState } from "react"
import {
  Check,
  Crop,
  Eraser,
  Loader2,
  Sparkles,
  Type,
  Wand2,
  X,
} from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ExtractedAsset } from "@/lib/ingestion"
import { apiFetch } from "@/lib/api-fetch"

const QUICK_OPS: { id: string; label: string; icon: React.ReactNode; filter: string }[] = [
  { id: "remove-bg", label: "Remove background", icon: <Eraser className="size-3" />, filter: "" },
  { id: "upscale", label: "Upscale / sharpen", icon: <Sparkles className="size-3" />, filter: "contrast(1.15) saturate(1.1)" },
  { id: "crop", label: "Crop to subject", icon: <Crop className="size-3" />, filter: "" },
  { id: "caption", label: "Rephrase caption", icon: <Type className="size-3" />, filter: "" },
]

export function FigureEditor({
  asset,
  onClose,
}: {
  asset: ExtractedAsset
  onClose: () => void
}) {
  const updateAssetUrl = useEditor((s) => s.updateAssetUrl)
  const workspaceId = useEditor((s) => s.project.id)
  const [prompt, setPrompt] = useState("")
  const [applying, setApplying] = useState(false)
  const [opError, setOpError] = useState<string | null>(null)
  const [result, setResult] = useState<{ op: string; url: string; checker: boolean } | null>(
    null,
  )

  const isPdf = asset.thumbnailUrl?.toLowerCase().endsWith(".pdf")

  async function runOp(opId: string, filter: string, overridePrompt?: string) {
    const label = overridePrompt || prompt.trim() || opId
    if (!label) return
    setApplying(true)
    setOpError(null)

    let mappedOp = "custom"
    if (opId === "remove-bg") mappedOp = "remove-bg"
    if (opId === "upscale") mappedOp = "upscale"
    if (opId === "crop") mappedOp = "crop-tight"

    try {
      const res = await apiFetch("/api/ingestion/image-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetUrl: asset.thumbnailUrl,
          workspaceId,
          operation: mappedOp,
          prompt: label,
        }),
      })

      if (!res.ok) {
        let errMessage = "Failed to edit image"
        try {
          const errData = await res.json()
          if (errData.error) errMessage = errData.error
        } catch (_) {}
        throw new Error(errMessage)
      }

      const data = await res.json()
      setResult({
        op: label,
        url: data.url,
        checker: mappedOp === "remove-bg",
      })
    } catch (err: unknown) {
      console.error(err)
      setOpError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/40 p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Wand2 className="size-3 text-primary" />
          AI image operations
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close figure editor"
          className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* before / after */}
      <div className="grid grid-cols-2 gap-2">
        <figure className="flex flex-col gap-1">
          {isPdf ? (
            <object
              data={asset.thumbnailUrl}
              type="application/pdf"
              className="h-20 w-full rounded border border-border bg-card object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.thumbnailUrl || "/placeholder.svg"}
              alt="Original extracted figure"
              crossOrigin="anonymous"
              className="h-20 w-full rounded border border-border bg-card object-contain"
            />
          )}
          <figcaption className="text-center font-mono text-[9px] text-muted-foreground">
            Before
          </figcaption>
        </figure>
        <figure className="flex flex-col gap-1">
          <div
            className={cn(
              "relative h-20 w-full overflow-hidden rounded border border-border bg-card",
              result?.checker &&
                "bg-[repeating-conic-gradient(var(--color-muted)_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]",
            )}
          >
            {result ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.url || "/placeholder.svg"}
                alt={`Result after ${result.op}`}
                crossOrigin="anonymous"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-2 text-center text-[9px] text-muted-foreground">
                {applying ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  "Apply an operation to preview the result"
                )}
              </div>
            )}
          </div>
          <figcaption className="text-center font-mono text-[9px] text-muted-foreground">
            After
          </figcaption>
        </figure>
      </div>

      {/* quick ops */}
      <div className="mt-2 flex flex-wrap gap-1">
        {QUICK_OPS.map((op) => (
          <Button
            key={op.id}
            size="xs"
            variant="outline"
            className="h-6 gap-1 px-1.5 text-[10px]"
            disabled={applying || isPdf}
            title={isPdf ? "AI edits are not supported for PDFs" : ""}
            onClick={() => runOp(op.id, op.filter, op.label)}
          >
            {op.icon}
            {op.label}
          </Button>
        ))}
      </div>

      {/* freeform prompt */}
      <div className="mt-2 flex items-center gap-1.5">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runOp("custom", "", prompt)
          }}
          placeholder={isPdf ? "AI edits are not supported for PDF previews." : "Freeform: e.g. enhance contrast, recolor to grayscale…"}
          className="h-7 text-[11px]"
          disabled={applying || isPdf}
        />
        <Button
          size="xs"
          className="h-7 gap-1 px-2 text-[11px]"
          disabled={applying || !prompt.trim() || isPdf}
          onClick={() => runOp("custom", "", prompt)}
        >
          {applying ? <Loader2 className="size-3 animate-spin" /> : "Apply"}
        </Button>
      </div>

      {/* accept / discard */}
      {result && !applying && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2">
          <span className="mr-auto text-[10px] text-muted-foreground">
            Applied <span className="text-foreground">{result.op}</span>
          </span>
          <Button
            size="xs"
            className="h-6 gap-1 px-2 text-[10px]"
            disabled={applying}
            onClick={async () => {
              setApplying(true)
              try {
                const res = await apiFetch("/api/ingestion/image-edit", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ assetUrl: result.url, workspaceId, operation: "accept", originalFilename: asset.filename }),
                })
                if (res.ok) {
                  const data = await res.json()
                  updateAssetUrl(asset.id, data.url)
                  setResult(null)
                  onClose()
                } else throw new Error("Accept failed")
              } catch(err) {
                console.error(err)
              } finally {
                setApplying(false)
              }
            }}
          >
            <Check className="size-3" />
            Accept
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[10px]"
            disabled={applying}
            onClick={() => {
              apiFetch("/api/ingestion/image-edit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assetUrl: result.url, workspaceId, operation: "discard" }),
              }).catch(() => {})
              setResult(null)
            }}
          >
            Discard
          </Button>
        </div>
      )}

      {/* operation error */}
      {opError && !applying && (
        <div className="mt-2 flex items-start gap-1.5 rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">
          <X className="mt-0.5 size-3 shrink-0" />
          <span>{opError}</span>
        </div>
      )}
    </div>
  )
}
