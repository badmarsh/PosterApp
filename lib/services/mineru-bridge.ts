import net from "net"
import { spawn } from "child_process"
import os from "os"

let bridgeServer: net.Server | null = null

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
