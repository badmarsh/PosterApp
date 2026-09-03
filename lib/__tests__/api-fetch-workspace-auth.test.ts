import { describe, it, expect, vi, afterEach } from "vitest"
import { apiFetch } from "@/lib/api-fetch"

describe("apiFetch & Workspace Auth Resilience", () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("intercepts followed /sign-in redirects on /api routes and converts to 401 JSON", async () => {
    // Simulate browser fetch following a 307 redirect to /sign-in and receiving HTML
    const mockResponse = new Response("<!DOCTYPE html><html><body>Sign In Page</body></html>", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
    Object.defineProperty(mockResponse, "redirected", { value: true })
    Object.defineProperty(mockResponse, "url", { value: "http://localhost:3333/sign-in?redirect_url=http%3A%2F%2Flocalhost%3A3333%2Fapi%2Fworkspaces" })
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const res = await apiFetch("/api/workspaces")

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
    expect(res.headers.get("content-type")).toBe("application/json")

    // Crucial check: calling res.json() MUST NOT throw SyntaxError: Unexpected token '<'
    const data = await res.json()
    expect(data).toEqual({
      error: "Unauthorized",
      message: "Authentication required",
    })
  })

  it("intercepts 200 OK text/html responses on /api routes and converts to 401 JSON", async () => {
    // Simulate reverse proxy or middleware returning HTML on an API route
    const mockResponse = new Response("<!DOCTYPE html><html><body>Login Required</body></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    })
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const res = await apiFetch("/api/workspaces")

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
    expect(res.headers.get("content-type")).toBe("application/json")

    const data = await res.json()
    expect(data.error).toBe("Unauthorized")
  })

  it("preserves valid JSON responses on /api routes without interference", async () => {
    const mockWorkspaces = [
      { id: "ws_1", name: "Thesis Project", templateName: "atlas" },
    ]
    const mockResponse = new Response(JSON.stringify(mockWorkspaces), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const res = await apiFetch("/api/workspaces")

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.headers.get("content-type")).toBe("application/json")

    const data = await res.json()
    expect(data).toEqual(mockWorkspaces)
  })

  it("prevents WorkspaceSelector from throwing SyntaxError when receiving HTML response", async () => {
    // Simulate what happened in WorkspaceSelector before the fix
    const mockResponse = new Response("<!DOCTYPE html><html><body>Sign In</body></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    })
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const r = await apiFetch("/api/workspaces")
    const contentType = r.headers.get("content-type") || ""

    // Verify the response is intercepted as JSON
    expect(contentType).toContain("application/json")
    expect(r.ok).toBe(false)

    const errData = await r.json()
    expect(errData.error).toBe("Unauthorized")
  })
})
