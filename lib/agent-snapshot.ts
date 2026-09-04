import { prisma } from '@/lib/prisma'

export async function createWorkspaceSnapshot(workspaceId: string, label: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      outputs: { include: { cards: true } },
      assets: true,
      ingestFiles: true,
    },
  })
  if (!workspace) throw new Error('Workspace not found')

  const snap = await prisma.$transaction(async (tx) => {
    const s = await tx.workspaceSnapshot.create({
      data: {
        workspaceId,
        revision: workspace.revision,
        label: label.slice(0, 100),
        snapshot: JSON.stringify(workspace),
      },
    })
    // Keep max 20 snapshots per workspace
    const old = await tx.workspaceSnapshot.findMany({
      where: { workspaceId },
      orderBy: { savedAt: 'desc' },
      skip: 20,
      select: { id: true },
    })
    if (old.length > 0) {
      await tx.workspaceSnapshot.deleteMany({
        where: { id: { in: old.map((o) => o.id) } },
      })
    }
    return s
  })

  return snap
}
