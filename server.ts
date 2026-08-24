/**
 * Custom Next.js server — runs Next.js + Yjs WebSocket on the same port.
 *
 * Usage: `tsx server.ts` (replaces `next dev --port 3333`)
 *
 * WebSocket path: /api/yjs?workspaceId=<id>&token=<clerk_session_token>
 */

import { createServer } from "http"
import { parse } from "url"
import next from "next"
import { WebSocketServer } from "ws"
import { verifyToken } from "@clerk/backend"
// y-websocket server utilities (CJS module)
const { setupWSConnection } = require("y-websocket/bin/utils")

const dev = process.env.NODE_ENV !== "production"
const port = parseInt(process.env.PORT || "3333", 10)

const app = next({ dev, port })
const handle = app.getRequestHandler()

/** Verify a Clerk session token and return the userId, or null if invalid. */
async function verifyClerkToken(token: string): Promise<string | null> {
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })
    return payload.sub ?? null
  } catch (err) {
    console.warn("[Clerk Verify Error]", err)
    return null
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  // Yjs WebSocket server — shares the same HTTP server
  const wss = new WebSocketServer({ noServer: true })

  wss.on("connection", (ws, req) => {
    // setupWSConnection handles CRDT sync for this room
    const url = parse(req.url || "", true)
    const workspaceId = (url.query.workspaceId as string) || "default"
    setupWSConnection(ws, req, { docName: workspaceId, gc: true })
  })

  server.on("upgrade", async (req, socket, head) => {
    const parsedUrl = parse(req.url || "", true)

    // Only handle upgrades to /api/yjs
    if (!parsedUrl.pathname?.startsWith("/api/yjs")) {
      app.getUpgradeHandler()(req, socket, head)
      return
    }

    const token = parsedUrl.query.token as string | undefined

    if (!token) {
      console.warn("[Yjs WS] Rejected: no token")
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
      socket.destroy()
      return
    }

    const userId = await verifyClerkToken(token)
    if (!userId) {
      console.warn("[Yjs WS] Rejected: invalid token")
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
      socket.destroy()
      return
    }

    const workspaceId = parsedUrl.query.workspaceId as string
    if (!workspaceId || !/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n")
      socket.destroy()
      return
    }



    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req)
    })
  })

  const httpServer = server.listen(port, () => {
    console.log(`\n  ▲ Next.js (custom server) ready on http://localhost:${port}`)
    console.log(`  ⚡ Yjs WebSocket ready on ws://localhost:${port}/api/yjs\n`)
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n  [Next.js] Shutting down gracefully...")
    wss.clients.forEach((client) => client.close())
    wss.close(() => {
      httpServer.close(() => {
        console.log("  [Next.js] Closed out remaining connections.")
        process.exit(0)
      })
    })
    
    // Force close after 5s
    setTimeout(() => {
      console.error("  [Next.js] Forcing shutdown after timeout")
      process.exit(1)
    }, 5000)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
})
