"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

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
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          ✕
        </button>
        <h2 className="text-xl font-semibold pr-8">Select a Workspace</h2>
        {error && <p className="text-sm text-destructive">Failed to load workspaces: {error}</p>}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
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
        )}
        
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Create New Project
          </button>
        ) : (
          <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 rounded-md border p-4 bg-muted/30">
            <h3 className="font-medium text-sm">New Workspace</h3>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Workspace ID (slug)</label>
              <input 
                value={newId} 
                onChange={e => setNewId(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-sm"
                placeholder="my-cool-project"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Project Name</label>
              <input 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-sm"
                placeholder="My Cool Project"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Template</label>
              <select 
                value={newTemplate} 
                onChange={e => setNewTemplate(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-sm"
                disabled={isSubmitting}
              >
                <option value="atlas">Atlas</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button 
                type="button" 
                onClick={() => setIsCreating(false)}
                className="px-3 py-1 text-sm rounded hover:bg-accent"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
