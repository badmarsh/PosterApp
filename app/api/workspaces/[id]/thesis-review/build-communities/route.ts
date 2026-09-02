import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildGraphCommunities } from "@/lib/ai/graph-communities"

// Rate-limit: 1 rebuild per 2 minutes per workspace
const buildLimiter = new Map<string, number>()
const BUILD_COOLDOWN_MS = 2 * 60 * 1000

export async function POST(
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

  // Rate limit
  const lastBuild = buildLimiter.get(workspaceId)
  if (lastBuild && Date.now() - lastBuild < BUILD_COOLDOWN_MS) {
    return NextResponse.json(
      { error: "Rate limited — wait 2 minutes between community rebuilds" },
      { status: 429 }
    )
  }
  buildLimiter.set(workspaceId, Date.now())

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
