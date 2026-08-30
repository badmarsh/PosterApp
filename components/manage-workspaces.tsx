"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { Trash2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export function ManageWorkspaces() {
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    setIsDeleting(true)
    try {
      const res = await apiFetch(`/api/workspaces/${confirmDeleteId}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setWorkspaces((prev) => prev.filter((w) => w.id !== confirmDeleteId))
      toast.success("Workspace deleted.")
    } catch (err) {
      toast.error(String(err))
    } finally {
      setIsDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  const workspaceToDelete = workspaces.find((w) => w.id === confirmDeleteId)

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading workspaces...</div>
  if (error) return <div className="p-8 text-sm text-destructive">Error: {error}</div>

  return (
    <div className="p-8 flex flex-col gap-6 w-full h-full">
      <div>
        <h1 className="text-xl font-bold mb-1">Workspaces</h1>
        <p className="text-sm text-muted-foreground">Manage and delete your projects.</p>
      </div>

      <div className="flex flex-col gap-3">
        {workspaces.map((ws) => (
          <div key={ws.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{ws.name}</span>
              <span className="text-xs text-muted-foreground">ID: {ws.id} &bull; Template: {ws.templateName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDeleteId(ws.id)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        ))}
        {workspaces.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            You don&apos;t have any workspaces yet.
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-1">
              <AlertTriangle className="size-4 shrink-0" />
              <DialogTitle className="text-destructive">Delete Workspace?</DialogTitle>
            </div>
            <DialogDescription>
              This will permanently delete <strong>{workspaceToDelete?.name}</strong> and all its data.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-4 -mb-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
