"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bot, ChevronDown, ChevronRight, ExternalLink, Loader2, Play, RefreshCw, Trash2, Wrench } from "lucide-react"
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
type PanelMode = "poster_research" | "improve_poster"

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

interface CardPatch {
  id: string
  content: string
  rationale: string
}

interface ImprovePosterIteration {
  iterationIndex: number
  patches: CardPatch[]
  diagnosis: string
  compileLog: string
}

interface ImprovePosterProposal {
  version: string
  summary: string
  iterations: ImprovePosterIteration[]
  cleanCompile: boolean
}

type AnyProposal = Proposal | ImprovePosterProposal

interface RunLogEvent {
  ts: string
  type: string
  message: string
}

interface RunStatus {
  runId: string
  status: "idle" | "queued" | "running" | "done" | "failed" | "cancelled"
  phase?: string
  proposal?: AnyProposal | null
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

const MAX_ITER_LABELS: Record<number, string> = {
  1: "1 iterácia (~3 min, ~$0.05)",
  3: "3 iterácie (~10 min, ~$0.18)",
  5: "5 iterácií (~18 min, ~$0.35)",
}

const PHASE_LABELS: Record<string, string> = {
  planning: "Plánovanie",
  researching: "Výskum",
  synthesizing: "Syntéza",
  writing: "Písanie",
  compiling: "Kompilácia",
  patching: "Aplikovanie opráv",
  finished: "Dokončené",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isImprovePosterProposal(p: AnyProposal | null | undefined): p is ImprovePosterProposal {
  return !!(p && "iterations" in p)
}

// ---------------------------------------------------------------------------
// Improve Poster Result View
// ---------------------------------------------------------------------------

function ImprovePosterResult({
  proposal,
  runId,
  projectId,
  busy,
  applied,
  onApply,
  onDiscard,
}: {
  proposal: ImprovePosterProposal
  runId: string
  projectId: string
  busy: boolean
  applied: boolean
  onApply: () => void
  onDiscard: () => void
}) {
  const [expandedIter, setExpandedIter] = useState<number | null>(null)

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-3 p-3">
        {/* Summary + compile status */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Výsledok opravy
          </p>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                proposal.cleanCompile
                  ? "bg-success/15 text-success"
                  : "bg-warning/15 text-warning"
              )}
            >
              {proposal.cleanCompile ? "✓ Čistá kompilácia" : "⚠ Kompilácia s varovaním"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {proposal.iterations.length} iteráci{proposal.iterations.length === 1 ? "a" : proposal.iterations.length < 5 ? "e" : "í"}
            </span>
          </div>
          {proposal.summary && (
            <p className="text-xs leading-relaxed text-muted-foreground">{proposal.summary}</p>
          )}
        </div>

        {/* Per-iteration accordion */}
        {proposal.iterations.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Iterácie ({proposal.iterations.length})
            </p>
            <div className="space-y-1.5">
              {proposal.iterations.map((iter) => (
                <div key={iter.iterationIndex} className="rounded-md border border-border">
                  <button
                    className="flex w-full items-center justify-between p-2 text-left"
                    onClick={() => setExpandedIter(expandedIter === iter.iterationIndex ? null : iter.iterationIndex)}
                  >
                    <span className="text-xs font-medium">
                      Iterácia {iter.iterationIndex + 1} — {iter.patches.length} záplat{iter.patches.length === 1 ? "a" : iter.patches.length < 5 ? "y" : ""}
                    </span>
                    {expandedIter === iter.iterationIndex
                      ? <ChevronDown className="size-3 text-muted-foreground" />
                      : <ChevronRight className="size-3 text-muted-foreground" />
                    }
                  </button>
                  {expandedIter === iter.iterationIndex && (
                    <div className="border-t border-border p-2 space-y-2">
                      {iter.diagnosis && (
                        <p className="text-[11px] text-muted-foreground">{iter.diagnosis}</p>
                      )}
                      {iter.patches.map((patch) => (
                        <div key={patch.id} className="rounded bg-muted/50 p-1.5 text-[10px]">
                          <span className="font-mono text-muted-foreground">{patch.id}</span>
                          {patch.rationale && (
                            <p className="mt-0.5 text-muted-foreground">{patch.rationale}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onApply} disabled={busy || applied}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {applied ? "Potvrdené" : "Potvrdiť zmeny"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDiscard}>
            Zahodiť
          </Button>
        </div>

        {applied && (
          <div className="space-y-1">
            <p className="text-[11px] text-success">
              ✓ Zmeny boli potvrdené. Snímky sú uložené pre prípadné vrátenie.
            </p>
            <button
              className="flex items-center gap-1 text-[11px] text-primary underline-offset-2 hover:underline"
              onClick={() => window.location.reload()}
            >
              <ExternalLink className="size-3" />
              Obnoviť stránku
            </button>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function DeerflowPanel({ projectId }: { projectId: string }) {
  const [serverEnabled, setServerEnabled] = useState<boolean | null>(null)
  const [workspaceRevision, setWorkspaceRevision] = useState<number>(0)

  // Sub-tab
  const [panelMode, setPanelMode] = useState<PanelMode>("poster_research")

  // Deep research state
  const [focus, setFocus] = useState("")
  const [depth, setDepth] = useState<Depth>("standard")

  // Improve poster state
  const [maxIterations, setMaxIterations] = useState<number>(3)

  // Shared state
  const [language, setLanguage] = useState<Language>("sk")
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [overBudget, setOverBudget] = useState(false)
  const [busy, setBusy] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<string | null>(null)
  const [phase, setPhase] = useState<string>("")
  const [logs, setLogs] = useState<RunLogEvent[]>([])
  const [proposal, setProposal] = useState<AnyProposal | null>(null)
  const [runError, setRunError] = useState<{ message: string; code: string } | null>(null)
  const [applied, setApplied] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const running = runStatus === "queued" || runStatus === "running"
  const canStartResearch = Boolean(serverEnabled) && focus.trim().length >= 10 && !running && !busy
  const canStartImprove = Boolean(serverEnabled) && !running && !busy

  // Load workspace toggle + revision
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
        // Panel stays in "unknown" state
      }
    })()
    return () => {
      cancelled = true
      esRef.current?.close()
    }
  }, [projectId])

  // Debounced estimate for current mode
  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        try {
          const body = panelMode === "improve_poster"
            ? { kind: "improve_poster", maxIterations }
            : { kind: "poster_research", depth }
          const res = await apiFetch(`/api/workspaces/${projectId}/deerflow/estimate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
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
  }, [projectId, panelMode, depth, maxIterations])

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
          setProposal(JSON.parse((e as MessageEvent).data) as AnyProposal)
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
        void refreshStatus(id)
      }
    },
    [projectId, refreshStatus]
  )

  const startResearchRun = async () => {
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
        const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string; details?: unknown }
        const message = typeof err.error === "string" ? err.error : (err.message ?? "Failed to start research run")
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

  const startImproveRun = async () => {
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
          kind: "improve_poster",
          language,
          maxIterations,
          confirmEstimate: true,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
        const message = typeof err.error === "string" ? err.error : (err.message ?? "Failed to start improve run")
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
      const route = panelMode === "improve_poster"
        ? `/api/workspaces/${projectId}/deerflow/runs/${runId}/apply-improve`
        : `/api/workspaces/${projectId}/deerflow/runs/${runId}/apply`
      const res = await apiFetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => ({}))) as {
        appliedCardIds?: string[]
        appliedPatches?: number
        bibAdded?: number
        skippedDuplicates?: number
        cleanCompile?: boolean
        error?: { message?: string }
      }
      if (!res.ok) {
        throw new Error(data.error?.message ?? "Apply failed")
      }
      setApplied(true)
      if (panelMode === "improve_poster") {
        toast.success("Improve poster potvrdený", {
          description: `${data.appliedPatches ?? 0} záplat aplikovaných${data.cleanCompile ? " · čistá kompilácia ✓" : ""}`,
        })
      } else {
        toast.success("Deep research applied", {
          description: `${data.appliedCardIds?.length ?? 0} kariet · ${data.bibAdded ?? 0} citácií`,
        })
      }
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
        const data = (await res.json().catch(() => ({}))) as { error?: string }
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

  const phaseLabel = PHASE_LABELS[phase] ?? phase

  const researchProposal = !isImprovePosterProposal(proposal) ? (proposal as Proposal | null) : null
  const improveProposal = isImprovePosterProposal(proposal) ? proposal : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Sub-tab switcher */}
      <div className="flex border-b border-border">
        <button
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium",
            panelMode === "poster_research"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => { setPanelMode("poster_research"); setProposal(null); setRunStatus(null); setLogs([]); setRunError(null) }}
        >
          <Bot className="size-3.5" />
          Deep research
        </button>
        <button
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium",
            panelMode === "improve_poster"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => { setPanelMode("improve_poster"); setProposal(null); setRunStatus(null); setLogs([]); setRunError(null) }}
        >
          <Wrench className="size-3.5" />
          Opraviť poster
        </button>
      </div>

      {/* Controls */}
      <div className="space-y-2.5 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {panelMode === "poster_research" ? <Bot className="size-3.5" /> : <Wrench className="size-3.5" />}
            {panelMode === "poster_research" ? "Deep research kopilot" : "Autonómna oprava"}
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

        {/* Deep research specific */}
        {panelMode === "poster_research" && (
          <Textarea
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Čo má agent preskúmať? (min. 10 znakov)"
            className="min-h-[64px] resize-none text-xs"
          />
        )}

        {/* Improve poster specific */}
        {panelMode === "improve_poster" && (
          <div className="rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
            Agent skompiluje poster, diagnostikuje chyby a navrhne opravy Markdown obsahu kartičiek.
            Pred každou dávkou záplat sa vytvorí záloha.
          </div>
        )}

        <div className={cn("gap-2", panelMode === "poster_research" ? "grid grid-cols-2" : "grid grid-cols-2")}>
          <UiSelect value={language} onValueChange={(v) => setLanguage(v as Language)}>
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sk">Slovenčina</SelectItem>
              <SelectItem value="cs">Čeština</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </UiSelect>

          {panelMode === "poster_research" ? (
            <UiSelect value={depth} onValueChange={(v) => setDepth(v as Depth)}>
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fast">{DEPTH_LABELS.fast}</SelectItem>
                <SelectItem value="standard">{DEPTH_LABELS.standard}</SelectItem>
                <SelectItem value="deep">{DEPTH_LABELS.deep}</SelectItem>
              </SelectContent>
            </UiSelect>
          ) : (
            <UiSelect
              value={String(maxIterations)}
              onValueChange={(v) => setMaxIterations(Number(v))}
            >
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{MAX_ITER_LABELS[1]}</SelectItem>
                <SelectItem value="3">{MAX_ITER_LABELS[3]}</SelectItem>
                <SelectItem value="5">{MAX_ITER_LABELS[5]}</SelectItem>
              </SelectContent>
            </UiSelect>
          )}
        </div>

        <span className={cn("block text-[11px] text-muted-foreground", overBudget && "text-destructive")}>
          {budgetLine}
        </span>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={panelMode === "poster_research" ? !canStartResearch : !canStartImprove}
            onClick={() => void (panelMode === "poster_research" ? startResearchRun() : startImproveRun())}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {panelMode === "poster_research" ? "Spustiť výskum" : "Spustiť opravu"}
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
            <span className="font-medium capitalize">{phaseLabel || phase || runStatus}</span>
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

      {/* Improve poster result */}
      {improveProposal && runId && (
        <ImprovePosterResult
          proposal={improveProposal}
          runId={runId}
          projectId={projectId}
          busy={busy}
          applied={applied}
          onApply={() => void applyProposal()}
          onDiscard={() => { setProposal(null); setRunStatus(null) }}
        />
      )}

      {/* Deep research proposal */}
      {researchProposal && (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 p-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Návrh výskumu
              </p>
              <p className="text-xs leading-relaxed">{researchProposal.summary}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Sekcie ({researchProposal.sectionDrafts.length})
              </p>
              <div className="space-y-1.5">
                {researchProposal.sectionDrafts.map((draft, i) => (
                  <div key={i} className="rounded-md border border-border p-2">
                    <p className="text-xs font-medium">{draft.title}</p>
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
                Zdroje ({researchProposal.sources.length}) · Citácie ({researchProposal.citations.length})
              </p>
              <div className="space-y-1">
                {researchProposal.sources.slice(0, 10).map((source, i) => (
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
