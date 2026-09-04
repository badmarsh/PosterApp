import { NextResponse, NextRequest } from "next/server"
import { auth, requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { wrapUntrustedContext } from "@/lib/ai/prompts"
import { applyAgentChange } from "@/lib/agent-changes/apply"
import { rateLimitAsync } from "@/lib/rate-limit"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await requireWorkspaceAccess(id)

    const searchParams = req.nextUrl.searchParams
    const statusFilter = searchParams.get("status")

    const where: any = { workspaceId: id }
    if (statusFilter) {
      where.status = statusFilter
    }

    const changes = await prisma.agentPendingChange.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        apiKey: {
          select: { name: true },
        },
      },
      take: 100,
    })

    // Untrusted-wrap the agent-provided rationale before returning to client (§4.3 / §9.3)
    const sanitizedChanges = changes.map((c) => ({
      ...c,
      rationale: c.rationale ? wrapUntrustedContext(c.rationale, "agent-rationale") : null,
      apiKeyName: c.apiKey.name,
    }))

    return NextResponse.json({ changes: sanitizedChanges })
  } catch (err: any) {
    if (err instanceof Response) return err
    console.error("[agent-changes GET] Error:", err)
    return NextResponse.json({ error: "Failed to load agent changes" }, { status: 500 })
  }
}

/**
 * Batch approval endpoint:
 * POST /api/workspaces/[id]/agent-changes
 * Body: { changeIds: string[], forceRebase?: boolean }
 * Spec §9.3: Batch approval never crosses tool types.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { userId } = await requireWorkspaceEditor(id)
    const { allowed, retryAfterMs } = await rateLimitAsync(`agent-changes:${userId}:${id}`, 20, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: `Rate limited — try again in ${Math.ceil(retryAfterMs / 1000)}s` },
        { status: 429 }
      )
    }
    const body = await req.json().catch(() => ({}))
    const changeIds: string[] = body.changeIds || []
    const forceRebase: boolean = Boolean(body.forceRebase)

    if (!Array.isArray(changeIds) || changeIds.length === 0) {
      return NextResponse.json(
        { error: "changeIds array is required" },
        { status: 400 }
      )
    }

    // Load all changes to verify they belong to this workspace and have identical toolName
    const changes = await prisma.agentPendingChange.findMany({
      where: { id: { in: changeIds }, workspaceId: id },
    })

    if (changes.length !== changeIds.length) {
      return NextResponse.json(
        { error: "One or more changes were not found in this workspace" },
        { status: 404 }
      )
    }

    const firstTool = changes[0].toolName
    const crossTool = changes.some((c) => c.toolName !== firstTool)
    if (crossTool) {
      return NextResponse.json(
        { error: "Batch approval cannot cross tool types (§9.3)" },
        { status: 400 }
      )
    }

    const applied: string[] = []
    const failures: Array<{ changeId: string; code: string; message: string }> = []

    for (const changeId of changeIds) {
      const res = await applyAgentChange(changeId, userId, { forceRebase })
      if (res.ok) {
        applied.push(changeId)
      } else {
        failures.push({
          changeId,
          code: res.code,
          message: res.message,
        })
      }
    }

    return NextResponse.json({
      ok: failures.length === 0,
      applied,
      failures,
    })
  } catch (err: any) {
    if (err instanceof Response) return err
    console.error("[agent-changes batch POST] Error:", err)
    return NextResponse.json({ error: "Failed to batch approve changes" }, { status: 500 })
  }
}
