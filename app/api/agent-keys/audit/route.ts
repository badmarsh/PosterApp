import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const logs = await prisma.agentToolCallLog.findMany({
      where: {
        apiKey: { userId },
      },
      select: {
        id: true,
        toolName: true,
        workspaceId: true,
        calledAt: true,
        durationMs: true,
        ok: true,
        errorCode: true,
        changeId: true,
        args: true,
        result: true,
        apiKey: {
          select: { name: true },
        },
      },
      orderBy: { calledAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(logs)
  } catch (err) {
    console.error('[agent-keys audit GET] Error:', err)
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 })
  }
}
