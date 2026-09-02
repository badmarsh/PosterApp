import { describe, it, expect } from "vitest"
import {
  sanitizeXmlString,
  sanitizeFilename,
  safeContentDisposition,
  isPrivateOrReservedHost,
  assertSafeExternalUrl,
  safeApiError,
  redactSensitiveData,
} from "@/lib/security"

describe("lib/security", () => {
  describe("sanitizeXmlString", () => {
    it("handles null, undefined, and empty string safely", () => {
      expect(sanitizeXmlString("")).toBe("")
      expect(sanitizeXmlString(null as any)).toBe("")
      expect(sanitizeXmlString(undefined as any)).toBe("")
    })

    it("strips XML 1.0 illegal control characters while preserving valid characters", () => {
      const input = "Hello\x00World\x08!\x0BHow\x0Care\x1Fyou?\nLine 2\tTabbed\r\nLine 3"
      const cleaned = sanitizeXmlString(input)

      expect(cleaned).toBe("HelloWorld!Howareyou?\nLine 2\tTabbed\r\nLine 3")
      expect(cleaned).not.toContain("\x00")
      expect(cleaned).not.toContain("\x08")
      expect(cleaned).not.toContain("\x0B")
      expect(cleaned).not.toContain("\x0C")
      expect(cleaned).not.toContain("\x1F")
    })

    it("preserves unicode Slovak/Czech characters and accents", () => {
      const input = "Prírodovedecká fakulta · Katedra Fyziky (Úspešné hodnotenie: A)"
      expect(sanitizeXmlString(input)).toBe(input)
    })
  })

  describe("sanitizeFilename", () => {
    it("returns default fallback for empty or whitespace-only input", () => {
      expect(sanitizeFilename("")).toBe("file")
      expect(sanitizeFilename("   ")).toBe("file")
      expect(sanitizeFilename("", "custom_default.pdf")).toBe("custom_default.pdf")
    })

    it("removes directory traversal path sequences", () => {
      expect(sanitizeFilename("../../../etc/passwd")).toBe("passwd")
      expect(sanitizeFilename("..\\..\\Windows\\System32\\cmd.exe")).toBe("cmd.exe")
      expect(sanitizeFilename("folder/nested/name.png")).toBe("name.png")
    })

    it("strips illegal characters and control characters", () => {
      expect(sanitizeFilename("my:file<name>*?.pdf")).toBe("my_file_name_.pdf")
      expect(sanitizeFilename("paper\x00title.pdf")).toBe("papertitle.pdf")
    })

    it("safely prefixes reserved Windows filenames", () => {
      expect(sanitizeFilename("CON.txt")).toBe("_CON.txt")
      expect(sanitizeFilename("aux.pdf")).toBe("_aux.pdf")
      expect(sanitizeFilename("NUL")).toBe("_NUL")
      expect(sanitizeFilename("COM1.png")).toBe("_COM1.png")
      expect(sanitizeFilename("LPT2.tex")).toBe("_LPT2.tex")
    })

    it("truncates excessively long filenames while preserving extension", () => {
      const veryLong = "a".repeat(300) + ".pdf"
      const result = sanitizeFilename(veryLong)
      expect(result.length).toBeLessThanOrEqual(128)
      expect(result.endsWith(".pdf")).toBe(true)
    })
  })

  describe("safeContentDisposition", () => {
    it("generates valid standard ASCII and UTF-8 encoded Content-Disposition header", () => {
      const header = safeContentDisposition("posudok-Ján_Novák.pdf", "attachment")
      expect(header).toContain('attachment; filename="posudok-Jan_Novak.pdf"')
      expect(header).toContain("filename*=UTF-8''posudok-J%C3%A1n_Nov%C3%A1k.pdf")
    })

    it("strips CR/LF characters to prevent HTTP response header injection", () => {
      const header = safeContentDisposition("evil\r\nSet-Cookie: sessionId=123\r\n.pdf", "attachment")
      expect(header).not.toContain("\r")
      expect(header).not.toContain("\n")
    })
  })

  describe("isPrivateOrReservedHost", () => {
    it("flags localhost and local loopback as private", () => {
      expect(isPrivateOrReservedHost("localhost")).toBe(true)
      expect(isPrivateOrReservedHost("127.0.0.1")).toBe(true)
      expect(isPrivateOrReservedHost("127.1.2.3")).toBe(true)
      expect(isPrivateOrReservedHost("::1")).toBe(true)
      expect(isPrivateOrReservedHost("0.0.0.0")).toBe(true)
    })

    it("flags private RFC 1918 subnets as private", () => {
      expect(isPrivateOrReservedHost("10.0.0.1")).toBe(true)
      expect(isPrivateOrReservedHost("10.255.255.254")).toBe(true)
      expect(isPrivateOrReservedHost("172.16.0.1")).toBe(true)
      expect(isPrivateOrReservedHost("172.31.255.254")).toBe(true)
      expect(isPrivateOrReservedHost("192.168.1.1")).toBe(true)
      expect(isPrivateOrReservedHost("192.168.0.254")).toBe(true)
    })

    it("flags cloud metadata (169.254.169.254) as private (SSRF protection)", () => {
      expect(isPrivateOrReservedHost("169.254.169.254")).toBe(true)
      expect(isPrivateOrReservedHost("instance-data")).toBe(true)
      expect(isPrivateOrReservedHost("metadata.google.internal")).toBe(true)
    })

    it("flags local / internal domain names as private", () => {
      expect(isPrivateOrReservedHost("my-server.local")).toBe(true)
      expect(isPrivateOrReservedHost("internal.corp.internal")).toBe(true)
      expect(isPrivateOrReservedHost("router.home.arpa")).toBe(true)
    })

    it("allows public internet hostnames and public IPs", () => {
      expect(isPrivateOrReservedHost("arxiv.org")).toBe(false)
      expect(isPrivateOrReservedHost("api.crossref.org")).toBe(false)
      expect(isPrivateOrReservedHost("8.8.8.8")).toBe(false)
      expect(isPrivateOrReservedHost("1.1.1.1")).toBe(false)
    })
  })

  describe("assertSafeExternalUrl", () => {
    it("allows valid public HTTPS and HTTP URLs", () => {
      const url1 = assertSafeExternalUrl("https://arxiv.org/pdf/2301.12345.pdf")
      expect(url1.hostname).toBe("arxiv.org")

      const url2 = assertSafeExternalUrl("http://example.com/paper.pdf")
      expect(url2.hostname).toBe("example.com")
    })

    it("rejects non-HTTP protocols", () => {
      expect(() => assertSafeExternalUrl("ftp://example.com/file.pdf")).toThrow("Unsupported protocol")
      expect(() => assertSafeExternalUrl("file:///etc/passwd")).toThrow("Unsupported protocol")
      expect(() => assertSafeExternalUrl("javascript:alert(1)")).toThrow("Unsupported protocol")
    })

    it("rejects SSRF attempts targeting private or reserved hosts", () => {
      expect(() => assertSafeExternalUrl("http://localhost:3000/api")).toThrow("SSRF protection")
      expect(() => assertSafeExternalUrl("http://127.0.0.1:8080/admin")).toThrow("SSRF protection")
      expect(() => assertSafeExternalUrl("http://169.254.169.254/latest/meta-data/")).toThrow("SSRF protection")
      expect(() => assertSafeExternalUrl("http://192.168.1.1/setup")).toThrow("SSRF protection")
      expect(() => assertSafeExternalUrl("http://10.0.0.5/secrets")).toThrow("SSRF protection")
    })
  })

  describe("safeApiError", () => {
    it("produces standardized JSON error responses with default status 500", async () => {
      const res = safeApiError("Something went wrong", 500, "INTERNAL_ERROR")
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json).toEqual({
        error: "Something went wrong",
        code: "INTERNAL_ERROR",
      })
    })

    it("reflects custom status code and error code", async () => {
      const res = safeApiError("Not found", 404, "NOT_FOUND")
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.error).toBe("Not found")
      expect(json.code).toBe("NOT_FOUND")
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

    it("redacts database connection strings from error messages", async () => {
      const res = safeApiError("DATABASE_URL=postgres://secret@host")
      const json = await res.json()
      expect(json.error).not.toContain("postgres://")
      expect(json.error).not.toContain("secret@host")
    })

    it("redacts API keys from error messages", async () => {
      const res = safeApiError("API_KEY=sk-1234567890abcdef")
      const json = await res.json()
      expect(json.error).not.toContain("sk-1234567890abcdef")
    })
  })

  describe("redactSensitiveData", () => {
    it("redacts postgres connection strings", () => {
      const result = redactSensitiveData("postgres://user:pass@host:5432/db")
      expect(result).toBe("[redacted]")
    })

    it("redacts mysql connection strings", () => {
      const result = redactSensitiveData("mysql://user:pass@host:3306/db")
      expect(result).toBe("[redacted]")
    })

    it("redacts DATABASE_URL key=value patterns", () => {
      const result = redactSensitiveData("DATABASE_URL=postgres://secret@host")
      expect(result).toBe("[redacted]")
    })

    it("redacts API_KEY key=value patterns", () => {
      const result = redactSensitiveData("API_KEY=sk-1234567890abcdef")
      expect(result).toBe("[redacted]")
    })

    it("redacts TOKEN key=value patterns", () => {
      const result = redactSensitiveData("TOKEN=ghp_1234567890abcdef")
      expect(result).toBe("[redacted]")
    })

    it("redacts SECRET key=value patterns", () => {
      const result = redactSensitiveData("SECRET=super-secret-value")
      expect(result).toBe("[redacted]")
    })

    it("redacts PASSWORD key=value patterns", () => {
      const result = redactSensitiveData("PASSWORD=hunter2")
      expect(result).toBe("[redacted]")
    })

    it("redacts AUTH key=value patterns", () => {
      const result = redactSensitiveData("AUTH=basic:YWRtaW46cGFzcw==")
      expect(result).toBe("[redacted]")
    })

    it("preserves safe messages without sensitive data", () => {
      const result = redactSensitiveData("Card generation failed: timeout")
      expect(result).toBe("Card generation failed: timeout")
    })

    it("preserves normal text with URLs", () => {
      const result = redactSensitiveData("Failed to fetch https://arxiv.org/abs/2301.12345")
      expect(result).toBe("Failed to fetch https://arxiv.org/abs/2301.12345")
    })

    it("preserves empty string", () => {
      expect(redactSensitiveData("")).toBe("")
    })

    it("handles mixed content with sensitive and safe parts", () => {
      const msg = "Error: Failed to connect. DATABASE_URL=postgres://user:pass@localhost:5432/prod. Request ID: abc-123"
      const result = redactSensitiveData(msg)
      expect(result).toContain("Error: Failed to connect.")
      expect(result).toContain("Request ID: abc-123")
      expect(result).not.toContain("postgres://user:pass@localhost:5432/prod")
    })
  })
})
