/**
 * Core application security, sanitization, and SSRF-prevention utilities.
 */

import { NextResponse } from "next/server"

/**
 * Strips invalid XML 1.0 control characters (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F)
 * to prevent malformed or corrupted OpenXML / DOCX files.
 */
export function sanitizeXmlString(input: string | null | undefined): string {
  if (!input) return ""
  // Allowed in XML 1.0: \x09 (tab), \x0A (line feed), \x0D (carriage return), \x20-\xD7FF, \xE000-\xFFFD
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
}

/**
 * Sanitizes a filename to prevent path traversal, control-character injection,
 * and dangerous storage paths.
 */
export function sanitizeFilename(name: string, fallback = "file"): string {
  if (!name || typeof name !== "string") return fallback

  // Remove control characters, null bytes, and newlines
  let clean = name.replace(/[\x00-\x1F\x7F]/g, "").trim()

  // Strip directory path sequences (e.g. ../ or ..\ or folder/file)
  const parts = clean.split(/[\/\\]+/).filter(Boolean)
  clean = parts.pop() || ""

  // Remove leading/trailing dots and spaces
  clean = clean.replace(/^[.\s]+|[.\s]+$/g, "")

  // Remove unsafe filesystem / header characters: < > : " | ? *
  clean = clean.replace(/[<>:"|?*]/g, "_")
  // Collapse multiple consecutive underscores
  clean = clean.replace(/_+/g, "_")

  if (!clean) return fallback

  // Check for reserved Windows filenames (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i
  if (reserved.test(clean)) {
    clean = `_${clean}`
  }

  // Truncate excessively long filenames while preserving extension
  if (clean.length > 128) {
    const extIdx = clean.lastIndexOf(".")
    if (extIdx > 0 && clean.length - extIdx <= 16) {
      const ext = clean.slice(extIdx)
      const stem = clean.slice(0, 128 - ext.length)
      clean = `${stem}${ext}`
    } else {
      clean = clean.slice(0, 128)
    }
  }

  return clean || fallback
}

/**
 * Generates an injection-safe Content-Disposition header with RFC 5987 filename* encoding.
 */
export function safeContentDisposition(
  filename: string,
  type: "attachment" | "inline" = "attachment"
): string {
  const sanitized = sanitizeFilename(filename, "document")
  // Transliterate accented letters to plain ASCII for fallback (e.g. á -> a)
  const asciiFallback = sanitized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "")
  const encodedName = encodeURIComponent(sanitized).replace(/['()]/g, escape).replace(/\*/g, "%2A")

  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`
}

/**
 * Checks whether an IP or hostname belongs to private, loopback, link-local,
 * or cloud-metadata address ranges to protect against SSRF.
 */
export function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim()

  // Common loopback / local aliases & local/internal top-level domains
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]" ||
    host === "local" ||
    host === "instance-data" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".arpa") ||
    host.endsWith(".lan") ||
    host.endsWith(".home") ||
    host.endsWith(".corp")
  ) {
    return true
  }

  // Cloud metadata endpoint (AWS, GCP, Azure, OpenStack, DigitalOcean)
  if (host === "169.254.169.254" || host === "metadata.google.internal") {
    return true
  }

  // IPv4 pattern matching
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) {
    const [, a, b, c] = ipv4Match.map(Number)
    if (a === 0) return true // 0.0.0.0/8
    if (a === 10) return true // 10.0.0.0/8 Private
    if (a === 127) return true // 127.0.0.0/8 Loopback
    if (a === 169 && b === 254) return true // 169.254.0.0/16 Link-local / Metadata
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12 Private
    if (a === 192 && b === 168) return true // 192.168.0.0/16 Private
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 Carrier-grade NAT
    if (a >= 224) return true // Multicast & Reserved
  }

  // IPv6 check
  if (host.startsWith("[") && host.endsWith("]")) {
    const unbracketed = host.slice(1, -1)
    if (
      unbracketed === "::1" ||
      unbracketed.startsWith("fe80:") ||
      unbracketed.startsWith("fc00:") ||
      unbracketed.startsWith("fd00:")
    ) {
      return true
    }
  }

  return false
}

/**
 * Validates that an external URL is safe to fetch (HTTP/HTTPS, non-SSRF).
 * Throws an error if the URL is invalid or targets a reserved/internal address.
 */
export function assertSafeExternalUrl(urlStr: string): URL {
  if (!urlStr || typeof urlStr !== "string") {
    throw new Error("URL must be a non-empty string")
  }

  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    throw new Error("Invalid URL format")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`)
  }

  if (isPrivateOrReservedHost(parsed.hostname)) {
    throw new Error("Target address is reserved or internal (SSRF protection)")
  }

  return parsed
}

/**
 * Strips sensitive environment variable values and connection strings from
 * error messages that could leak into API responses.
 */
export function redactSensitiveData(message: string): string {
  return message
    // Connection strings (postgres://, mysql://, mongodb://, redis://, etc.)
    .replace(/(?:postgres|mysql|mongodb|redis|sqlite|jdbc|mssql):\/\/[^\s"'`<>]*/gi, "[redacted]")
    // KEY=VALUE patterns for known sensitive env vars — replace entire match
    .replace(/(?:DATABASE_URL|SECRET|API_KEY|TOKEN|PASSWORD|AUTH)=[^\s"'`<>]*/gi, "[redacted]")
    // Bearer / API key tokens
    .replace(/(?:Bearer|sk-|pk-|key-)[^\s"'`<>]*/gi, "[redacted]")
}

/**
 * Returns a standardized, structured JSON error response that never leaks
 * database internals, stack traces, or internal server paths.
 */
export function safeApiError(
  message: string,
  status = 500,
  code = "INTERNAL_ERROR",
  details?: unknown
): Response {
  return new Response(
    JSON.stringify({
      error: redactSensitiveData(message),
      code,
      ...(details ? { details } : {}),
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }
  )
}


/** Thrown by readJsonBodyCapped when the body exceeds the limit. */
export class PayloadTooLargeError extends Error {
  constructor(public readonly limit: number) {
    super(`Payload exceeds ${limit} bytes`)
    this.name = "PayloadTooLargeError"
  }
}

/**
 * Reads and JSON-parses a request body while enforcing a hard byte cap on the
 * actual stream (not just the Content-Length header, which chunked or
 * malicious clients can omit or lie about).
 */
export async function readJsonBodyCapped<T = unknown>(req: Request, maxBytes: number): Promise<T> {
  const declared = Number(req.headers.get("content-length") ?? 0)
  if (Number.isFinite(declared) && declared > maxBytes) throw new PayloadTooLargeError(maxBytes)
  if (!req.body) throw new SyntaxError("Empty body")

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new PayloadTooLargeError(maxBytes)
    }
    chunks.push(value)
  }
  const text = Buffer.concat(chunks).toString("utf8")
  return JSON.parse(text) as T
}
