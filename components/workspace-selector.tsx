"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { TEMPLATE_REGISTRY as TEMPLATES } from "@/lib/output-types"
import { FolderOpen, Plus, FlaskConical } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ResearchLabTemplates, type ScientificTask } from "@/components/research-lab-templates"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function WorkspaceSelector({
  onSelect,
  onClose,
}: {
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<"workspaces" | "research-lab">("workspaces")
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isCreating, setIsCreating] = useState(false)
  const [newId, setNewId] = useState("")
  const [newName, setNewName] = useState("")
  const [newOutputType, setNewOutputType] = useState<"poster" | "slides" | "paper" | "thesis-review">("poster")
  const [newTemplate, setNewTemplate] = useState("atlas")
  const [idTouched, setIdTouched] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    apiFetch("/api/workspaces")
      .then(async (r) => {
        const contentType = r.headers.get("content-type") || ""
        if (!r.ok) {
          if (contentType.includes("application/json")) {
            const errData = await r.json().catch(() => ({}))
            throw new Error(errData.error || errData.message || `HTTP ${r.status}`)
          }
          const text = await r.text().catch(() => "")
          if (r.status === 401 || text.includes("sign-in") || text.includes("Unauthorized")) {
            throw new Error("Unauthorized: Sign in required")
          }
          throw new Error(`HTTP ${r.status}`)
        }
        if (!contentType.includes("application/json")) {
          const text = await r.text().catch(() => "")
          if (text.includes("sign-in") || text.includes("<!DOCTYPE") || text.includes("<html")) {
            throw new Error("Unauthorized: Sign in required")
          }
          throw new Error("Invalid response format (expected JSON)")
        }
        return r.json()
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("Invalid workspaces data received")
        }
        setWorkspaces(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }, [])

  const slugify = (v: string) =>
    v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32)

  const handleNameChange = (v: string) => {
    setNewName(v)
    if (!idTouched) setNewId(slugify(v))
  }

  const templateOptions = TEMPLATES.filter((t) => t.outputType === newOutputType)

  useEffect(() => {
    if (!templateOptions.some((t) => t.id === newTemplate)) {
      setNewTemplate(templateOptions[0]?.id ?? "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newOutputType])

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
      const res = await apiFetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId, name: newName, outputType: newOutputType, templateId: newTemplate || undefined }),
      })
      const contentType = res.headers.get("content-type") || ""
      if (!res.ok) {
        if (contentType.includes("application/json")) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || err.message || `HTTP ${res.status}`)
        }
        const text = await res.text().catch(() => "")
        if (res.status === 401 || text.includes("sign-in")) {
          throw new Error("Unauthorized: Sign in required")
        }
        throw new Error(`HTTP ${res.status}`)
      }
      if (!contentType.includes("application/json")) {
        throw new Error("Invalid response format from server")
      }
      onSelect(newId)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err))
      setIsSubmitting(false)
    }
  }

  const handleLaunchLabTask = async (task: ScientificTask) => {
    setIsSubmitting(true)
    setCreateError(null)
    try {
      const slugBase = slugify(task.shortTitle || task.title)
      const uniqueSuffix = Date.now().toString(36).slice(-4)
      const generatedId = `${slugBase}-${uniqueSuffix}`.slice(0, 32)

      const res = await apiFetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: generatedId,
          name: task.title,
          outputType: "poster",
          templateId: "atlas",
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || err.message || `HTTP ${res.status}`)
      }

      const project = await res.json()
      const activeOutId = project.activeOutputId || project.outputs?.[0]?.id || `out_poster_${Date.now().toString(36)}`

      const setupCards = (task.setupCards || task.initialCards?.filter((c) => c.pattern !== "results") || []).map((c, idx) => ({
        id: `card_${Date.now().toString(36)}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        title: c.title,
        column: idx % 3,
        order: Math.floor(idx / 3),
        pattern: c.pattern || "text",
        content: c.content,
        figureLayout: "auto",
        validation: "valid",
        table: { hasHeader: true, caption: "", rows: [] },
        figures: [],
        sourceIds: [],
      }))

      const placeholderCards = (task.placeholderResultCards || task.initialCards?.filter((c) => c.pattern === "results") || []).map((c, idx) => {
        const globalIdx = setupCards.length + idx
        return {
          id: `card_${Date.now().toString(36)}_${globalIdx}_${Math.random().toString(36).substring(2, 6)}`,
          title: c.title,
          column: globalIdx % 3,
          order: Math.floor(globalIdx / 3),
          pattern: c.pattern || "text",
          content: `[PLACEHOLDER — no experiment has run yet]\n\n${c.content}`,
          figureLayout: "auto",
          validation: "pending",
          table: { hasHeader: true, caption: "", rows: [] },
          figures: [],
          sourceIds: [],
        }
      })

      const initialCards = [...setupCards, ...placeholderCards]

      await apiFetch(`/api/workspaces/${generatedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: generatedId,
          name: task.title,
          revision: project.revision ?? 0,
          activeOutputId: activeOutId,
          outputs: [
            {
              id: activeOutId,
              outputType: "poster",
              templateId: "atlas",
              title: task.title,
              isActive: true,
              cards: initialCards,
            },
          ],
        }),
      }).catch((putErr) => {
        console.warn("Could not populate initial cards:", putErr)
      })

      try {
        await navigator.clipboard.writeText(task.prompt)
        toast.success("Lab workspace created & DeerFlow prompt copied to clipboard!")
      } catch {
        toast.success("Lab workspace created!")
      }

      onSelect(generatedId)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isDbDown = error?.includes("Database offline")
  const isAuthRequired = error?.includes("Unauthorized") || error?.includes("Sign in required")

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className={
          activeTab === "research-lab"
            ? "sm:max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col p-6"
            : "sm:max-w-md"
        }
        showCloseButton
      >
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle>
                {activeTab === "research-lab" ? "Research Lab Templates" : "Select a Workspace"}
              </DialogTitle>
              <DialogDescription>
                {activeTab === "research-lab"
                  ? "Long-horizon scientific task protocols designed for autonomous DeerFlow execution."
                  : "Open an existing project or create a new one."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 border-b pb-2.5 -mt-1">
          <button
            type="button"
            onClick={() => setActiveTab("workspaces")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer",
              activeTab === "workspaces"
                ? "bg-muted text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <FolderOpen className="size-3.5" />
            My Workspaces
            {workspaces.length > 0 && (
              <span className="ml-1 rounded-full bg-muted-foreground/15 text-muted-foreground px-1.5 py-0.2 text-[10px] font-mono">
                {workspaces.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("research-lab")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer",
              activeTab === "research-lab"
                ? "bg-primary/10 text-primary font-semibold shadow-xs ring-1 ring-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <FlaskConical className="size-3.5 text-primary" />
            Research Lab (DeerFlow)
            <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-mono">
              6 Protocols
            </span>
          </button>
        </div>

        {createError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
            {createError}
          </div>
        )}

        {activeTab === "research-lab" ? (
          <div className="flex-1 overflow-hidden min-h-0 pt-1">
            <ResearchLabTemplates
              onLaunchTask={handleLaunchLabTask}
              onCopyPrompt={() => {
                toast.success("DeerFlow prompt copied to clipboard!")
              }}
              isCreating={isSubmitting}
            />
          </div>
        ) : (
          <>
            {isDbDown && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                <p className="font-medium text-destructive mb-0.5">Database Connection Failed</p>
                <p className="text-destructive/80 text-xs">Cannot reach the database. Make sure the PostgreSQL container is running.</p>
              </div>
            )}
            {error && !isDbDown && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-destructive">
                    {isAuthRequired ? "Authentication Required" : "Failed to load workspaces"}
                  </p>
                  {isAuthRequired && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px] px-2.5 border-destructive/40 text-destructive hover:bg-destructive/10 cursor-pointer"
                      onClick={() => { window.location.href = "/sign-in" }}
                    >
                      Sign In
                    </Button>
                  )}
                </div>
                <p className="text-destructive/80 text-xs">
                  {isAuthRequired
                    ? "Your session has expired or you are not signed in. Please sign in to access your projects."
                    : error}
                </p>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
                    <Skeleton className="size-4 shrink-0 rounded" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !isDbDown ? (
              <div className="flex flex-col gap-1.5 max-h-[40vh] overflow-y-auto -mx-1 px-1">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => onSelect(ws.id)}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                  >
                    <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm leading-tight">{ws.name}</p>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">{ws.id} · {ws.templateName}</p>
                        {Boolean(ws.pendingChangesCount && ws.pendingChangesCount > 0) && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/40 shrink-0">
                            {ws.pendingChangesCount} pending
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {workspaces.length === 0 && !error && (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center">
                    <p className="text-sm font-medium">No workspaces yet</p>
                    <p className="text-xs text-muted-foreground max-w-xs">Create a workspace to build a poster, slides or paper from a PDF, or explore the Research Lab templates.</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Button size="sm" className="gap-1.5" onClick={() => setIsCreating(true)}>
                        <Plus className="size-3.5" />
                        Create blank workspace
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setActiveTab("research-lab")}>
                        <FlaskConical className="size-3.5 text-primary" />
                        Explore Research Lab
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {!isDbDown && (
              isCreating ? (
                <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium">New Workspace</p>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ws-name">Project Name</Label>
                    <Input id="ws-name" autoFocus value={newName} onChange={(e) => handleNameChange(e.target.value)} placeholder="My Cool Project" disabled={isSubmitting} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ws-id" className="text-xs text-muted-foreground">Workspace ID (auto-generated, editable)</Label>
                    <Input id="ws-id" value={newId} onChange={(e) => { setIdTouched(true); setNewId(e.target.value) }} placeholder="my-cool-project" disabled={isSubmitting} className="font-mono text-xs" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ws-output">Output type</Label>
                    <Select value={newOutputType} onValueChange={(val) => val && setNewOutputType(val as typeof newOutputType)} disabled={isSubmitting}>
                      <SelectTrigger id="ws-output" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="poster">Poster</SelectItem>
                        <SelectItem value="slides">Slides</SelectItem>
                        <SelectItem value="paper">Paper</SelectItem>
                        <SelectItem value="thesis-review">Thesis review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {templateOptions.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ws-template">Template</Label>
                      <Select value={newTemplate} onValueChange={(val) => val && setNewTemplate(val)} disabled={isSubmitting}>
                        <SelectTrigger id="ws-template" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {templateOptions.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsCreating(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create"}</Button>
                  </div>
                </form>
              ) : (
                <DialogFooter className="-mx-4 -mb-4 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setIsCreating(true)} className="gap-1.5">
                    <Plus className="size-3.5" />
                    Create Blank Project
                  </Button>
                </DialogFooter>
              )
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
