import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { hashToken } from "@/lib/token-hash"

export async function issueCollaborationTicket(workspaceId: string, userId: string) {
  const ticket = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + 60_000)
  await prisma.collaborationTicket.deleteMany({ where: { workspaceId, userId, OR: [{ expiresAt: { lt: new Date() } }, { consumedAt: { not: null } }] } })
  await prisma.collaborationTicket.create({ data: { workspaceId, userId, tokenHash: hashToken(ticket), expiresAt } })
  return { ticket, expiresAt: expiresAt.toISOString() }
}

/** Atomically consume a ticket and never log its raw value. */
export async function consumeCollaborationTicket(ticket: string, workspaceId: string) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(ticket)) return null
  const tokenHash = hashToken(ticket)
  const now = new Date()
  const consumed = await prisma.collaborationTicket.updateMany({ where: { tokenHash, workspaceId, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } })
  if (consumed.count !== 1) return null
  return (await prisma.collaborationTicket.findUnique({ where: { tokenHash }, select: { userId: true } }))?.userId ?? null
}
