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
  Clock,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { HelpModal } from "@/components/help-modal"
import { HistoryPanel } from "@/components/history-panel"
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
  const { project, aiReview, openIngestion, switchProject, switchOutput, autoFillAllCardsAction, convertOutputAction, collaborators, yjsStatus, showLatexSource, toggleLatexSource, isHistoryOpen, setIsHistoryOpen, collabEnabled, setCollabEnabled, duplicateProject, newProject } = useEditor(
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
      isHistoryOpen: s.isHistoryOpen,
      setIsHistoryOpen: s.setIsHistoryOpen,
      collabEnabled: s.collabEnabled,
      setCollabEnabled: s.setCollabEnabled,
      duplicateProject: s.duplicateProject,
      newProject: s.newProject,
    }))
  )
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([])
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  useEffect(() => {
    apiFetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => setWorkspaces(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])


  // NOTE: Autosave is owned exclusively by shell.tsx (3-second debounce).
  // A duplicate timer was removed from here to prevent race conditions where
  // two simultaneous saves could cause the isDirty flag to be cleared incorrectly.


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
                title="Switch workspace"
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
            <DropdownMenuItem onClick={duplicateProject} className="cursor-pointer">
              Duplicate workspace
            </DropdownMenuItem>
            <DropdownMenuItem onClick={newProject} className="cursor-pointer">
              New workspace
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenWorkspaceSelector} className="cursor-pointer">
              View all workspaces...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
        <Button
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => exportTex()}
          aria-label="Export as .tex file"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Export .tex</span>
        </Button>

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

        <Button
          variant={collabEnabled ? "default" : "outline"}
          size="sm"
          className={cn("h-8 gap-1.5 mx-2", collabEnabled ? "bg-green-600 hover:bg-green-700 text-white" : "text-muted-foreground")}
          onClick={() => setCollabEnabled(!collabEnabled)}
        >
          Live Collab {collabEnabled ? "ON" : "OFF"}
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
        </div>

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
        
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-8", isHistoryOpen && "text-primary bg-primary/10")}
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                aria-label="Save History"
              >
                <Clock className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Save History</TooltipContent>
        </Tooltip>

        <UserButton>
          <UserButton.UserProfilePage 
            label="Manage Workspaces" 
            url="workspaces" 
            labelIcon={<Folders className="h-4 w-4" />}
          >
            <ManageWorkspaces />
          </UserButton.UserProfilePage>
        </UserButton>
      </div>
      <HelpModal open={isHelpOpen} onOpenChange={setIsHelpOpen} />
      <HistoryPanel />
    </header>
  )
}
