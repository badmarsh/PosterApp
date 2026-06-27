"use client"

import { useEffect, useState, useRef } from "react"
import { useTheme } from "next-themes"
import {
  CheckCircle2,
  Download,
  FileCode2,
  FileStack,
  Sparkles,
  Moon,
  PanelLeft,
  HelpCircle,
  Save,
  Sun,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { HelpModal } from "@/components/help-modal"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  const { project, aiReview, openIngestion, switchProject } = useEditor()
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const projectRef = useRef(project)
  const lastSavedRef = useRef(JSON.stringify(project))

  useEffect(() => {
    projectRef.current = project
  }, [project])

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then(setWorkspaces)
      .catch(() => {})
  }, [])

  const doSave = async (proj: typeof project, isAuto = false) => {
    setSaving(true)
    try {
      const bodyStr = JSON.stringify(proj)
      const res = await fetch(`/api/workspaces/${proj.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      lastSavedRef.current = bodyStr
      if (!isAuto) toast.success("Workspace saved")
    } catch (err) {
      toast.error(`Save failed: ${err}`)
    } finally {
      setSaving(false)
    }
  }

  async function saveProject() {
    await doSave(projectRef.current, false)
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (JSON.stringify(projectRef.current) !== lastSavedRef.current) {
        doSave(projectRef.current, true)
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [])

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

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="h-8 px-2 font-semibold text-sm data-[state=open]:bg-muted"
              >
                {project.name}
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-64">
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => switchProject(ws.id)}
                className={cn(
                  "cursor-pointer",
                  ws.id === project.id &&
                    "bg-primary/10 text-primary focus:bg-primary/15 focus:text-primary font-medium"
                )}
              >
                {ws.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
          {project.templateName}
        </span>
      </div>

      <div className="flex-1" />

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
          onClick={aiReview}
          aria-label="AI Poster review"
        >
          <Sparkles className="size-3.5" />
          <span className="hidden md:inline">AI Poster review</span>
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
                className="size-8"
                onClick={() => setIsHelpOpen(true)}
                aria-label="Help Guide"
              >
                <HelpCircle className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Help Guide</TooltipContent>
        </Tooltip>
      </div>
      <HelpModal open={isHelpOpen} onOpenChange={setIsHelpOpen} />
    </header>
  )
}
