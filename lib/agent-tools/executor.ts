import { prisma } from "@/lib/prisma"
import { rateLimitAsync } from "@/lib/rate-limit"
import {
  requireScope,
  requireAgentWorkspaceAccess,
  AgentAuthError,
  type AgentContext,
} from "@/lib/agent-auth"
import { logToolCall } from "@/lib/agent-audit"
import {
  findToolByWireName,
  findToolById,
  type AgentTool,
} from "./registry"
import {
  okEnvelope,
  errorEnvelope,
  type Envelope,
} from "./envelope"

async function computeDiffPreview(args: any, toolId: string) {
  try {
    if (toolId === "posterapp.cards.update" && args.cardId) {
      const card = await prisma.card.findUnique({
        where: { id: args.cardId },
        select: { title: true, content: true },
      })
      return {
        before: card ? { title: card.title, content: card.content } : null,
        after: {
          title: args.title ?? card?.title,
          content: args.content ?? card?.content,
        },
      }
    }
    if (toolId === "posterapp.cards.create") {
      return {
        before: null,
        after: {
          title: args.title,
          content: args.content,
          position: args.position,
        },
      }
    }
    if (toolId === "posterapp.bibliography.add") {
      return {
        before: null,
        after: {
          title: args.title,
          authors: args.authors,
          year: args.year,
          doi: args.doi,
          bibtex: args.bibtex,
        },
      }
    }
    if (toolId === "posterapp.bibliography.remove") {
      return {
        before: { id: args.entryId },
        after: null,
      }
    }
    if (toolId === "posterapp.assets.upload") {
      return {
        before: null,
        after: {
          filename: args.filename,
          mimeType: args.mimeType,
          caption: args.caption,
        },
      }
    }
  } catch (err) {
    console.error("[executor] Failed to compute diffPreview:", err)
  }
  return null
}

function resolveTargetType(toolId: string): string {
  if (toolId.startsWith("posterapp.cards.")) return "card"
  if (toolId.startsWith("posterapp.bibliography.")) return "bibliography"
  if (toolId.startsWith("posterapp.assets.")) return "asset"
  if (toolId.startsWith("posterapp.compile.")) return "compile"
  return "workspace"
}

function resolveTargetId(args: any, toolId: string): string | null {
  if (toolId === "posterapp.cards.update") return args.cardId ?? null
  if (toolId === "posterapp.bibliography.remove") return args.entryId ?? null
  if (toolId === "posterapp.assets.get") return args.assetId ?? null
  return null
}

/**
 * Executes a tool through the §7.2 execution chain:
 * 1 verifyAgentKey (caller provides authenticated AgentContext)
 * 2 resolve tool by wireName
 * 3 requireScope(ctx, tool.scopes)
 * 4 parse args with tool.input
 * 5 requireAgentWorkspaceAccess(ctx, workspaceId)
 * 6 rateLimitAsync(key, limit, windowMs)
 * 7 if tool.approval -> enqueue AgentPendingChange else handler()
 * 8 free-text wrapping
 * 9 logToolCall (always)
 * 10 return Envelope
 */
export async function executeAgentTool(
  ctx: AgentContext,
  toolIdentifier: string,
  rawArgs: unknown
): Promise<Envelope> {
  const startTime = Date.now()

  // 2. Resolve tool by wireName or canonical id
  const tool: AgentTool | undefined =
    findToolByWireName(toolIdentifier) || findToolById(toolIdentifier as any)

  if (!tool) {
    const durationMs = Date.now() - startTime
    await logToolCall(ctx, null, toolIdentifier, rawArgs, null, durationMs, false, "TOOL_NOT_FOUND")
    return errorEnvelope("TOOL_NOT_FOUND", `Tool '${toolIdentifier}' is not registered`)
  }

  // 3. Require required scopes
  try {
    for (const scope of tool.scopes) {
      requireScope(ctx, scope)
    }
  } catch (err) {
    const durationMs = Date.now() - startTime
    const message = err instanceof Error ? err.message : "Forbidden"
    await logToolCall(ctx, null, tool.id, rawArgs, null, durationMs, false, "FORBIDDEN")
    return errorEnvelope("FORBIDDEN", message)
  }

  // 4. Validate input args
  const parsed = tool.input.safeParse(rawArgs || {})
  if (!parsed.success) {
    const durationMs = Date.now() - startTime
    await logToolCall(ctx, null, tool.id, rawArgs, null, durationMs, false, "VALIDATION")
    return errorEnvelope("VALIDATION", "Invalid tool arguments", {
      details: parsed.error.format(),
    })
  }
  const args = parsed.data as any
  const workspaceId: string | null = args.workspaceId || null

  // 5. Check workspace authorization if tool is workspace-bound
  if (workspaceId) {
    try {
      await requireAgentWorkspaceAccess(ctx, workspaceId, tool.kind === "write")
    } catch (err) {
      const durationMs = Date.now() - startTime
      const message = err instanceof Error ? err.message : "Access denied to workspace"
      const status = (err as any)?.status || 403
      const code = status === 404 ? "NOT_FOUND" : "FORBIDDEN"
      await logToolCall(ctx, workspaceId, tool.id, args, null, durationMs, false, code)
      return errorEnvelope(code, message)
    }
  }

  // 6. Rate limiting: key + workspace + tool kind
  const rateLimitKey = `agent:${ctx.apiKeyId}:${workspaceId || "global"}:${tool.kind}`
  const rateLimit = await rateLimitAsync(
    rateLimitKey,
    tool.rateLimit.limit,
    tool.rateLimit.windowMs
  )
  if (!rateLimit.allowed) {
    const durationMs = Date.now() - startTime
    await logToolCall(ctx, workspaceId, tool.id, args, null, durationMs, false, "RATE_LIMITED")
    return errorEnvelope("RATE_LIMITED", "Rate limit exceeded for tool kind", {
      retryAfterMs: rateLimit.retryAfterMs,
    })
  }

  // 7. Write tools always enqueue AgentPendingChange (§8.3)
  if (tool.approval) {
    try {
      if (!workspaceId) {
        throw new Error("Cannot create pending change without workspaceId")
      }
      const diffPreview = await computeDiffPreview(args, tool.id)
      const expiresAt = new Date(Date.now() + 7 * 86_400_000) // 7 days

      const pendingChange = await prisma.agentPendingChange.create({
        data: {
          workspaceId,
          apiKeyId: ctx.apiKeyId,
          toolName: tool.id,
          targetType: resolveTargetType(tool.id),
          targetId: resolveTargetId(args, tool.id),
          payload: args,
          diffPreview: diffPreview as any,
          rationale: args.rationale ? String(args.rationale).slice(0, 2000) : null,
          status: "pending",
          expiresAt,
        },
      })

      const resultData = {
        status: "pending" as const,
        changeId: pendingChange.id,
        expiresAt: expiresAt.toISOString(),
      }

      const durationMs = Date.now() - startTime
      await logToolCall(
        ctx,
        workspaceId,
        tool.id,
        args,
        resultData,
        durationMs,
        true,
        null,
        pendingChange.id
      )

      return okEnvelope(resultData, tool.id, durationMs)
    } catch (err: any) {
      const durationMs = Date.now() - startTime
      console.error(`[executor] Error enqueueing pending change for ${tool.id}:`, err)
      await logToolCall(ctx, workspaceId, tool.id, args, null, durationMs, false, "INTERNAL")
      return errorEnvelope("INTERNAL", err?.message || "Failed to enqueue pending change")
    }
  }

  // Handler execution for immediate read/job tools
  try {
    const result = await tool.handler(ctx, args)
    const durationMs = Date.now() - startTime
    await logToolCall(ctx, workspaceId, tool.id, args, result, durationMs, true)
    return okEnvelope(result, tool.id, durationMs)
  } catch (err: any) {
    const durationMs = Date.now() - startTime
    console.error(`[executor] Error executing handler for ${tool.id}:`, err)
    if (err instanceof AgentAuthError) {
      const code = err.status === 404 ? "NOT_FOUND" : "FORBIDDEN"
      await logToolCall(ctx, workspaceId, tool.id, args, null, durationMs, false, code)
      return errorEnvelope(code, err.message)
    }
    await logToolCall(ctx, workspaceId, tool.id, args, null, durationMs, false, "INTERNAL")
    return errorEnvelope("INTERNAL", err?.message || "Tool execution failed")
  }
}
