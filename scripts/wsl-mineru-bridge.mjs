import net from "net"
import { spawn } from "child_process"

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

server.listen(8001, "127.0.0.1", () => {
  console.log("[mineru-bridge] Listening on 127.0.0.1:8001 -> WSL2 MinerU")
})
