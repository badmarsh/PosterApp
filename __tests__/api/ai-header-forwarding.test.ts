import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 0 })),
  rateLimitAsync: vi.fn(async () => ({ allowed: true, retryAfterMs: 0 })),
}))

vi.mock("@/lib/ai/context", () => ({
  loadSourceContext: vi.fn(() => Promise.resolve("Mock paper source context for testing.")),
}))

const mockGenerateAIResponse = vi.fn()
const mockGenerateAITextResponse = vi.fn()

vi.mock("@/lib/ai/client", () => ({
  generateAIResponse: (...args: any[]) => mockGenerateAIResponse(...args),
  generateAITextResponse: (...args: any[]) => mockGenerateAITextResponse(...args),
  getLastServedProvider: vi.fn(() => "primary"),
}))

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { POST as convertPOST } from "@/app/api/workspaces/[id]/cards/convert/route"
import { POST as shrinkPOST } from "@/app/api/workspaces/[id]/cards/[cardId]/shrink/route"
import { POST as generatePOST } from "@/app/api/workspaces/[id]/cards/[cardId]/generate/route"
import { POST as reviewPOST } from "@/app/api/workspaces/[id]/review/route"
import { POST as structurePOST } from "@/app/api/workspaces/[id]/structure/generate/route"
import { POST as bibLookupPOST } from "@/app/api/workspaces/[id]/bib/lookup/route"

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)

describe("AI Header Forwarding (API Key & Model Overrides)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockAuth as any).mockResolvedValue({ userId: "user_123" } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue({
      id: "ws-1",
      userId: "user_123",
      cards: "[]",
      columns: 3,
    } as any)
  })

  it("cards/convert forwards client API key and model override", async () => {
    mockGenerateAIResponse.mockResolvedValueOnce({
      title: "Converted Title",
      bullets: ["Bullet 1", "Bullet 2"],
    })

    const req = new NextRequest("http://localhost/api/workspaces/ws-1/cards/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": "test-custom-gemini-key",
        "X-AI-Model-Override": JSON.stringify({ convert: "gemini-2.5-pro" }),
      },
      body: JSON.stringify({
        sourceContent: "Content to convert",
        sourceType: "poster",
        targetType: "slides",
      }),
    })

    const res = await convertPOST(req, { params: Promise.resolve({ id: "ws-1" }) })
    expect(res.status).toBe(200)

    expect(mockGenerateAIResponse).toHaveBeenCalledTimes(1)
    const [callName, options] = mockGenerateAIResponse.mock.calls[0]
    expect(callName).toBe("convert")
    expect(options.apiKey).toBe("test-custom-gemini-key")
    expect(options.model).toBe("gemini-2.5-pro")
  })

  it("cards/[cardId]/shrink forwards client API key and model override", async () => {
    mockGenerateAIResponse.mockResolvedValueOnce({
      content: "Shrunk content",
    })

    const req = new NextRequest("http://localhost/api/workspaces/ws-1/cards/card-1/shrink", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": "test-custom-gemini-key",
        "X-AI-Model-Override": JSON.stringify({ shrink: "custom-shrink-v2" }),
      },
      body: JSON.stringify({
        content: "Long content to shrink into smaller sentences",
        targetCharacters: 150,
      }),
    })

    const res = await shrinkPOST(req, {
      params: Promise.resolve({ id: "ws-1", cardId: "card-1" }),
    })
    expect(res.status).toBe(200)

    expect(mockGenerateAIResponse).toHaveBeenCalledTimes(1)
    const [callName, options] = mockGenerateAIResponse.mock.calls[0]
    expect(callName).toBe("shrink")
    expect(options.apiKey).toBe("test-custom-gemini-key")
    expect(options.model).toBe("custom-shrink-v2")
  })

  it("review forwards client API key and model override", async () => {
    mockGenerateAIResponse.mockResolvedValueOnce({
      tips: [
        {
          severity: "info",
          category: "content",
          message: "Great structure",
        },
      ],
    })

    const req = new NextRequest("http://localhost/api/workspaces/ws-1/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": "test-custom-gemini-key",
        "X-AI-Model-Override": JSON.stringify({ review: "custom-review-model" }),
      },
      body: JSON.stringify({
        cards: [],
        columns: 3,
        posterTitle: "My Poster",
      }),
    })

    const res = await reviewPOST(req, { params: Promise.resolve({ id: "ws-1" }) })
    expect(res.status).toBe(200)

    expect(mockGenerateAIResponse).toHaveBeenCalledTimes(1)
    const [callName, options] = mockGenerateAIResponse.mock.calls[0]
    expect(callName).toBe("review")
    expect(options.apiKey).toBe("test-custom-gemini-key")
    expect(options.model).toBe("custom-review-model")
  })

  it("structure/generate forwards client API key and model override", async () => {
    mockGenerateAIResponse.mockResolvedValueOnce({
      cards: [
        { title: "Intro", pattern: "regular" },
        { title: "References", pattern: "references" },
      ],
    })

    const req = new NextRequest("http://localhost/api/workspaces/ws-1/structure/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": "test-custom-gemini-key",
        "X-AI-Model-Override": JSON.stringify({ structure: "custom-structure-model" }),
      },
      body: JSON.stringify({
        outputType: "poster",
        n: 2,
      }),
    })

    const res = await structurePOST(req, { params: Promise.resolve({ id: "ws-1" }) })
    expect(res.status).toBe(200)

    expect(mockGenerateAIResponse).toHaveBeenCalledTimes(1)
    const [callName, options] = mockGenerateAIResponse.mock.calls[0]
    expect(callName).toBe("generate-structure")
    expect(options.apiKey).toBe("test-custom-gemini-key")
    expect(options.model).toBe("custom-structure-model")
  })

  it("bib/lookup forwards client API key and model override to generateAITextResponse", async () => {
    mockGenerateAITextResponse.mockResolvedValueOnce("@article{test2026,\n  title={Test}\n}")

    const req = new NextRequest("http://localhost/api/workspaces/ws-1/bib/lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": "test-custom-gemini-key",
        "X-AI-Model-Override": JSON.stringify({ bibtex: "custom-bib-model" }),
      },
      body: JSON.stringify({
        query: "Novak et al. 2026",
      }),
    })

    const res = await bibLookupPOST(req, { params: Promise.resolve({ id: "ws-1" }) })
    expect(res.status).toBe(200)

    expect(mockGenerateAITextResponse).toHaveBeenCalledTimes(1)
    const [callName, options] = mockGenerateAITextResponse.mock.calls[0]
    expect(callName).toBe("bib-lookup")
    expect(options.apiKey).toBe("test-custom-gemini-key")
    expect(options.model).toBe("custom-bib-model")
  })

  it("cards/[cardId]/generate forwards client API key and model override", async () => {
    mockGenerateAIResponse.mockResolvedValueOnce({
      title: "Generated Card",
      bullets: ["Point A", "Point B"],
      assignedAssets: [],
    })

    const req = new NextRequest("http://localhost/api/workspaces/ws-1/cards/card-1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": "test-custom-gemini-key",
        "X-AI-Model-Override": JSON.stringify({ generation: "custom-gen-model" }),
      },
      body: JSON.stringify({
        topic: "Methodology",
        characterLimit: 500,
      }),
    })

    const res = await generatePOST(req, {
      params: Promise.resolve({ id: "ws-1", cardId: "card-1" }),
    })
    expect(res.status).toBe(200)

    expect(mockGenerateAIResponse).toHaveBeenCalledTimes(1)
    const [callName, options] = mockGenerateAIResponse.mock.calls[0]
    expect(callName).toBe("generate-card")
    expect(options.apiKey).toBe("test-custom-gemini-key")
    expect(options.model).toBe("custom-gen-model")
  })

  it("cards/[cardId]/generate forwards client API key to shrink call when over budget", async () => {
    // First call returns over-budget bullets (charLimit is 50, content length > 70)
    mockGenerateAIResponse
      .mockResolvedValueOnce({
        title: "Very Long Card",
        bullets: [
          "This is an extremely long bullet point that exceeds the character limit of fifty characters.",
          "Another very long bullet point to force the shrink pass to execute.",
        ],
        assignedAssets: [],
      })
      .mockResolvedValueOnce({
        title: "Shrunk Card",
        bullets: ["Short bullet."],
        assignedAssets: [],
      })

    const req = new NextRequest("http://localhost/api/workspaces/ws-1/cards/card-1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": "test-custom-gemini-key",
      },
      body: JSON.stringify({
        topic: "Methodology",
        characterLimit: 50,
      }),
    })

    const res = await generatePOST(req, {
      params: Promise.resolve({ id: "ws-1", cardId: "card-1" }),
    })
    expect(res.status).toBe(200)

    expect(mockGenerateAIResponse).toHaveBeenCalledTimes(2)
    const [primaryCallName, primaryOptions] = mockGenerateAIResponse.mock.calls[0]
    expect(primaryCallName).toBe("generate-card")
    expect(primaryOptions.apiKey).toBe("test-custom-gemini-key")

    const [shrinkCallName, shrinkOptions] = mockGenerateAIResponse.mock.calls[1]
    expect(shrinkCallName).toBe("generate-card-shrink")
    expect(shrinkOptions.apiKey).toBe("test-custom-gemini-key")
  })
})
