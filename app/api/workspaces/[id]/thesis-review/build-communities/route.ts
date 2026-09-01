import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { buildGraphCommunities } from "@/lib/ai/graph-communities"

// Rate-limit: 1 rebuild per 2 minutes per workspace
const buildLimiter = new Map<string, number>()
const BUILD_COOLDOWN_MS = 2 * 60 * 1000

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: workspaceId } = await params

  // Ownership check
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId },
    select: { id: true },
  })
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 })

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
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: workspaceId } = await params

  const communities = await prisma.graphCommunity.findMany({
    where: { workspaceId },
    orderBy: { nodeCount: "desc" },
    select: { id: true, label: true, summary: true, nodeCount: true, createdAt: true },
  })

  return NextResponse.json({ communities })
}
