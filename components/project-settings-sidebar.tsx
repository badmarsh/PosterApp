"use client"

import { useState, useEffect, useRef } from "react"
import { apiFetch } from "@/lib/api-fetch"

import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
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

import { FileStack, Copy, FilePlus2, BookOpen, Upload, Palette, Trash2, Loader2, Calculator } from "lucide-react"
import { OUTPUT_TYPE_LABELS, getTemplateDef, type OutputType } from "@/lib/output-types"
import { ThesisMetadataPanel } from "@/components/thesis-review/thesis-metadata-panel"

export function ProjectSettingsSidebar() {
  const { project, updateProject, isSwitchingProject, switchProject, newProject, duplicateProject, bibKeys, setIsBibManagerOpen, switchOutput, updateActiveThemeColor, equations, setIsEquationLibraryOpen } = useEditor(
    useShallow((s) => ({
      project: s.project,
      updateProject: s.updateProject,
      isSwitchingProject: s.isSwitchingProject,
      switchProject: s.switchProject,
      newProject: s.newProject,
      duplicateProject: s.duplicateProject,
      bibKeys: s.bibKeys,
      setIsBibManagerOpen: s.setIsBibManagerOpen,
      switchOutput: s.switchOutput,
      updateActiveThemeColor: s.updateActiveThemeColor,
      equations: s.equations,
      setIsEquationLibraryOpen: s.setIsEquationLibraryOpen,
    }))
  )

  const logoInputRef = useRef<HTMLInputElement>(null)
  const secondaryLogoInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingSecondaryLogo, setIsUploadingSecondaryLogo] = useState(false)

  async function handleLogoUpload(file: File, isSecondary = false) {
    const setUploading = isSecondary ? setIsUploadingSecondaryLogo : setIsUploadingLogo
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await apiFetch(`/api/workspaces/${project.id}/assets/upload`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to upload logo")
      }
      if (isSecondary) {
        updateProject({ secondaryLogoUrl: data.asset.url })
      } else {
        updateProject({ logoUrl: data.asset.url })
      }
    } catch (err: any) {
      console.error("Logo upload error:", err)
    } finally {
      setUploading(false)
    }
  }

  // Derive active output metadata
  const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)
  const activeOutputType = (activeOutput?.outputType ?? "poster") as OutputType
  const activeTitle = activeOutput?.title ?? project.posterTitle
  const activeThemeColor = activeOutput?.themeColor ?? null
  const templateDef = getTemplateDef(activeOutput?.templateId ?? "atlas")
  const [workspaces, setWorkspaces] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    apiFetch('/api/workspaces')
      .then((r) => r.json())
      .then((data) => setWorkspaces(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [project.id])

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

  if (activeOutputType === "thesis-review") {
    return (
      <aside
        className="flex w-80 lg:w-[360px] shrink-0 flex-col border-r border-border bg-sidebar"
        aria-label="Thesis review parameters sidebar"
      >
        <div className="flex-1 overflow-y-auto">
          <ThesisMetadataPanel workspaceId={project.id} />
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar"
      aria-label="Project settings sidebar"
    >
      {/* Project Switcher Header removed as requested */}

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="mb-4 space-y-1">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Project Defaults
          </h2>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Global defaults inherited by Poster, Slides, and Paper.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="internalName" className="text-[11px] font-medium text-muted-foreground">Project Name</Label>
            <Input
              id="internalName"
              value={project.name}
              onChange={(e) => updateProject({ name: e.target.value })}
              className="h-8 text-[12px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="outputTitle" className="text-[11px] font-medium text-muted-foreground">Default Title</Label>
            <Textarea
              id="outputTitle"
              value={project.posterTitle ?? ""}
              onChange={(e) => updateProject({ posterTitle: e.target.value })}
              placeholder="e.g. Advanced Layouts & Latent Dynamics"
              className="min-h-16 resize-none text-[12px] font-medium leading-tight"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="authors" className="text-[11px] font-medium text-muted-foreground">Default Authors & Affiliations</Label>
            <Textarea
              id="authors"
              value={project.authors ?? ""}
              onChange={(e) => updateProject({ authors: e.target.value })}
              placeholder="e.g. A. Reyes, M. Okafor, L. Petrova, D. Chen"
              className="min-h-16 resize-none text-[11px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="venue" className="text-[11px] font-medium text-muted-foreground">Default Conference / Venue</Label>
            <Input
              id="venue"
              value={project.venue ?? ""}
              onChange={(e) => updateProject({ venue: e.target.value })}
              placeholder="e.g. CoRL 2026 / Lab Name"
              className="h-8 text-[11px]"
            />
          </div>

          {/* Project Logo Upload */}
          <div className="space-y-2 pt-4 border-t border-border">
            <div>
              <Label className="text-[11px] font-medium text-muted-foreground">Project Logo</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                Default institutional logo for templates with branding.
              </p>
            </div>

            {project.logoUrl ? (
              <div className="flex items-center justify-between gap-2 p-2 rounded-md border border-border bg-muted/20">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-9 rounded border border-border bg-background flex items-center justify-center overflow-hidden p-1 shrink-0">
                    <img
                      src={project.logoUrl}
                      alt="Project Logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium truncate">Primary Logo</p>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="text-[10px] text-primary hover:underline"
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo ? "Uploading..." : "Replace logo"}
                    </button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateProject({ logoUrl: null })}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  title="Remove logo"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center text-[11px] h-8 gap-2 border-dashed"
                onClick={() => logoInputRef.current?.click()}
                disabled={isUploadingLogo}
              >
                {isUploadingLogo ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                {isUploadingLogo ? "Uploading..." : "Upload Logo"}
              </Button>
            )}

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleLogoUpload(file, false)
                e.target.value = ""
              }}
            />

            {/* Secondary Logo (Optional) */}
            <div className="space-y-1 pt-1.5">
              <Label className="text-[10px] font-medium text-muted-foreground/80">Secondary Logo (Optional)</Label>
              {project.secondaryLogoUrl ? (
                <div className="flex items-center justify-between gap-2 p-1.5 rounded-md border border-border bg-muted/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-7 rounded border border-border bg-background flex items-center justify-center overflow-hidden p-0.5 shrink-0">
                      <img
                        src={project.secondaryLogoUrl}
                        alt="Secondary Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium truncate">Secondary Logo</p>
                      <button
                        type="button"
                        onClick={() => secondaryLogoInputRef.current?.click()}
                        className="text-[9px] text-primary hover:underline"
                        disabled={isUploadingSecondaryLogo}
                      >
                        {isUploadingSecondaryLogo ? "Uploading..." : "Replace"}
                      </button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => updateProject({ secondaryLogoUrl: null })}
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    title="Remove secondary logo"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-[10px] h-7 gap-1.5 text-muted-foreground hover:text-foreground border border-dashed border-border/60"
                  onClick={() => secondaryLogoInputRef.current?.click()}
                  disabled={isUploadingSecondaryLogo}
                >
                  {isUploadingSecondaryLogo ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Upload className="size-3" />
                  )}
                  {isUploadingSecondaryLogo ? "Uploading..." : "Add Secondary Logo"}
                </Button>
              )}
              <input
                ref={secondaryLogoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleLogoUpload(file, true)
                  e.target.value = ""
                }}
              />
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground">Bibliography &amp; Citations</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">Manage references for your poster.</p>
              </div>
              <span className="font-mono text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                {bibKeys.length} ref{bibKeys.length === 1 ? "" : "s"}
              </span>
            </div>

            <Button
              variant="outline"
              onClick={() => setIsBibManagerOpen(true)}
              className="w-full justify-between text-[11px] h-8 gap-2"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="size-3.5 text-primary" />
                Citation Library
              </span>
              <span className="text-[10px] text-muted-foreground">Open</span>
            </Button>
          </div>

          <div className="space-y-1.5 pt-4 border-t border-border">
            <div className="flex flex-col gap-2">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground">Equation Library</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">Manage formulas and variable glossary.</p>
              </div>
              
              <Button
                variant="outline"
                className="w-full justify-between text-[11px] h-8 gap-2"
                onClick={() => setIsEquationLibraryOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <Calculator className="size-3.5 text-primary" />
                  Manage Equations
                </span>
                <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                  {equations?.length || 0}
                </span>
              </Button>
            </div>
          </div>

          {/* Theme color picker */}
          {templateDef && templateDef.colors.length > 1 && (
            <div className="space-y-1.5 pt-4 border-t border-border">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Palette className="size-3 text-muted-foreground" />
                <Label className="text-[11px] font-medium text-muted-foreground">Accent colour</Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {templateDef.colors.map((c) => (
                  <button
                    key={c.id}
                    title={c.name}
                    onClick={() => updateActiveThemeColor(c.hex)}
                    className="group relative size-6 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{
                      backgroundColor: c.hex,
                      borderColor: activeThemeColor === c.hex ? c.hex : "transparent",
                      boxShadow: activeThemeColor === c.hex ? `0 0 0 2px var(--background), 0 0 0 4px ${c.hex}` : undefined,
                    }}
                    aria-pressed={activeThemeColor === c.hex}
                  />
                ))}
              </div>
              {activeThemeColor && (
                <p className="text-[10px] font-mono text-muted-foreground">{activeThemeColor}</p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
