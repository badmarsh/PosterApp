"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bot, ExternalLink, Loader2, Play, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select as UiSelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types (client-side view only; server validation lives in lib/deerflow)
// ---------------------------------------------------------------------------

type Language = "sk" | "cs" | "en"
type Depth = "fast" | "standard" | "deep"

interface SourceRef {
  title: string
  url?: string
  doi?: string
  venue?: string
  year?: string
  retrievedFrom?: string
  confidence?: number
}

interface Citation {
  title: string
  authors?: string[]
  year?: string
  doi?: string
  url?: string
}

interface SectionDraft {
  title: string
  bullets: string[]
  suggestedAssetIds?: string[]
}

interface Proposal {
  version: string
  summary: string
  sources: SourceRef[]
  citations: Citation[]
  sectionDrafts: SectionDraft[]
  openQuestions: string[]
}

interface RunLogEvent {
  ts: string
  type: string
  message: string
}

interface RunStatus {
  runId: string
  status: "idle" | "queued" | "running" | "done" | "failed" | "cancelled"
  phase?: string
  proposal?: Proposal | null
  error?: { message: string; code: string } | null
  events?: RunLogEvent[]
}

interface Estimate {
  minutes: number
  usd: number
  description: string
}

const DEPTH_LABELS: Record<Depth, string> = {
  fast: "Rýchly (5 min)",
  standard: "Štandard (15 min)",
  deep: "Hĺbkový (30 min)",
}

export function DeerflowPanel({ projectId }: { projectId: string }) {
  const [serverEnabled, setServerEnabled] = useState<boolean | null>(null)
  const [workspaceRevision, setWorkspaceRevision] = useState<number>(0)
  const [focus, setFocus] = useState("")
  const [language, setLanguage] = useState<Language>("sk")
  const [depth, setDepth] = useState<Depth>("standard")
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [overBudget, setOverBudget] = useState(false)
  const [busy, setBusy] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<string | null>(null)
  const [phase, setPhase] = useState<string>("")
  const [logs, setLogs] = useState<RunLogEvent[]>([])
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [runError, setRunError] = useState<{ message: string; code: string } | null>(null)
  const [applied, setApplied] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const running = runStatus === "queued" || runStatus === "running"
  const canStart = Boolean(serverEnabled) && focus.trim().length >= 10 && !running && !busy

  // Load the per-workspace toggle + revision.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch(`/api/workspaces/${projectId}`)
        if (!res.ok) return
        const data = (await res.json()) as { deerflowEnabled?: boolean; revision?: number }
        if (cancelled) return
        setServerEnabled(data.deerflowEnabled !== false)
        setWorkspaceRevision(data.revision ?? 0)
      } catch {
        // Panel stays in "unknown" state; the server enforces on use.
      }
    })()
    return () => {
      cancelled = true
      esRef.current?.close()
    }
  }, [projectId])

  // Debounced estimate.
  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await apiFetch(`/api/workspaces/${projectId}/deerflow/estimate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ depth }),
          })
          if (!res.ok) return
          const data = (await res.json()) as { estimate: Estimate; willExceed: boolean }
          setEstimate(data.estimate)
          setOverBudget(data.willExceed)
        } catch {
          // offline / not enabled — estimate stays null
        }
      })()
    }, 400)
    return () => clearTimeout(t)
  }, [projectId, depth])

  const refreshStatus = useCallback(
    async (id: string) => {
      try {
        const res = await apiFetch(`/api/workspaces/${projectId}/deerflow/runs/${id}`)
        if (!res.ok) return
        const data = (await res.json()) as RunStatus
        setRunStatus(data.status)
        setPhase(data.phase ?? "")
        if (data.proposal) setProposal(data.proposal)
        if (data.error) setRunError(data.error)
        if (data.events) setLogs(data.events)
      } catch {
        // ignore
      }
    },
    [projectId]
  )

  const connectStream = useCallback(
    (id: string) => {
      esRef.current?.close()
      const es = new EventSource(`/api/workspaces/${projectId}/deerflow/runs/${id}/stream`)
      esRef.current = es

      es.addEventListener("log", (e) => {
        try {
          const evt = JSON.parse((e as MessageEvent).data) as RunLogEvent
          setLogs((prev) => [...prev.slice(-99), evt])
        } catch {
          // ignore malformed frame
        }
      })
      es.addEventListener("progress", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data) as { status: string; phase?: string }
          setRunStatus(data.status)
          setPhase(data.phase ?? "")
        } catch {
          // ignore
        }
      })
      es.addEventListener("proposal", (e) => {
        try {
          setProposal(JSON.parse((e as MessageEvent).data) as Proposal)
        } catch {
          // ignore
        }
      })
      es.addEventListener("error", (e) => {
        try {
          setRunError(JSON.parse((e as MessageEvent).data) as { message: string; code: string })
        } catch {
          setRunError({ message: "Agent stream error", code: "DEERFLOW_STREAM_ERROR" })
        }
      })
      es.addEventListener("done", (e) => {
        es.close()
        esRef.current = null
        try {
          const data = JSON.parse((e as MessageEvent).data) as { status: string }
          setRunStatus(data.status)
        } catch {
          // ignore
        }
        void refreshStatus(id)
      })
      es.onerror = () => {
        // EventSource auto-reconnects; refetch status so the UI is not stale.
        void refreshStatus(id)
      }
    },
    [projectId, refreshStatus]
  )

  const startRun = async () => {
    setBusy(true)
    setRunError(null)
    setProposal(null)
    setLogs([])
    setApplied(false)
    try {
      const res = await apiFetch(`/api/workspaces/${projectId}/deerflow/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "poster_research",
          language,
          focus: focus.trim(),
          depth,
          includeAssets: true,
          confirmEstimate: true,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string }; message?: string }
        const message = err.error?.message ?? err.message ?? "Failed to start research run"
        setRunError({ message, code: "DEERFLOW_START_FAILED" })
        return
      }
      const data = (await res.json()) as { runId: string }
      setRunId(data.runId)
      setRunStatus("queued")
      connectStream(data.runId)
    } finally {
      setBusy(false)
    }
  }

  const cancelRun = async () => {
    if (!runId) return
    try {
      await apiFetch(`/api/workspaces/${projectId}/deerflow/threads/${runId}`, { method: "DELETE" })
      setRunStatus("cancelled")
      setRunError({ message: "Run cancelled", code: "DEERFLOW_CANCELLED" })
      esRef.current?.close()
      esRef.current = null
    } catch {
      // best-effort
    }
  }

  const applyProposal = async () => {
    if (!runId) return
    setBusy(true)
    try {
      const res = await apiFetch(`/api/workspaces/${projectId}/deerflow/runs/${runId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => ({}))) as {
        appliedCardIds?: string[]
        bibAdded?: number
        skippedDuplicates?: number
        error?: { message?: string }
      }
      if (!res.ok) {
        throw new Error(data.error?.message ?? "Apply failed")
      }
      setApplied(true)
      toast.success("Deep research applied", {
        description: `${data.appliedCardIds?.length ?? 0} cards · ${data.bibAdded ?? 0} citations · ${data.skippedDuplicates ?? 0} duplicates skipped`,
      })
    } catch (err) {
      toast.error("Failed to apply", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusy(false)
    }
  }

  const toggleEnabled = async (next: boolean) => {
    try {
      const res = await apiFetch(`/api/workspaces/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: workspaceRevision, deerflowEnabled: next }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; details?: unknown }
        toast.error("Could not change setting", { description: data.error })
        return
      }
      const data = (await res.json()) as { revision?: number }
      setServerEnabled(next)
      if (data.revision) setWorkspaceRevision(data.revision)
      toast.success(next ? "DeerFlow enabled" : "DeerFlow disabled for this workspace")
    } catch {
      toast.error("Could not change setting")
    }
  }

  const budgetLine = useMemo(() => {
    if (!estimate) return "Vyžaduje sa DeerFlow sidecar (DEERFLOW_ENABLED=1)."
    const eta = `~${estimate.minutes} min · ~$${estimate.usd.toFixed(2)}`
    return overBudget ? `${eta} — denný rozpočet vyčerpaný!` : eta
  }, [estimate, overBudget])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Controls */}
      <div className="space-y-2.5 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Bot className="size-3.5" />
            Deep research kopilot
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">
              {serverEnabled ? "Zapnuté" : "Vypnuté"}
            </span>
            <Switch
              checked={serverEnabled === true}
              onCheckedChange={(v) => void toggleEnabled(v === true)}
              disabled={serverEnabled === null}
              aria-label="Enable DeerFlow for this workspace"
            />
          </div>
        </div>

        <Textarea
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="Čo má agent preskúmať? (min. 10 znakov)"
          className="min-h-[64px] resize-none text-[12px]"
        />

        <div className="grid grid-cols-2 gap-2">
          <UiSelect value={language} onValueChange={(v) => setLanguage(v as Language)}>
            <SelectTrigger size="sm" className="text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sk">Slovenčina</SelectItem>
              <SelectItem value="cs">Čeština</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </UiSelect>
          <UiSelect value={depth} onValueChange={(v) => setDepth(v as Depth)}>
            <SelectTrigger size="sm" className="text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fast">{DEPTH_LABELS.fast}</SelectItem>
              <SelectItem value="standard">{DEPTH_LABELS.standard}</SelectItem>
              <SelectItem value="deep">{DEPTH_LABELS.deep}</SelectItem>
            </SelectContent>
          </UiSelect>
        </div>

        <span className={cn("block text-[11px] text-muted-foreground", overBudget && "text-destructive")}>
          {budgetLine}
        </span>

        <div className="flex items-center gap-2">
          <Button size="sm" className="flex-1" disabled={!canStart} onClick={() => void startRun()}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            Spustiť výskum
          </Button>
          {running && runId && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              aria-label="Cancel run"
              onClick={() => void cancelRun()}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Live status */}
      {(running || runStatus === "done") && (
        <div className="space-y-2 border-b border-border p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium capitalize">{phase || runStatus}</span>
            <span className="text-muted-foreground">{runStatus}</span>
          </div>
          {running && <Progress value={33} className="animate-pulse" />}
          {logs.length > 0 && (
            <ScrollArea className="h-28">
              <div className="space-y-1 font-mono text-[10px] leading-snug text-muted-foreground">
                {logs.map((log, i) => (
                  <div key={i} className="truncate" title={log.message}>
                    {log.message}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          {runError && !running && (
            <p className="rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
              {runError.message}
            </p>
          )}
        </div>
      )}

      {/* Proposal */}
      {proposal && (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 p-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Návrh výskumu
              </p>
              <p className="text-[12px] leading-relaxed">{proposal.summary}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Sekcie ({proposal.sectionDrafts.length})
              </p>
              <div className="space-y-1.5">
                {proposal.sectionDrafts.map((draft, i) => (
                  <div key={i} className="rounded-md border border-border p-2">
                    <p className="text-[12px] font-medium">{draft.title}</p>
                    <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
                      {draft.bullets.map((bullet, j) => (
                        <li key={j} className="truncate" title={bullet}>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void applyProposal()} disabled={busy || applied}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                {applied ? "Použité" : "Použiť do plátna"}
              </Button>
              {runId && (
                <Button size="sm" variant="ghost" onClick={() => void cancelRun()}>
                  Zahodiť
                </Button>
              )}
            </div>

            {applied && (
              <button
                className="flex items-center gap-1 text-[11px] text-primary underline-offset-2 hover:underline"
                onClick={() => window.location.reload()}
              >
                <ExternalLink className="size-3" />
                Obnoviť stránku a zobraziť nové karty
              </button>
            )}

            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Zdroje ({proposal.sources.length}) · Citácie ({proposal.citations.length})
              </p>
              <div className="space-y-1">
                {proposal.sources.slice(0, 10).map((source, i) => (
                  <div key={i} className="truncate text-[11px]" title={source.title}>
                    • {source.title}
                    {source.confidence !== undefined && source.confidence < 0.5
                      ? " (noverifikované)"
                      : ""}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      )}

      {!proposal && !running && serverEnabled === false && (
        <p className="p-3 text-[11px] text-muted-foreground">
          Deep research je pre tento workspace vypnutý. Zapnite ho prepínačom vyššie.
        </p>
      )}
    </div>
  )
}
