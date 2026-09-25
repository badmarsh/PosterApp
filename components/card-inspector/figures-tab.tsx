"use client"

import { useRef, useState } from "react"
import { AlertTriangle, Info, Upload, X, XCircle, Sparkles, Loader2 } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { ImageIcon, FolderOpen } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import type { Card } from "@/lib/poster-types"

export function FiguresTab({ card }: { card: Card }) {
  const updateCard = useEditor((s) => s.updateCard)
  const projectId = useEditor((s) => s.project.id)
  const [brokenSlots, setBrokenSlots] = useState<Record<number, boolean>>({})
  const [fixingSlot, setFixingSlot] = useState<number | null>(null)
  const slots =
    card.pattern === "bullets-two-images" || card.pattern === "section-two-figures"
      ? 2
      : card.pattern === "bullets-image" ||
        card.pattern === "image-focused" ||
        card.pattern === "figure-slide" ||
        card.pattern === "section-figure"
        ? 1
        : 0
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])

  function setFigure(i: number, patch: Partial<Card["figures"][number]>) {
    const figures = [...(card.figures || [])]
    for (let j = 0; j < i; j++) {
      if (!figures[j]) {
        figures[j] = {
          // eslint-disable-next-line react-hooks/purity
          id: `fig_${j}_${Date.now().toString(36)}`,
          url: "",
          caption: "",
        }
      }
    }
    figures[i] = {
      // eslint-disable-next-line react-hooks/purity
      id: figures[i]?.id ?? `fig_${i}_${Date.now().toString(36)}`,
      url: figures[i]?.url ?? "",
      caption: figures[i]?.caption ?? "",
      ...patch,
    }
    setBrokenSlots((prev) => ({ ...prev, [i]: false }))
    updateCard(card.id, { figures })
  }

  async function handleAiFix(i: number, fig?: Card["figures"][number]) {
    setFixingSlot(i)
    try {
      const res = await apiFetch(`/api/workspaces/${projectId}/fix-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "figure",
          cardId: card.id,
          figureIndex: i,
          currentUrl: fig?.url,
          caption: fig?.caption,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok && data.fixedUrl) {
        setFigure(i, { url: data.fixedUrl })
        setBrokenSlots((prev) => ({ ...prev, [i]: false }))
        toast.success("Figure reconnected", { description: data.explanation })
      } else {
        toast.error("AI Fix failed", { description: data.error || "No matching asset found in workspace." })
      }
    } catch (err) {
      toast.error("Failed to fix figure asset")
    } finally {
      setFixingSlot(null)
    }
  }

  async function onUpload(i: number, file?: File) {
    if (!file) return
    const blobUrl = URL.createObjectURL(file)
    setFigure(i, { url: blobUrl })
    
    try {
      const formData = new FormData()
      formData.append("file", file)
      
      const res = await fetch(`/api/workspaces/${projectId}/assets/upload`, {
        method: "POST",
        body: formData
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || "Upload failed")
      
      setFigure(i, { url: data.asset.url })
    } catch (err) {
      console.error(err)
      toast.error("Figure upload failed", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
  }

  if (slots === 0) {
    return (
      <div className="p-3">
        <p className="rounded-md border border-dashed border-border bg-muted/40 px-2.5 py-3 text-center text-[11px] text-muted-foreground">
          This block pattern has no figure slots. Choose an image pattern in Basics.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {slots === 2 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
          <span className="text-[11px] text-foreground">Layout</span>
          <Select
            value={card.figureLayout}
            onValueChange={(v) => updateCard(card.id, { figureLayout: v as Card["figureLayout"] })}
          >
            <SelectTrigger size="sm" className="w-36" aria-label="Figure layout">
              <SelectValue>
                {card.figureLayout === "two-up" ? "Two-up figures" : "Single figure"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single figure</SelectItem>
              <SelectItem value="two-up">Two-up figures</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {Array.from({ length: slots }).map((_, i) => {
        const fig = card.figures[i]
        return (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                Slot {i + 1}
              </span>
              {fig?.url && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Clear image"
                  onClick={() => setFigure(i, { url: "" })}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>

            <div className="flex min-h-28 items-center justify-center overflow-hidden rounded border border-dashed border-border bg-muted/40 p-2">
              {fig?.url ? (
                brokenSlots[i] ? (
                  <div className="flex flex-col items-center justify-center gap-2 p-3 text-center w-full">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>Image missing or failed to load</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate max-w-full px-2">
                      {fig.url}
                    </p>
                    <Button
                      size="xs"
                      variant="default"
                      className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs shadow-xs mt-1"
                      disabled={fixingSlot === i}
                      onClick={() => handleAiFix(i, fig)}
                    >
                      {fixingSlot === i ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Sparkles className="size-3 text-warning" />
                      )}
                      AI Fix Figure Reference
                    </Button>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fig.url || "/placeholder.svg"}
                    alt={fig.caption || "figure preview"}
                    className="h-28 w-full object-contain"
                    onError={() => setBrokenSlots((prev) => ({ ...prev, [i]: true }))}
                    onLoad={() => setBrokenSlots((prev) => ({ ...prev, [i]: false }))}
                  />
                )
              ) : (
                <EmptyState
                  icon={ImageIcon}
                  compact
                  variant="inline"
                  title="No figure attached"
                  description="Upload an image file or pick from extracted assets in your project."
                  action={
                    <Button
                      variant="outline"
                      size="xs"
                      className="gap-1 mt-1 text-[11px]"
                      onClick={() => fileRefs.current[i]?.click()}
                    >
                      <Upload className="size-3" /> Upload Figure
                    </Button>
                  }
                  className="border-0 p-1"
                />
              )}
            </div>

            <div className="flex gap-1.5">
              <input
                ref={(el) => {
                  fileRefs.current[i] = el
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUpload(i, e.target.files?.[0])}
              />
              <Button
                variant="outline"
                size="xs"
                className="gap-1"
                onClick={() => fileRefs.current[i]?.click()}
              >
                <Upload className="size-3" /> Upload
              </Button>
              <Input
                aria-label={`Figure ${i + 1} URL`}
                value={fig?.url ?? ""}
                onChange={(e) => setFigure(i, { url: e.target.value })}
                placeholder="or image URL / path"
                className="h-7 flex-1 font-mono text-[11px]"
              />
            </div>
            <Input
              aria-label={`Figure ${i + 1} caption`}
              value={fig?.caption ?? ""}
              onChange={(e) => setFigure(i, { caption: e.target.value })}
              placeholder="Caption"
              className="h-7 text-xs"
            />
          </div>
        )
      })}
    </div>
  )
}

const LEVEL_ICON = {
  error: { Icon: XCircle, className: "text-destructive" },
  warning: { Icon: AlertTriangle, className: "text-chart-4" },
  info: { Icon: Info, className: "text-muted-foreground" },
} as const
