import { NextResponse } from "next/server"
import { generateManifest } from "@/lib/agent-tools/registry"

export const dynamic = "force-dynamic"

export async function GET() {
  const tools = generateManifest()
  return NextResponse.json({
    name: "PosterApp Agent MCP & REST API",
    version: "1.0.0",
    description: "Derived documentation manifest from lib/agent-tools/registry.ts",
    toolsCount: tools.length,
    tools,
  })
}
