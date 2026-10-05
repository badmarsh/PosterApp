import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { fetchModelsFromEndpoint, isValidEndpointBaseUrl, normalizeEndpointBaseUrl } from "@/lib/ai/endpoints"

const FetchModelsSchema = z.object({
  baseUrl: z.string().trim().min(1).max(2048).url().refine(isValidEndpointBaseUrl, "Base URL must use HTTP or HTTPS and cannot contain embedded credentials"),
  apiKey: z.string().max(8192).optional(),
}).strict()

export async function POST(req: Request) {
  try {
    const { userId } = await auth().catch(() => ({ userId: null }))
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Sign in to test an AI endpoint", models: [] }, { status: 401 })
    }

    const rl = await rateLimitAsync(`ai-models-fetch:${userId}`, 30, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: "Rate limit exceeded", models: [] }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const parsed = FetchModelsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Invalid endpoint settings", models: [] },
        { status: 400 }
      )
    }

    const result = await fetchModelsFromEndpoint(
      normalizeEndpointBaseUrl(parsed.data.baseUrl),
      parsed.data.apiKey
    )
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
