"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Key,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Shield,
  AlertCircle,
  AlertTriangle,
  Clock,
  Lock,
  Building2,
  ExternalLink,
} from "lucide-react"

export const ALL_AGENT_SCOPES = [
  "workspace:read",
  "workspace:write",
  "bibliography:read",
  "bibliography:write",
  "assets:read",
  "assets:write",
  "rag:query",
  "review:run",
  "compile:run",
  "ingestion:run",
  "snapshot:create",
  "changes:read",
] as const

import { AGENT_SCOPE_PRESETS, type AgentScopePreset } from "@/lib/agent-launch"

export { type AgentScopePreset }
const PRESET_SCOPES = AGENT_SCOPE_PRESETS

interface AgentKeyItem {
  id: string
  name: string
  scopes: string[]
  workspaceId: string | null
  workspace?: {
    id: string
    name: string
  } | null
  restrictCardIds?: string[]
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
}

interface AuditLogItem {
  id: string
  toolName: string
  workspaceId: string | null
  calledAt: string
  durationMs: number | null
  ok: boolean
  errorCode: string | null
  changeId: string | null
  args: any
  result: any
  apiKey: { name: string }
}

interface WorkspaceOption {
  id: string
  name: string
}

export function AgentIntegrationPanel() {
  const [keys, setKeys] = useState<AgentKeyItem[]>([])
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [keyName, setKeyName] = useState("DeerFlow Agent")
  const [preset, setPreset] = useState<AgentScopePreset>("research-propose")
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    ...PRESET_SCOPES["research-propose"],
  ])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("")
  const [expiresInDays, setExpiresInDays] = useState<number>(30)

  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function fetchWorkspaces() {
    try {
      const res = await fetch("/api/workspaces")
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setWorkspaces(data.map((w: any) => ({ id: w.id, name: w.name || "Untitled" })))
          if (data.length > 0 && !selectedWorkspaceId) {
            setSelectedWorkspaceId(data[0].id)
          }
        }
      }
    } catch (e) {
      console.error("Failed to load workspaces:", e)
    }
  }

  async function fetchKeys() {
    try {
      const res = await fetch("/api/agent-keys")
      if (res.ok) {
        const data = await res.json()
        setKeys(data)
      }
    } catch (e) {
      console.error("Failed to load agent keys:", e)
    }
  }

  async function fetchLogs() {
    setLoadingLogs(true)
    try {
      const res = await fetch("/api/agent-keys/audit")
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
      }
    } catch (e) {
      console.error("Failed to load audit logs:", e)
    } finally {
      setLoadingLogs(false)
    }
  }

  const [activityTab, setActivityTab] = useState<"logs" | "changes">("logs")
  const [changes, setChanges] = useState<any[]>([])
  const [loadingChanges, setLoadingChanges] = useState(false)

  async function fetchChanges() {
    setLoadingChanges(true)
    try {
      const res = await fetch("/api/agent-keys/changes")
      if (res.ok) {
        const data = await res.json()
        setChanges(data)
      }
    } catch (e) {
      console.error("Failed to load agent changes:", e)
    } finally {
      setLoadingChanges(false)
    }
  }

  useEffect(() => {
    fetchWorkspaces()
    fetchKeys()
    fetchLogs()
    fetchChanges()
  }, [])

  function handlePresetChange(p: AgentScopePreset) {
    setPreset(p)
    setErrorMessage(null)
    if (p === "full") {
      setSelectedScopes(["*"])
    } else if (p === "custom") {
      // keep current selection
    } else {
      setSelectedScopes([...PRESET_SCOPES[p]])
      if (!selectedWorkspaceId && workspaces.length > 0) {
        setSelectedWorkspaceId(workspaces[0].id)
      }
    }
  }

  async function generateKey() {
    if (!keyName.trim()) {
      setErrorMessage("Key name is required.")
      return
    }
    if (selectedScopes.length === 0) {
      setErrorMessage("At least one scope must be selected.")
      return
    }
    if (preset !== "full" && !selectedWorkspaceId) {
      setErrorMessage("Please select a target workspace for this scoped key.")
      return
    }

    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch("/api/agent-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName.trim(),
          scopes: selectedScopes,
          workspaceId: preset === "full" ? null : selectedWorkspaceId || null,
          expiresInDays,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429) {
          setErrorMessage(
            data.error || "Rate limit exceeded. Maximum 5 key creations per hour."
          )
        } else {
          setErrorMessage(data.error || "Failed to create agent key.")
        }
        return
      }

      setNewKey(data.key)
      fetchKeys()
    } catch (e: any) {
      console.error("Failed to generate key:", e)
      setErrorMessage(e?.message || "Failed to generate key.")
    } finally {
      setLoading(false)
    }
  }

  async function revokeKey(id: string) {
    try {
      const res = await fetch(`/api/agent-keys/${id}`, { method: "DELETE" })
      if (res.ok) {
        fetchKeys()
      }
    } catch (e) {
      console.error("Failed to revoke key:", e)
    }
  }

  function handleCopy() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activeKeys = keys.filter((k) => !k.revokedAt)
  const revokedKeys = keys.filter((k) => !!k.revokedAt)

  return (
    <div className="space-y-6 max-w-4xl p-1">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="size-5 text-primary" />
          DeerFlow Integration & Agent Keys
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your PosterApp workspaces to your DeerFlow agent via MCP or REST. Keys use
          cryptographic SHA-256 token hashing and granular workspace scoping. Proposed changes
          are enqueued in your approval queue and applied only after human review.
        </p>
      </div>

      {/* Migration Notice */}
      <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3.5 flex items-start gap-3">
        <Lock className="size-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Hardened Credential Storage:</span>{" "}
          API keys are hashed with SHA-256; raw keys are never stored in the database and are
          only displayed once upon creation. Any legacy unhashed keys have been revoked for
          security.
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-2.5 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Key creation form */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agent-key-name" className="text-sm font-medium">
              Integration Name
            </Label>
            <Input
              id="agent-key-name"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g. DeerFlow Agent, Weekly Sentinel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-key-expiry" className="text-sm font-medium">
              Expiry
            </Label>
            <select
              id="agent-key-expiry"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value={30}>30 days (default)</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Security Preset</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handlePresetChange("research-ro")}
              className={`p-3 text-left rounded-lg border transition-colors ${
                preset === "research-ro"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border hover:bg-muted/40 text-muted-foreground"
              }`}
            >
              <div className="font-semibold text-xs flex items-center gap-1.5">
                <Shield className="size-3.5 text-primary" />
                Research (Read-Only)
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Reads workspace cards, bib, assets, and runs RAG queries. No mutations.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handlePresetChange("research-propose")}
              className={`p-3 text-left rounded-lg border transition-colors ${
                preset === "research-propose"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border hover:bg-muted/40 text-muted-foreground"
              }`}
            >
              <div className="font-semibold text-xs flex items-center gap-1.5">
                <Shield className="size-3.5 text-emerald-500" />
                Research + Propose
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Full read + write proposals (cards, bib, assets) scoped to a single workspace.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handlePresetChange("full")}
              className={`p-3 text-left rounded-lg border transition-colors ${
                preset === "full"
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border hover:bg-muted/40 text-muted-foreground"
              }`}
            >
              <div className="font-semibold text-xs flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-destructive" />
                Full (Unscoped)
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                All scopes across all current and future workspaces. High privilege.
              </p>
            </button>
          </div>
        </div>

        {/* Unscoped Warning */}
        {preset === "full" && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-2.5 text-xs text-destructive">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Caution: Unscoped Key.</span> This API key will grant
              access to <strong>all workspaces</strong> accessible to your user account without
              workspace boundary isolation. Use only if required.
            </div>
          </div>
        )}

        {/* Workspace Scoping */}
        <div className="space-y-2">
          <Label htmlFor="agent-workspace" className="text-sm font-medium flex items-center gap-1.5">
            <Building2 className="size-3.5 text-muted-foreground" />
            Workspace Boundary
          </Label>
          {preset === "full" ? (
            <div className="p-2.5 rounded border border-border bg-muted/30 text-xs text-muted-foreground">
              All workspaces (unrestricted access)
            </div>
          ) : (
            <select
              id="agent-workspace"
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {workspaces.length === 0 ? (
                <option value="">No workspaces found</option>
              ) : (
                workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({ws.id})
                  </option>
                ))
              )}
            </select>
          )}
        </div>

        {/* Scopes display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Active Scopes ({selectedScopes.length})</Label>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => {
                  setPreset("custom")
                  setSelectedScopes([...ALL_AGENT_SCOPES])
                }}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => {
                  setPreset("custom")
                  setSelectedScopes([])
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {preset === "full" ? (
              <Badge variant="destructive" className="font-mono text-xs">
                * (all scopes)
              </Badge>
            ) : (
              ALL_AGENT_SCOPES.map((scope) => {
                const selected = selectedScopes.includes(scope)
                return (
                  <Badge
                    key={scope}
                    variant={selected ? "default" : "outline"}
                    className="cursor-pointer select-none transition-colors text-xs py-1 px-2"
                    onClick={() => {
                      setPreset("custom")
                      setSelectedScopes((prev) =>
                        prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
                      )
                    }}
                  >
                    {scope}
                  </Badge>
                )
              })
            )}
          </div>
        </div>

        <Button
          onClick={generateKey}
          disabled={loading || !keyName.trim() || selectedScopes.length === 0}
          className="gap-2"
        >
          <Key className="size-4" />
          {loading ? "Generating..." : "Generate API Key"}
        </Button>
      </div>

      {/* One-time key display */}
      {newKey && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-amber-500 flex items-center gap-1.5">
                <AlertCircle className="size-4" />
                Copy this key now — it will never be displayed again
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set this key as{" "}
                <code className="font-mono text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">
                  POSTERAPP_AGENT_KEY
                </code>{" "}
                in your DeerFlow <code className="font-mono">.env</code> or config.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleCopy} className="shrink-0 gap-1.5">
              {copied ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied!" : "Copy Key"}
            </Button>
          </div>
          <div className="font-mono text-xs p-2.5 rounded bg-background/80 border border-border select-all break-all">
            {newKey}
          </div>
        </div>
      )}

      {/* Active keys list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Key className="size-4 text-muted-foreground" />
          Active Agent API Keys ({activeKeys.length})
        </h3>
        {activeKeys.length === 0 ? (
          <p className="text-xs text-muted-foreground italic border rounded-lg p-4 text-center">
            No active agent keys. Generate one above to connect DeerFlow.
          </p>
        ) : (
          <div className="space-y-2">
            {activeKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{k.name}</span>
                    {k.workspaceId ? (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Building2 className="size-2.5" />
                        {k.workspace?.name || k.workspaceId}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">
                        All Workspaces
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      Created {new Date(k.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {k.scopes.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeKey(k.id)}
                  className="text-destructive hover:bg-destructive/10 shrink-0 h-8 gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked keys list */}
      {revokedKeys.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            Revoked Keys ({revokedKeys.length})
          </h3>
          <div className="space-y-2 opacity-70">
            {revokedKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-2.5 gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs line-through text-muted-foreground">
                      {k.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                      Revoked
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {k.revokedAt ? new Date(k.revokedAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent activity: Audit Log & Changes tabs (§9.3) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <div className="flex bg-muted/60 p-0.5 rounded-md border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setActivityTab("logs")}
                className={cn(
                  "px-2.5 py-1 rounded font-medium transition-colors",
                  activityTab === "logs"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Audit Log ({logs.length})
              </button>
              <button
                type="button"
                onClick={() => setActivityTab("changes")}
                className={cn(
                  "px-2.5 py-1 rounded font-medium transition-colors",
                  activityTab === "changes"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Changes ({changes.length})
              </button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (activityTab === "logs") fetchLogs()
              else fetchChanges()
            }}
            disabled={loadingLogs || loadingChanges}
            className="h-7 text-xs gap-1"
          >
            <RefreshCw
              className={
                "size-3 " + (loadingLogs || loadingChanges ? "animate-spin" : "")
              }
            />
            Refresh
          </Button>
        </div>

        {activityTab === "logs" ? (
          logs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic border rounded-lg p-4 text-center">
              No agent activity recorded yet.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto divide-y divide-border text-xs">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors gap-2"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <code className="font-mono font-semibold text-primary truncate">
                        {log.toolName}
                      </code>
                      {log.workspaceId && (
                        <span className="text-muted-foreground truncate max-w-[120px]">
                          ws: {log.workspaceId}
                        </span>
                      )}
                      {log.changeId && (
                        <Badge variant="outline" className="text-[9px]">
                          change: {log.changeId.slice(0, 8)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                      {log.durationMs !== null && <span>{log.durationMs}ms</span>}
                      <span>{new Date(log.calledAt).toLocaleTimeString()}</span>
                      {log.ok ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-emerald-500/10 text-emerald-500"
                        >
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">
                          {log.errorCode || "Failed"}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : changes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic border rounded-lg p-4 text-center">
            No agent change proposals recorded yet.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="max-h-[320px] overflow-y-auto divide-y divide-border text-xs">
              {changes.map((change) => (
                <div
                  key={change.id}
                  className="p-2.5 flex flex-col gap-1.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="font-mono font-semibold text-foreground truncate">
                        {change.toolName}
                      </code>
                      <span className="text-muted-foreground truncate text-[11px]">
                        {change.workspaceName || change.workspaceId}
                      </span>
                      <span className="text-muted-foreground text-[10px] bg-muted/80 px-1 rounded">
                        {change.apiKeyName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(change.createdAt).toLocaleDateString()}
                      </span>
                      {change.status === "pending" && (
                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-500">
                          Pending
                        </Badge>
                      )}
                      {change.status === "applied" && (
                        <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-500">
                          Applied
                        </Badge>
                      )}
                      {change.status === "rejected" && (
                        <Badge variant="outline" className="text-[10px] border-red-500 text-red-500">
                          Rejected
                        </Badge>
                      )}
                      {change.status === "failed" && (
                        <Badge variant="destructive" className="text-[10px]">
                          Failed
                        </Badge>
                      )}
                      {change.status === "expired" && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Expired
                        </Badge>
                      )}
                    </div>
                  </div>
                  {change.rationale && (
                    <div className="text-[11px] font-mono text-muted-foreground bg-muted/40 p-1.5 rounded truncate">
                      Rationale: {change.rationale}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
