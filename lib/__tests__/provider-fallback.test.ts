import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { generateAIResponse, generateAITextResponse, getLastServedProvider } from "@/lib/ai/client"

describe("Task 13: Provider-level fallback in AI client", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(Math, "random").mockReturnValue(0)
    vi.stubEnv("AI_API_URL", "https://primary.example/v1/chat/completions")
    vi.stubEnv("AI_API_KEY", "primary-key")
  })

  it("fails over to AI_API_URL_FALLBACK when primary provider fails with 503 and records fallback provider provenance", async () => {
    vi.stubEnv("AI_API_URL_FALLBACK", "https://fallback.example/v1/chat/completions")
    vi.stubEnv("AI_API_KEY_FALLBACK", "fallback-key")

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("primary.example")) {
        return Promise.resolve(new Response("Service Unavailable", { status: 503 }))
      }
      if (url.includes("fallback.example")) {
        return Promise.resolve(
          new Response(JSON.stringify({ choices: [{ message: { content: '{"status":"fallback_success"}' } }] }), {
            status: 200,
          })
        )
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`))
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await generateAIResponse("test-failover", {
      model: "test-model",
      userPrompt: "test",
      schema: z.object({ status: z.string() }),
    })

    expect(result).toEqual({ status: "fallback_success" })
    expect(getLastServedProvider()).toBe("fallback-provider")
    // Primary was called 3 times (due to retries), then fallback was called once
    expect(fetchMock).toHaveBeenCalledWith(
      "https://fallback.example/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fallback-key",
        }),
      })
    )
  })

  it("does NOT call fallback provider and records primary provenance when primary provider succeeds", async () => {
    vi.stubEnv("AI_API_URL_FALLBACK", "https://fallback.example/v1/chat/completions")
    vi.stubEnv("AI_API_KEY_FALLBACK", "fallback-key")

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"status":"primary_success"}' } }] }), {
        status: 200,
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await generateAIResponse("test-primary", {
      model: "test-model",
      userPrompt: "test",
      schema: z.object({ status: z.string() }),
    })

    expect(result).toEqual({ status: "primary_success" })
    expect(getLastServedProvider()).toBe("primary")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://primary.example/v1/chat/completions",
      expect.anything()
    )
  })

  it("does NOT attempt fallback for 4xx client errors (e.g. HTTP 400 Bad Request)", async () => {
    vi.stubEnv("AI_API_URL_FALLBACK", "https://fallback.example/v1/chat/completions")
    vi.stubEnv("AI_API_KEY_FALLBACK", "fallback-key")

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Bad Request: invalid parameters", { status: 400 })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      generateAIResponse("test-400", {
        model: "test-model",
        userPrompt: "test",
        schema: z.object({ status: z.string() }),
      })
    ).rejects.toThrow("AI API failed: HTTP 400")

    // Primary called once (no retries for 400), fallback never called
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://fallback.example/v1/chat/completions",
      expect.anything()
    )
  })

  it("does NOT attempt fallback for AIValidationError (schema mismatch)", async () => {
    vi.stubEnv("AI_API_URL_FALLBACK", "https://fallback.example/v1/chat/completions")
    vi.stubEnv("AI_API_KEY_FALLBACK", "fallback-key")

    // Fresh Response per call — a shared Response can only be read once.
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"status":"wrong-shape"}' } }] }), { status: 200 })
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      generateAIResponse("test-validation-no-fallback", {
        model: "test-model",
        userPrompt: "test",
        schema: z.object({ answer: z.string() }),
      })
    ).rejects.toThrow("does not match the expected schema")

    // Primary called twice (initial + one repair attempt), fallback never called
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://fallback.example/v1/chat/completions",
      expect.anything()
    )
  })

  it("throws primary error when fallback provider is not configured", async () => {
    vi.stubEnv("AI_API_URL_FALLBACK", "")

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      generateAIResponse("test-no-fallback", {
        model: "test-model",
        userPrompt: "test",
        schema: z.object({ status: z.string() }),
      })
    ).rejects.toThrow("AI API failed: HTTP 500")

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("supports fallback in generateAITextResponse", async () => {
    vi.stubEnv("AI_API_URL_FALLBACK", "https://fallback.example/v1/chat/completions")
    vi.stubEnv("AI_API_KEY_FALLBACK", "fallback-key")

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("primary.example")) {
        return Promise.resolve(new Response("Service Unavailable", { status: 503 }))
      }
      return Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: "Text from fallback" } }] }), {
          status: 200,
        })
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await generateAITextResponse("test-text-failover", {
      model: "test-model",
      userPrompt: "test",
    })

    expect(result).toBe("Text from fallback")
  })
})
