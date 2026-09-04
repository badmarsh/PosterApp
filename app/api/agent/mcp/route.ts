import { NextRequest, NextResponse } from "next/server"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  PingRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { zodToJsonSchema } from "zod-to-json-schema"
import { verifyAgentKey, AgentAuthError } from "@/lib/agent-auth"
import { AGENT_TOOLS } from "@/lib/agent-tools/registry"
import { executeAgentTool } from "@/lib/agent-tools/executor"
import { rateLimitAsync } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      Allow: "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, X-API-Key, Content-Type, Accept, mcp-session-id",
    },
  })
}

export async function POST(req: NextRequest) {
  // 1. Verify agent authentication before transport handles body (§7)
  let ctx
  try {
    ctx = await verifyAgentKey(req)
  } catch (err) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: err.message,
          },
          id: null,
        },
        { status: err.status }
      )
    }
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Unauthorized",
        },
        id: null,
      },
      { status: 401 }
    )
  }

  // Rate limit: 200 requests per minute per key
  const rl = await rateLimitAsync(`agent-mcp:${ctx.apiKeyId}`, 200, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Rate limit exceeded. Too many requests.",
        },
        id: null,
      },
      {
        status: 429,
        headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() },
      }
    )
  }

  // 2. Normalize Accept header to ensure both application/json and text/event-stream are accepted
  const headers = new Headers(req.headers)
  let accept = headers.get("accept") || ""
  if (!accept.includes("application/json")) {
    accept = accept ? `${accept}, application/json` : "application/json"
  }
  if (!accept.includes("text/event-stream")) {
    accept = `${accept}, text/event-stream`
  }
  headers.set("accept", accept)
  const proxiedReq = new Request(req.url, {
    method: "POST",
    headers,
    body: req.body,
    // @ts-expect-error duplex required for streaming in Node fetch
    duplex: "half",
  })

  // 3. Create stateless MCP server for this request (§7)
  const server = new Server(
    {
      name: "posterapp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // 4. Implement ping handler
  server.setRequestHandler(PingRequestSchema, async () => {
    return {}
  })

  // 5. Implement tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: AGENT_TOOLS.map((tool) => ({
        name: tool.wireName,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.input as any) as any,
      })),
    }
  })

  // 6. Implement tools/call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const envelope = await executeAgentTool(
      ctx,
      request.params.name,
      request.params.arguments ?? {}
    )

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(envelope),
        },
      ],
      isError: !envelope.ok,
    }
  })

  // 7. Connect stateless WebStandard transport (sessionIdGenerator: undefined)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  await server.connect(transport)

  // 8. Delegate request handling to transport
  return transport.handleRequest(proxiedReq)
}
