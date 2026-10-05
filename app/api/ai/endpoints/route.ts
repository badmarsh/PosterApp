import { NextResponse } from "next/server"
import { z } from "zod"
import { auth, apiError } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { isValidEndpointBaseUrl, normalizeEndpointBaseUrl } from "@/lib/ai/endpoints"
import { getUserAiEndpoints, saveUserAiEndpoints } from "@/lib/ai/endpoint-store"

const EndpointSchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().min(1).max(2048).url().refine(isValidEndpointBaseUrl, "Base URL must use HTTP or HTTPS and cannot contain embedded credentials"),
  apiKey: z.string().max(8192).optional(),
  enabled: z.boolean().optional(),
  models: z.array(z.string().trim().min(1).max(256)).max(500).optional(),
  lastLoadedAt: z.string().datetime().optional(),
  status: z.enum(["connected", "error", "untested"]).optional(),
  errorMessage: z.string().max(1000).optional(),
}).strict()

const UpdateEndpointsSchema = z.object({
  endpoints: z.array(EndpointSchema).max(50),
}).strict()

async function getAuthenticatedUserId() {
  const { userId } = await auth().catch(() => ({ userId: null }))
  return userId
}

export async function GET() {
  // Endpoints belong to the authenticated user; there is no anonymous view.
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return apiError("UNAUTHENTICATED", "Sign in to access AI endpoint settings", 401)

    // Only the caller's own endpoints are ever returned: the settings UI must
    // never disclose another user's stored credentials.
    const endpoints = await getUserAiEndpoints(userId)
    return NextResponse.json({ endpoints }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (err) {
    console.error("[api/ai/endpoints] Failed to load endpoints:", err)
    return apiError("AI_ENDPOINTS_LOAD_FAILED", "Failed to load AI endpoint settings", 500)
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return apiError("UNAUTHENTICATED", "Sign in to update AI endpoint settings", 401)

    const rl = await rateLimitAsync(`ai-endpoints:${userId}`, 30, 60_000)
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", "Too many requests. Please try again shortly.", 429)
    }

    const body = await req.json().catch(() => null)
    const parsed = UpdateEndpointsSchema.safeParse(body)
    if (!parsed.success) {
      return apiError("INVALID_PAYLOAD", parsed.error.issues[0]?.message || "Invalid AI endpoint settings", 400)
    }

    const endpoints = parsed.data.endpoints.map((endpoint) => ({
      ...endpoint,
      baseUrl: normalizeEndpointBaseUrl(endpoint.baseUrl),
      apiKey: endpoint.apiKey?.trim() || undefined,
    }))
    await saveUserAiEndpoints(userId, endpoints)
    return NextResponse.json({ ok: true, endpoints })
  } catch (err) {
    console.error("[api/ai/endpoints] Failed to save endpoints:", err)
    return apiError("AI_ENDPOINTS_SAVE_FAILED", "Failed to save AI endpoint settings", 500)
  }
}
