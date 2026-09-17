"use client"

import { useEffect, useState, useCallback } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { Trash2, AlertTriangle, Loader2, FolderOpen, RefreshCw, CheckCircle2, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useUser } from "@clerk/nextjs"
import { useEditor } from "@/components/editor-store"

interface WorkspaceOutput {
  id: string
  outputType: string
  templateId: string
  title: string
  isActive?: boolean
}

interface WorkspaceItem {
  id: string
  name: string
  authors?: string
  venue?: string
  userId: string
  outputs?: WorkspaceOutput[]
  members?: Array<{ role: string; userId: string }>
}

export function ManageWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { user } = useUser()
  const { activeWorkspaceId, switchProject, setLastWorkspaceId } = useEditor((s) => ({
    activeWorkspaceId: s.project?.id,
    switchProject: s.switchProject,
    setLastWorkspaceId: s.setLastWorkspaceId,
  }))

  const fetchWorkspaces = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const r = await apiFetch("/api/workspaces")
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${r.status}`)
      }
      const data = await r.json()
      if (Array.isArray(data)) {
        setWorkspaces(data)
      } else {
        setWorkspaces([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchWorkspaces()
  }, [fetchWorkspaces])

  const handleDelete = async (idToDelete: string) => {
    setIsDeleting(true)
    try {
      const res = await apiFetch(`/api/workspaces/${idToDelete}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      setWorkspaces((prev) => prev.filter((w) => w.id !== idToDelete))
      toast.success("Workspace deleted.")

      // If the deleted workspace is currently active, clear state and reload cleanly
      if (activeWorkspaceId === idToDelete) {
        setLastWorkspaceId(null)
        try {
          localStorage.removeItem("posterapp-editor-storage")
        } catch {}
        window.location.href = "/"
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setIsDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-6 w-full">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="flex flex-col gap-1.5 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-8 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col gap-4">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>Failed to load workspaces: {error}</span>
          <Button variant="outline" size="sm" onClick={() => void fetchWorkspaces(true)}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Manage Workspaces</h2>
          <p className="text-xs text-muted-foreground">View, switch between, and delete your workspaces.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void fetchWorkspaces(true)}
          disabled={refreshing}
          className="gap-1.5 text-xs text-muted-foreground"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId
          const isOwner = !user?.id || !ws.userId || ws.userId === user.id
          const isConfirming = confirmDeleteId === ws.id
          const outputTypes = ws.outputs?.map((o) => o.outputType).filter(Boolean) ?? []
          const outputSummary = outputTypes.length > 0 ? outputTypes.join(", ") : "1 poster"

          return (
            <div
              key={ws.id}
              className={`flex flex-col gap-3 p-4 border rounded-lg transition-colors ${
                isActive ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-border/80"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground truncate">{ws.name}</span>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <CheckCircle2 className="size-3" />
                        Current
                      </span>
                    )}
                    {!isOwner && (
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Shared ({ws.members?.[0]?.role || "member"})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="font-mono text-[11px]">{ws.id}</span>
                    <span>&bull;</span>
                    <span>Outputs: {outputSummary}</span>
                    {ws.venue && (
                      <>
                        <span>&bull;</span>
                        <span className="truncate max-w-[200px]">{ws.venue}</span>
                      </>
                    )}
                  </div>
                </div>

                {!isConfirming && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void switchProject(ws.id)}
                        className="gap-1.5 text-xs h-8 px-2.5"
                      >
                        <FolderOpen className="size-3.5" />
                        Open
                      </Button>
                    )}
                    {isOwner ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(ws.id)}
                        disabled={Boolean(confirmDeleteId && confirmDeleteId !== ws.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs h-8 px-2.5"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    ) : (
                      <span
                        className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-1 opacity-60"
                        title="Only the workspace owner can delete this workspace."
                      >
                        <ShieldAlert className="size-3.5" />
                        Owner only
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Inline delete confirmation (zero portal / z-index issues) */}
              {isConfirming && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 mt-1 border-t border-destructive/20 bg-destructive/5 -mx-4 -mb-4 p-3 rounded-b-lg">
                  <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>Permanently delete &ldquo;{ws.name}&rdquo; and all its files? This cannot be undone.</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={isDeleting}
                      className="h-7 text-xs px-2.5"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void handleDelete(ws.id)}
                      disabled={isDeleting}
                      className="h-7 text-xs px-2.5 gap-1.5"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="size-3" />
                          Yes, Delete
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {workspaces.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-lg bg-muted/10">
            You don&apos;t have any workspaces yet.
          </div>
        )}
      </div>
    </div>
  )
}
