import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// A-N1 regression: the SSE error event emitted when asset persistence fails
// must NOT leak raw DB error text to the client unless NODE_ENV === development.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
  requireWorkspaceEditor: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    asset: { upsert: vi.fn(), create: vi.fn() },
    ingestFile: { upsert: vi.fn(), updateMany: vi.fn() },
  },
}))

vi.mock("fs", () => {
  const mock = {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    promises: {
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
    },
  }
  return { default: mock, ...mock }
})

vi.mock("@/lib/services/mineru-bridge", () => ({
  fetchMinerU: vi.fn(),
  resolveMinerUUrl: vi.fn().mockResolvedValue("http://127.0.0.1:8001"),
  ensureMinerUBridge: vi.fn(),
}))

vi.mock("@/lib/services/vision-service", () => ({
  generateCaption: vi.fn().mockResolvedValue({ caption: "Test figure caption", snippet: "", name: "" }),
}))

vi.mock("@/lib/services/bibtex-service", () => ({
  extractBibTeX: vi.fn().mockResolvedValue({ count: 0 }),
}))

vi.mock("@/lib/services/equation-service", () => ({
  generateEquationCaption: vi.fn().mockResolvedValue({ name: "", key: "", description: "" }),
}))

import { requireWorkspaceEditor } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { fetchMinerU } from "@/lib/services/mineru-bridge"
import { POST } from "@/app/api/ingestion/parse/route"

const mockRequireEditor = vi.mocked(requireWorkspaceEditor)
const mockFetchMinerU = vi.mocked(fetchMinerU)

// Raw error text we pretend the DB layer threw. If this string ever reaches the
// SSE stream in a production-mode run, the leak has regressed.
const RAW_DB_ERROR = "ECONNREFUSED database unreachable at db.internal.example.com:5432"

function buildMultipartRequest(workspaceId: string): NextRequest {
  const boundary = "----vitestboundary1234"
  const pdfContent = "%PDF-1.4 fake pdf body for testing"
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="test.pdf"`,
    "Content-Type: application/pdf",
    "",
    pdfContent,
    `--${boundary}--`,
    "",
  ].join("\r\n")

  return new NextRequest(
    `http://localhost:3000/api/ingestion/parse?workspaceId=${workspaceId}`,
    {
      method: "POST",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": String(Buffer.byteLength(body)),
      },
      body,
    }
  )
}

function mineruOkResponse(): Response {
  // One figure image + math-free markdown. No fileId in the form, so the
  // sources/bibtex/vector-chunking branch is skipped and the pipeline runs
  // straight through to asset persistence.
  const payload = {
    results: {
      test: {
        md_content: "# Test Document\n\nA figure follows below.\n",
        images: { "fig1.jpg": "dGVzdGltYWdl" },
      },
    },
  }
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

function parseSse(text: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = []
  for (const chunk of text.split("\n\n")) {
    const line = chunk.trim()
    if (line.startsWith("data: ")) {
      try {
        events.push(JSON.parse(line.slice("data: ".length)))
      } catch {
        // ignore malformed
      }
    }
  }
  return events
}

describe("A-N1: ingestion parse SSE error detail gating", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockRequireEditor.mockResolvedValue({ userId: "user_test", workspaceId: "ws_test" } as any)
    mockFetchMinerU.mockResolvedValue(mineruOkResponse())
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it("omits `detail` on DB-save failure when NODE_ENV is not development", async () => {
    vi.stubEnv("NODE_ENV", "production")
    ;(prisma.$transaction as any).mockRejectedValueOnce(new Error(RAW_DB_ERROR))

    const res = await POST(buildMultipartRequest("ws_test"))
    const text = await res.text()
    const events = parseSse(text)

    const errorEvents = events.filter((e) => e.type === "error")
    expect(errorEvents.length).toBe(1)
    const errorEvent = errorEvents[0]
    expect(errorEvent.error).toBe("Failed to save extracted assets to database")
    // The raw DB error text must never reach the client in production.
    expect(errorEvent.detail).toBeUndefined()
    expect(text).not.toContain(RAW_DB_ERROR)
    expect(text).not.toContain("db.internal.example.com")
  })

  it("includes `detail` on DB-save failure when NODE_ENV === development", async () => {
    vi.stubEnv("NODE_ENV", "development")
    ;(prisma.$transaction as any).mockRejectedValueOnce(new Error(RAW_DB_ERROR))

    const res = await POST(buildMultipartRequest("ws_test"))
    const text = await res.text()
    const events = parseSse(text)

    const errorEvents = events.filter((e) => e.type === "error")
    expect(errorEvents.length).toBe(1)
    const errorEvent = errorEvents[0]
    expect(errorEvent.error).toBe("Failed to save extracted assets to database")
    expect(errorEvent.detail).toBe(RAW_DB_ERROR)
  })
})
