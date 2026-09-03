"use client"

import { useEffect, useState, useRef } from "react"
import {
  Download,
  FileStack,
  Sparkles,
  PanelLeft,
  HelpCircle,
  Save,
  Check,
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
  Share2,
  Search,
  Settings as SettingsIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HelpModal } from "@/components/help-modal"
import { HistoryPanel } from "@/components/history-panel"
import { UserButton } from "@clerk/nextjs"
import { ManageWorkspaces } from "@/components/manage-workspaces"
import { ShareWorkspaceDialog } from "@/components/share-workspace-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemePicker } from "./theme-picker"
import { SettingsPanel } from "./settings-panel"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { generateFullTemplate } from "@/lib/latex"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-fetch"

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
  const [shareOpen, setShareOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  const compactMode = useEditor((s) => s.compactMode)

  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-2.5 border-b border-border bg-card px-3",
        compactMode ? "h-10" : "h-12"
      )}
    >
      {/* Zone 1: View Toggles — structure panel (left) and LaTeX source */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-8", structureOpen && "text-primary bg-primary/10")}
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
                className={cn("size-8", showLatexSource && "text-primary bg-primary/10")}
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
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Zone 2: Workspace Identity */}
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

      <Separator orientation="vertical" className="h-5 hidden sm:block" />

      {/* Zone 3: Search / Command Palette */}
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
              <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground lg:inline">
                ⌘K
              </kbd>
            </Button>
          }
        />
        <TooltipContent>Command palette</TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      {/* Autosave is OFF — Save sits first from center so it's the shortest reach from the canvas */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant={isDirty ? "default" : "outline"}
              size="sm"
              className={cn("h-8 gap-1.5", isDirty ? "font-medium shadow-xs" : "text-muted-foreground")}
              disabled={!isDirty || isSaving}
              onClick={() => saveProject()}
              aria-label={isDirty ? "Save project changes" : "All changes saved"}
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : isDirty ? (
                <Save className="size-3.5" />
              ) : (
                <Check className="size-3.5 text-chart-3" />
              )}
              <span>{isDirty ? "Save changes" : "Saved"}</span>
            </Button>
          }
        />
        <TooltipContent>{isDirty ? "Save unsaved changes" : "Project is up to date"}</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-5" />

      {/* Zone 4: Document Ingestion & Export Actions */}
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
          onClick={() => setIsScannerOpen(true)}
          aria-label="Scan Image / OCR"
        >
          <Camera className="size-3.5" />
          <span className="hidden md:inline">Scan / OCR</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setIsAcademicSearchOpen(true)}
          aria-label="Academic Search"
        >
          <Sparkles className="size-3.5" />
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
                <Download className="size-3.5" />
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
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Zone 5: Collaboration */}
      <div className="flex items-center gap-1.5">
        <Button
          variant={collabEnabled ? "default" : "outline"}
          size="sm"
          className={cn("h-8 gap-1.5", collabEnabled && "bg-chart-3 hover:bg-chart-3/90 text-primary-foreground")}
          onClick={() => setCollabEnabled(!collabEnabled)}
          aria-label={collabEnabled ? "Live Collaboration enabled" : "Enable Live Collaboration"}
          aria-pressed={collabEnabled}
        >
          <Users className={cn("size-3.5", collabEnabled ? "text-primary-foreground" : "")} />
          <span className="hidden md:inline">Live Collab</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setShareOpen(true)}
          aria-label="Share workspace / manage co-authors"
          title="Share workspace"
        >
          <Share2 className="size-3.5" />
          <span className="hidden lg:inline">Share</span>
        </Button>
        
        {/* Accessible Collaborator Avatar Stack */}
        <div className="flex items-center -space-x-1.5 mr-1" role="group" aria-label="Active collaborators">
          <span className="sr-only">
            {collaborators.length > 0
              ? `${collaborators.length} collaborator${collaborators.length > 1 ? "s" : ""} active`
              : yjsStatus === "connected"
              ? "Connected (solo session)"
              : "Offline"}
          </span>
          {collaborators.map((c) => (
            <Tooltip key={c.clientId}>
              <TooltipTrigger
                render={
                  <div
                    role="img"
                    aria-label={`${c.name} — active now`}
                    className="size-7 rounded-full border-2 border-background flex items-center justify-center text-[11px] text-white font-bold cursor-default select-none shadow-xs"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                }
              />
              <TooltipContent>{c.name} (Active)</TooltipContent>
            </Tooltip>
          ))}
          {yjsStatus === "connected" && collaborators.length === 0 && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <div
                    role="img"
                    aria-label="Connected to Yjs (Solo session)"
                    className="size-7 rounded-full border-2 border-background flex items-center justify-center text-[11px] bg-muted text-muted-foreground font-semibold cursor-default select-none shadow-xs"
                  >
                    1
                  </div>
                }
              />
              <TooltipContent>Connected (Solo session)</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Zone 6: Theme, Help, History, User Account */}
      <div className="flex items-center gap-1">
        <ThemePicker />
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
          <UserButton.MenuItems>
            <UserButton.Action
              label="Settings"
              labelIcon={<SettingsIcon className="h-4 w-4" />}
              onClick={() => setSettingsOpen(true)}
            />
          </UserButton.MenuItems>
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
      <ShareWorkspaceDialog open={shareOpen} onOpenChange={setShareOpen} workspaceId={project.id} workspaceName={project.name} />
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-3xl max-w-[calc(100vw-2rem)] w-[90vw] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
          <div className="border-b border-border bg-muted/20 p-6 pb-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <SettingsIcon className="size-5 text-primary" />
                Settings
              </DialogTitle>
              <DialogDescription className="text-sm">
                Theme, appearance, editor behavior, language, AI models,
                shortcuts and data.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <SettingsPanel />
          </div>
        </DialogContent>
      </Dialog>
      <HistoryPanel />
    </header>
  )
}
