import { rateLimitAsync } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { randomBytes } from "crypto"
import { hashToken } from "@/lib/token-hash"
import { ALLOWED_AGENT_SCOPES } from "@/lib/agent-auth"

const createKeySchema = z.object({
  name: z.string().trim().min(1).max(64),
  scopes: z.array(z.string()).min(1),
  workspaceId: z.string().trim().nullable().optional(),
  restrictCardIds: z.array(z.string()).optional().default([]),
  expiresInDays: z.number().min(1).max(365).optional().default(30),
})

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting: max 5 key creations per hour per user (§6)
    const rateLimit = await rateLimitAsync(`agent-keys:${userId}`, 5, 60 * 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Maximum 5 key creations per hour.",
          retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rateLimit.retryAfterMs / 1000).toString(),
          },
        }
      )
    }

    const json = await req.json()
    const body = createKeySchema.parse(json)

    // Validate that all scopes requested are valid scopes (§6)
    const invalidScopes = body.scopes.filter(
      (s) => !ALLOWED_AGENT_SCOPES.includes(s as any)
    )
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { error: `Invalid scopes specified: ${invalidScopes.join(", ")}` },
        { status: 400 }
      )
    }

    // If workspaceId is specified, verify that the user has owner or member access
    if (body.workspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: body.workspaceId },
        include: {
          members: {
            where: { userId },
            select: { role: true },
          },
        },
      })
      if (!workspace) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
      }
      const isOwner = workspace.userId === userId
      const isMember = workspace.members.length > 0
      if (!isOwner && !isMember) {
        return NextResponse.json(
          { error: "Access denied to target workspace" },
          { status: 403 }
        )
      }
    }

    // Generate secure random key: pa_<base64url> (§6)
    const rawKey = "pa_" + randomBytes(32).toString("base64url")
    const tokenHash = hashToken(rawKey)

    const key = await prisma.agentApiKey.create({
      data: {
        name: body.name,
        tokenHash,
        userId,
        scopes: body.scopes,
        workspaceId: body.workspaceId || null,
        restrictCardIds: body.restrictCardIds,
        expiresAt: body.expiresInDays
          ? new Date(Date.now() + body.expiresInDays * 86_400_000)
          : null,
      },
    })

    // Return raw key string ONCE ONLY (§6)
    return NextResponse.json(
      {
        id: key.id,
        key: rawKey,
        name: key.name,
        scopes: key.scopes,
        workspaceId: key.workspaceId,
        restrictCardIds: key.restrictCardIds,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      },
      { status: 201 }
    )
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.format() },
        { status: 400 }
      )
    }
    console.error("[agent-keys POST] Error:", err)
    return NextResponse.json({ error: "Failed to create agent key" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const keys = await prisma.agentApiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        scopes: true,
        workspaceId: true,
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        restrictCardIds: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(keys)
  } catch (err) {
    console.error("[agent-keys GET] Error:", err)
    return NextResponse.json({ error: "Failed to list agent keys" }, { status: 500 })
  }
}
