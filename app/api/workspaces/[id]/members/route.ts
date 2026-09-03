import { NextResponse } from "next/server"
import { z } from "zod"
import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspaceAccess, requireWorkspaceOwner, type WorkspaceRole } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { isE2eAuthBypassEnabled } from "@/lib/e2e-bypass"

/**
 * Workspace membership — the missing "invite a co-author" step for Live Collab.
 *
 *   GET    /api/workspaces/:id/members                 → owner + members (any member)
 *   POST   /api/workspaces/:id/members  {email, role}  → add by Clerk e-mail (owner only)
 *   DELETE /api/workspaces/:id/members  {userId}       → remove (owner only, or self-leave)
 */

const AddSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(["editor", "viewer"]).default("editor"),
})
const RemoveSchema = z.object({ userId: z.string().min(1).max(128) })

type MemberView = { userId: string; role: WorkspaceRole; email: string | null; name: string | null; imageUrl: string | null }

async function describeUsers(userIds: string[]): Promise<Map<string, { email: string | null; name: string | null; imageUrl: string | null }>> {
  const out = new Map<string, { email: string | null; name: string | null; imageUrl: string | null }>()
  if (userIds.length === 0 || isE2eAuthBypassEnabled()) return out
  try {
    const client = await clerkClient()
    const { data } = await client.users.getUserList({ userId: userIds, limit: 100 })
    for (const u of data) {
      const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0]
      out.set(u.id, {
        email: primary?.emailAddress ?? null,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
        imageUrl: u.imageUrl ?? null,
      })
    }
  } catch (err) {
    console.warn("[members] Could not resolve user profiles from Clerk:", err)
  }
  return out
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { workspace, userId, role } = await requireWorkspaceAccess(id)
    const rows = await prisma.workspaceMember.findMany({ where: { workspaceId: id }, select: { userId: true, role: true } })
    const ids = Array.from(new Set([workspace.userId, ...rows.map((r) => r.userId)]))
    const profiles = await describeUsers(ids)
    const members: MemberView[] = [
      { userId: workspace.userId, role: "owner" as const, ...(profiles.get(workspace.userId) ?? { email: null, name: null, imageUrl: null }) },
      ...rows
        .filter((r) => r.userId !== workspace.userId)
        .map((r) => ({ userId: r.userId, role: r.role as WorkspaceRole, ...(profiles.get(r.userId) ?? { email: null, name: null, imageUrl: null }) })),
    ]
    return NextResponse.json({ members, me: { userId, role } }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof Response) return error
    console.error("[members] GET failed:", error)
    return NextResponse.json({ error: { code: "INTERNAL", message: "Could not list members" } }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { userId: ownerId } = await requireWorkspaceOwner(id)
    const rl = await rateLimitAsync(`members-add:${ownerId}`, 20, 60_000)
    if (!rl.allowed) return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many invitations" } }, { status: 429 })

    const parsed = AddSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION", message: "A valid e-mail and role are required" } }, { status: 400 })
    const { email, role } = parsed.data

    if (isE2eAuthBypassEnabled()) {
      return NextResponse.json({ error: { code: "UNAVAILABLE", message: "Invitations are disabled in test mode" } }, { status: 503 })
    }
    const client = await clerkClient()
    const { data } = await client.users.getUserList({ emailAddress: [email], limit: 2 })
    const match = data.find((u) => u.emailAddresses.some((e) => e.emailAddress.toLowerCase() === email.toLowerCase()))
    if (!match) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "No account with this e-mail has signed in to PosterApp yet. Ask your co-author to sign in once, then invite them again." } },
        { status: 404 },
      )
    }
    if (match.id === ownerId) return NextResponse.json({ error: { code: "ALREADY_OWNER", message: "You already own this workspace" } }, { status: 409 })

    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: id, userId: match.id } },
      create: { workspaceId: id, userId: match.id, role },
      update: { role },
    })
    const primary = match.emailAddresses.find((e) => e.id === match.primaryEmailAddressId) ?? match.emailAddresses[0]
    const member: MemberView = {
      userId: match.id,
      role,
      email: primary?.emailAddress ?? email,
      name: [match.firstName, match.lastName].filter(Boolean).join(" ") || null,
      imageUrl: match.imageUrl ?? null,
    }
    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error
    console.error("[members] POST failed:", error)
    return NextResponse.json({ error: { code: "INTERNAL", message: "Could not add member" } }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { workspace, userId, role } = await requireWorkspaceAccess(id)
    const parsed = RemoveSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION", message: "userId is required" } }, { status: 400 })
    const target = parsed.data.userId
    if (target === workspace.userId) return NextResponse.json({ error: { code: "CANNOT_REMOVE_OWNER", message: "The owner cannot be removed" } }, { status: 409 })
    const isSelfLeave = target === userId
    if (!isSelfLeave && role !== "owner") return NextResponse.json({ error: { code: "WORKSPACE_FORBIDDEN", message: "Only the owner can remove members" } }, { status: 403 })
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: id, userId: target } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Response) return error
    console.error("[members] DELETE failed:", error)
    return NextResponse.json({ error: { code: "INTERNAL", message: "Could not remove member" } }, { status: 500 })
  }
}
