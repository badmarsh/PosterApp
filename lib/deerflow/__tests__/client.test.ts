import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  assertBridgePath,
  createDeerThread,
  streamDeerRun,
  deleteDeerThread,
} from "../client"
import {
  DeerflowAuthError,
  DeerflowUnavailableError,
  DeerflowValidationError,
} from "../errors"
import { createDeerflowFixture } from "../../../tests/fixtures/deerflow-gateway.mjs"

type Fixture = Awaited<ReturnType<typeof createDeerflowFixture>>

describe("DeerFlow bridge client", () => {
  let fixture: Fixture

  beforeEach(async () => {
    fixture = createDeerflowFixture()
    await fixture.start()
    process.env.DEERFLOW_URL = fixture.url
    process.env.DEERFLOW_SERVICE_TOKEN = "test-token"
    process.env.DEERFLOW_ENABLED = "1"
  })

  afterEach(async () => {
    await fixture.stop()
    delete process.env.DEERFLOW_URL
    delete process.env.DEERFLOW_SERVICE_TOKEN
    delete process.env.DEERFLOW_ENABLED
  })

  it("creates a thread and parses thread_id", async () => {
    const thread = await createDeerThread({ source: "posterapp" })
    expect(thread.thread_id).toMatch(/^thread-/)
  })

  it("streams scripted SSE events from a run", async () => {
    const thread = await createDeerThread()
    const events: string[] = []
    for await (const ev of streamDeerRun(thread.thread_id, {
      assistant_id: "lead_agent",
      input: { messages: [{ type: "human", content: [{ type: "text", text: "hi" }] }] },
      stream_mode: ["values", "custom"],
    })) {
      events.push(`${ev.event}:${ev.data}`)
    }
    expect(events.some((e) => e.startsWith("custom:"))).toBe(true)
    expect(events.some((e) => e.includes("Planning research plan"))).toBe(true)
  })

  it("deletes a thread (204 no-body response)", async () => {
    const thread = await createDeerThread()
    await expect(deleteDeerThread(thread.thread_id)).resolves.toBeUndefined()
  })

  it("rejects paths that escape the configured origin", () => {
    expect(() => assertBridgePath("http://127.0.0.1:2026", "http://evil.example/x")).toThrow(
      DeerflowValidationError
    )
    expect(() => assertBridgePath("http://127.0.0.1:2026", "//evil.example/x")).toThrow(
      DeerflowValidationError
    )
    expect(() => assertBridgePath("http://127.0.0.1:2026", "/api/langgraph/threads")).not.toThrow()
  })

  it("rejects non-http(s) base URLs", () => {
    expect(() => assertBridgePath("file:///etc/passwd", "/x")).toThrow(DeerflowValidationError)
  })

  it("maps upstream 401 to DeerflowAuthError", async () => {
    // Patch fetch to simulate auth failure from the fixture origin.
    const original = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
    try {
      await expect(createDeerThread()).rejects.toBeInstanceOf(DeerflowAuthError)
    } finally {
      globalThis.fetch = original
    }
  })

  it("maps network failure to DeerflowUnavailableError", async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed")
    }
    try {
      await expect(createDeerThread()).rejects.toBeInstanceOf(DeerflowUnavailableError)
    } finally {
      globalThis.fetch = original
    }
  })
})
