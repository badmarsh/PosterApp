"use client"

import { ChevronDown, Loader2, Play, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { OutputType } from "@/lib/output-types"
import { useEditor } from "@/components/editor-store"
import { getUiCopy } from "@/lib/i18n/ui"

export function PreviewToolbar({
  format,
  compiling,
  autoCompile,
  compileOk,
  onCompile,
  onSetAutoCompile,
}: {
  format: OutputType
  compiling: boolean
  autoCompile: boolean
  compileOk: boolean | null
  onCompile: (format: OutputType) => void
  onSetAutoCompile: (enabled: boolean) => void
}) {
  const copy = getUiCopy(useEditor((state) => state.language))
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-card px-3">
      <span className="text-[12px] font-semibold text-foreground">{copy.structure}</span>
      <div className="flex h-7 items-center overflow-hidden rounded border border-border bg-card shadow-sm">
        <Button
          type="button"
          variant="ghost"
          disabled={compiling && !autoCompile}
          onClick={() => autoCompile ? onSetAutoCompile(false) : onCompile(format)}
          className={cn("h-full rounded-none gap-1.5 px-3 text-[11px] font-semibold", autoCompile ? "bg-primary/10 text-primary" : "text-foreground", !autoCompile && compileOk === true && "text-success", !autoCompile && compileOk === false && "text-destructive")}
        >
          {autoCompile ? <RefreshCw className={cn("size-3", compiling && "animate-spin")} /> : compiling ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
          {autoCompile ? copy.livePreview : copy.compile}
        </Button>
        <div className="h-full w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="ghost" className="h-full rounded-none px-1.5 text-muted-foreground" disabled={compiling} />} aria-label="Preview compile options">
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onSetAutoCompile(true)} className="gap-2"><RefreshCw className="size-3" />{copy.livePreview}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetAutoCompile(false)} className="gap-2"><Play className="size-3" />{copy.manualCompile}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
