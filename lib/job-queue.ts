export type JobStatus = "queued" | "running" | "done" | "error" | "cancelled"

export type Job = {
  id: string
  label: string
  status: JobStatus
  progress?: number // 0-100
  error?: string
  createdAt: number
}

export type JobFn = (
  onProgress: (p: number) => void,
  signal: AbortSignal
) => Promise<void>

class JobQueue {
  private queue: Array<{ job: Job; fn: JobFn }> = []
  private activeCount = 0
  private maxConcurrency = 3
  private controllers = new Map<string, AbortController>()
  private listeners = new Set<(jobs: Job[]) => void>()

  // Load from localStorage on initialization if in browser
  constructor() {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("posterapp-jobs")
        if (stored) {
          const parsed = JSON.parse(stored) as Job[]
          const RETENTION_MS = 10 * 60_000
          const now = Date.now()
          // Any job that was interrupted on previous page session, pruned by retention
          this.queue = parsed
            .filter((job) => now - job.createdAt < RETENTION_MS)
            .slice(0, 50)
            .map((job) => {
              if (job.status === "queued" || job.status === "running") {
                return {
                  job: { ...job, status: "error", error: "Interrupted by reload" },
                  fn: async () => {},
                }
              }
              return { job, fn: async () => {} }
            })
        }
      } catch (err) {
        console.error("Failed to load jobs from localStorage", err)
      }
    }
  }

  private notify() {
    const RETENTION_MS = 10 * 60_000
    const now = Date.now()
    this.queue = this.queue
      .filter(
        ({ job }) =>
          job.status === "queued" || job.status === "running" || now - job.createdAt < RETENTION_MS
      )
      .slice(0, 50)

    const jobs = this.getJobs()
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("posterapp-jobs", JSON.stringify(jobs))
      } catch (err) {
        console.error("Failed to persist jobs to localStorage", err)
      }
    }
    this.listeners.forEach((cb) => cb(jobs))
  }

  enqueue(label: string, fn: JobFn): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    this.queue.unshift({
      job: { id, label, status: "queued", createdAt: Date.now() },
      fn,
    })
    this.notify()
    this.processNext()
    return id
  }

  cancel(jobId: string) {
    const item = this.queue.find((q) => q.job.id === jobId)
    if (!item) return

    if (item.job.status === "queued") {
      item.job.status = "cancelled"
      this.notify()
    } else if (item.job.status === "running") {
      item.job.status = "cancelled"
      const controller = this.controllers.get(jobId)
      if (controller) {
        controller.abort()
      }
      this.notify()
    }
  }

  cancelAll() {
    this.queue.forEach((item) => {
      if (item.job.status === "queued" || item.job.status === "running") {
        item.job.status = "cancelled"
      }
    })
    this.controllers.forEach((controller) => controller.abort())
    this.controllers.clear()
    this.notify()
  }

  getJobs(): Job[] {
    return this.queue.map((q) => ({ ...q.job }))
  }

  reconcileWithIngestFiles(
    ingestFiles: Array<{ name: string; status: string; progress?: number; error?: string }>
  ) {
    if (!ingestFiles || ingestFiles.length === 0) return
    const fileMap = new Map<string, { status: string; progress?: number; error?: string }>()
    for (const f of ingestFiles) {
      fileMap.set(f.name.toLowerCase(), f)
    }

    let changed = false
    for (const item of this.queue) {
      if (item.job.error === "Interrupted by reload" || item.job.status === "error") {
        const match = item.job.label.match(/^Parse\s+(.+)$/i)
        if (match) {
          const filename = match[1].trim().toLowerCase()
          const dbFile = fileMap.get(filename)
          if (dbFile && dbFile.status === "done") {
            item.job.status = "done"
            item.job.progress = 100
            item.job.error = undefined
            changed = true
          }
        }
      }
    }

    if (changed) {
      this.notify()
    }
  }

  subscribe(cb: (jobs: Job[]) => void): () => void {
    this.listeners.add(cb)
    cb(this.getJobs()) // emit immediately
    return () => {
      this.listeners.delete(cb)
    }
  }

  private async processNext() {
    if (this.activeCount >= this.maxConcurrency) return
    const nextItem = this.queue.slice().reverse().find((q) => q.job.status === "queued")
    if (!nextItem) return

    this.activeCount++
    nextItem.job.status = "running"
    this.notify()

    // Trigger next item concurrently if quota permits
    if (this.activeCount < this.maxConcurrency) {
      this.processNext()
    }

    const controller = new AbortController()
    this.controllers.set(nextItem.job.id, controller)

    try {
      await nextItem.fn(
        (p: number) => {
          if (nextItem.job.status === "running") {
            nextItem.job.progress = p
            this.notify()
          }
        },
        controller.signal
      )

      if ((nextItem.job.status as string) !== "cancelled") {
        nextItem.job.status = "done"
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        nextItem.job.status = "cancelled"
      } else if ((nextItem.job.status as string) !== "cancelled") {
        nextItem.job.status = "error"
        nextItem.job.error = err instanceof Error ? err.message : String(err)
      }
    } finally {
      this.controllers.delete(nextItem.job.id)
      this.activeCount--
      this.notify()
      this.processNext() // process next in queue
    }
  }
}

export const jobQueue = new JobQueue()
