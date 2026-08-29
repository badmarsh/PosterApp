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

  it("should generate a caption successfully with JSON schema", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              name: "Radiation Benchmark Chart",
              originalCaption: "Figure 1: Benchmark results",
              description: "A bar chart comparing radiation tolerances.",
            }),
          },
        },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await generateCaption("mock-url", "A test figure")
    expect(result.caption).toBe("Figure 1: Benchmark results")
    expect(result.snippet).toBe("A bar chart comparing radiation tolerances.")
    expect(result.name).toBe("Radiation Benchmark Chart")
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("should fall back to descriptive name when originalCaption is 'Not provided'", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              name: "Radiation Criteria Comparison",
              originalCaption: "Not provided",
              description: "Comparison table of radiation criteria.",
            }),
          },
        },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await generateCaption("mock-url", "A test table")
    expect(result.caption).toBe("Radiation Criteria Comparison")
    expect(result.name).toBe("Radiation Criteria Comparison")
    expect(result.snippet).toBe("Comparison table of radiation criteria.")
  })

  it("should return a fallback on error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"))

    const result = await generateCaption("mock-url", "A test figure")
    expect(result.caption).toBe("")
    expect(result.snippet).toBe("")
    expect(result.name).toBe("")
  })
})
