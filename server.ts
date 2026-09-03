/**
 * Custom Next.js server — runs Next.js + Yjs WebSocket on the same port.
 *
 * Usage:
 *   dev : `tsx server.ts` (via scripts/dev.mjs)
 *   prod: `pnpm build && pnpm start` (runs `tsx server.ts` with NODE_ENV=production)
 *
 * NOTE: plain `next start` does NOT host the Yjs WebSocket — collaboration
 * silently degrades to reconnect loops. Always start via this file.
 *
 * Yjs documents are held in memory by y-websocket. Set YPERSISTENCE=<dir>
 * to enable y-leveldb persistence so unsaved CRDT state survives restarts.
 *
 * WebSocket path: /api/yjs?workspaceId=<id>; authentication is a short-lived
 * one-time ticket in Sec-WebSocket-Protocol, never a URL query parameter.
 */

import { createServer } from "http"
import { parse } from "url"
import next from "next"
import { WebSocketServer } from "ws"
import { consumeCollaborationTicket } from "./lib/collaboration-ticket"
import { prisma } from "./lib/prisma"
// y-websocket server utilities (CJS module)
const { setupWSConnection } = require("y-websocket/bin/utils")

const dev = process.env.NODE_ENV !== "production"
const port = parseInt(process.env.PORT || "3333", 10)

// Turbopack is a dev-only bundler flag; in production Next serves the
// prebuilt .next output and the option must be off.
const app = next({ dev, port, turbopack: dev })
const handle = app.getRequestHandler()

const WORKSPACE_ID = /^[A-Za-z0-9_-]{3,64}$/
const COLLAB_PROTOCOL = "posterapp-yjs-v1"

async function canAccessWorkspace(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { members: { where: { userId }, select: { role: true } } },
  })
  return Boolean(workspace && (workspace.userId === userId || workspace.members.some((member: { role: string }) => ["owner", "editor", "viewer"].includes(member.role))))
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    // Liveness probe for load balancers / container orchestrators. Kept out of
    // Next routing (and Clerk middleware) so it is cheap and unauthenticated.
    if (parsedUrl.pathname === "/healthz") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" })
      res.end(JSON.stringify({ ok: true, uptime: Math.round(process.uptime()) }))
      return
    }
    handle(req, res, parsedUrl)
  })

  // Yjs WebSocket server — shares the same HTTP server
  const wss = new WebSocketServer({ noServer: true, handleProtocols: (protocols) => protocols.has(COLLAB_PROTOCOL) ? COLLAB_PROTOCOL : false })

  wss.on("connection", (ws, req) => {
    // setupWSConnection handles CRDT sync for this room
    const workspaceId = (req as typeof req & { workspaceId: string }).workspaceId
    setupWSConnection(ws, req, { docName: workspaceId, gc: true })
  })

  server.on("upgrade", async (req, socket, head) => {
    const parsedUrl = parse(req.url || "", true)

    // Only handle upgrades to /api/yjs
    if (!parsedUrl.pathname?.startsWith("/api/yjs")) {
      app.getUpgradeHandler()(req, socket, head)
      return
    }

    const workspaceId = parsedUrl.query.workspaceId as string
    if (!workspaceId || !WORKSPACE_ID.test(workspaceId)) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n")
      socket.destroy()
      return
    }

    const requestedProtocols = (req.headers["sec-websocket-protocol"] || "").split(",").map((value) => value.trim())
    const ticket = requestedProtocols.find((value) => /^[A-Za-z0-9_-]{40,100}$/.test(value))
    if (!ticket || !requestedProtocols.includes(COLLAB_PROTOCOL)) {
      console.warn("[Yjs WS] Rejected authentication")
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
      socket.destroy()
      return
    }

    const authTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    const authCheck = (async () => {
      try {
        const userId = await consumeCollaborationTicket(ticket, workspaceId)
        if (!userId || !(await canAccessWorkspace(workspaceId, userId))) return null
        return userId
      } catch (err) {
        console.error("[Yjs WS] Error during auth check:", err)
        return null
      }
    })()

    const userId = await Promise.race([authCheck, authTimeout])
    if (!userId) {
      console.warn("[Yjs WS] Rejected authorization (or timed out)")
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
      socket.destroy()
      return
    }

    ;(req as typeof req & { workspaceId: string }).workspaceId = workspaceId


    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req)
    })
  })

  const host = process.env.HOST || "0.0.0.0"
  if (!dev && !process.env.YPERSISTENCE) {
    console.warn("  [Yjs] YPERSISTENCE is not set — collaborative documents are in-memory only and will be lost on restart.")
  }
  const httpServer = server.listen(port, host, () => {
    console.log(`\n  ▲ Next.js (custom server) ready on http://localhost:${port} and http://${host}:${port}`)
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
