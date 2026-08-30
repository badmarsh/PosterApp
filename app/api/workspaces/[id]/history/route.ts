import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { computeWorkspaceDiff } from "@/lib/snapshot-diff"
import { generateSnapshotLabelAsync } from "@/lib/ai-labeler"

const MAX_SNAPSHOTS = 50

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 })
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspace = await prisma.workspace.findUnique({ where: { id, userId }, select: { id: true } })
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const snapshots = await prisma.workspaceSnapshot.findMany({
    where: { workspaceId: id },
    orderBy: { savedAt: "desc" },
    select: { id: true, savedAt: true, label: true, revision: true },
    take: MAX_SNAPSHOTS,
  })

  return NextResponse.json({ snapshots })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 })
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspace = await prisma.workspace.findUnique({
    where: { id, userId },
    include: {
      outputs: { include: { cards: true } },
      assets: true,
      ingestFiles: true,
    },
  })
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const label = typeof body.label === "string" ? body.label.slice(0, 100) : null

  // Retrieve latest previous snapshot to compute diff for AI auto-labeling if label is not provided
  let prevWs: any = null
  if (!label) {
    const prevSnap = await prisma.workspaceSnapshot.findFirst({
      where: { workspaceId: id },
      orderBy: { savedAt: "desc" },
      select: { snapshot: true },
    })
    if (prevSnap?.snapshot) {
      try {
        prevWs = JSON.parse(prevSnap.snapshot)
      } catch {}
    }
  }

  const snapshot = await prisma.$transaction(async (tx) => {
    const snap = await tx.workspaceSnapshot.create({
      data: {
        workspaceId: id,
        revision: workspace.revision,
        label,
        snapshot: JSON.stringify(workspace),
      },
    })
    const old = await tx.workspaceSnapshot.findMany({
      where: { workspaceId: id },
      orderBy: { savedAt: "desc" },
      skip: MAX_SNAPSHOTS,
      select: { id: true },
    })
    if (old.length > 0) {
      await tx.workspaceSnapshot.deleteMany({ where: { id: { in: old.map((s) => s.id) } } })
    }
    return snap
  })

  // Trigger background label generation if label was not manually specified
  if (!label) {
    const diff = computeWorkspaceDiff(prevWs, workspace)
    if (diff.length > 0) {
      generateSnapshotLabelAsync(snapshot.id, diff).catch((err) => {
        console.error("[history] Async snapshot label generation failed:", err)
      })
    }
  }

  return NextResponse.json({ id: snapshot.id, savedAt: snapshot.savedAt, label: snapshot.label, revision: snapshot.revision })
}

