"use client"

import { X, Sparkles, Download, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { generateFullTemplate } from "@/lib/latex"

export function ActionsPanel() {
  const { 
    isActionsOpen, 
    setIsActionsOpen, 
    project, 
    autoFillAllCardsAction, 
    aiReview,
    pushEvent,
  } = useEditor(
    useShallow((s) => ({
      isActionsOpen: s.isActionsOpen,
      setIsActionsOpen: s.setIsActionsOpen,
      project: s.project,
      autoFillAllCardsAction: s.autoFillAllCardsAction,
      aiReview: s.aiReview,
      pushEvent: s.pushEvent,
    }))
  )

  if (!isActionsOpen) return null

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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={() => setIsActionsOpen(false)}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 z-50 h-full w-[320px] bg-background border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <span className="font-semibold text-sm">Project Actions</span>
          </div>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setIsActionsOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Generate Empty Items</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Automatically fill all empty cards in your project using AI and ingested context.
            </p>
            <Button
              className="w-full justify-start gap-2 bg-status-info/10 text-status-info hover:bg-status-info/20"
              variant="outline"
              onClick={() => {
                autoFillAllCardsAction();
                setIsActionsOpen(false);
              }}
            >
              <Sparkles className="size-4" />
              Generate contents for empty items
            </Button>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-medium">AI Review</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Have the AI review your current poster layout and content for improvements.
            </p>
            <Button
              className="w-full justify-start gap-2"
              variant="outline"
              onClick={() => {
                aiReview();
                setIsActionsOpen(false);
              }}
            >
              <Sparkles className="size-4" />
              AI Review
            </Button>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-medium">Export</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Download the raw LaTeX source code for your current layout to compile locally.
            </p>
            <Button
              className="w-full justify-start gap-2"
              variant="outline"
              onClick={() => {
                exportTex();
                setIsActionsOpen(false);
              }}
            >
              <Download className="size-4" />
              Export
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}
