import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { fetchModelsFromEndpoint } from "@/lib/ai/endpoints"

export async function POST(req: Request) {
  try {
    const { userId } = await auth().catch(() => ({ userId: null }))
    const rateLimitKey = userId ? `ai-models-fetch:${userId}` : "ai-models-fetch:anonymous"
    const rl = await rateLimitAsync(rateLimitKey, 30, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: "Rate limit exceeded", models: [] }, { status: 429 })
    }

    const body = await req.json()
    const { baseUrl, apiKey } = body || {}

    if (!baseUrl || typeof baseUrl !== "string" || !baseUrl.trim()) {
      return NextResponse.json(
        { ok: false, error: "Missing required 'baseUrl' field", models: [] },
        { status: 400 }
      )
    }

    const result = await fetchModelsFromEndpoint(baseUrl, typeof apiKey === "string" ? apiKey : undefined)
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (err) {
    console.error("[api/ai/endpoints/models] Failed to fetch models:", err)
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to load models from endpoint",
        models: [],
      },
      { status: 500 }
    )
  }
}
