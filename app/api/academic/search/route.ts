/**
 * POST /api/academic/search
 *
 * Perplexity-style multi-source academic literature search across
 * OpenAlex, Crossref, Semantic Scholar, and arXiv.
 */

import { NextRequest, NextResponse } from "next/server"
import { searchAcademicPaper } from "@/lib/services/academic-connector"
import { rateLimitAsync } from "@/lib/rate-limit"
import { auth } from "@/lib/auth"
import { z } from "zod"

const SearchSchema = z.object({
  query: z.string().min(1).max(300),
  limit: z.number().int().min(1).max(20).default(6),
  yearFrom: z.number().int().min(1900).max(2100).optional(),
  yearTo: z.number().int().min(1900).max(2100).optional(),
  domain: z.string().max(100).optional(),
})

export async function POST(req: NextRequest) {
  let userId = "anon"
  try {
    const session = await auth()
    if (session?.userId) userId = session.userId
  } catch {
    // E2E test fallback or unauth
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:academic-search`, 30, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  let body: z.infer<typeof SearchSchema>
  try {
    const raw = await req.json()
    const parsed = SearchSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search parameters", details: parsed.error.format() },
        { status: 400 }
      )
    }
    body = parsed.data
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const papers = await searchAcademicPaper(body.query, body.limit, {
      yearFrom: body.yearFrom,
      yearTo: body.yearTo,
      domain: body.domain,
    })

    return NextResponse.json({ results: papers })
  } catch (error: unknown) {
    console.error("[Academic Search] Error:", error)
    return NextResponse.json(
      { error: "Academic search failed" },
      { status: 500 }
    )
  }
}
