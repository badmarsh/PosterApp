import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { getStoredAiEndpoints, setStoredAiEndpoints, type AiEndpointConfig } from "@/lib/ai/endpoints"

export async function GET() {
  try {
    const endpoints = await getStoredAiEndpoints()
    return NextResponse.json({ endpoints })
  } catch (err) {
    console.error("[api/ai/endpoints] Failed to load endpoints:", err)
    return NextResponse.json({ error: "Failed to load endpoints" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth().catch(() => ({ userId: null }))
    const rateLimitKey = userId ? `ai-endpoints:${userId}` : "ai-endpoints:anonymous"
    const rl = await rateLimitAsync(rateLimitKey, 30, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const body = await req.json()
    if (!body || !Array.isArray(body.endpoints)) {
      return NextResponse.json({ error: "Invalid payload, 'endpoints' array required" }, { status: 400 })
    }

    const endpoints: AiEndpointConfig[] = body.endpoints.map((ep: any) => ({
      id: String(ep.id || Math.random().toString(36).substring(2, 9)),
      name: String(ep.name || "Endpoint"),
      baseUrl: String(ep.baseUrl || "").trim(),
      apiKey: typeof ep.apiKey === "string" ? ep.apiKey.trim() : undefined,
      enabled: ep.enabled !== false,
      models: Array.isArray(ep.models) ? ep.models : [],
      lastLoadedAt: typeof ep.lastLoadedAt === "string" ? ep.lastLoadedAt : undefined,
      status: ep.status === "connected" || ep.status === "error" ? ep.status : "untested",
      errorMessage: typeof ep.errorMessage === "string" ? ep.errorMessage : undefined,
    }))

    await setStoredAiEndpoints(endpoints)
    return NextResponse.json({ ok: true, endpoints })
  } catch (err) {
    console.error("[api/ai/endpoints] Failed to save endpoints:", err)
    return NextResponse.json({ error: "Failed to save endpoints" }, { status: 500 })
  }
}
