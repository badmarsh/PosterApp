/**
 * Server-only SSRF-safe outbound fetch. Kept separate from lib/security.ts
 * (which is imported by client components) because it uses node:dns.
 */
import "server-only"
import { lookup } from "node:dns/promises"
import { isPrivateOrReservedHost, assertSafeExternalUrl } from "@/lib/security"

/**
 * Resolves the hostname via DNS and rejects if ANY resolved address is in a
 * private/reserved range. Defends against DNS-based SSRF (public hostnames
 * that resolve to internal IPs, DNS rebinding of the first hop, etc.).
 * Literal IPs are validated directly by `isPrivateOrReservedHost`.
 */
export async function assertSafeResolvedHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "")
  if (isPrivateOrReservedHost(host)) {
    throw new Error("Target address is reserved or internal (SSRF protection)")
  }
  // Skip DNS for IP literals — already checked above.
  if (/^[\d.]+$/.test(host) || host.includes(":")) return

  let addresses: { address: string; family: number }[]
  try {
    addresses = await lookup(host, { all: true, verbatim: true })
  } catch {
    throw new Error("Target hostname could not be resolved")
  }
  if (addresses.length === 0) {
    throw new Error("Target hostname could not be resolved")
  }
  for (const { address, family } of addresses) {
    const candidate = family === 6 ? `[${address}]` : address
    if (isPrivateOrReservedHost(candidate) || isPrivateOrReservedHost(address)) {
      throw new Error("Target address resolves to a reserved or internal network (SSRF protection)")
    }
    // IPv4-mapped IPv6 (::ffff:10.0.0.1)
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
    if (mapped && isPrivateOrReservedHost(mapped[1])) {
      throw new Error("Target address resolves to a reserved or internal network (SSRF protection)")
    }
  }
}

export interface SafeFetchOptions {
  timeoutMs?: number
  maxRedirects?: number
  headers?: Record<string, string>
}

/**
 * SSRF-safe fetch: validates the initial URL and every redirect hop against
 * the reserved-host list AND the DNS-resolved addresses. Redirects are
 * followed manually so a public URL cannot bounce the server into an
 * internal network. Throws on violation; returns the final Response.
 */
export async function safeFetch(urlStr: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 15_000, maxRedirects = 5, headers = {} } = options
  let currentUrl = assertSafeExternalUrl(urlStr).toString()

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const parsed = assertSafeExternalUrl(currentUrl)
    await assertSafeResolvedHost(parsed.hostname)

    const res = await fetch(currentUrl, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    })

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location")
      // Drain the body so the connection can be reused/closed.
      res.body?.cancel().catch(() => {})
      if (!location) throw new Error("Redirect without Location header")
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }
    return res
  }
  throw new Error("Too many redirects")
}
