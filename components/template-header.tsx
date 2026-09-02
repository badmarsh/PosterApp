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
        "group relative cursor-pointer select-none transition-all flex flex-col items-center justify-center",
        isHeaderUnlocked 
          ? (isPosterVariant
              ? "border-b-2 border-primary/60 bg-primary/[0.03] shadow-sm px-4 py-2 text-center"
              : "overflow-hidden rounded-md border-2 border-primary/60 bg-primary/[0.03] px-4 py-2 text-center mb-3 shadow-sm")
          : (isPosterVariant
              ? "border-b-2 border-primary/30 bg-gradient-to-b from-muted/60 to-card px-4 py-2 text-center hover:bg-muted/80"
              : "overflow-hidden rounded-md border border-border bg-gradient-to-b from-muted/60 to-card px-4 py-2 text-center shadow-sm hover:border-primary/40 hover:shadow-md mb-3"),
        className
      )}
      title="Click to edit header in right sidebar"
    >
      {/* Header text content */}
      <h2 className="text-balance text-[13px] font-bold leading-tight group-hover:text-primary transition-colors">
        {metadata.title}
      </h2>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {metadata.authors || "No authors set"}
      </p>
      <p className="text-[10px] text-muted-foreground/80">
        {metadata.venue || "No venue / conference set"}
      </p>
    </div>
  )
}
