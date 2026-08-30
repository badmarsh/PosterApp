"use client"

import { useEffect, useState, useRef } from "react"
import { useTheme } from "next-themes"
import {
  Download,
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
  Loader2,

  Camera,
  FileArchive,
  Users,

  Search,

} from "lucide-react"
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
  onOpenCommandPalette: () => void
}

export function TopBar({
  structureOpen,
  agentOpen,
  onToggleStructure,
  onToggleAgent,
  onOpenWorkspaceSelector,
  onOpenCommandPalette,
}: TopBarProps) {
  const { project, pushEvent, aiReview, openIngestion, switchProject, switchOutput, autoFillAllCardsAction, convertOutputAction, collaborators, yjsStatus, showLatexSource, toggleLatexSource, isHistoryOpen, setIsHistoryOpen, setIsScannerOpen, setIsAcademicSearchOpen, collabEnabled, setCollabEnabled, duplicateProject, newProject, saveProject, isDirty, isSaving, pdfData } = useEditor(
    useShallow((s) => ({
      project: s.project,
      pushEvent: s.pushEvent,
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
      setIsScannerOpen: s.setIsScannerOpen,
      setIsAcademicSearchOpen: s.setIsAcademicSearchOpen,
      collabEnabled: s.collabEnabled,
      setCollabEnabled: s.setCollabEnabled,
      duplicateProject: s.duplicateProject,
      newProject: s.newProject,
      saveProject: s.saveProject,
      isDirty: s.isDirty,
      isSaving: s.isSaving,
      pdfData: s.pdfData,
    }))
  )
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([])
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const refreshWorkspaces = () => {
    apiFetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => setWorkspaces(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  useEffect(() => {
    refreshWorkspaces()
  }, [project.id])

  function exportTex() {
    const activeOutput = project.outputs?.find(o => o.id === project.activeOutputId) || project.outputs?.[0]
    if (!activeOutput) {
      pushEvent({ kind: "info", status: "error", title: "Export Failed", detail: "No active output found." })
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
    pushEvent({ kind: "info", status: "done", title: `Exported ${activeOutput.outputType}.tex`, detail: "LaTeX source file downloaded." })
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

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-8", showLatexSource && "text-primary")}
              onClick={toggleLatexSource}
              aria-label="Toggle LaTeX Source View"
              aria-pressed={showLatexSource}
            >
              <CodeIcon className="size-4" />
            </Button>
          }
        />
        <TooltipContent>Source code</TooltipContent>
      </Tooltip>

      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
          <LayoutTemplate className="size-4" />
        </div>

        <DropdownMenu onOpenChange={(open) => { if (open) refreshWorkspaces() }}>
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


      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground"
              onClick={onOpenCommandPalette}
              aria-label="Open command palette"
            >
              <Search className="size-3.5" />
              <span className="hidden md:inline">Search actions</span>
              <kbd className="hidden rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground lg:inline">
                ⌘K
              </kbd>
            </Button>
          }
        />
        <TooltipContent>Command palette</TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      {/* Manual Save Button */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 gap-1.5 mr-1", isDirty && "border-primary text-primary")}
              disabled={!isDirty || isSaving}
              onClick={() => saveProject()}
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              ) : (
                <Save className="size-3.5 text-primary" />
              )}
              <span>{isDirty ? "Save changes" : "Saved"}</span>
            </Button>
          }
        />
        <TooltipContent>Save Project</TooltipContent>
      </Tooltip>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={openIngestion}
          aria-label="Ingest source PDFs"
        >
          <FileStack className="size-3.5 text-primary" />
          <span className="hidden md:inline">Ingest</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setIsScannerOpen(true)}
          aria-label="Scan Image / OCR"
        >
          <Camera className="size-3.5 text-primary" />
          <span className="hidden md:inline">Scan / OCR</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setIsAcademicSearchOpen(true)}
          aria-label="Academic Search"
        >
          <Sparkles className="size-3.5 text-primary" />
          <span className="hidden md:inline">Academic</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                aria-label="Export options"
              >
                <Download className="size-3.5 text-primary" />
                <span className="hidden md:inline">Export</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => window.open(`/api/workspaces/${project.id}/export`, "_blank")}
              className="cursor-pointer gap-2 py-2"
            >
              <FileArchive className="size-4 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold text-xs text-foreground">Overleaf &amp; LaTeX ZIP</span>
                <span className="text-[10px] text-muted-foreground">main.tex + .bib + assets folder</span>
              </div>
            </DropdownMenuItem>
            {pdfData && (
              <DropdownMenuItem
                onClick={() => {
                  const blob = new Blob([pdfData], { type: "application/pdf" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `${project.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.pdf`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="cursor-pointer gap-2 py-2"
              >
                <FileText className="size-4 text-primary" />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs text-foreground">Download PDF</span>
                  <span className="text-[10px] text-muted-foreground">Latest compiled preview</span>
                </div>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant={collabEnabled ? "default" : "outline"}
          size="sm"
          className={cn("h-8 gap-1.5 mx-1", collabEnabled ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "")}
          onClick={() => setCollabEnabled(!collabEnabled)}
        >
          <Users className={cn("size-3.5", collabEnabled ? "text-white" : "text-primary")} />
          <span className="hidden md:inline">Live Collab</span>
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
