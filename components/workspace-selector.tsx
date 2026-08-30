"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function WorkspaceSelector({ onSelect, onClose }: { onSelect: (id: string) => void, onClose: () => void }) {
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
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground"
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Button>
        <h2 className="text-xl font-semibold pr-8">Select a Workspace</h2>
        
        {error && error.includes("Database offline") ? (
          <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
            <h3 className="font-semibold mb-1">Database Connection Failed</h3>
            <p className="text-sm">Cannot reach the database. Please make sure the PostgreSQL container is running.</p>
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load workspaces: {error}</p>
        ) : null}

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : !error || !error.includes("Database offline") ? (
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
        ) : null}
        
        {(!error || !error.includes("Database offline")) && (
          !isCreating ? (
            <Button onClick={() => setIsCreating(true)} className="mt-4 h-9 w-full text-sm">
              Create New Project
            </Button>
          ) : (
            <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 rounded-md border p-4 bg-muted/30">
              <h3 className="font-medium text-sm">New Workspace</h3>
              {createError && <p className="text-xs text-destructive">{createError}</p>}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Workspace ID (slug)</label>
                <Input
                  value={newId}
                  onChange={e => setNewId(e.target.value)}
                  placeholder="my-cool-project"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Project Name</label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="My Cool Project"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Template</label>
                <Select value={newTemplate} onValueChange={setNewTemplate} disabled={isSubmitting}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atlas">Atlas</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreating(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          )
        )}
      </div>
    </div>
  )
}
