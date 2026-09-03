import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { DEFAULT_AI_MAX_TOKENS, generateAIResponse } from "@/lib/ai/client"

describe("AI client resilience", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubEnv("AI_API_URL", "https://primary.example/v1/chat/completions")
    vi.stubEnv("AI_API_KEY", "test-key")
  })

  it("retries retryable provider failures and pins the default output ceiling", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"answer":"ok"}' } }] }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(generateAIResponse("retry-test", {
      model: "test-model",
      userPrompt: "Return JSON",
      schema: z.object({ answer: z.string() }),
    })).resolves.toEqual({ answer: "ok" })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).max_tokens).toBe(DEFAULT_AI_MAX_TOKENS)
  })

  it("repairs one malformed structured response before failing", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"answer":42}' } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"answer":"repaired"}' } }] }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(generateAIResponse("repair-test", {
      model: "test-model",
      userPrompt: "Return JSON",
      schema: z.object({ answer: z.string() }),
    })).resolves.toEqual({ answer: "repaired" })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const repairPayload = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(repairPayload.messages.at(-1).content).toContain("Validation error")
  })

  it("repairs truncated responses (finish_reason=length) with a 1.5x token budget", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"answer":"trunc' }, finish_reason: "length" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"answer":"complete"}' } }],
      }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(generateAIResponse("trunc-test", {
      model: "test-model",
      userPrompt: "Return JSON",
      schema: z.object({ answer: z.string() }),
    })).resolves.toEqual({ answer: "complete" })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const repairPayload = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(repairPayload.max_tokens).toBe(Math.ceil(DEFAULT_AI_MAX_TOKENS * 1.5))
    expect(repairPayload.messages.at(-1).content).toContain("truncated")
  })
})
