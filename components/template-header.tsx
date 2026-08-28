"use client"

import { Lock, Unlock, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { cn } from "@/lib/utils"
import { resolveOutputMetadata } from "@/lib/poster-types"
import type { OutputType } from "@/lib/output-types"

interface TemplateHeaderProps {
  variant?: OutputType
  className?: string
}

export function TemplateHeader({ variant = "poster", className }: TemplateHeaderProps) {
  const {
    project,
    selectCard,
    isHeaderUnlocked,
    setHeaderUnlocked,
  } = useEditor(
    useShallow((s) => ({
      project: s.project,
      selectCard: s.selectCard,
      isHeaderUnlocked: s.isHeaderUnlocked,
      setHeaderUnlocked: s.setHeaderUnlocked,
    }))
  )

  const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)
  const metadata = resolveOutputMetadata(project, activeOutput)

  const isPosterVariant = variant === "poster"

  const handleUnlock = () => {
    selectCard(null)
    setHeaderUnlocked(true)
  }

  const handleLock = (e: React.MouseEvent) => {
    e.stopPropagation()
    setHeaderUnlocked(false)
  }

  if (isHeaderUnlocked) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleUnlock}
        className={cn(
          "group relative cursor-pointer select-none transition-all border-2 border-primary/60 bg-primary/[0.03] shadow-sm",
          isPosterVariant
            ? "border-b-2 border-primary/60 px-4 py-3.5 text-center"
            : "overflow-hidden rounded-md border border-primary/60 px-4 py-3.5 text-center mb-3",
          className
        )}
        title="Editing template header in right sidebar"
      >
        {/* Top row: badge + lock button */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-primary">
              <Unlock className="size-2.5" />
              Template Header — Unlocked
            </span>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              (Editing in right sidebar)
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1 bg-background hover:bg-muted text-foreground border-border"
            onClick={handleLock}
          >
            <Lock className="size-2.5" />
            Lock Header
          </Button>
        </div>

        {/* Content preview */}
        <h2 className="text-balance text-[13px] font-bold leading-tight text-foreground">
          {metadata.title}
        </h2>
        {metadata.authors && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {metadata.authors}
          </p>
        )}
        {metadata.venue && (
          <p className="text-[9px] text-muted-foreground/80">
            {metadata.venue}
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleUnlock}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleUnlock()
        }
      }}
      className={cn(
        "group relative cursor-pointer select-none transition-all",
        isPosterVariant
          ? "border-b-2 border-primary/30 bg-gradient-to-b from-muted/60 to-card px-4 py-3 text-center hover:bg-muted/80"
          : "overflow-hidden rounded-md border border-border bg-gradient-to-b from-muted/60 to-card px-4 py-3.5 text-center shadow-sm hover:border-primary/40 hover:shadow-md mb-3",
        className
      )}
      title="Click to unlock and edit header & operations in right sidebar"
    >
      {/* Top row: badge + quick indicator */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center gap-1 rounded border border-border bg-muted/80 px-1.5 py-px font-mono text-[9px] uppercase tracking-wide text-muted-foreground group-hover:border-primary/40 group-hover:text-foreground transition-colors">
            <Lock className="size-2.5" />
            template header — locked
          </div>
        </div>

        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <Pencil className="size-2.5" />
          Click to unlock & edit
        </span>
      </div>

      {/* Header text content */}
      <h2 className="text-balance text-[13px] font-bold leading-tight group-hover:text-primary transition-colors">
        {metadata.title}
      </h2>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {metadata.authors || "No authors set"}
      </p>
      <p className="text-[9px] text-muted-foreground/80">
        {metadata.venue || "No venue / conference set"}
      </p>
    </div>
  )
}
