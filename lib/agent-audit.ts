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
  changeId?: string | null
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
