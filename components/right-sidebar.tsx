"use client"

import { useState, useEffect } from "react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { CardInspector } from "@/components/card-inspector"
import { PdfSidebar } from "@/components/pdf-sidebar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { LayoutGrid, FileText } from "lucide-react"

export function RightSidebar() {
  const { selectedCardId, isSwitchingProject } = useEditor(
    useShallow((s) => ({
      selectedCardId: s.selectedCardId,
      isSwitchingProject: s.isSwitchingProject,
    }))
  )
  
  const [activeTab, setActiveTab] = useState<"editor" | "pdf">("pdf")
  const [prevSelectedCardId, setPrevSelectedCardId] = useState(selectedCardId)

  if (selectedCardId !== prevSelectedCardId) {
    setPrevSelectedCardId(selectedCardId)
    if (selectedCardId) {
      setActiveTab("editor")
    } else if (!selectedCardId && activeTab === "editor") {
      setActiveTab("pdf")
    }
  }

  if (isSwitchingProject) {
    return (
      <section className="flex w-full shrink-0 flex-col border-l border-border bg-card lg:w-[26rem] h-full items-center justify-center">
        <div className="size-6 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
      </section>
    )
  }

  return (
    <section className="flex w-full shrink-0 flex-col border-l border-border bg-card lg:w-[26rem] h-full min-h-0">
      <div className="flex shrink-0 items-center border-b border-border bg-muted/30 px-3 py-1.5 h-11">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "editor" | "pdf")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="editor" disabled={!selectedCardId} className="text-[11px] h-7">
              <LayoutGrid className="size-3.5 mr-1.5" />
              Editor
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
          <CardInspector />
        </div>
        <div className={`absolute inset-0 ${activeTab === 'pdf' ? 'flex' : 'hidden'}`}>
          <PdfSidebar />
        </div>
      </div>
    </section>
  )
}
