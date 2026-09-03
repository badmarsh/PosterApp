/**
 * Server-side review job manager.
 *
 * Professional/Path-A reviews take 5–20 minutes (retrieval → 13 per-criterion
 * calls → primary review → self-critique → synthesis). The HTTP request that
 * started a generation cannot report that progress; instead the generation is
 * detached into a job whose stage progress is streamed over SSE and which can
 * be cancelled via an AbortSignal.
 *
 * In-process by design (same deployment model as job-queue.ts / telemetry.ts):
 * a server restart drops running jobs — the client treats a vanished job as
 * "interrupted", exactly like the browser job queue.
 */

export type ReviewJobStage =
  | "queued"
  | "loading_context"
  | "retrieval"
  | "criterion_reviews"
  | "primary_review"
  | "self_critique"
  | "synthesis"
  | "persisting"
  | "done"
  | "error"
  | "cancelled"

export interface ReviewJobState {
  id: string
  workspaceId: string
  userId: string
  status: "running" | "done" | "error" | "cancelled"
  stage: ReviewJobStage
  /** 0–100 coarse progress derived from the stage. */
  progress: number
  /** Human-readable stage detail, e.g. "retrieval 13/13". */
  detail: string
  error?: string
  result?: unknown
  createdAt: number
  updatedAt: number
}

type Listener = (state: ReviewJobState) => void

interface ReviewJob {
  state: ReviewJobState
  controller: AbortController
  listeners: Set<Listener>
  report: (stage: ReviewJobStage, detail?: string) => void
}

const STAGE_PROGRESS: Record<ReviewJobStage, number> = {
  queued: 0,
  loading_context: 5,
  retrieval: 20,
  criterion_reviews: 55,
  primary_review: 70,
  self_critique: 82,
  synthesis: 92,
  persisting: 97,
  done: 100,
  error: 100,
  cancelled: 100,
}

class ReviewJobManager {
  private jobs = new Map<string, ReviewJob>()
  private readonly MAX_JOBS = 64
  private readonly TTL_MS = 60 * 60 * 1000

  private prune(now = Date.now()) {
    for (const [id, job] of this.jobs) {
      if (
        job.state.status !== "running" &&
        now - job.state.updatedAt > this.TTL_MS
      ) {
        this.jobs.delete(id)
      }
    }
    if (this.jobs.size > this.MAX_JOBS) {
      const oldest = Array.from(this.jobs.values())
        .filter((j) => j.state.status !== "running")
        .sort((a, b) => a.state.updatedAt - b.state.updatedAt)
      for (const j of oldest.slice(0, this.jobs.size - this.MAX_JOBS)) {
        this.jobs.delete(j.state.id)
      }
    }
  }

  get(id: string): ReviewJobState | null {
    this.prune()
    return this.jobs.get(id)?.state ?? null
  }

  /** Ownership check — only the user who started the job may watch/cancel it. */
  ownsJob(id: string, userId: string): boolean {
    const job = this.jobs.get(id)
    return !!job && job.state.userId === userId
  }

  listForWorkspace(workspaceId: string): ReviewJobState[] {
    this.prune()
    return Array.from(this.jobs.values())
      .filter((j) => j.state.workspaceId === workspaceId)
      .map((j) => ({ ...j.state }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Start a detached generation job.
   * @param run receives (reportStage, signal) — resolves with the API payload.
   */
  start(
    workspaceId: string,
    userId: string,
    run: (report: (stage: ReviewJobStage, detail?: string) => void, signal: AbortSignal) => Promise<unknown>
  ): ReviewJobState {
    this.prune()
    const id = `rvw_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const controller = new AbortController()
    const now = Date.now()
    const state: ReviewJobState = {
      id,
      workspaceId,
      userId,
      status: "running",
      stage: "queued",
      progress: 0,
      detail: "queued",
      createdAt: now,
      updatedAt: now,
    }
    const job: ReviewJob = {
      state,
      controller,
      listeners: new Set(),
      report: () => {},
    }
    this.jobs.set(id, job)

    const report = (stage: ReviewJobStage, detail?: string) => {
      if (job.state.status !== "running") return
      job.state.stage = stage
      job.state.progress = STAGE_PROGRESS[stage] ?? job.state.progress
      if (detail !== undefined) job.state.detail = detail
      job.state.updatedAt = Date.now()
      this.emit(job)
    }
    job.report = report

    ;(async () => {
      try {
        const result = await run(report, controller.signal)
        if (controller.signal.aborted) {
          job.state.status = "cancelled"
          job.state.stage = "cancelled"
        } else {
          job.state.status = "done"
          job.state.stage = "done"
          job.state.progress = 100
          job.state.result = result
        }
      } catch (err) {
        if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
          job.state.status = "cancelled"
          job.state.stage = "cancelled"
        } else {
          job.state.status = "error"
          job.state.stage = "error"
          job.state.error = err instanceof Error ? err.message : String(err)
        }
      } finally {
        job.state.updatedAt = Date.now()
        this.emit(job)
      }
    })()

    return { ...state }
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id)
    if (!job || job.state.status !== "running") return false
    job.controller.abort()
    job.state.status = "cancelled"
    job.state.stage = "cancelled"
    job.state.updatedAt = Date.now()
    this.emit(job)
    return true
  }

  subscribe(id: string, cb: Listener): () => void {
    const job = this.jobs.get(id)
    if (!job) return () => {}
    job.listeners.add(cb)
    cb({ ...job.state })
    return () => {
      job.listeners.delete(cb)
    }
  }

  private emit(job: ReviewJob) {
    const snapshot = { ...job.state }
    for (const cb of job.listeners) {
      try {
        cb(snapshot)
      } catch {
        /* listener errors are non-fatal */
      }
    }
  }
}

export const reviewJobManager = new ReviewJobManager()

/** Encodes an SSE `data:` frame. */
export function sseFrame(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}
