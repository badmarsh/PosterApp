import { auth as clerkAuth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { prisma, type Prisma } from "@/lib/prisma"
import { isE2eAuthBypassEnabled, E2E_TEST_USER_ID } from "@/lib/e2e-bypass"

export const WORKSPACE_ROLES = ["owner", "editor", "viewer"] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]
const WORKSPACE_ID = /^[A-Za-z0-9_-]{3,64}$/

/** Workspace row as returned by requireWorkspaceAccess (includes filtered members). */
export type WorkspaceWithMembers = Prisma.WorkspaceGetPayload<{
  include: { members: { where: { userId: string }; select: { role: true } } }
}>

export async function auth() {
  if (isE2eAuthBypassEnabled()) {
    return { userId: E2E_TEST_USER_ID }
  }
  return clerkAuth()
}

export function apiError(code: string, message: string, status: number) {
  return new Response(JSON.stringify({ error: { code, message } }), { 
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

/** Central authorization boundary; legacy Workspace.userId remains the owner. */
export async function requireWorkspaceAccess(workspaceId: string): Promise<{ workspace: WorkspaceWithMembers; userId: string; role: WorkspaceRole }> {
  if (!WORKSPACE_ID.test(workspaceId)) throw apiError("INVALID_WORKSPACE_ID", "Invalid workspace ID", 400)
  const { userId } = await auth()
  if (!userId) throw apiError("UNAUTHENTICATED", "Sign in to continue", 401)
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, include: { members: { where: { userId }, select: { role: true } } } })
  if (!workspace) throw apiError("WORKSPACE_NOT_FOUND", "Workspace not found", 404)
  const role: WorkspaceRole | undefined = workspace.userId === userId ? "owner" : workspace.members[0]?.role as WorkspaceRole | undefined
  if (!role || !WORKSPACE_ROLES.includes(role)) throw apiError("WORKSPACE_NOT_FOUND", "Workspace not found", 404)
  return { workspace, userId, role }
}

export async function requireWorkspaceEditor(workspaceId: string) {
  const access = await requireWorkspaceAccess(workspaceId)
  if (access.role === "viewer") throw apiError("WORKSPACE_READ_ONLY", "You do not have permission to edit this workspace", 403)
  return access
}

export async function requireWorkspaceOwner(workspaceId: string) {
  const access = await requireWorkspaceAccess(workspaceId)
  if (access.role !== "owner") {
    throw apiError("WORKSPACE_FORBIDDEN", "Only workspace owners can perform this action", 403)
  }
  return access
}

