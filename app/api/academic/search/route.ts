/**
 * POST /api/academic/search
 *
 * Search academic literature via Semantic Scholar Graph API and arXiv.
 */

import { NextRequest, NextResponse } from "next/server"
import { searchAcademicPaper } from "@/lib/services/academic-connector"
import { rateLimitAsync } from "@/lib/rate-limit"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

const SearchSchema = z.object({
  query: z.string().min(1).max(300),
  limit: z.number().int().min(1).max(20).default(5),
})

export async function POST(req: NextRequest) {
  let userId = "anon"
  try {
    const session = await auth()
    if (session.userId) userId = session.userId
  } catch {
    // E2E test fallback or unauth
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:academic-search`, 20, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  try {
    const raw = await req.json()
    const { query, limit } = SearchSchema.parse(raw)

    const papers = await searchAcademicPaper(query, limit)
    return NextResponse.json({ results: papers })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 400 }
    )
  }
}
