"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { FolderOpen, Plus } from "lucide-react"

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
    apiFetch("/api/workspaces")
      .then(async (r) => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}))
          throw new Error(errData.error || `HTTP ${r.status}`)
        }
        return r.json()
      })
      .then((data) => {
        setWorkspaces(data)
        setLoading(false)
      })
      .catch((err) => {
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
      const res = await apiFetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId, name: newName, templateName: newTemplate }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      onSelect(newId)
    } catch (err) {
      setCreateError(String(err))
      setIsSubmitting(false)
    }
  }

  const isDbDown = error?.includes("Database offline")

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Select a Workspace</DialogTitle>
          <DialogDescription>Open an existing project or create a new one.</DialogDescription>
        </DialogHeader>

        {isDbDown && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive mb-0.5">Database Connection Failed</p>
            <p className="text-destructive/80 text-xs">Cannot reach the database. Make sure the PostgreSQL container is running.</p>
          </div>
        )}
        {error && !isDbDown && (
          <p className="text-sm text-destructive">Failed to load workspaces: {error}</p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !isDbDown ? (
          <div className="flex flex-col gap-1.5 max-h-[40vh] overflow-y-auto -mx-1 px-1">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => onSelect(ws.id)}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm leading-tight">{ws.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{ws.id} · {ws.templateName}</p>
                </div>
              </button>
            ))}
            {workspaces.length === 0 && !error && (
              <p className="text-sm text-muted-foreground text-center py-4">No workspaces yet.</p>
            )}
          </div>
        ) : null}

        {!isDbDown && (
          isCreating ? (
            <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">New Workspace</p>
              {createError && <p className="text-xs text-destructive">{createError}</p>}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ws-id">Workspace ID (slug)</Label>
                <Input id="ws-id" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="my-cool-project" disabled={isSubmitting} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ws-name">Project Name</Label>
                <Input id="ws-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Cool Project" disabled={isSubmitting} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ws-template">Template</Label>
                <Select value={newTemplate} onValueChange={(val) => val && setNewTemplate(val)} disabled={isSubmitting}>
                  <SelectTrigger id="ws-template" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atlas">Atlas</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCreating(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create"}</Button>
              </div>
            </form>
          ) : (
            <DialogFooter className="-mx-4 -mb-4">
              <Button variant="outline" size="sm" onClick={() => setIsCreating(true)} className="gap-1.5">
                <Plus className="size-3.5" />
                Create New Project
              </Button>
            </DialogFooter>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}
