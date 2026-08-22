"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { Trash2 } from "lucide-react"

export function ManageWorkspaces() {
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this workspace and all its data? This cannot be undone.")) return
    
    try {
      const res = await apiFetch(`/api/workspaces/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setWorkspaces(prev => prev.filter(w => w.id !== id))
    } catch(err) {
      alert(String(err))
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading workspaces...</div>
  }

  if (error) {
    return <div className="p-8 text-sm text-destructive">Error: {error}</div>
  }

  return (
    <div className="p-8 flex flex-col gap-6 w-full h-full">
      <div>
        <h1 className="text-xl font-bold mb-1">Workspaces</h1>
        <p className="text-sm text-muted-foreground">Manage and delete your projects.</p>
      </div>

      <div className="flex flex-col gap-3">
        {workspaces.map(ws => (
          <div key={ws.id} className="flex items-center justify-between p-4 border rounded-md bg-card">
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{ws.name}</span>
              <span className="text-xs text-muted-foreground">ID: {ws.id} • Template: {ws.templateName}</span>
            </div>
            <button
              onClick={() => handleDelete(ws.id)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          </div>
        ))}
        {workspaces.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            You don&apos;t have any workspaces yet.
          </div>
        )}
      </div>
    </div>
  )
}
