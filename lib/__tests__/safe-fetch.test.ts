import { describe, it, expect, vi, beforeEach } from "vitest"
import { isMetadataOrReservedHost, assertSafeExternalUrl } from "@/lib/security"
import { safeFetch } from "@/lib/safe-fetch"

const dnsLookup = vi.hoisted(() => vi.fn())
vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => dnsLookup(...args),
}))

describe("SSRF host policy", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    dnsLookup.mockReset()
    dnsLookup.mockImplementation(async (host: string) => {
      if (host === "localhost") return [{ address: "127.0.0.1", family: 4 }]
      if (host === "ollama.internal") return [{ address: "192.168.10.4", family: 4 }]
      if (host === "public.example.com" || host === "rebind.example.com") {
        return [{ address: "93.184.216.34", family: 4 }]
      }
      throw new Error(`getaddrinfo ENOTFOUND ${host}`)
    })
  })

  describe("isMetadataOrReservedHost", () => {
    it("flags metadata, link-local, unspecified and multicast addresses", () => {
      for (const host of [
        "169.254.169.254",
        "169.254.1.1",
        "metadata.google.internal",
        "instance-data",
        "0.0.0.0",
        "224.0.0.1",
        "255.255.255.255",
        "::",
        "fe80::1",
        "[fe80::1]",
        "ff02::1",
        "::ffff:169.254.169.254",
      ]) {
        expect(isMetadataOrReservedHost(host), host).toBe(true)
      }
    })

    it("does not flag loopback or private addresses that the opt-in permits", () => {
      for (const host of ["127.0.0.1", "localhost", "10.1.2.3", "192.168.0.5", "::1", "public.example.com"]) {
        expect(isMetadataOrReservedHost(host), host).toBe(false)
      }
    })
  })

  describe("assertSafeExternalUrl", () => {
    it("rejects private hosts unless explicitly allowed", () => {
      expect(() => assertSafeExternalUrl("http://localhost:11434/v1")).toThrow("SSRF protection")
      expect(assertSafeExternalUrl("http://localhost:11434/v1", { allowPrivateHosts: true }).hostname).toBe("localhost")
    })

    it("rejects metadata hosts even when private hosts are allowed", () => {
      expect(() => assertSafeExternalUrl("http://169.254.169.254/v1", { allowPrivateHosts: true })).toThrow(
        "SSRF protection"
      )
      expect(() => assertSafeExternalUrl("http://metadata.google.internal/v1", { allowPrivateHosts: true })).toThrow(
        "SSRF protection"
      )
    })
  })

  describe("safeFetch", () => {
    it("refuses a loopback target by default without performing any request", async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)

      await expect(safeFetch("http://localhost:11434/v1/models")).rejects.toThrow("SSRF protection")
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("fetches a loopback target when the operator opts in", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 200 }))
      vi.stubGlobal("fetch", fetchMock)

      const res = await safeFetch("http://localhost:11434/v1/models", { allowPrivateHosts: true })

      expect(res.status).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("still refuses link-local and metadata targets when the operator opts in", async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)

      await expect(safeFetch("http://169.254.169.254/latest/meta-data/", { allowPrivateHosts: true })).rejects.toThrow(
        "SSRF protection"
      )
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("blocks a public hostname whose DNS answer is internal", async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      dnsLookup.mockResolvedValueOnce([{ address: "10.0.0.9", family: 4 }])

      await expect(safeFetch("https://rebind.example.com/v1")).rejects.toThrow("resolves to a reserved")
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("does not follow a redirect into a blocked address", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }))
      vi.stubGlobal("fetch", fetchMock)

      await expect(safeFetch("https://public.example.com/v1")).rejects.toThrow("SSRF protection")
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("follows a redirect between public hosts", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: "/v1/models" } }))
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      vi.stubGlobal("fetch", fetchMock)

      const res = await safeFetch("https://public.example.com/models")

      expect(res.status).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(String(fetchMock.mock.calls[1][0])).toBe("https://public.example.com/v1/models")
    })
  })
})
