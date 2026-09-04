"use client"

import { useState, useEffect, useCallback } from "react"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Key,
  Layers,
  FileText,
  BookOpen,
  Image as ImageIcon,
  Cpu,
  RefreshCw,
  GitCompare,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export interface AgentChangeItem {
  id: string
  workspaceId: string
  toolName: string
  targetType: string
  targetId: string | null
  payload: any
  diffPreview: any
  rationale: string | null
  status: "pending" | "applied" | "rejected" | "expired" | "failed"
  createdAt: string
  expiresAt: string
  decidedAt: string | null
  decidedById: string | null
  snapshotId: string | null
  error: string | null
  apiKeyName?: string
}

interface ConflictState {
  changeId: string
  currentCard: any
  proposed: any
}

interface ApprovalInboxProps {
  workspaceId: string
  onApplySuccess?: () => void
}

export function ApprovalInbox({ workspaceId, onApplySuccess }: ApprovalInboxProps) {
  const [changes, setChanges] = useState<AgentChangeItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending")

  const fetchChanges = useCallback(async () => {
    setIsLoading(true)
    try {
      const url =
        statusFilter === "pending"
          ? `/api/workspaces/${workspaceId}/agent-changes?status=pending`
          : `/api/workspaces/${workspaceId}/agent-changes`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setChanges(data.changes || [])
      }
    } catch (err) {
      console.error("[ApprovalInbox] Failed to fetch changes:", err)
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, statusFilter])

  useEffect(() => {
    fetchChanges()
  }, [fetchChanges])

  const handleApprove = async (changeId: string, forceRebase = false) => {
    setProcessingId(changeId)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/agent-changes/${changeId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRebase }),
      })

      const data = await res.json()
      if (res.status === 409 && data.code === "CONFLICT") {
        setConflict({
          changeId,
          currentCard: data.currentCard,
          proposed: data.proposed,
        })
        toast.warning("Conflict detected", {
          description: "Target card was modified since this proposal. Review to rebase or reject.",
        })
        return
      }

      if (!res.ok) {
        toast.error("Failed to approve change", {
          description: data.error || data.message || "Unknown error",
        })
        return
      }

      toast.success("Change applied successfully", {
        description: `Snapshot created: ${data.snapshotId}`,
      })
      setConflict(null)
      fetchChanges()
      onApplySuccess?.()
    } catch (err: any) {
      toast.error("Approval request failed", { description: err?.message })
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (changeId: string, reason?: string) => {
    setProcessingId(changeId)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/agent-changes/${changeId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error("Failed to reject change", {
          description: data.error || data.message,
        })
        return
      }

      toast.info("Change rejected")
      setConflict(null)
      fetchChanges()
    } catch (err: any) {
      toast.error("Rejection request failed", { description: err?.message })
    } finally {
      setProcessingId(null)
    }
  }

  // Group pending bib changes to support batch approval (§9.3: never cross tool types)
  const pendingBibChanges = changes.filter(
    (c) => c.status === "pending" && c.toolName === "posterapp.bibliography.add"
  )

  const handleBatchApproveBib = async () => {
    if (pendingBibChanges.length === 0) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/agent-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeIds: pendingBibChanges.map((c) => c.id) }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Batch approved ${data.applied?.length || 0} bibliography entries`)
        fetchChanges()
        onApplySuccess?.()
      } else {
        toast.error("Batch approval failed", { description: data.error })
      }
    } catch (err: any) {
      toast.error("Batch approval error", { description: err?.message })
    } finally {
      setIsLoading(false)
    }
  }

  const pendingCount = changes.filter((c) => c.status === "pending").length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header & filters */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          <span className="text-xs font-semibold">Approval Inbox</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/40">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex bg-muted/60 p-0.5 rounded-md border border-border/50 text-[10px]">
            <button
              onClick={() => setStatusFilter("pending")}
              className={cn(
                "px-2 py-0.5 rounded font-medium transition-colors",
                statusFilter === "pending" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={cn(
                "px-2 py-0.5 rounded font-medium transition-colors",
                statusFilter === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={fetchChanges}
            disabled={isLoading}
            title="Refresh changes"
          >
            <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Batch action banner if multiple bib additions are pending */}
      {statusFilter === "pending" && pendingBibChanges.length > 1 && (
        <div className="px-3 py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">
            {pendingBibChanges.length} bibliography entries proposed
          </span>
          <Button
            size="xs"
            variant="default"
            onClick={handleBatchApproveBib}
            disabled={isLoading}
            className="text-[11px] h-6 px-2"
          >
            Approve all {pendingBibChanges.length} entries
          </Button>
        </div>
      )}

      {/* Conflict Modal / Inline Card View */}
      {conflict && (
        <div className="m-3 p-3 rounded-lg border border-red-500/40 bg-red-500/10 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Conflict: Card modified after proposal</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            The target card was modified by a human editor or concurrent edit. Review the three-way state below:
          </p>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mt-1">
            <div className="p-2 rounded bg-background/80 border border-border">
              <div className="font-bold text-muted-foreground mb-1">Current Card:</div>
              <div className="font-semibold text-foreground">{conflict.currentCard?.title}</div>
              <div className="text-muted-foreground mt-1 line-clamp-3">
                {conflict.currentCard?.content}
              </div>
            </div>
            <div className="p-2 rounded bg-primary/10 border border-primary/30">
              <div className="font-bold text-primary mb-1">Proposed by Agent:</div>
              <div className="font-semibold text-foreground">{conflict.proposed?.title}</div>
              <div className="text-muted-foreground mt-1 line-clamp-3">
                {conflict.proposed?.content}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() => handleReject(conflict.changeId, "Rejected due to concurrent edit conflict")}
              className="text-[11px] h-6"
            >
              Reject Proposal
            </Button>
            <Button
              size="xs"
              variant="destructive"
              onClick={() => handleApprove(conflict.changeId, true)}
              disabled={processingId === conflict.changeId}
              className="text-[11px] h-6"
            >
              Apply Anyway (Rebase)
            </Button>
          </div>
        </div>
      )}

      {/* Changes list */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
        {changes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
            <Layers className="size-8 opacity-40" />
            <p className="text-xs font-medium">No pending agent changes</p>
            <p className="text-[11px] opacity-70 max-w-[220px]">
              When DeerFlow proposes changes to cards, bibliography, or assets, they will appear here for your review.
            </p>
          </div>
        ) : (
          changes.map((change) => {
            const isPending = change.status === "pending"
            const toolIcon =
              change.targetType === "card" ? (
                <FileText className="size-3.5 text-blue-500" />
              ) : change.targetType === "bibliography" ? (
                <BookOpen className="size-3.5 text-purple-500" />
              ) : change.targetType === "asset" ? (
                <ImageIcon className="size-3.5 text-emerald-500" />
              ) : (
                <Cpu className="size-3.5 text-amber-500" />
              )

            return (
              <div
                key={change.id}
                className={cn(
                  "rounded-lg border p-3 flex flex-col gap-2 transition-all bg-card/60 shadow-xs",
                  isPending ? "border-amber-500/40 hover:border-amber-500/60" : "border-border/60 opacity-80"
                )}
              >
                {/* Meta row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {toolIcon}
                    <span className="text-xs font-semibold font-mono">{change.toolName}</span>
                    {change.apiKeyName && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground px-1.5 py-0.2 rounded bg-muted/60">
                        <Key className="size-2.5" />
                        {change.apiKeyName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {change.status === "pending" && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-500">
                        Pending
                      </Badge>
                    )}
                    {change.status === "applied" && (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-500">
                        Applied
                      </Badge>
                    )}
                    {change.status === "rejected" && (
                      <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-500">
                        Rejected
                      </Badge>
                    )}
                    {change.status === "expired" && (
                      <Badge variant="outline" className="text-[10px] border-muted-foreground/50 text-muted-foreground">
                        Expired
                      </Badge>
                    )}
                    {change.status === "failed" && (
                      <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-500">
                        Failed
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Agent-supplied rationale wrapped as untrusted data (§9.3: no markdown execution) */}
                {change.rationale && (
                  <div className="rounded bg-muted/30 p-2 text-[11px] border border-border/50 text-foreground/90 font-mono whitespace-pre-wrap leading-relaxed">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold block mb-0.5">
                      Agent Rationale (Untrusted)
                    </span>
                    {change.rationale}
                  </div>
                )}

                {/* Diff preview */}
                {change.diffPreview && (
                  <div className="rounded bg-background/90 p-2 border border-border/70 text-[10px] font-mono flex flex-col gap-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                      <GitCompare className="size-3" />
                      <span>Proposed Mutation Diff</span>
                    </div>

                    {change.diffPreview.before && (
                      <div className="p-1.5 rounded bg-red-500/5 border border-red-500/20 text-red-700 dark:text-red-400">
                        <span className="font-bold block mb-0.5">Before:</span>
                        {typeof change.diffPreview.before === "string" ? (
                          <pre className="whitespace-pre-wrap">{change.diffPreview.before}</pre>
                        ) : (
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(change.diffPreview.before, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {change.diffPreview.after && (
                      <div className="p-1.5 rounded bg-emerald-500/5 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                        <span className="font-bold block mb-0.5">After:</span>
                        {typeof change.diffPreview.after === "string" ? (
                          <pre className="whitespace-pre-wrap">{change.diffPreview.after}</pre>
                        ) : (
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(change.diffPreview.after, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer with timestamp & actions */}
                <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground border-t border-border/40 mt-1">
                  <div className="flex items-center gap-1">
                    <Clock className="size-3" />
                    <span>{new Date(change.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleReject(change.id)}
                        disabled={processingId === change.id}
                        className="h-6 px-2 text-[10px] hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
                      >
                        <XCircle className="size-3 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => handleApprove(change.id)}
                        disabled={processingId === change.id}
                        className="h-6 px-2 text-[10px]"
                      >
                        <CheckCircle2 className="size-3 mr-1" />
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
