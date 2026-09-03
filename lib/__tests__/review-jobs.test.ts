import { describe, it, expect, beforeEach } from "vitest"
import { reviewJobManager } from "@/lib/review-jobs"

describe("review job manager", () => {
  beforeEach(() => {
    // no shared state reset API; jobs self-prune — use unique ids via real start()
  })

  it("runs a job, streams stage updates, and stores the result", async () => {
    const stages: string[] = []
    const state = reviewJobManager.start("ws-jobs-1", "user-1", async (report, signal) => {
      report("loading_context", "loading")
      stages.push("loading_context")
      report("retrieval", "retrieval 5/13")
      stages.push("retrieval")
      expect(signal.aborted).toBe(false)
      report("done")
      return { id: "review-xyz", ok: true }
    })

    // Wait for completion
    await new Promise<void>((resolve) => {
      const unsub = reviewJobManager.subscribe(state.id, (s) => {
        if (s.status === "done") {
          unsub()
          resolve()
        }
      })
    })

    const final = reviewJobManager.get(state.id)!
    expect(final.status).toBe("done")
    expect(final.stage).toBe("done")
    expect((final.result as { id: string }).id).toBe("review-xyz")
    expect(final.progress).toBe(100)
    expect(stages).toContain("retrieval")
  })

  it("cancels a running job via the abort signal", async () => {
    let aborted = false
    const state = reviewJobManager.start("ws-jobs-2", "user-1", async (report, signal) => {
      report("retrieval", "slow stage")
      await new Promise<void>((resolve) => {
        const wait = setTimeout(resolve, 5000)
        signal.addEventListener("abort", () => {
          clearTimeout(wait)
          aborted = true
          resolve()
        })
      })
      if (signal.aborted) {
        const err = new Error("cancelled")
        err.name = "AbortError"
        throw err
      }
      report("done")
      return { id: "should-not-save" }
    })

    // Cancel almost immediately.
    await new Promise((r) => setTimeout(r, 50))
    reviewJobManager.cancel(state.id)

    // The abort handler unblocks the job's promise; its status is then set.
    await new Promise<void>((resolve) => {
      const tick = () => {
        const s = reviewJobManager.get(state.id)
        if (s && s.status === "cancelled") return resolve()
        setTimeout(tick, 10)
      }
      tick()
    })

    const final = reviewJobManager.get(state.id)!
    expect(final.status).toBe("cancelled")
    expect(aborted).toBe(true)
  })

  it("records failures as error status", async () => {
    const state = reviewJobManager.start("ws-jobs-3", "user-1", async () => {
      throw new Error("boom")
    })
    await new Promise<void>((resolve) => {
      const unsub = reviewJobManager.subscribe(state.id, (s) => {
        if (s.status === "error") {
          unsub()
          resolve()
        }
      })
    })
    const final = reviewJobManager.get(state.id)!
    expect(final.status).toBe("error")
    expect(final.error).toContain("boom")
  })

  it("enforces ownership for cancel/stream", () => {
    const state = reviewJobManager.start("ws-jobs-4", "owner", async () => {
      await new Promise((r) => setTimeout(r, 200))
      return {}
    })
    expect(reviewJobManager.ownsJob(state.id, "owner")).toBe(true)
    expect(reviewJobManager.ownsJob(state.id, "intruder")).toBe(false)
  })
})
