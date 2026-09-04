import { prisma } from "@/lib/prisma"
import { hashToken } from "@/lib/token-hash"

export const ALLOWED_AGENT_SCOPES = [
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
  "*",
] as const

export type AgentScope = (typeof ALLOWED_AGENT_SCOPES)[number]

export type AgentContext = {
  apiKeyId: string
  userId: string
  scopes: string[]
  workspaceId: string | null
  restrictCardIds: string[]
}

export class AgentAuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.name = "AgentAuthError"
    this.status = status
  }
}

/**
 * Extracts raw API key from Authorization header (Bearer <token> or raw <token>)
 * or X-API-Key header to satisfy §18.2 DeerFlow proxy conventions.
 */
function extractRawKey(req: Request): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader) {
    const trimmed = authHeader.trim()
    if (trimmed.startsWith("Bearer ")) {
      const token = trimmed.slice(7).trim()
      if (token) return token
    } else if (trimmed.startsWith("pa_")) {
      return trimmed
    }
  }
  const xApiKey = req.headers.get("x-api-key")
  if (xApiKey) {
    const trimmed = xApiKey.trim()
    if (trimmed) return trimmed
  }
  return null
}

export async function verifyAgentKey(req: Request): Promise<AgentContext> {
  const rawKey = extractRawKey(req)
  if (!rawKey) {
    throw new AgentAuthError(
      "Missing or invalid authorization credentials. Expected Authorization: Bearer <key> or X-API-Key: <key>",
      401
    )
  }

  const tokenHash = hashToken(rawKey)
  const apiKey = await prisma.agentApiKey.findUnique({
    where: { tokenHash },
  })

  if (!apiKey) {
    throw new AgentAuthError("Invalid API key", 401)
  }
  if (apiKey.revokedAt) {
    throw new AgentAuthError("API key revoked", 403)
  }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new AgentAuthError("API key expired", 403)
  }

  // Update lastUsedAt asynchronously without blocking response
  prisma.agentApiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch((err) => {
      console.error("[agent-auth] Failed to update lastUsedAt:", err)
    })

  return {
    apiKeyId: apiKey.id,
    userId: apiKey.userId,
    scopes: apiKey.scopes,
    workspaceId: apiKey.workspaceId ?? null,
    restrictCardIds: apiKey.restrictCardIds ?? [],
  }
}

export function requireScope(ctx: AgentContext, scope: string) {
  if (ctx.scopes.includes("*")) return
  if (!ctx.scopes.includes(scope)) {
    throw new AgentAuthError(`Scope required: ${scope}`, 403)
  }
}

export function requireScopes(ctx: AgentContext, requiredScopes: string[]) {
  if (ctx.scopes.includes("*")) return
  const missing = requiredScopes.filter((s) => !ctx.scopes.includes(s))
  if (missing.length > 0) {
    throw new AgentAuthError(`Missing required scopes: ${missing.join(", ")}`, 403)
  }
}

export async function requireAgentWorkspaceAccess(
  ctx: AgentContext,
  workspaceId: string,
  write = false
) {
  // 1. Scoped key check (§6 / §17): If key is scoped to a workspace, it cannot touch another workspace.
  if (ctx.workspaceId && ctx.workspaceId !== workspaceId) {
    throw new AgentAuthError(
      `Access forbidden: API key is restricted to workspace ${ctx.workspaceId}`,
      403
    )
  }

  // 2. Existing owner/collaborator check for ctx.userId on workspaceId
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        where: { userId: ctx.userId },
        select: { role: true },
      },
    },
  })

  if (!workspace) {
    throw new AgentAuthError("Workspace not found", 404)
  }

  const isOwner = workspace.userId === ctx.userId
  const memberRole = workspace.members[0]?.role

  if (!isOwner && !memberRole) {
    throw new AgentAuthError("Access denied to workspace", 403)
  }

  if (write && !isOwner && memberRole !== "owner" && memberRole !== "editor") {
    throw new AgentAuthError("Write permission denied for workspace", 403)
  }

  return workspace
}
