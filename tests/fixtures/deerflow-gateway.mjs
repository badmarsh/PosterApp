/**
 * Fake DeerFlow gateway for tests (never shipped to production).
 *
 * Implements the small subset of the LangGraph-compatible + Gateway API the
 * PosterApp bridge uses:
 *   POST   /api/langgraph/threads                  -> { thread_id }
 *   POST   /api/langgraph/threads/:id/runs/stream  -> SSE frames (scripted)
 *   DELETE /api/threads/:id                        -> 204
 *   GET    /api/models                             -> { models: [] }
 *
 * Usage (in vitest):
 *   import { createDeerflowFixture } from "../../../tests/fixtures/deerflow-gateway.mjs"
 *   const fixture = await createDeerflowFixture({ frames: [ ... ] })
 *   process.env.DEERFLOW_URL = fixture.url
 *   ... after: await fixture.stop()
 *
 * CLI mode (manual smoke): node tests/fixtures/deerflow-gateway.mjs --port 2026
 */
import http from "node:http"
import { randomUUID } from "node:crypto"

const DEFAULT_FRAMES = [
  { event: "custom", data: { value: "Planning research plan" } },
  { event: "values", data: { value: { messages: [{ role: "assistant", content: "working" }] } } },
  { event: "custom", data: { value: "Searching sources" } },
]

export function createDeerflowFixture({ frames = DEFAULT_FRAMES } = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost")
    const path = url.pathname

    if (req.method === "POST" && path === "/api/langgraph/threads") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ thread_id: `thread-${randomUUID()}`, created_at: new Date().toISOString(), metadata: {} }))
      return
    }

    if (req.method === "GET" && path === "/api/models") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ models: [{ id: "fake-model" }] }))
      return
    }

    const runStream = path.match(/^\/api\/langgraph\/threads\/([^/]+)\/runs\/stream$/)
    if (req.method === "POST" && runStream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      })
      let i = 0
      const timer = setInterval(() => {
        if (i >= frames.length) {
          res.write(`event: done\ndata: {"ok":true}\n\n`)
          clearInterval(timer)
          res.end()
          return
        }
        const frame = frames[i++]
        const data = typeof frame.data === "string" ? frame.data : JSON.stringify(frame.data)
        res.write(`event: ${frame.event}\ndata: ${data}\n\n`)
      }, 20)
      req.on("close", () => clearInterval(timer))
      return
    }

    const deleteThread = path.match(/^\/api\/threads\/([^/]+)$/)
    if (req.method === "DELETE" && deleteThread) {
      res.writeHead(204)
      res.end()
      return
    }

    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "not found", path }))
  })

  let url = ""
  const start = () =>
    new Promise((resolve, reject) => {
      server.once("error", reject)
      server.listen(0, "127.0.0.1", () => {
        const address = server.address()
        const port = typeof address === "object" && address ? address.port : 0
        url = `http://127.0.0.1:${port}`
        resolve(url)
      })
    })

  const stop = () =>
    new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve(undefined)))
    })

  return { start, stop, get url() { return url }, server }
}

// ---------------------------------------------------------------------------
// improve-poster-v1 fixtures (Phase 2 autonomous build & fix loop)
// ---------------------------------------------------------------------------

/**
 * Builds a default improve-poster-v1 proposal for fixture frames.
 * Patches target `cardId` with safe Markdown content (passes hasUnsafeLatex).
 */
export function buildImprovePosterProposal({
  cardId = "card_1",
  iterationCount = 1,
  cleanCompile = false,
  patchesPerIteration = 1,
} = {}) {
  const iterations = []
  for (let i = 0; i < iterationCount; i++) {
    const patches = []
    for (let p = 0; p < patchesPerIteration; p++) {
      const id = patchesPerIteration === 1 ? cardId : `${cardId}_${p + 1}`
      patches.push({
        id,
        content: `**Fixed** content for iteration ${i + 1}, patch ${p + 1}.`,
        rationale: `repair ${i + 1}.${p + 1}`,
      })
    }
    iterations.push({
      iterationIndex: i,
      patches,
      compileLog: `! LaTeX error in iteration ${i + 1}`,
      diagnosis: `Unclosed math expression in iteration ${i + 1}`,
    })
  }
  return {
    version: "improve-poster-v1",
    iterations,
    summary: `Fixture proposal with ${iterationCount} iteration(s)`,
    cleanCompile,
    meta: {},
  }
}

/**
 * Wraps an improve-poster-v1 proposal into the SSE `values` frame the runner
 * extracts via `extractImprovePosterJsonCandidate` (messages[].content JSON).
 */
export function improvePosterFrames(proposal) {
  return [
    { event: "custom", data: { value: "Diagnosing compile errors..." } },
    {
      event: "values",
      data: { value: { messages: [{ content: JSON.stringify(proposal) }] } },
    },
  ]
}

/**
 * Fake DeerFlow gateway that serves per-call frames for the improve_poster
 * autonomous loop. The i-th POST to .../runs/stream serves callFrames[i]
 * (wrapping with modulo), so the runner's iterative streamDeerRun calls get
 * a different proposal per iteration. Falls back to a single-call default.
 */
export function createImprovePosterFixture({
  callFrames = [],
  proposal = null,
  cardId = "card_1",
} = {}) {
  if (callFrames.length === 0) {
    const p = proposal ?? buildImprovePosterProposal({ cardId, iterationCount: 1 })
    callFrames = [improvePosterFrames(p)]
  }

  let callIndex = 0
  let url = ""
  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://localhost")
    const path = u.pathname

    if (req.method === "POST" && path === "/api/langgraph/threads") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          thread_id: `thread-${randomUUID()}`,
          created_at: new Date().toISOString(),
          metadata: {},
        })
      )
      return
    }

    if (req.method === "GET" && path === "/api/models") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ models: [{ id: "fake-model" }] }))
      return
    }

    const runStream = path.match(/^\/api\/langgraph\/threads\/([^/]+)\/runs\/stream$/)
    if (req.method === "POST" && runStream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      })
      const frames = callFrames[callIndex % callFrames.length] ?? callFrames[0] ?? []
      callIndex++
      let i = 0
      const timer = setInterval(() => {
        if (i >= frames.length) {
          res.write(`event: done\ndata: {"ok":true}\n\n`)
          clearInterval(timer)
          res.end()
          return
        }
        const frame = frames[i++]
        const data = typeof frame.data === "string" ? frame.data : JSON.stringify(frame.data)
        res.write(`event: ${frame.event}\ndata: ${data}\n\n`)
      }, 10)
      req.on("close", () => clearInterval(timer))
      return
    }

    const deleteThread = path.match(/^\/api\/threads\/([^/]+)$/)
    if (req.method === "DELETE" && deleteThread) {
      res.writeHead(204)
      res.end()
      return
    }

    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "not found", path }))
  })

  const start = () =>
    new Promise((resolve, reject) => {
      server.once("error", reject)
      server.listen(0, "127.0.0.1", () => {
        const address = server.address()
        const port = typeof address === "object" && address ? address.port : 0
        url = `http://127.0.0.1:${port}`
        resolve(url)
      })
    })

  const stop = () =>
    new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve(undefined)))
    })

  return {
    start,
    stop,
    get url() {
      return url
    },
    server,
    get callCount() {
      return callIndex
    },
    resetCalls() {
      callIndex = 0
    },
  }
}

// CLI smoke mode.
if (process.argv[1] && process.argv[1].endsWith("deerflow-gateway.mjs")) {
  const portArg = process.argv.indexOf("--port")
  const port = portArg !== -1 ? Number(process.argv[portArg + 1]) : 2026
  const fixture = createDeerflowFixture()
  void fixture.start().then(() => {
    console.log(`Fake DeerFlow gateway listening on http://127.0.0.1:${port} (started on ${fixture.url})`)
  })
  // NOTE: CLI always binds the fixture's ephemeral port; --port is informational.
}
