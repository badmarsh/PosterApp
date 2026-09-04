import { describe, expect, it } from "vitest"
import { parseSseStream } from "../sse"
import { DeerflowProtocolError } from "../errors"

const encoder = new TextEncoder()

/** Deterministic PRNG (mulberry32) so chunk-boundary tests are stable. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function chunked(bytes: Uint8Array, size: number): Uint8Array[] {
  const chunks: Uint8Array[] = []
  for (let i = 0; i < bytes.length; i += size) {
    chunks.push(bytes.slice(i, Math.min(i + size, bytes.length)))
  }
  return chunks
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Array<{ event: string; data: string }>> {
  const out: Array<{ event: string; data: string }> = []
  for await (const ev of parseSseStream(stream)) {
    out.push({ event: ev.event, data: ev.data })
  }
  return out
}

const SAMPLE_SSE = [
  'event: custom\ndata: {"value":"Planning research plan"}\n\n',
  'event: values\ndata: {"messages":[{"role":"assistant","content":"working"}]}\n\n',
  ": keep-alive comment\n",
  "event: multiline\ndata: line one\ndata: line two\n\n",
].join("")

describe("parseSseStream", () => {
  it("parses a full frame set", async () => {
    const events = await collect(new Blob([SAMPLE_SSE]).stream())
    expect(events).toHaveLength(3)
    expect(events[0]).toEqual({ event: "custom", data: '{"value":"Planning research plan"}' })
    expect(events[1].event).toBe("values")
    expect(events[2]).toEqual({ event: "multiline", data: "line one\nline two" })
  })

  it("is invariant across 50 random chunk boundaries", async () => {
    const bytes = encoder.encode(SAMPLE_SSE)
    const rand = mulberry32(42)
    const reference = await collect(new Blob([SAMPLE_SSE]).stream())
    for (let round = 0; round < 50; round++) {
      // Randomly vary split sizes between 1 and 37 bytes.
      const size = 1 + Math.floor(rand() * 37)
      const chunks = chunked(bytes, size)
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const c of chunks) controller.enqueue(c)
          controller.close()
        },
      })
      const events = await collect(stream)
      expect(events).toEqual(reference)
    }
  })

  it("flushes a final event without a trailing blank line", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("event: final\ndata: {\"ok\":true}"))
        controller.close()
      },
    })
    const events = await collect(stream)
    expect(events).toEqual([{ event: "final", data: '{"ok":true}' }])
  })

  it("handles CRLF framing", async () => {
    const stream = new Blob(['event: x\r\ndata: hi\r\n\r\nevent: y\r\ndata: bye\r\n\r\n']).stream()
    const events = await collect(stream)
    expect(events).toEqual([
      { event: "x", data: "hi" },
      { event: "y", data: "bye" },
    ])
  })

  it("ignores comment lines but reports them via onComment", async () => {
    const comments: string[] = []
    const stream = new Blob([": hello\n\n"]).stream()
    for await (const ev of parseSseStream(stream, { onComment: (c) => comments.push(c) })) {
      void ev
    }
    expect(comments).toEqual([" hello"])
  })

  it("rejects events larger than the byte cap", async () => {
    const payload = `event: big\ndata: ${"x".repeat(600 * 1024)}\n\n`
    const stream = new Blob([payload]).stream()
    const iterator = parseSseStream(stream, { maxEventBytes: 512 * 1024 })[Symbol.asyncIterator]()
    await expect(iterator.next()).rejects.toBeInstanceOf(DeerflowProtocolError)
  })

  it("ends cleanly on an empty stream", async () => {
    const events = await collect(new Blob([""]).stream())
    expect(events).toEqual([])
  })
})
