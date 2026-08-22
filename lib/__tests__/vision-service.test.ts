import { describe, it, expect, vi, beforeEach } from "vitest"
import { generateCaption } from "../services/vision-service"

// Mock fetch
global.fetch = vi.fn()

describe("vision-service", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.AI_API_URL = "http://mock-api.com"
    process.env.AI_API_KEY = "mock-key"
  })

  it("should generate a caption successfully", async () => {
    const mockResponse = {
      choices: [{ message: { content: "<original_caption>Orig</original_caption><description>A bar chart</description>" } }]
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await generateCaption("mock-url", "A test figure")
    expect(result.caption).toBe("Orig")
    expect(result.snippet).toBe("A bar chart")
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("should return a fallback on error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"))

    const result = await generateCaption("mock-url", "A test figure")
    expect(result.caption).toBe("")
    expect(result.snippet).toBe("")
  })
})
