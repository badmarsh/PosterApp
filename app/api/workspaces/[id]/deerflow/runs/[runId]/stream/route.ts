import { NextResponse } from "next/server"
import { requireWorkspaceAccess } from "@/lib/auth"
import { findRunForWorkspace } from "@/lib/deerflow/db"
import { markRunInterrupted } from "@/lib/deerflow/runner"
import { getRunRecord, subscribeRun, type RunRecord } from "@/lib/deerflow/run-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const encoder = new TextEncoder()
const HEARTBEAT_MS = 15_000

function sseHeaders(): Headers {
  return new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  })
}

function sseFrame(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function sseComment(): Uint8Array {
  return encoder.encode(": ping\n\n")
}

function errorStream(message: string, code: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(sseFrame("error", { message, code }))
      controller.enqueue(sseFrame("done", { status: "failed" }))
      controller.close()
    },
  })
}

/**
 * GET /api/workspaces/[id]/deerflow/runs/[runId]/stream
 * SSE passthrough of live run progress. Replays buffered log events first,
 * then follows the run until it finishes and emits a terminal event.
 * The run executes on the server even when no client is connected.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || !/^[a-zA-Z0-9_-]+$/.test(runId)) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 })
  }

  try {
    await requireWorkspaceAccess(id)
    const row = await findRunForWorkspace(runId, id)
    if (!row) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 })
    }

    const live = getRunRecord(runId)
    if (!live && (row.status === "running" || row.status === "queued")) {
      await markRunInterrupted(runId, id)
      return new Response(errorStream("Run was interrupted; start a new run.", "DEERFLOW_INTERRUPTED"), {
        headers: sseHeaders(),
      })
    }
    const record = live ?? null

    // Cleanup handles shared between start() and cancel().
    let unsub: (() => void) | null = null
    let heartbeat: ReturnType<typeof setInterval> | null = null

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false
        let lastPayload = ""

        const cleanup = () => {
          unsub?.()
          unsub = null
          if (heartbeat) {
            clearInterval(heartbeat)
            heartbeat = null
          }
        }
        const close = () => {
          if (closed) return
          closed = true
          cleanup()
          try {
            controller.close()
          } catch {
            // controller already closed
          }
        }
        const send = (event: string, data: unknown) => {
          if (closed) return
          try {
            controller.enqueue(sseFrame(event, data))
          } catch {
            close()
          }
        }
        const emitState = (r: RunRecord) => {
          const payload = JSON.stringify({
            status: r.status,
            phase: r.phase,
            error: r.error?.message ?? null,
            hasProposal: r.proposal !== null,
          })
          if (payload === lastPayload) return
          lastPayload = payload
          send("progress", {
            status: r.status,
            phase: r.phase,
            elapsedMs: Date.now() - r.startedAt,
            eventCount: r.events.length,
          })
          if (r.error) send("error", { message: r.error.message, code: r.error.code })
          if (r.proposal) send("proposal", r.proposal)
          if (r.status === "done" || r.status === "failed" || r.status === "cancelled") {
            send("done", { status: r.status })
            close()
          }
        }

        if (record) {
          // Replay buffered log lines, then current state.
          for (const event of record.events) {
            send("log", event)
          }
          emitState(record)
          if (closed) return

          unsub = subscribeRun(runId, (r) => {
            const last = r.events[r.events.length - 1]
            if (last) send("log", last)
            emitState(r)
          })
        } else {
          // Finished run without live state — emit terminal events from DB.
          if (row.status === "done") {
            send("proposal", row.proposal ?? null)
            send("done", { status: "done" })
          } else if (row.status === "failed" || row.status === "cancelled") {
            send("error", {
              message: row.error ?? "Run failed",
              code: row.status === "cancelled" ? "DEERFLOW_CANCELLED" : "DEERFLOW_RUN_FAILED",
            })
            send("done", { status: row.status })
          } else {
            send("done", { status: row.status })
          }
          close()
          return
        }

        heartbeat = setInterval(() => {
          if (closed) return
          try {
            controller.enqueue(sseComment())
          } catch {
            close()
          }
        }, HEARTBEAT_MS)
      },
      cancel() {
        // Client disconnected; the run keeps executing server-side. Only
        // detach this consumer.
        unsub?.()
        unsub = null
        if (heartbeat) {
          clearInterval(heartbeat)
          heartbeat = null
        }
      },
    })

    return new Response(stream, { headers: sseHeaders() })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[deerflow stream] Error:", err)
    return new Response(errorStream("Failed to open DeerFlow stream", "DEERFLOW_STREAM_ERROR"), {
      status: 200,
      headers: sseHeaders(),
    })
  }
}
