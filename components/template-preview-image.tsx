"use client"

import { useEffect, useState, type ReactNode } from "react"
import { FileImage } from "lucide-react"
import { cn } from "@/lib/utils"

type PreviewFormat = "png" | "svg" | "fallback"

/**
 * A single template's generated artwork. PNG is preferred for the picker; SVG
 * remains a sharp fallback, followed by a small, accessible placeholder if an
 * asset is missing from an old or partial deployment.
 */
export function TemplatePreviewImage({
  templateId,
  label,
  decorative = false,
  className,
  imageClassName,
  fallback,
  loading = "lazy",
}: {
  templateId: string
  label: string
  decorative?: boolean
  className?: string
  imageClassName?: string
  fallback?: ReactNode
  loading?: "eager" | "lazy"
}) {
  const [format, setFormat] = useState<PreviewFormat>("png")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setFormat("png")
    setIsLoading(true)
  }, [templateId])

  const accessibleLabel = `${label} template preview`

  return (
    <div
      className={cn("relative aspect-[4/3] overflow-hidden rounded-lg bg-muted/40", className)}
      data-testid="template-preview-image"
      data-template-id={templateId}
      aria-busy={isLoading || undefined}
    >
      {isLoading && format !== "fallback" && (
        <div className="absolute inset-0 animate-pulse bg-muted/70" aria-hidden="true" />
      )}
      {format === "fallback" ? (
        fallback ? (
          <div className="absolute inset-0 flex items-center justify-center">{fallback}</div>
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 border border-dashed border-border bg-muted/30 text-muted-foreground"
            role={decorative ? undefined : "img"}
            aria-label={decorative ? undefined : `${accessibleLabel} unavailable`}
            aria-hidden={decorative || undefined}
          >
            <FileImage className="size-5" aria-hidden="true" />
            <span className="text-[10px]">Preview unavailable</span>
          </div>
        )
      ) : (
        <img
          key={`${templateId}.${format}`}
          src={`/template-previews/${templateId}.${format}`}
          alt={decorative ? "" : accessibleLabel}
          aria-hidden={decorative || undefined}
          loading={loading}
          decoding="async"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            if (format === "png") {
              setIsLoading(true)
              setFormat("svg")
            } else {
              setIsLoading(false)
              setFormat("fallback")
            }
          }}
          className={cn("relative z-10 block size-full object-contain", imageClassName)}
        />
      )}
    </div>
  )
}
