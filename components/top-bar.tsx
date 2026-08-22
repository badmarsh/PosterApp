"use client"

import { useEffect, useState, useRef } from "react"
import { useTheme } from "next-themes"
import {
  Download,
  FileCode2,
  FileStack,
  Sparkles,
  Moon,
  PanelLeft,
  HelpCircle,
  Save,
  Sun,
  FolderOpen,
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { generateFullTemplate } from "@/lib/latex"
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
  onOpenWorkspaceSelector: () => void
}

export function TopBar({
  structureOpen,
  agentOpen,
  onToggleStructure,
  onToggleAgent,
  onOpenWorkspaceSelector,
}: TopBarProps) {
  const { project, aiReview, openIngestion, switchProject, autoFillAllCardsAction } = useEditor(
    useShallow((s) => ({
      project: s.project,
      aiReview: s.aiReview,
      openIngestion: s.openIngestion,
      switchProject: s.switchProject,
      autoFillAllCardsAction: s.autoFillAllCardsAction,
    }))
  )
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
      .then((data) => setWorkspaces(Array.isArray(data) ? data : []))
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
    const t = setTimeout(() => {
      if (JSON.stringify(project) !== lastSavedRef.current) {
        doSave(project, true)
      }
    }, 2000)
    return () => clearTimeout(t)
  }, [project])



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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenWorkspaceSelector} className="cursor-pointer">
              View all workspaces...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button 
                variant="ghost" 
                size="icon" 
                className="size-6 text-muted-foreground ml-1" 
                onClick={onOpenWorkspaceSelector}
                aria-label="Switch workspace"
              >
                <FolderOpen className="size-3" />
              </Button>
            }
          />
          <TooltipContent>Switch workspace</TooltipContent>
        </Tooltip>

        <span className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
          {project.templateName}
        </span>
      </div>

      <div className="flex-1" />



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
          className="h-8 gap-1.5 bg-blue-50/50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
          onClick={autoFillAllCardsAction}
          aria-label="Generate All Cards"
        >
          <Sparkles className="size-3.5" />
          <span className="hidden md:inline">Generate All</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={aiReview}
          aria-label="AI Poster review"
        >
          <Sparkles className="size-3.5" />
          <span className="hidden md:inline">AI Review</span>
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
