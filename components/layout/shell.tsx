"use client"

import { useEffect, useState } from "react"
import { Cpu, LayoutGrid, PanelsTopLeft, SquarePen } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { useEditor } from "@/components/editor-store"
import { TopBar } from "@/components/top-bar"
import { ProjectSettingsSidebar } from "@/components/project-settings-sidebar"
import { StructureSidebar } from "@/components/structure-sidebar"
import { PosterPreview } from "@/components/poster-preview"
import { RightSidebar } from "@/components/right-sidebar"
import { AgentPanel } from "@/components/agent-panel"
import { IngestionDrawer } from "@/components/ingestion/ingestion-drawer"
import { CollaboratorsLayer } from "@/components/collaborators-layer"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsDesktop } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { ErrorBoundary } from "@/components/error-boundary"
import { WorkspaceSelector } from "@/components/workspace-selector"

type MobilePane = "structure" | "preview" | "editor" | "agent"

function DesktopShell({ onOpenWorkspaceSelector }: { onOpenWorkspaceSelector: () => void }) {
  const [structureOpen, setStructureOpen] = useState(true)
  const [agentOpen, setAgentOpen] = useState(true)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar
        structureOpen={structureOpen}
        agentOpen={agentOpen}
        onToggleStructure={() => setStructureOpen((v) => !v)}
        onToggleAgent={() => setAgentOpen((v) => !v)}
        onOpenWorkspaceSelector={onOpenWorkspaceSelector}
      />
      <div className="flex min-h-0 flex-1">
        {structureOpen ? (
          <ErrorBoundary name="Project Settings Sidebar">
            <ProjectSettingsSidebar />
          </ErrorBoundary>
        ) : null}
        <main className="flex min-w-0 flex-1 flex-col">
          <ErrorBoundary name="Poster Preview">
            <PosterPreview />
          </ErrorBoundary>
        </main>
        <ErrorBoundary name="Right Sidebar">
          <RightSidebar />
        </ErrorBoundary>
        {agentOpen ? (
          <ErrorBoundary name="Agent Panel">
            <AgentPanel />
          </ErrorBoundary>
        ) : null}
      </div>
    </div>
  )
}

function MobileNavButton({
  active,
  label,
  badge,
  pulse,
  onClick,
  children,
}: {
  active: boolean
  label: string
  badge?: number
  pulse?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="relative">
        {children}
        {pulse && (
          <span className="absolute -right-1 -top-0.5 size-1.5 animate-pulse rounded-full bg-primary" />
        )}
        {!pulse && badge ? (
          <span className="absolute -right-2 -top-1 min-w-3.5 rounded-full bg-muted px-1 text-center font-mono text-[8px] leading-[14px] text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
    </button>
  )
}

function MobileShell({ onOpenWorkspaceSelector }: { onOpenWorkspaceSelector: () => void }) {
  const { selectedCardId, project, agentEvents, isSwitchingProject, generatingId } = useEditor(
    useShallow((s) => ({
      selectedCardId: s.selectedCardId,
      project: s.project,
      agentEvents: s.agentEvents,
      isSwitchingProject: s.isSwitchingProject,
      generatingId: s.generatingId,
    }))
  )
  const busy = isSwitchingProject || generatingId !== null
  const [pane, setPane] = useState<MobilePane>("preview")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedCardId) setPane("editor")
  }, [selectedCardId])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar
        structureOpen={false}
        agentOpen={false}
        onToggleStructure={() => setPane("structure")}
        onToggleAgent={() => setPane("agent")}
        onOpenWorkspaceSelector={onOpenWorkspaceSelector}
      />
      <div className="relative min-h-0 flex-1">
        <div key={pane} className="absolute inset-0 flex animate-in fade-in duration-200">
          {pane === "structure" && (
            <ErrorBoundary name="Structure Sidebar">
              <StructureSidebar />
            </ErrorBoundary>
          )}
          {pane === "preview" && (
            <main className="flex min-w-0 flex-1 flex-col">
              <ErrorBoundary name="Poster Preview">
                <PosterPreview />
              </ErrorBoundary>
            </main>
          )}
          {pane === "editor" && (
            <ErrorBoundary name="Right Sidebar">
              <RightSidebar />
            </ErrorBoundary>
          )}
          {pane === "agent" && (
            <ErrorBoundary name="Agent Panel">
              <AgentPanel />
            </ErrorBoundary>
          )}
        </div>
      </div>
      <nav
        aria-label="Editor sections"
        className="flex shrink-0 items-stretch gap-1 border-t border-border bg-card px-2 py-1"
      >
        <MobileNavButton
          active={pane === "structure"}
          label="Structure"
          badge={(project.outputs?.find((o) => o.id === project.activeOutputId)?.cards || []).length}
          onClick={() => setPane("structure")}
        >
          <PanelsTopLeft className="size-5" />
        </MobileNavButton>
        <MobileNavButton
          active={pane === "preview"}
          label="Preview"
          onClick={() => setPane("preview")}
        >
          <LayoutGrid className="size-5" />
        </MobileNavButton>
        <MobileNavButton
          active={pane === "editor"}
          label="Editor"
          onClick={() => setPane("editor")}
        >
          <SquarePen className="size-5" />
        </MobileNavButton>
        <MobileNavButton
          active={pane === "agent"}
          label="Agent"
          badge={agentEvents.length}
          pulse={busy}
          onClick={() => setPane("agent")}
        >
          <Cpu className="size-5" />
        </MobileNavButton>
      </nav>
    </div>
  )
}

function AppSkeleton() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
        <Skeleton className="size-7 rounded" />
        <Skeleton className="h-4 w-40" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-72 shrink-0 flex-col gap-2 border-r border-border bg-sidebar p-3 lg:flex">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            Loading editor…
          </div>
        </div>
      </div>
    </div>
  )
}

export function Shell() {
  const { isDesktop, mounted } = useIsDesktop()
  const switchProject = useEditor((s) => s.switchProject)
  const project = useEditor((s) => s.project)
  const isSwitchingProject = useEditor((s) => s.isSwitchingProject)
  const lastWorkspaceId = useEditor((s) => s.lastWorkspaceId)
  
  const [showSelector, setShowSelector] = useState(false)
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false)

  // Autosave Hook
  const agentEvents = useEditor((s) => s.agentEvents)
  const chatMessages = useEditor((s) => s.chatMessages)
  const saveProject = useEditor((s) => s.saveProject)
  const isDirty = useEditor((s) => s.isDirty)
  
  useEffect(() => {
    // Only autosave if the project is loaded and we are not in the middle of a switch
    if (isSwitchingProject || !project.id || project.id === "prj_lattice") return
    if (!isDirty) return

    const timer = setTimeout(() => {
      saveProject()
    }, 3000)

    return () => clearTimeout(timer)
  }, [project, agentEvents, chatMessages, isSwitchingProject, saveProject, isDirty])

  useEffect(() => {
    if (!hasAutoLoaded) {
      if (lastWorkspaceId && lastWorkspaceId !== "prj_lattice") {
        switchProject(lastWorkspaceId)
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowSelector(true)
      }
      setHasAutoLoaded(true)
    } else if (project.id === "prj_lattice" && !isSwitchingProject) {
      setShowSelector(true)
    }
  }, [project.id, lastWorkspaceId, hasAutoLoaded, isSwitchingProject, switchProject])

  if (!mounted) return <AppSkeleton />
  return (
    <>
      <CollaboratorsLayer />
      {!isSwitchingProject && showSelector && (
        <WorkspaceSelector onSelect={(id) => { switchProject(id); setShowSelector(false) }} onClose={() => setShowSelector(false)} />
      )}
      {isDesktop ? <DesktopShell onOpenWorkspaceSelector={() => setShowSelector(true)} /> : <MobileShell onOpenWorkspaceSelector={() => setShowSelector(true)} />}
      <ErrorBoundary name="Ingestion Drawer">
        <IngestionDrawer />
      </ErrorBoundary>
    </>
  )
}
