"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import {
  CheckCircle2,
  Download,
  FileCode2,
  FileStack,
  ListChecks,
  Moon,
  PanelLeft,
  PanelRight,
  Save,
  Sun,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEditor } from "@/components/editor-store"
import { generateFullTemplate, levelFromMessages, validateCard } from "@/lib/latex"
import { cn } from "@/lib/utils"

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = resolvedTheme === "dark"
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {mounted && isDark ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        }
      />
      <TooltipContent>Toggle theme</TooltipContent>
    </Tooltip>
  )
}

type TopBarProps = {
  structureOpen: boolean
  agentOpen: boolean
  onToggleStructure: () => void
  onToggleAgent: () => void
}

export function TopBar({
  structureOpen,
  agentOpen,
  onToggleStructure,
  onToggleAgent,
}: TopBarProps) {
  const { project, validateAll, openIngestion, switchProject } = useEditor()
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then(setWorkspaces)
      .catch(() => {})
  }, [])

  async function saveProject() {
    setSaving(true)
    try {
      const res = await fetch(`/api/workspaces/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("Workspace saved")
    } catch (err) {
      toast.error(`Save failed: ${err}`)
    } finally {
      setSaving(false)
    }
  }

  const counts = project.cards.reduce(
    (acc, c) => {
      const lvl = levelFromMessages(validateCard(c))
      acc[lvl] += 1
      return acc
    },
    { valid: 0, warning: 0, invalid: 0 },
  )
  const overall =
    counts.invalid > 0 ? "invalid" : counts.warning > 0 ? "warning" : "valid"
  const overallStyles = {
    valid: "text-chart-3",
    warning: "text-chart-4",
    invalid: "text-destructive",
  }[overall]

  function exportTex() {
    const tex = generateFullTemplate(project)
    const blob = new Blob([tex], { type: "text/x-tex" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${project.id}.tex`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported poster.tex")
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-8", structureOpen && "text-primary")}
              onClick={onToggleStructure}
              aria-label="Toggle structure panel"
              aria-pressed={structureOpen}
            >
              <PanelLeft className="size-4" />
            </Button>
          }
        />
        <TooltipContent>Structure panel</TooltipContent>
      </Tooltip>

      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded bg-primary text-primary-foreground">
          <FileCode2 className="size-4" />
        </div>
        <div className="leading-none">
          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">
              Poster Block Studio
            </span>
            <span className="hidden rounded border border-border bg-muted px-1 py-px font-mono text-[10px] text-muted-foreground lg:inline">
              {project.templateName}
            </span>
          </div>
        </div>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {project.name}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {project.posterTitle}
        </p>
      </div>

      <div
        className={cn(
          "hidden items-center gap-1.5 rounded border border-border bg-muted px-2 py-1 font-mono text-[11px] md:flex",
          overallStyles,
        )}
      >
        <CheckCircle2 className="size-3.5" />
        <span className="text-foreground">
          {counts.valid} ok · {counts.warning} warn · {counts.invalid} err
        </span>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={openIngestion}
          aria-label="Ingest source PDFs"
        >
          <FileStack className="size-3.5" />
          <span className="hidden md:inline">Ingest</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={saveProject}
          disabled={saving}
          aria-label="Save project"
        >
          <Save className="size-3.5" />
          <span className="hidden md:inline">{saving ? "Saving…" : "Save"}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={validateAll}
          aria-label="Validate all cards"
        >
          <ListChecks className="size-3.5" />
          <span className="hidden md:inline">Validate all</span>
        </Button>
        <Button
          size="sm"
          className="h-8 gap-1.5"
          onClick={exportTex}
          aria-label="Export poster as .tex file"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Export .tex</span>
        </Button>
        <ThemeToggle />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-8", agentOpen && "text-primary")}
                onClick={onToggleAgent}
                aria-label="Toggle agent panel"
                aria-pressed={agentOpen}
              >
                <PanelRight className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Agent activity</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
