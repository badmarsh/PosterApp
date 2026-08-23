import { auth as clerkAuth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function auth() {
  if (process.env.NEXT_PUBLIC_E2E_TEST === "1" && process.env.NODE_ENV !== "production") {
    return { userId: "test-user-id" }
  }
  return await clerkAuth()
}

export async function requireWorkspaceOwner(workspaceId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(workspaceId)) {
    throw NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  const { userId } = await auth()
  if (!userId) throw NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId, userId },
  })
  if (!workspace) throw NextResponse.json({ error: "Not found" }, { status: 404 })

  return workspace
}
