"use client"

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
import { otherProjects } from "@/lib/mock-data"
import { FileStack, Copy, FilePlus2 } from "lucide-react"

export function ProjectSettingsSidebar() {
  const { project, updateProject, isSwitchingProject, switchProject, newProject, duplicateProject } = useEditor()

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
          onValueChange={(val) => switchProject(val)}
        >
          <SelectTrigger className="h-8 w-[160px] border-transparent bg-transparent px-2 font-mono text-[11px] font-semibold tracking-tight shadow-none hover:bg-muted/50 focus:ring-0">
            <div className="flex items-center gap-1.5 truncate">
              <FileStack className="size-3.5 text-muted-foreground" />
              <span className="truncate">{project.name}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
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
        </div>
      </ScrollArea>
    </aside>
  )
}
