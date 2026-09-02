import { describe, it, expect } from "vitest"
import { safeApiError } from "@/lib/security"

describe("safeApiError", () => {
  it("returns a Response with status 500 by default", () => {
    const res = safeApiError("Something went wrong")
    expect(res).toBeInstanceOf(Response)
    expect(res.status).toBe(500)
  })

  it("returns a Response with the specified status code", () => {
    const res = safeApiError("Bad request", 400)
    expect(res.status).toBe(400)
  })

  it("does NOT leak sensitive connection strings from handler errors", async () => {
    // Simulate a handler that accidentally includes secrets in the error message
    const sensitiveMessage = "DATABASE_URL=postgres://secret@host"

    const res = safeApiError(sensitiveMessage)
    const body = await res.text()

    expect(body).not.toContain("DATABASE_URL")
    expect(body).not.toContain("postgres://")
    expect(body).not.toContain("secret@host")
  })

  it("includes the provided error message in the response body", async () => {
    const res = safeApiError("Something went wrong")
    const json = await res.json()

    expect(json.error).toBe("Something went wrong")
    expect(json.code).toBe("INTERNAL_ERROR")
  })

  it("uses a custom error code when provided", async () => {
    const res = safeApiError("Not found", 404, "NOT_FOUND")
    const json = await res.json()

    expect(json.error).toBe("Not found")
    expect(json.code).toBe("NOT_FOUND")
    expect(res.status).toBe(404)
  })

  it("includes optional details when provided", async () => {
    const res = safeApiError("Validation failed", 400, "VALIDATION_ERROR", {
      field: "name",
    })
    const json = await res.json()

    expect(json.details).toEqual({ field: "name" })
  })

  it("sets Content-Type to application/json", () => {
    const res = safeApiError("test")
    expect(res.headers.get("Content-Type")).toBe("application/json")
  })
})
