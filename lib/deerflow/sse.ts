/**
 * Minimal, dependency-free Server-Sent Events parser for Node streams.
 *
 * DeerFlow streams run events with `Accept: text/event-stream`. This parser
 * handles CRLF/LF framing, multi-line `data:` fields (joined with "\n"),
 * `event:`/`id:` fields, `:` comment lines, events split across arbitrary
 * chunk boundaries, and a final event not terminated by a blank line.
 *
 * A hard per-event byte cap protects against a hostile/misbehaving upstream
 * buffering an unbounded frame.
 */
import "server-only"
import { DeerflowProtocolError } from "./errors"

export interface SseEvent {
  /** Named event type (`event:` field). Empty string when unnamed. */
  event: string
  /** `id:` field, if present. */
  id?: string
  /** `data:` payload, multi-line fields joined with "\n". */
  data: string
}

export interface ParseSseOptions {
  /** Reject a single event larger than this many bytes (default 512 KB). */
  maxEventBytes?: number
  /** Abort parsing when the signal fires (checked between chunks). */
  signal?: AbortSignal
}

const DEFAULT_MAX_EVENT_BYTES = 512 * 1024

/** Events emitted by an SseParser session. */
export interface SseStreamOptions extends ParseSseOptions {
  /** Optional callback invoked for `:` comment lines and other ignored frames. */
  onComment?: (comment: string) => void
}

/**
 * Parses a `ReadableStream<Uint8Array>` into a stream of `SseEvent`s.
 * throws `DeerflowProtocolError` when a frame exceeds the byte cap.
 */
export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
  options: SseStreamOptions = {}
): AsyncGenerator<SseEvent> {
  const { maxEventBytes = DEFAULT_MAX_EVENT_BYTES, signal, onComment } = options
  const decoder = new TextDecoder("utf-8")
  const reader = stream.getReader()

  // Per-frame accumulation
  let frameEvent = ""
  let frameId: string | undefined
  let frameData: string[] = []
  let frameBytes = 0
  // Line buffer across chunk boundaries (may hold a partial line). Lines are
  // small; only the whole frame is byte-capped, so an unbounded *line* is
  // bounded by the same frame cap check below.
  let lineBuffer = ""

  const resetFrame = () => {
    frameEvent = ""
    frameId = undefined
    frameData = []
    frameBytes = 0
  }

  const dispatch = (): SseEvent | null => {
    if (frameData.length === 0 && !frameEvent && frameId === undefined) {
      resetFrame()
      return null
    }
    const event: SseEvent = {
      event: frameEvent,
      data: frameData.join("\n"),
      ...(frameId !== undefined ? { id: frameId } : {}),
    }
    resetFrame()
    return event
  }

  const feedLine = (line: string) => {
    if (line.startsWith(":")) {
      onComment?.(line.slice(1))
      return
    }
    const colon = line.indexOf(":")
    const field = colon === -1 ? line : line.slice(0, colon)
    // Per spec, a field of only spaces after the colon is skipped; the value
    // is otherwise the rest of the line with one leading space removed.
    let value = colon === -1 ? "" : line.slice(colon + 1)
    if (value.startsWith(" ")) value = value.slice(1)
    frameBytes += Buffer.byteLength(value, "utf8")
    if (frameBytes > maxEventBytes) {
      throw new DeerflowProtocolError(
        `SSE event exceeded ${maxEventBytes} bytes`
      )
    }
    switch (field) {
      case "event":
        frameEvent = value
        break
      case "id":
        frameId = value
        break
      case "data":
        frameData.push(value)
        break
      default:
        // Unknown fields (retry:, etc.) are ignored per spec.
        break
    }
  }

  try {
    for (;;) {
      if (signal?.aborted) return
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })

      let buffer = lineBuffer + text
      let newline = buffer.indexOf("\n")
      while (newline !== -1) {
        const line = buffer.slice(0, newline)
        // Strip trailing \r for CRLF frames.
        const cleaned = line.endsWith("\r") ? line.slice(0, -1) : line
        if (cleaned === "") {
          const event = dispatch()
          if (event) yield event
        } else {
          feedLine(cleaned)
        }
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf("\n")
      }
      lineBuffer = buffer
    }

    // Stream ended without a final blank line — flush a pending frame.
    if (lineBuffer.length > 0) feedLine(lineBuffer)
    if (frameData.length > 0 || frameEvent || frameId !== undefined) {
      const event = dispatch()
      if (event) yield event
    }
  } finally {
    reader.releaseLock()
  }
}
