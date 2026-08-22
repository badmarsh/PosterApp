"use client"

import { useEffect, useState } from "react"
import { Cpu, LayoutGrid, PanelsTopLeft, SquarePen } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { EditorProvider, useEditor } from "@/components/editor-store"
import { TopBar } from "@/components/top-bar"
import { ProjectSettingsSidebar } from "@/components/project-settings-sidebar"
import { StructureSidebar } from "@/components/structure-sidebar"
import { PosterPreview } from "@/components/poster-preview"
import { CardInspector } from "@/components/card-inspector"
import { AgentPanel } from "@/components/agent-panel"
import { IngestionDrawer } from "@/components/ingestion/ingestion-drawer"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsDesktop } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { ErrorBoundary } from "@/components/error-boundary"
import { apiFetch } from "@/lib/api-fetch"

type MobilePane = "structure" | "preview" | "editor" | "agent"

// Auth is injected via apiFetch() — see lib/api-fetch.ts

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
        <ErrorBoundary name="Card Inspector">
          <CardInspector />
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

  // When a card gets selected (e.g. from the structure list or preview),
  // bring the editor pane forward automatically.
  useEffect(() => {
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
            <ErrorBoundary name="Card Inspector">
              <CardInspector />
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
          badge={project.cards.length}
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

function WorkspaceSelector({ onSelect, onClose }: { onSelect: (id: string) => void, onClose: () => void }) {
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [isCreating, setIsCreating] = useState(false)
  const [newId, setNewId] = useState("")
  const [newName, setNewName] = useState("")
  const [newTemplate, setNewTemplate] = useState("atlas")
  const [createError, setCreateError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    apiFetch('/api/workspaces')
      .then(async r => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}))
          throw new Error(errData.error || `HTTP ${r.status}`)
        }
        return r.json()
      })
      .then(data => {
        setWorkspaces(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError(String(err))
        setLoading(false)
      })
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(newId)) {
      setCreateError("ID must be 3-32 characters, alphanumeric and dashes only")
      return
    }
    if (!newName.trim()) {
      setCreateError("Name is required")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiFetch('/api/workspaces', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId, name: newName, templateName: newTemplate })
      })
      if (!res.ok) {
         const err = await res.json().catch(() => ({}))
         throw new Error(err.error || `HTTP ${res.status}`)
      }
      onSelect(newId)
    } catch(err) {
      setCreateError(String(err))
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-lg max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          ✕
        </button>
        <h2 className="text-xl font-semibold pr-8">Select a Workspace</h2>
        {error && <p className="text-sm text-destructive">Failed to load workspaces: {error}</p>}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-auto">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => onSelect(ws.id)}
                className="flex flex-col items-start rounded-md border p-3 hover:bg-accent hover:text-accent-foreground text-left"
              >
                <span className="font-medium">{ws.name}</span>
                <span className="text-xs opacity-80">{ws.templateName}</span>
              </button>
            ))}
            {workspaces.length === 0 && !error && (
              <div className="text-sm text-muted-foreground">No workspaces found.</div>
            )}
          </div>
        )}
        
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Create New Project
          </button>
        ) : (
          <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 rounded-md border p-4 bg-muted/30">
            <h3 className="font-medium text-sm">New Workspace</h3>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Workspace ID (slug)</label>
              <input 
                value={newId} 
                onChange={e => setNewId(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-sm"
                placeholder="my-cool-project"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Project Name</label>
              <input 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-sm"
                placeholder="My Cool Project"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Template</label>
              <select 
                value={newTemplate} 
                onChange={e => setNewTemplate(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-sm"
                disabled={isSubmitting}
              >
                <option value="atlas">Atlas</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button 
                type="button" 
                onClick={() => setIsCreating(false)}
                className="px-3 py-1 text-sm rounded hover:bg-accent"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Shell() {
  const { isDesktop, mounted } = useIsDesktop()
  const switchProject = useEditor((s) => s.switchProject)
  const project = useEditor((s) => s.project)
  const isSwitchingProject = useEditor((s) => s.isSwitchingProject)
  const [showSelector, setShowSelector] = useState(false)

  useEffect(() => {
    if (project.id === "prj_lattice") {
      setShowSelector(true)
    }
  }, [project.id])

  if (!mounted) return <AppSkeleton />
  return (
    <>
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

export default function Page() {
  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  )
}
