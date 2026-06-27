"use client"

import { useState, useEffect } from "react"

import { useEditor } from "@/components/editor-store"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { otherProjects } from "@/lib/mock-data"
import { FileStack, Copy, FilePlus2, BookOpen, Upload } from "lucide-react"

export function ProjectSettingsSidebar() {
  const { project, updateProject, isSwitchingProject, switchProject, newProject, duplicateProject, bibContent, updateBib } = useEditor()
  const [localBib, setLocalBib] = useState(bibContent)

  useEffect(() => {
    setLocalBib(bibContent)
  }, [bibContent])

  if (isSwitchingProject) {
    return (
      <aside
        className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar"
        aria-label="Project settings sidebar"
      >
        <div className="flex items-center p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar"
      aria-label="Project settings sidebar"
    >
      {/* Project Switcher Header */}
      <div className="flex items-center justify-between border-b border-border p-2">
        <Select
          value={project.id}
          onValueChange={(val) => {
            if (val) switchProject(val)
          }}
        >
          <SelectTrigger className="h-8 flex-1 border-transparent bg-transparent px-2 font-mono text-[11px] font-semibold tracking-tight shadow-none hover:bg-muted/50 focus:ring-0">
            <div className="flex items-center gap-1.5 truncate">
              <FileStack className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{project.name}</span>
            </div>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" className="w-[240px]">
            <SelectItem value={project.id}>{project.name}</SelectItem>
            {otherProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Duplicate project"
            onClick={duplicateProject}
            className="rounded p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="New project"
            onClick={newProject}
            className="rounded p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <FilePlus2 className="size-3.5" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="mb-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Project Settings
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="internalName" className="text-[11px] font-medium text-muted-foreground">Internal Name</Label>
            <Input
              id="internalName"
              value={project.name}
              onChange={(e) => updateProject({ name: e.target.value })}
              className="h-8 text-[12px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="posterTitle" className="text-[11px] font-medium text-muted-foreground">Poster Title</Label>
            <Textarea
              id="posterTitle"
              value={project.posterTitle}
              onChange={(e) => updateProject({ posterTitle: e.target.value })}
              className="min-h-16 resize-none text-[12px] font-medium leading-tight"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="authors" className="text-[11px] font-medium text-muted-foreground">Authors & Affiliations</Label>
            <Textarea
              id="authors"
              value={project.authors}
              onChange={(e) => updateProject({ authors: e.target.value })}
              className="min-h-16 resize-none text-[11px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="venue" className="text-[11px] font-medium text-muted-foreground">Conference / Venue</Label>
            <Input
              id="venue"
              value={project.venue}
              onChange={(e) => updateProject({ venue: e.target.value })}
              className="h-8 text-[11px]"
            />
          </div>

          <div className="space-y-1.5 pt-4 border-t border-border">
            <div className="flex flex-col gap-2">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground">Bibliography (BibTeX)</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">Manage references for your poster.</p>
              </div>
              
              <Dialog onOpenChange={(open) => {
                if (!open && localBib !== bibContent) {
                  updateBib(project.id, localBib)
                }
              }}>
                <DialogTrigger
                  render={<Button variant="outline" className="w-full justify-start text-[11px] h-8 gap-2" />}
                >
                  <BookOpen className="size-3.5" />
                  Edit references.bib
                </DialogTrigger>
                <DialogContent className="max-w-[90vw] sm:max-w-3xl h-[80vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Bibliography Manager</DialogTitle>
                    <div className="flex items-start justify-between gap-4 mt-1">
                      <DialogDescription>
                        Edit the raw BibTeX contents for this workspace. Changes are saved automatically when you close this window.
                      </DialogDescription>
                      <div className="shrink-0 flex items-center">
                        <input
                          type="file"
                          accept=".bib"
                          id="bib-upload"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                const content = e.target?.result as string;
                                setLocalBib(content);
                              };
                              reader.readAsText(file);
                            }
                            // Reset input so the same file can be uploaded again if needed
                            e.target.value = '';
                          }}
                        />
                        <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => document.getElementById('bib-upload')?.click()}>
                          <Upload className="size-3" />
                          Upload .bib
                        </Button>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="flex-1 min-h-0 pt-2 relative">
                    {localBib !== bibContent && (
                      <span className="absolute top-2 right-4 text-[10px] text-muted-foreground bg-background px-2 py-0.5 rounded-md border border-border z-10">
                        Unsaved changes...
                      </span>
                    )}
                    <Textarea
                      value={localBib}
                      onChange={(e) => setLocalBib(e.target.value)}
                      onBlur={() => updateBib(project.id, localBib)}
                      placeholder="@article{...}"
                      className="h-full resize-none font-mono text-[12px] leading-relaxed shadow-none focus-visible:ring-1 bg-muted/30"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
