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
  const { applyFigureOp } = useEditor()
  const [prompt, setPrompt] = useState("")
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<{ op: string; filter: string; checker: boolean } | null>(
    null,
  )

  async function runOp(op: string, filter: string) {
    const label = op || prompt.trim()
    if (!label) return
    setApplying(true)
    await applyFigureOp(asset.id, label)
    setApplying(false)
    setResult({
      op: label,
      filter: filter || "contrast(1.08) brightness(1.03)",
      checker: op === "remove-bg",
    })
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
          <img
            src={asset.thumbnailUrl || "/placeholder.svg"}
            alt="Original extracted figure"
            crossOrigin="anonymous"
            className="h-20 w-full rounded border border-border bg-card object-contain"
          />
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
              <img
                src={asset.thumbnailUrl || "/placeholder.svg"}
                alt={`Result after ${result.op}`}
                crossOrigin="anonymous"
                className="h-full w-full object-contain"
                style={{ filter: result.filter }}
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
            disabled={applying}
            onClick={() => runOp(op.label, op.filter)}
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
            if (e.key === "Enter") runOp("", "")
          }}
          placeholder="Freeform: e.g. enhance contrast, recolor to grayscale…"
          className="h-7 text-[11px]"
          disabled={applying}
        />
        <Button
          size="xs"
          className="h-7 gap-1 px-2 text-[11px]"
          disabled={applying || !prompt.trim()}
          onClick={() => runOp("", "")}
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
            onClick={() => {
              setResult(null)
              onClose()
            }}
          >
            <Check className="size-3" />
            Accept
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() => setResult(null)}
          >
            Discard
          </Button>
        </div>
      )}
    </div>
  )
}
