"use client"

import { useEffect, useState, useCallback } from "react"
import { X, Clock, RotateCcw, Tag, Trash2, AlertTriangle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

type Snapshot = {
  id: string
  savedAt: string
  label: string | null
  revision: number
}

export function HistoryPanel() {
  const { isHistoryOpen, setIsHistoryOpen, project, pushEvent } = useEditor(
    useShallow((s) => ({
      isHistoryOpen: s.isHistoryOpen,
      setIsHistoryOpen: s.setIsHistoryOpen,
      project: s.project,
      pushEvent: s.pushEvent,
    }))
  )

  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(false)
  
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [labelingId, setLabelingId] = useState<string | null>(null)
  const [labelInput, setLabelInput] = useState("")

  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!project.id) return
    setLoading(true)
    try {
      const res = await apiFetch(`/api/workspaces/${project.id}/history`)
      if (res.ok) {
        const data = await res.json()
        setSnapshots(data.snapshots ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [project.id])

  useEffect(() => {
    if (isHistoryOpen) fetchHistory()
  }, [isHistoryOpen, fetchHistory])

  const handleRestore = async () => {
    if (!confirmRestoreId) return
    const snapId = confirmRestoreId
    setConfirmRestoreId(null)
    setRestoringId(snapId)
    try {
      const res = await apiFetch(`/api/workspaces/${project.id}/history/${snapId}`, { method: "POST" })
      if (res.ok) {
        pushEvent({ kind: "info", status: "done", title: "Snapshot Restored", detail: "Reloading workspace..." })
        setTimeout(() => window.location.reload(), 800)
      } else {
        pushEvent({ kind: "info", status: "error", title: "Restore Failed", detail: "Failed to restore snapshot." })
      }
    } finally {
      setRestoringId(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    const snapId = confirmDeleteId
    setConfirmDeleteId(null)
    try {
      const res = await apiFetch(`/api/workspaces/${project.id}/history/${snapId}`, { method: "DELETE" })
      if (res.ok) {
        setSnapshots(s => s.filter(x => x.id !== snapId))
      }
    } catch (err) {
      pushEvent({ kind: "info", status: "error", title: "Delete Failed", detail: err instanceof Error ? err.message : String(err) })
    }
  }

  const handleSaveLabel = async (snapId: string) => {
    const label = labelInput.trim()
    if (!label) { setLabelingId(null); return }
    try {
      const res = await apiFetch(`/api/workspaces/${project.id}/history/${snapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      })
      if (res.ok) {
        setSnapshots(s => s.map(x => x.id === snapId ? { ...x, label } : x))
      }
    } finally {
      setLabelingId(null)
      setLabelInput("")
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  if (!isHistoryOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={() => setIsHistoryOpen(false)}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 z-50 h-full w-[380px] bg-background border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <span className="font-semibold text-sm">Save History</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {snapshots.length}/50
            </span>
          </div>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setIsHistoryOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Loading history...
            </div>
          ) : snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <Clock className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No saves yet.</p>
              <p className="text-xs text-muted-foreground/60">Save your project to create a history entry.</p>
            </div>
          ) : (
            snapshots.map((snap, i) => (
              <div
                key={snap.id}
                className={cn(
                  "group rounded-lg border border-border bg-card p-3 hover:border-primary/40 hover:bg-primary/5 transition-all",
                  i === 0 && "border-primary/30 bg-primary/5"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {i === 0 && (
                        <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          Latest
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDate(snap.savedAt)}</span>
                      <span className="text-xs text-muted-foreground/50">&bull; rev {snap.revision}</span>
                    </div>
                    {labelingId === snap.id ? (
                      <div className="flex gap-1.5 mt-1.5">
                        <Input
                          autoFocus
                          value={labelInput}
                          onChange={e => setLabelInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleSaveLabel(snap.id)
                            if (e.key === "Escape") setLabelingId(null)
                          }}
                          placeholder="e.g. Before AI rewrite"
                          className="h-7 text-xs flex-1"
                        />
                        <Button size="sm" className="h-7 text-xs px-2.5" onClick={() => handleSaveLabel(snap.id)}>
                          Save
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium mt-0.5 truncate">
                        {snap.label || <span className="text-muted-foreground italic">Auto-save</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      title="Add label"
                      onClick={() => { setLabelingId(snap.id); setLabelInput(snap.label ?? "") }}
                    >
                      <Tag className="size-3" />
                    </Button>
                    {i !== 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-destructive hover:text-destructive"
                        title="Delete snapshot"
                        onClick={() => setConfirmDeleteId(snap.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                    {i !== 0 && (
                      <Button
                        size="icon"
                        className="size-6"
                        title="Restore this snapshot"
                        disabled={restoringId === snap.id}
                        onClick={() => setConfirmRestoreId(snap.id)}
                      >
                        {restoringId === snap.id ? (
                          <span className="text-[10px]">...</span>
                        ) : (
                          <RotateCcw className="size-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <p className="text-xs text-muted-foreground text-center">
            Every save creates a snapshot automatically. Up to 50 per workspace.
          </p>
        </div>
      </aside>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-1">
              <AlertTriangle className="size-4 shrink-0" />
              <DialogTitle className="text-destructive">Delete Snapshot?</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to delete this snapshot? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-4 -mb-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete Snapshot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation */}
      <Dialog open={!!confirmRestoreId} onOpenChange={(open) => { if (!open) setConfirmRestoreId(null) }}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="size-4 shrink-0 text-chart-4" />
              <DialogTitle>Restore Snapshot?</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to restore this snapshot? Your current unsaved changes will be overwritten.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-4 -mb-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmRestoreId(null)}>Cancel</Button>
            <Button size="sm" onClick={handleRestore}>Restore Snapshot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
