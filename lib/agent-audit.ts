import { prisma } from "@/lib/prisma"
import type { AgentContext } from "./agent-auth"

function sanitize(obj: unknown): any {
  if (obj === undefined || obj === null) return null
  try {
    return JSON.parse(
      JSON.stringify(obj, (_, v) =>
        typeof v === "string" && v.length > 10_000 ? "[truncated]" : v
      )
    )
  } catch {
    return { error: "Serialization failed" }
  }
}

export async function logToolCall(
  ctx: AgentContext,
  workspaceId: string | null,
  toolName: string,
  args: unknown,
  result?: unknown,
  durationMs?: number,
  ok = true,
  errorCode?: string | null,
  changeId?: string | null,
  approved = false
) {
  try {
    await prisma.agentToolCallLog.create({
      data: {
        apiKeyId: ctx.apiKeyId,
        workspaceId: workspaceId || null,
        toolName,
        args: sanitize(args) ?? {},
        result: result !== undefined ? sanitize(result) : undefined,
        ok,
        approved,
        errorCode: errorCode || null,
        durationMs: durationMs ?? 0,
        changeId: changeId || null,
        calledAt: new Date(),
      },
    })
  } catch (err) {
    console.error("[agent-audit] Failed to log tool call:", err)
  }
}

export async function logApprovedMutation(
  apiKeyId: string,
  workspaceId: string,
  toolName: string,
  args: unknown,
  result: unknown,
  changeId: string
) {
  try {
    await prisma.agentToolCallLog.create({
      data: {
        apiKeyId,
        workspaceId,
        toolName,
        args: sanitize(args) ?? {},
        result: sanitize(result) ?? undefined,
        ok: true,
        approved: true,
        changeId,
        calledAt: new Date(),
      },
    })
  } catch (err) {
    console.error("[agent-audit] Failed to log approved mutation:", err)
  }
}
