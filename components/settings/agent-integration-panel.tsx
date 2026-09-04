'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Key, Copy, Check, Trash2, RefreshCw, Shield, AlertCircle, Clock } from 'lucide-react'

const ALL_SCOPES = [
  'workspace:read',
  'workspace:write',
  'bibliography:read',
  'bibliography:write',
  'assets:read',
  'assets:write',
  'rag:query',
  'review:run',
  'compile:run',
  'ingestion:run',
  'snapshot:create',
]

interface AgentKeyItem {
  id: string
  name: string
  scopes: string[]
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

interface AuditLogItem {
  id: string
  toolName: string
  workspaceId: string | null
  calledAt: string
  durationMs: number | null
  approved: boolean
  apiKey: { name: string }
}

export function AgentIntegrationPanel() {
  const [keys, setKeys] = useState<AgentKeyItem[]>([])
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [keyName, setKeyName] = useState('DeerFlow Agent')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'workspace:read',
    'workspace:write',
    'bibliography:read',
    'bibliography:write',
    'assets:read',
    'rag:query',
    'review:run',
    'compile:run',
    'snapshot:create',
  ])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)

  async function fetchKeys() {
    try {
      const res = await fetch('/api/agent-keys')
      if (res.ok) {
        const data = await res.json()
        setKeys(data)
      }
    } catch (e) {
      console.error('Failed to load agent keys:', e)
    }
  }

  async function fetchLogs() {
    setLoadingLogs(true)
    try {
      const res = await fetch('/api/agent-keys/audit')
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e)
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    fetchKeys()
    fetchLogs()
  }, [])

  async function generateKey() {
    if (!keyName.trim() || selectedScopes.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/agent-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: keyName,
          scopes: selectedScopes,
          expiresInDays: 90,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setNewKey(data.key)
        fetchKeys()
      }
    } catch (e) {
      console.error('Failed to generate key:', e)
    } finally {
      setLoading(false)
    }
  }

  async function revokeKey(id: string) {
    try {
      const res = await fetch('/api/agent-keys/' + id, { method: 'DELETE' })
      if (res.ok) {
        fetchKeys()
      }
    } catch (e) {
      console.error('Failed to revoke key:', e)
    }
  }

  function handleCopy() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-4xl p-1">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="size-5 text-primary" />
          DeerFlow Integration
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your PosterApp workspaces to your DeerFlow super-agent. Scopes enforce granular permissions. Proposed changes are written immediately and reversible via snapshot.
        </p>
      </div>

      {/* Scope selector */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="agent-key-name" className="text-sm font-medium">Integration Name</Label>
          <Input
            id="agent-key-name"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="DeerFlow Agent"
            className="max-w-sm"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Allowed Scopes</Label>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => setSelectedScopes([...ALL_SCOPES])}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => setSelectedScopes([])}
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_SCOPES.map((scope) => {
              const selected = selectedScopes.includes(scope)
              return (
                <Badge
                  key={scope}
                  variant={selected ? 'default' : 'outline'}
                  className="cursor-pointer select-none transition-colors text-xs py-1 px-2"
                  onClick={() =>
                    setSelectedScopes((prev) =>
                      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
                    )
                  }
                >
                  {scope}
                </Badge>
              )
            })}
          </div>
        </div>

        <Button onClick={generateKey} disabled={loading || !keyName.trim() || selectedScopes.length === 0} className="gap-2">
          <Key className="size-4" />
          {loading ? 'Generating...' : 'Generate API Key'}
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
                Set this key as <code className="font-mono text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">POSTERAPP_AGENT_KEY</code> in your DeerFlow <code className="font-mono">.env</code> file.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleCopy} className="shrink-0 gap-1.5">
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied!' : 'Copy Key'}
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
          Active Agent API Keys ({keys.length})
        </h3>
        {keys.length === 0 ? (
          <p className="text-xs text-muted-foreground italic border rounded-lg p-4 text-center">
            No active agent keys. Generate one above to connect DeerFlow.
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{k.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      Created {new Date(k.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {k.scopes.map((s) => (
                      <span key={s} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
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

      {/* Recent agent activity audit log */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            Recent Agent Activity (Audit Log)
          </h3>
          <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loadingLogs} className="h-7 text-xs gap-1">
            <RefreshCw className={'size-3 ' + (loadingLogs ? 'animate-spin' : '')} />
            Refresh
          </Button>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic border rounded-lg p-4 text-center">
            No agent activity recorded yet.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto divide-y divide-border text-xs">
              {logs.map((log) => (
                <div key={log.id} className="p-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <code className="font-mono font-semibold text-primary truncate">{log.toolName}</code>
                    {log.workspaceId && (
                      <span className="text-muted-foreground truncate max-w-[120px]">
                        ws: {log.workspaceId}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                    {log.durationMs !== null && <span>{log.durationMs}ms</span>}
                    <span>{new Date(log.calledAt).toLocaleTimeString()}</span>
                    {log.approved && (
                      <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-500">
                        Approved
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
