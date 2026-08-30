import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  normalizeScholarQuery,
  verifyCitation,
  searchPaperByTitle,
  fetchPaperDetails,
  ssFetch,
} from "@/lib/services/semantic-scholar-service"

describe("Semantic Scholar Service & Retry Logic", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("normalizes Slovak and Czech queries with diacritics", () => {
    expect(normalizeScholarQuery("Hraško: Detekcia anomálií")).toBe("hrasko detekcia anomalii")
    expect(normalizeScholarQuery("Čaplovičová, M. (2022)")).toBe("caplovicova m 2022")
    expect(normalizeScholarQuery("   Transformers & Neural-Nets!   ")).toBe("transformers neural nets")
  })

  it("retries on 429 rate limit and honors Retry-After header", async () => {
    let callCount = 0
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve(
          new Response("Too Many Requests", {
            status: 429,
            headers: { "retry-after": "0.01" },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ paperId: "p1", title: "Success Paper" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    })

    vi.stubGlobal("fetch", mockFetch)

    const res = await ssFetch<{ paperId: string; title: string }>("/paper/p1")
    expect(callCount).toBe(2)
    expect(res.status).toBe("verified")
    expect(res.data?.title).toBe("Success Paper")
  })

  it("does not retry on 400 Bad Request or invalid input", async () => {
    let callCount = 0
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve(
        new Response("Bad Request", {
          status: 400,
        })
      )
    })

    vi.stubGlobal("fetch", mockFetch)

    const res = await ssFetch("/paper/invalid")
    expect(callCount).toBe(1)
    expect(res.status).toBe("invalid_input")
  })

  it("reports service_error when all retry attempts fail on 503", async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve(
        new Response("Service Unavailable", {
          status: 503,
          headers: { "retry-after": "0.01" },
        })
      )
    })

    vi.stubGlobal("fetch", mockFetch)

    const res = await ssFetch("/paper/p503")
    expect(res.status).toBe("service_error")
    expect(res.data).toBeNull()
  })

  it("verifies citation with high confidence on normalized match", async () => {
    const mockPaper = {
      paperId: "p-attn",
      title: "Attention Is All You Need",
      year: 2017,
      authors: [{ authorId: "a1", name: "Ashish Vaswani" }],
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [mockPaper] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", mockFetch)

    const result = await verifyCitation("Attention is all you need")
    expect(result.found).toBe(true)
    expect(result.status).toBe("verified")
    expect(result.confidence).toBe("high")
    expect(result.paper?.paperId).toBe("p-attn")
  })
})
