/**
 * GET /api/workspaces/[id]/thesis-review/jobs/[jobId]/stream
 *
 * Server-Sent Events stream for a detached review job. Emits:
 *   event: stage   data: { stage, detail, progress }
 *   event: done    data: <review API payload>
 *   event: error   data: { error }
 *   event: cancelled data: {}
 * Closes the connection after a terminal event.
 */

import { NextRequest } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { reviewJobManager, sseFrame, type ReviewJobState } from "@/lib/review-jobs"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const { id: workspaceId, jobId } = await params

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return new Response("Unauthorized", { status: 401 })
  }

  const state = reviewJobManager.get(jobId)
  if (!state || state.workspaceId !== workspaceId) {
    return new Response(JSON.stringify({ error: "Job not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }
  if (!reviewJobManager.ownsJob(jobId, userId)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      let heartbeat: ReturnType<typeof setInterval> | null = null
      const close = () => {
        if (closed) return
        closed = true
        if (heartbeat) clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
        unsubscribe()
      }

      const send = (frame: Uint8Array) => {
        if (closed) return
        try {
          controller.enqueue(frame)
        } catch {
          close()
        }
      }

      const handle = (s: ReviewJobState) => {
        if (s.status === "running") {
          send(sseFrame("stage", { stage: s.stage, detail: s.detail, progress: s.progress }))
          return
        }
        if (s.status === "done") {
          send(sseFrame("done", s.result ?? { id: null }))
          close()
        } else if (s.status === "error") {
          send(sseFrame("error", { error: s.error ?? "Review generation failed" }))
          close()
        } else if (s.status === "cancelled") {
          send(sseFrame("cancelled", {}))
          close()
        }
      }

      const unsubscribe = reviewJobManager.subscribe(jobId, handle)

      // Heartbeat keeps proxies from closing an idle stream during long AI calls.
      heartbeat = setInterval(() => {
        send(encoder.encode(`: heartbeat\n\n`))
      }, 15_000)

      // Safety net: never stream for more than 30 minutes.
      setTimeout(() => {
        send(sseFrame("error", { error: "Review job timed out" }))
        close()
      }, 30 * 60_000)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
