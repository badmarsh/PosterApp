import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  apiError: (code: string, message: string, status: number) =>
    new Response(JSON.stringify({ error: { code, message } }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}))

vi.mock("@/lib/ai/endpoint-store", () => ({
  getUserAiEndpoints: vi.fn(),
  saveUserAiEndpoints: vi.fn(),
}))

vi.mock("@/lib/ai/endpoints", () => ({
  normalizeEndpointBaseUrl: (value: string) => value.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, ""),
  isValidEndpointBaseUrl: (value: string) => {
    try {
      const url = new URL(value)
      return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password
    } catch {
      return false
    }
  },
}))

import { auth } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { getUserAiEndpoints, saveUserAiEndpoints } from "@/lib/ai/endpoint-store"
import { GET, POST } from "@/app/api/ai/endpoints/route"

const endpoint = {
  id: "endpoint-1",
  name: "OpenAI compatible",
  baseUrl: "https://api.example.com/v1",
  apiKey: "secret-key",
  enabled: true,
  models: ["model-a"],
  status: "connected" as const,
}

function postRequest(body: unknown) {
  return new Request("https://app.example.com/api/ai/endpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("AI endpoint settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ userId: "user-1" } as any)
    vi.mocked(rateLimitAsync).mockResolvedValue({ allowed: true, retryAfterMs: 0 } as any)
  })

  it("requires authentication before exposing saved API keys", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as any)

    const response = await GET()

    expect(response.status).toBe(401)
    expect(getUserAiEndpoints).not.toHaveBeenCalled()
  })

  it("returns server persistence failures instead of an empty successful response", async () => {
    vi.mocked(getUserAiEndpoints).mockRejectedValueOnce(new Error("database unavailable"))

    const response = await GET()

    expect(response.status).toBe(500)
    expect(response.headers.get("Cache-Control")).toBeNull()
  })

  it("rejects malformed or non-HTTP endpoint payloads without changing persisted settings", async () => {
    const response = await POST(postRequest({
      endpoints: [{ ...endpoint, baseUrl: "javascript:alert(1)" }],
    }))

    expect(response.status).toBe(400)
    expect(saveUserAiEndpoints).not.toHaveBeenCalled()
  })

  it("saves normalized endpoint settings for authenticated users", async () => {
    const response = await POST(postRequest({
      endpoints: [{ ...endpoint, baseUrl: "https://api.example.com/v1/chat/completions/" }],
    }))

    expect(response.status).toBe(200)
    // Scoped to the signed-in user: the payload can never overwrite a shared row.
    expect(saveUserAiEndpoints).toHaveBeenCalledWith("user-1", [
      expect.objectContaining({ baseUrl: "https://api.example.com/v1", apiKey: "secret-key" }),
    ])
    expect(await response.json()).toMatchObject({ ok: true })
  })

  it("reads only the signed-in user's endpoints, never an instance-wide row", async () => {
    vi.mocked(getUserAiEndpoints).mockResolvedValueOnce([
      { id: "ep-own", name: "Own endpoint", baseUrl: "https://api.example.com/v1" },
    ])

    const response = await GET()
    const body = await response.json()

    expect(getUserAiEndpoints).toHaveBeenCalledWith("user-1")
    expect(body.endpoints).toEqual([expect.objectContaining({ id: "ep-own" })])
  })

  it("never exposes one user's saved credentials to another user", async () => {
    vi.mocked(getUserAiEndpoints).mockResolvedValueOnce([
      { id: "ep-a", name: "User A", baseUrl: "https://a.example.com/v1", apiKey: "sk-a" },
    ])
    const first = await GET()

    vi.mocked(getUserAiEndpoints).mockResolvedValueOnce([])
    vi.mocked(auth).mockResolvedValueOnce({ userId: "user-2" } as any)
    const second = await GET()

    expect((await second.json()).endpoints).toEqual([])
    // The second caller's read is scoped to their own id, not the first user's row.
    expect(getUserAiEndpoints).toHaveBeenLastCalledWith("user-2")
    expect(JSON.stringify(await first.json())).not.toContain("user-2")
  })

  it("rejects unexpected settings fields and honors rate limits", async () => {
    const invalidResponse = await POST(postRequest({ endpoints: [], reset: true }))
    expect(invalidResponse.status).toBe(400)

    vi.mocked(rateLimitAsync).mockResolvedValueOnce({ allowed: false, retryAfterMs: 60_000 } as any)
    const limitedResponse = await POST(postRequest({ endpoints: [] }))
    expect(limitedResponse.status).toBe(429)
  })
})
