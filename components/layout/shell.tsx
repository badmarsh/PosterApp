"use client"

import { useEffect, useState } from "react"
import { Cpu, LayoutGrid, PanelsTopLeft, SquarePen } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { useEditor, useEditorStoreInstance } from "@/components/editor-store"
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

import { EquationRegistryDialog } from "@/components/equation-registry-dialog"
import { ImageOcrDialog } from "@/components/scanner/image-ocr-dialog"
import { BibliographyDialog } from "@/components/bibliography-dialog"
import { AcademicSearchDialog } from "@/components/academic-search-dialog"

import { CommandPalette } from "@/components/command-palette"
import { ThesisReviewStoreProvider } from "@/components/thesis-review/thesis-review-provider"
import { DEMO_PROJECT_ID } from "@/lib/mock-data"


type MobilePane = "structure" | "preview" | "editor" | "agent"

function DesktopShell({ onOpenWorkspaceSelector }: { onOpenWorkspaceSelector: () => void }) {
  const [structureOpen, setStructureOpen] = useState(true)
  const [agentOpen, setAgentOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const editorStore = useEditorStoreInstance()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault()
        void editorStore.getState().saveProject()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === "TEXTAREA" || target.isContentEditable)) return
        e.preventDefault()
        void editorStore.getState().compileProject()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [editorStore])

  const isThesisReview = useEditor((s) => {
    const o = s.project.outputs?.find((o) => o.id === s.project.activeOutputId)
    return o?.outputType === "thesis-review"
  })
  const reviewOutputKey = useEditor((s) => {
    const o = s.project.outputs?.find((o) => o.id === s.project.activeOutputId)
    return o?.outputType === "thesis-review" ? `${s.project.id}:${o.id}` : null
  })

  return (
    <ThesisReviewStoreProvider outputKey={reviewOutputKey}>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <TopBar
          structureOpen={structureOpen}
          agentOpen={agentOpen}
          onToggleStructure={() => setStructureOpen((v) => !v)}
          onToggleAgent={() => setAgentOpen((v) => !v)}
          onOpenWorkspaceSelector={onOpenWorkspaceSelector}
          onOpenCommandPalette={() => setPaletteOpen(true)}
        />
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          onToggleStructure={() => setStructureOpen((v) => !v)}
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
          {!isThesisReview ? (
            <ErrorBoundary name="Right Sidebar">
              <RightSidebar />
            </ErrorBoundary>
          ) : null}
          {/* Always mounted — using CSS width-0 to hide rather than unmounting, so the
              RightSidebar / PdfViewer ResizeObserver is not triggered by layout reflow.
              Conditionally unmounting caused the PDF to re-render with incorrect containerWidth. */}
          <ErrorBoundary name="Agent Panel">
            <div style={{ display: agentOpen && !isThesisReview ? "contents" : "none" }}>
              <AgentPanel />
            </div>
          </ErrorBoundary>
        </div>
      </div>
    </ThesisReviewStoreProvider>
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
          <span className="absolute -right-2 -top-1 min-w-3.5 rounded-full bg-muted px-1 text-center font-mono text-[9px] leading-[14px] text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
    </button>
  )
}

function MobileShell({ onOpenWorkspaceSelector }: { onOpenWorkspaceSelector: () => void }) {
  const { selectedCardId, project, agentEvents, isSwitchingProject, generatingIds } = useEditor(
    useShallow((s) => ({
      selectedCardId: s.selectedCardId,
      project: s.project,
      agentEvents: s.agentEvents,
      isSwitchingProject: s.isSwitchingProject,
      generatingIds: s.generatingIds,
    }))
  )
  const busy = isSwitchingProject || generatingIds.length > 0
  const [pane, setPane] = useState<MobilePane>("preview")
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    if (selectedCardId) setPane("editor")
  }, [selectedCardId])

  const reviewOutputKey = useEditor((s) => {
    const o = s.project.outputs?.find((o) => o.id === s.project.activeOutputId)
    return o?.outputType === "thesis-review" ? `${s.project.id}:${o.id}` : null
  })

  return (
    <ThesisReviewStoreProvider outputKey={reviewOutputKey}>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar
        structureOpen={pane === "structure"}
        agentOpen={pane === "agent"}
        onToggleStructure={() => setPane(pane === "structure" ? "preview" : "structure")}
        onToggleAgent={() => setPane(pane === "agent" ? "preview" : "agent")}
        onOpenWorkspaceSelector={onOpenWorkspaceSelector}
        onOpenCommandPalette={() => setPaletteOpen(true)}
      />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onToggleStructure={() => setPane("structure")}
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
    </ThesisReviewStoreProvider>
  )
}

export function AppSkeleton() {
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
  const isAcademicSearchOpen = useEditor((s) => s.isAcademicSearchOpen)
  const setIsAcademicSearchOpen = useEditor((s) => s.setIsAcademicSearchOpen)

  const [showSelector, setShowSelector] = useState(false)
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false)

  // Autosave is off by design; warn before the tab closes with unsaved edits.
  const isDirty = useEditor((s) => s.isDirty)
  const isSaving = useEditor((s) => s.isSaving)
  useEffect(() => {
    if (!isDirty && !isSaving) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty, isSaving])

  useEffect(() => {
    if (!hasAutoLoaded) {
      // Deep link from a shared invite: /?workspace=<id> wins over the remembered workspace.
      const linked = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("workspace") : null
      if (linked && /^[A-Za-z0-9_-]{3,64}$/.test(linked)) {
        switchProject(linked)
        window.history.replaceState({}, "", window.location.pathname)
      } else if (lastWorkspaceId && lastWorkspaceId !== DEMO_PROJECT_ID) {
        switchProject(lastWorkspaceId)
      } else {
        setShowSelector(true)
      }
      setHasAutoLoaded(true)
    } else if (project.id === DEMO_PROJECT_ID && !isSwitchingProject) {
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
      <ErrorBoundary name="Equation Registry">
        <EquationRegistryDialog />
      </ErrorBoundary>
      <ErrorBoundary name="Vision OCR Scanner">
        <ImageOcrDialog />
      </ErrorBoundary>
      <ErrorBoundary name="Bibliography Library">
        <BibliographyDialog />
      </ErrorBoundary>
      <ErrorBoundary name="Academic Literature Search">
        <AcademicSearchDialog open={isAcademicSearchOpen} onOpenChange={setIsAcademicSearchOpen} />
      </ErrorBoundary>
    </>
  )
}
