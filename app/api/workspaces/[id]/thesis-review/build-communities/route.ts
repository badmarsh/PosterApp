import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildGraphCommunities } from "@/lib/ai/graph-communities"
import { rateLimitAsync } from "@/lib/rate-limit"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(
    `${userId}:${workspaceId}:build-communities`,
    1,
    2 * 60 * 1000
  )
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limited — try again in ${Math.ceil(retryAfterMs / 1000)}s` },
      { status: 429 }
    )
  }

  try {
    const result = await buildGraphCommunities(workspaceId)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[build-communities] Error:", err)
    return NextResponse.json({ error: "Community build failed" }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  try {
    await requireWorkspaceEditor(workspaceId)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const communities = await prisma.graphCommunity.findMany({
    where: { workspaceId },
    orderBy: { nodeCount: "desc" },
    select: { id: true, label: true, summary: true, nodeCount: true, createdAt: true },
  })

  return NextResponse.json({ communities })
}
