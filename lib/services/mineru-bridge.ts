import net from "net"
import { spawn } from "child_process"
import os from "os"

let cachedBaseUrl: string | null = null
let cacheExpiresAt = 0
const CACHE_TTL_MS = 60_000 // 1 minute cache

let bridgeServer: net.Server | null = null

/**
 * Returns candidate base URLs for MinerU service in priority order.
 */
export function getMinerUCandidateUrls(): string[] {
  const candidates: string[] = []
  const envUrl = process.env.MINERU_API_URL?.trim()

  // 1. Explicit env configuration if non-localhost
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    candidates.push(envUrl.replace(/\/+$/, ""))
  }

  // 2. Loopback endpoints (standard NAT mode or direct host)
  candidates.push("http://127.0.0.1:8001")
  candidates.push("http://localhost:8001")

  // 3. Host network interfaces (WSL2 mirrored networking mode)
  try {
    const ifaces = os.networkInterfaces()
    for (const name of Object.keys(ifaces)) {
      const list = ifaces[name]
      if (!list) continue
      for (const iface of list) {
        if (iface.family === "IPv4" && !iface.internal && iface.address) {
          candidates.push(`http://${iface.address}:8001`)
        }
      }
    }
  } catch {}

  // 4. If envUrl was localhost/127.0.0.1, ensure it is included
  if (envUrl && !candidates.includes(envUrl.replace(/\/+$/, ""))) {
    candidates.push(envUrl.replace(/\/+$/, ""))
  }

  // Deduplicate preserving order
  return Array.from(new Set(candidates))
}

/**
 * Resolves the active, reachable MinerU base URL by testing candidates.
 * Caches the working URL for subsequent requests.
 */
export async function resolveMinerUUrl(timeoutMs = 1500, forceRefresh = false): Promise<string> {
  const now = Date.now()
  if (!forceRefresh && cachedBaseUrl && now < cacheExpiresAt) {
    return cachedBaseUrl
  }

  const candidates = getMinerUCandidateUrls()

  for (const baseUrl of candidates) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      const res = await fetch(`${baseUrl}/docs`, {
        method: "GET",
        signal: ctrl.signal,
      })
      clearTimeout(timer)

      if (res.ok || res.status === 200 || res.status === 404 || res.status === 405) {
        cachedBaseUrl = baseUrl
        cacheExpiresAt = Date.now() + CACHE_TTL_MS
        return baseUrl
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Fallback to default if none responded
  const fallback = process.env.MINERU_API_URL || "http://127.0.0.1:8001"
  return fallback.replace(/\/+$/, "")
}

/**
 * Checks whether MinerU service is currently reachable.
 */
export async function isMinerUAvailable(timeoutMs = 1500): Promise<boolean> {
  try {
    const baseUrl = await resolveMinerUUrl(timeoutMs, false)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(`${baseUrl}/docs`, {
      method: "GET",
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    return res.ok || res.status === 200
  } catch {
    return false
  }
}

/**
 * Resilient fetch wrapper for MinerU API calls.
 * Automatically resolves endpoint and retries on discovery failure.
 */
export async function fetchMinerU(endpointPath: string, init?: RequestInit): Promise<Response> {
  const cleanPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`
  const baseUrl = await resolveMinerUUrl()

  try {
    const res = await fetch(`${baseUrl}${cleanPath}`, init)
    return res
  } catch (initialErr) {
    // If connection failed, invalidate cache and perform one retry with fresh discovery
    cachedBaseUrl = null
    const freshBaseUrl = await resolveMinerUUrl(2000, true)

    if (freshBaseUrl !== baseUrl) {
      return await fetch(`${freshBaseUrl}${cleanPath}`, init)
    }

    throw initialErr
  }
}

/**
 * Ensures a user-space TCP bridge is active on 127.0.0.1:8001 on Windows
 * forwarding requests to MinerU running inside WSL2.
 */
export function ensureMinerUBridge(): void {
  if (os.platform() !== "win32") return
  if (bridgeServer) return

  const server = net.createServer((clientSocket) => {
    const wslProcess = spawn("wsl", ["-d", "Ubuntu", "nc", "127.0.0.1", "8001"], {
      windowsHide: true,
    })

    clientSocket.pipe(wslProcess.stdin)
    wslProcess.stdout.pipe(clientSocket)

    clientSocket.on("error", () => {
      try { wslProcess.kill() } catch {}
    })
    wslProcess.on("error", () => {
      try { clientSocket.destroy() } catch {}
    })
    wslProcess.on("close", () => {
      try { clientSocket.end() } catch {}
    })
  })

  server.on("error", (err: NodeJS.ErrnoException) => {
    // If port 8001 is already bound, ignore the error
    if (err.code !== "EADDRINUSE") {
      console.warn("[MinerU Bridge] Warning:", err.message)
    }
  })

  try {
    server.listen(8001, "127.0.0.1", () => {
      console.log("[MinerU Bridge] Active on 127.0.0.1:8001 -> WSL2")
    })
    bridgeServer = server
  } catch {
    // Ignore if failed to bind
  }
}
