import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { wrapUntrustedContext } from "@/lib/security"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const changes = await prisma.agentPendingChange.findMany({
      where: {
        workspace: { userId },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        apiKey: {
          select: { name: true },
        },
        workspace: {
          select: { name: true },
        },
      },
    })

    const sanitized = changes.map((c) => ({
      ...c,
      rationale: c.rationale ? wrapUntrustedContext(c.rationale, "agent-rationale") : null,
      apiKeyName: c.apiKey?.name || "Agent",
      workspaceName: c.workspace?.name || c.workspaceId,
    }))

    return NextResponse.json(sanitized)
  } catch (err) {
    console.error("[agent-keys changes GET] Error:", err)
    return NextResponse.json({ error: "Failed to load changes" }, { status: 500 })
  }
}
