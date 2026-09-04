import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimitAsync } from '@/lib/rate-limit'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimit = await rateLimitAsync(`agent-keys-revoke:${userId}`, 30, 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const key = await prisma.agentApiKey.findFirst({
      where: { id, userId },
    })
    if (!key) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    await prisma.agentApiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[agent-keys DELETE] Error:', err)
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 })
  }
}
