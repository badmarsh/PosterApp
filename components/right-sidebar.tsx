"use client"

import { useState } from "react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { CardInspector } from "@/components/card-inspector"
import { HeaderInspector } from "@/components/header-inspector"
import { PdfSidebar } from "@/components/pdf-sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LayoutGrid, FileText, Heading } from "lucide-react"
import { cn } from "@/lib/utils"

export function RightSidebar() {
  const { project, selectedCardId, isHeaderUnlocked, isSwitchingProject, compactMode, inspectorDefaultTab } = useEditor(
    useShallow((s) => ({
      project: s.project,
      selectedCardId: s.selectedCardId,
      isHeaderUnlocked: s.isHeaderUnlocked,
      isSwitchingProject: s.isSwitchingProject,
      compactMode: s.compactMode,
      inspectorDefaultTab: s.inspectorDefaultTab,
    }))
  )

  // Initial tab honors the user preference (Settings → Appearance); later
  // preference changes only affect the next selection cycle.
  const [activeTab, setActiveTab] = useState<"editor" | "pdf">(inspectorDefaultTab)
  const [prevSelectionKey, setPrevSelectionKey] = useState<string | null>(null)

  const activeOutput = project?.outputs?.find((o) => o.id === project.activeOutputId)
  const outputTypeName = activeOutput?.outputType === "poster" ? "Poster" 
    : activeOutput?.outputType === "slides" ? "Slides" 
    : activeOutput?.outputType === "paper" ? "Paper" 
    : "Document"

  const currentSelectionKey = selectedCardId ? `card:${selectedCardId}` : isHeaderUnlocked ? "header" : null

  if (currentSelectionKey !== prevSelectionKey) {
    setPrevSelectionKey(currentSelectionKey)
    if (currentSelectionKey) {
      setActiveTab("editor")
    }
  }

  if (isSwitchingProject) {
    return (
      <section className="flex w-full shrink-0 flex-col border-l border-border bg-card lg:w-[26rem] h-full items-center justify-center">
        <div className="size-6 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
      </section>
    )
  }

  const isEditorEnabled = Boolean(selectedCardId || isHeaderUnlocked)
  const isEditingHeader = !selectedCardId && isHeaderUnlocked

  return (
    <section className="flex w-full shrink-0 flex-col border-l border-border bg-card lg:w-[26rem] h-full min-h-0">
      <div className={cn("flex shrink-0 items-center border-b border-border bg-muted/30 px-3 py-1.5", compactMode ? "h-9" : "h-11")}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "editor" | "pdf")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="editor" disabled={!isEditorEnabled} className="text-[11px] h-7">
              {isEditingHeader ? (
                <>
                  <Heading className="size-3.5 mr-1.5 text-primary" />
                  Edit {outputTypeName} Settings + Ops
                </>
              ) : (
                <>
                  <LayoutGrid className="size-3.5 mr-1.5" />
                  Card Editor
                </>
              )}
            </TabsTrigger>
            <TabsTrigger value="pdf" className="text-[11px] h-7">
              <FileText className="size-3.5 mr-1.5" />
              PDF Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 relative">
        {/* We use absolute positioning so the active pane takes full height without scrolling issues */}
        <div className={`absolute inset-0 ${activeTab === 'editor' ? 'flex' : 'hidden'}`}>
          {isEditingHeader ? <HeaderInspector /> : <CardInspector />}
        </div>
        <div className={`absolute inset-0 ${activeTab === 'pdf' ? 'flex' : 'hidden'}`}>
          <PdfSidebar />
        </div>
      </div>
    </section>
  )
}
