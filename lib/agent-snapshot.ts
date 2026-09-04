import { prisma } from '@/lib/prisma'

export interface SnapshotOptions {
  source?: 'agent' | 'human'
  coalesceWindowMs?: number
}

const MAX_SNAPSHOTS = 20

export async function createWorkspaceSnapshot(
  workspaceId: string,
  label: string,
  options?: SnapshotOptions
) {
  const source = options?.source ?? 'human'
  const coalesceWindowMs = options?.coalesceWindowMs ?? 60_000

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      outputs: { include: { cards: true } },
      assets: true,
      ingestFiles: true,
    },
  })
  if (!workspace) throw new Error('Workspace not found')

  // Section 10 Coalescing:
  // If an agent snapshot exists for the workspace within coalesceWindowMs (default 60s)
  // and no human edit occurred since (workspace.updatedAt <= lastAgentSnap.savedAt), reuse it.
  if (source === 'agent') {
    const cutoff = new Date(Date.now() - coalesceWindowMs)
    const recentAgentSnap = await prisma.workspaceSnapshot.findFirst({
      where: {
        workspaceId,
        source: 'agent',
        savedAt: { gte: cutoff },
      },
      orderBy: { savedAt: 'desc' },
    })

    if (recentAgentSnap) {
      const workspaceUpdatedAt = (workspace as { updatedAt?: Date }).updatedAt
      const hasHumanEditSince = Boolean(workspaceUpdatedAt && workspaceUpdatedAt > recentAgentSnap.savedAt)
      if (!hasHumanEditSince) {
        return recentAgentSnap
      }
    }
  }

  const snap = await prisma.$transaction(async (tx) => {
    const s = await tx.workspaceSnapshot.create({
      data: {
        workspaceId,
        revision: workspace.revision,
        label: label.slice(0, 100),
        source,
        snapshot: JSON.stringify(workspace),
      },
    })

    // Section 10 Eviction Policy:
    // Cap at MAX_SNAPSHOTS (20) per workspace.
    // Evict source:'agent' snapshots before source:'human'.
    // Never evict the most recent snapshot of each source.
    const allSnaps = (await tx.workspaceSnapshot.findMany({
      where: { workspaceId },
      orderBy: { savedAt: 'desc' },
      select: { id: true, source: true, savedAt: true },
    })) || []

    if (allSnaps.length > MAX_SNAPSHOTS) {
      const numToEvict = allSnaps.length - MAX_SNAPSHOTS

      // Find the most recent snapshot of each source to protect them from eviction
      const latestHuman = allSnaps.find((snapItem) => snapItem.source === 'human')
      const latestAgent = allSnaps.find((snapItem) => snapItem.source === 'agent')

      const protectedIds = new Set<string>()
      if (latestHuman) protectedIds.add(latestHuman.id)
      if (latestAgent) protectedIds.add(latestAgent.id)

      // Collect eligible candidates for eviction, ordered oldest first
      const candidates = allSnaps.filter((snapItem) => !protectedIds.has(snapItem.id)).reverse()

      // Prioritize evicting source:'agent' first, then source:'human'
      const agentCandidates = candidates.filter((c) => c.source === 'agent')
      const humanCandidates = candidates.filter((c) => c.source === 'human')

      const toEvict: string[] = []
      for (const item of agentCandidates) {
        if (toEvict.length < numToEvict) {
          toEvict.push(item.id)
        }
      }
      for (const item of humanCandidates) {
        if (toEvict.length < numToEvict) {
          toEvict.push(item.id)
        }
      }

      if (toEvict.length > 0) {
        await tx.workspaceSnapshot.deleteMany({
          where: { id: { in: toEvict } },
        })
      }
    }

    return s
  })

  return snap
}
