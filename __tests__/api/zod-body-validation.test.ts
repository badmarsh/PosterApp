/**
 * Negative-body validation tests for Zod-protected routes.
 * These tests exercise the 400 path that safeParse now covers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { NextRequest } from "next/server"

// ── Shared test helpers ────────────────────────────────────────────────────

const WORKSPACE_ID = "test_workspace_01"
const CARD_ID = "test_card_01"

function mockRequest(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    url: `http://localhost/api/workspaces/${WORKSPACE_ID}/test`,
  } as unknown as NextRequest
}

// Auth + rate-limit stubs — allow everything
vi.mock("@/lib/auth", () => ({
  requireWorkspaceEditor: vi.fn().mockResolvedValue({ userId: "user_1", workspace: { id: WORKSPACE_ID, revision: 1 } }),
  requireWorkspaceAccess: vi.fn().mockResolvedValue({ userId: "user_1", workspace: { id: WORKSPACE_ID } }),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
  rateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
}))

// Stub heavy dependencies that are not under test
vi.mock("@/lib/ai/client", () => ({
  generateAIResponse: vi.fn(),
  generateAITextResponse: vi.fn(),
}))
vi.mock("@/lib/ai/context", () => ({
  loadSourceContext: vi.fn().mockResolvedValue(""),
}))
vi.mock("@/lib/ai/contracts", () => ({
  CardGenerationSchema: {},
  ShrinkContentSchema: {},
  StructureGenerationSchema: {},
}))
vi.mock("@/lib/ai/models", () => ({
  resolveAiModel: vi.fn().mockReturnValue("test-model"),
  AI_TIMEOUTS: { structure: 60000, generate: 60000, shrink: 60000, convert: 60000 },
}))
vi.mock("@/lib/ai/prompts", () => ({
  buildCitationInstruction: vi.fn().mockReturnValue(""),
  buildGroundingInstruction: vi.fn().mockReturnValue(""),
  wrapUntrustedContext: vi.fn((label: string, content: string) => `[${label}]\n${content}`),
}))
vi.mock("@/lib/output-types", () => ({
  buildDefaultStructure: vi.fn().mockReturnValue([]),
  OutputType: {},
}))
vi.mock("@/lib/services/qr-service", () => ({
  generateAndSaveQRCode: vi.fn().mockResolvedValue({ url: "http://example.com/qr" }),
}))
vi.mock("@/lib/services/ocr-service", () => ({
  processImageOcr: vi.fn().mockResolvedValue({ text: "test" }),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: { asset: { create: vi.fn() } },
}))
vi.mock("@/lib/workspace-files", () => ({
  workspacePath: vi.fn().mockReturnValue("/tmp/test"),
  SAFE_FILENAME: /^[a-zA-Z0-9_.-]+$/,
}))
vi.mock("@/lib/bib-types", () => ({
  parseBibEntries: vi.fn().mockReturnValue([]),
}))

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Zod body validation — negative tests", () => {
  describe("POST /cards/convert", () => {
    it("rejects missing sourceContent", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/cards/convert/route")
      const req = mockRequest({ sourceType: "poster", targetType: "slides" })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID }) })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/invalid/i)
    })

    it("rejects invalid sourceType enum", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/cards/convert/route")
      const req = mockRequest({ sourceContent: "hello", sourceType: "INVALID", targetType: "poster" })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID }) })
      expect(res.status).toBe(400)
    })

    it("rejects sourceContent over limit", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/cards/convert/route")
      const req = mockRequest({ sourceContent: "x".repeat(100_001), sourceType: "poster", targetType: "slides" })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID }) })
      expect(res.status).toBe(400)
    })
  })

  describe("POST /cards/[cardId]/shrink", () => {
    it("rejects missing content", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/cards/[cardId]/shrink/route")
      const req = mockRequest({ targetCharacters: 100 })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID, cardId: CARD_ID }) })
      expect(res.status).toBe(400)
    })

    it("rejects negative targetCharacters", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/cards/[cardId]/shrink/route")
      const req = mockRequest({ content: "some text", targetCharacters: -5 })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID, cardId: CARD_ID }) })
      expect(res.status).toBe(400)
    })
  })

  describe("POST /cards/[cardId]/generate", () => {
    it("rejects missing topic", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/cards/[cardId]/generate/route")
      const req = mockRequest({ outputType: "poster" })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID, cardId: CARD_ID }) })
      expect(res.status).toBe(400)
    })

    it("rejects invalid outputType enum", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/cards/[cardId]/generate/route")
      const req = mockRequest({ topic: "My topic", outputType: "invalid_type" })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID, cardId: CARD_ID }) })
      expect(res.status).toBe(400)
    })
  })

  describe("POST /qr", () => {
    it("rejects missing url", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/qr/route")
      const req = mockRequest({ label: "test" })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID }) })
      expect(res.status).toBe(400)
    })

    it("rejects invalid url format", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/qr/route")
      const req = mockRequest({ url: "not-a-url" })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID }) })
      expect(res.status).toBe(400)
    })
  })

  describe("POST /ocr", () => {
    it("rejects missing image", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/ocr/route")
      const req = mockRequest({ mode: "auto" })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID }) })
      expect(res.status).toBe(400)
    })

    it("rejects prompt over limit", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/ocr/route")
      const req = mockRequest({ image: "base64data", prompt: "x".repeat(2001) })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID }) })
      expect(res.status).toBe(400)
    })
  })

  describe("POST /structure/generate", () => {
    it("rejects invalid outputType enum", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/structure/generate/route")
      const req = mockRequest({ outputType: "INVALID" })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID }) })
      expect(res.status).toBe(400)
    })
  })

  describe("POST /bib/lookup", () => {
    it("rejects missing query", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/bib/lookup/route")
      const req = mockRequest({})
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID }) })
      expect(res.status).toBe(400)
    })

    it("rejects query over limit", async () => {
      const { POST } = await import("../../app/api/workspaces/[id]/bib/lookup/route")
      const req = mockRequest({ query: "x".repeat(2001) })
      const res = await POST(req, { params: Promise.resolve({ id: WORKSPACE_ID }) })
      expect(res.status).toBe(400)
    })
  })
})
