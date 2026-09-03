"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Loader2, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Member = { userId: string; role: "owner" | "editor" | "viewer"; email: string | null; name: string | null; imageUrl: string | null }

/**
 * "Share" for Live Collab: shows who has access, lets the owner add a co-author
 * by e-mail, and copies a direct workspace link. Previously the only way to
 * collaborate was to already know the workspace ID and be a member.
 */
export function ShareWorkspaceDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceName: string
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [myRole, setMyRole] = useState<Member["role"] | null>(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"editor" | "viewer">("editor")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/workspaces/${workspaceId}/members`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
      setMembers(data.members ?? [])
      setMyRole(data.me?.role ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { if (open) void load() }, [open, load])

  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/?workspace=${encodeURIComponent(workspaceId)}` : ""

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      toast.success("Workspace link copied")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Could not copy — select the link and copy it manually")
    }
  }

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
      setMembers((prev) => [...prev.filter((m) => m.userId !== data.member.userId), data.member])
      setEmail("")
      toast.success(`${data.member.email ?? "Co-author"} added as ${role}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdding(false)
    }
  }

  const removeMember = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/workspaces/${workspaceId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      toast.success("Member removed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const isOwner = myRole === "owner"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share “{workspaceName}”</DialogTitle>
          <DialogDescription>
            Co-authors see live cursors and edits when <strong>Live Collab</strong> is on. Editors can change content; viewers can only read.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="share-link" className="text-xs">Workspace link</Label>
          <div className="flex gap-2">
            <Input id="share-link" readOnly value={inviteLink} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={copyLink}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              Copy
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">The link only works for people listed below.</p>
        </div>

        {isOwner && (
          <form onSubmit={addMember} className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
            <Label htmlFor="share-email" className="text-xs">Add a co-author by e-mail</Label>
            <div className="flex gap-2">
              <Input
                id="share-email"
                type="email"
                required
                placeholder="colleague@university.sk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={adding}
              />
              <Select value={role} onValueChange={(v) => v && setRole(v as "editor" | "viewer")} disabled={adding}>
                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" disabled={adding || !email.trim()} className="shrink-0 gap-1.5">
                {adding ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                Add
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">They must have signed in to PosterApp at least once with this e-mail.</p>
          </form>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex flex-col gap-1">
          <Label className="text-xs">People with access</Label>
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Loading…</div>
          ) : (
            <ul className="divide-y rounded-lg border">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-2 px-3 py-2 text-xs">
                  {m.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.imageUrl} alt="" className="size-6 rounded-full" />
                  ) : (
                    <span className="flex size-6 items-center justify-center rounded-full bg-muted font-semibold uppercase">{(m.name || m.email || "?").slice(0, 1)}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.name || m.email || m.userId}</div>
                    {m.name && m.email && <div className="truncate text-muted-foreground">{m.email}</div>}
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">{m.role}</Badge>
                  {m.role !== "owner" && isOwner && (
                    <Button type="button" size="icon-xs" variant="ghost" aria-label={`Remove ${m.email ?? m.userId}`} className="text-muted-foreground hover:text-destructive" onClick={() => removeMember(m.userId)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
