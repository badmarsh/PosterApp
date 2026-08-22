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
  Folders,
  LayoutTemplate,
  FileText,
  CodeIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { HelpModal } from "@/components/help-modal"
import { UserButton } from "@clerk/nextjs"
import { ManageWorkspaces } from "@/components/manage-workspaces"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { generateFullTemplate } from "@/lib/latex"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-fetch"

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const { project, aiReview, openIngestion, switchProject, switchOutput, autoFillAllCardsAction, convertOutputAction, collaborators, yjsStatus, showLatexSource, toggleLatexSource } = useEditor(
    useShallow((s) => ({
      project: s.project,
      aiReview: s.aiReview,
      openIngestion: s.openIngestion,
      switchProject: s.switchProject,
      switchOutput: s.switchOutput,
      autoFillAllCardsAction: s.autoFillAllCardsAction,
      convertOutputAction: s.convertOutputAction,
      collaborators: s.collaborators,
      yjsStatus: s.yjsStatus,
      showLatexSource: s.showLatexSource,
      toggleLatexSource: s.toggleLatexSource,
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
    apiFetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => setWorkspaces(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const doSave = async (proj: typeof project, isAuto = false) => {
    setSaving(true)
    try {
      const bodyStr = JSON.stringify(proj)
      const res = await apiFetch(`/api/workspaces/${proj.id}`, {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project])



  function exportTex() {
    const activeOutput = project.outputs?.find(o => o.id === project.activeOutputId) || project.outputs?.[0]
    if (!activeOutput) {
      toast.error("No active output")
      return
    }
    const tex = generateFullTemplate(project, activeOutput, project.id)
    const blob = new Blob([tex], { type: "text/x-tex" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${project.id}_${activeOutput.outputType}.tex`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${activeOutput.outputType}.tex`)
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

        {project.outputs && project.outputs.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden h-6 rounded px-2 py-0 text-[10px] font-mono text-muted-foreground lg:flex"
                >
                  {project.outputs.find((o) => o.id === project.activeOutputId)?.outputType || "Output"}
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              {project.outputs.map((o) => (
                <DropdownMenuItem
                  key={o.id}
                  onClick={() => switchOutput(o.id)}
                  className={cn("text-xs cursor-pointer", o.id === project.activeOutputId && "font-bold text-primary")}
                >
                  <span className="uppercase w-16 inline-block">{o.outputType}</span>
                  <span className="text-muted-foreground ml-2">{o.title}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs cursor-pointer px-2 py-1.5 flex items-center justify-between">
                  Convert Output...
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => convertOutputAction(project.activeOutputId, "poster")}>To Poster</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => convertOutputAction(project.activeOutputId, "slides")}>To Slides</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => convertOutputAction(project.activeOutputId, "paper")}>To Paper</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="sm"
                className="h-8 gap-1.5"
                aria-label="Export as .tex file"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Export .tex</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => exportTex()}>
                    <FileCode2 className="mr-2 size-4 text-muted-foreground" />
                    Export .tex
                  </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant={showLatexSource ? "default" : "outline"}
          size="sm"
          className={cn("h-8 gap-1.5", showLatexSource ? "bg-primary/20 text-primary hover:bg-primary/30" : "")}
          onClick={toggleLatexSource}
          aria-label="Toggle LaTeX Source View"
        >
          <CodeIcon className="size-3.5" />
          <span className="hidden sm:inline">Source</span>
        </Button>
        
        <div className="flex -space-x-2 mr-2">
          {collaborators.map(c => (
            <div key={c.clientId} className="size-8 rounded-full border-2 border-background flex items-center justify-center text-xs text-white font-bold" style={{ backgroundColor: c.color }} title={c.name}>
              {c.name.charAt(0)}
            </div>
          ))}
          {yjsStatus === "connected" && collaborators.length === 0 && (
             <div className="size-8 rounded-full border-2 border-background flex items-center justify-center text-xs bg-muted text-muted-foreground font-semibold" title="Connected to Yjs (Solo)">
               1
             </div>
          )}
          {yjsStatus !== "connected" && (
             <div className="size-8 rounded-full border-2 border-background flex items-center justify-center text-xs bg-destructive text-destructive-foreground font-semibold animate-pulse" title="Yjs Offline">
               !
             </div>
          )}
        </div>

        <ThemeToggle />
        <UserButton>
          <UserButton.UserProfilePage 
            label="Manage Workspaces" 
            url="workspaces" 
            labelIcon={<Folders className="h-4 w-4" />}
          >
            <ManageWorkspaces />
          </UserButton.UserProfilePage>
        </UserButton>
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
