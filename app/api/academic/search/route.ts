/**
 * POST /api/academic/search
 *
 * Perplexity-style multi-source academic literature search across
 * OpenAlex, Crossref, Semantic Scholar, and arXiv.
 *
 * Response: `{ results, mode, providers, degraded, filteredByYear }` — `results` is the
 * ranked list (unchanged contract); the other fields are additive diagnostics so the UI
 * can tell "no matches" from "every registry was down" (`degraded: true`, empty results).
 */

import { NextRequest, NextResponse } from "next/server"
import { searchAcademicPaperDetailed } from "@/lib/services/academic-connector"
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
  // Never serve unauthenticated traffic against paid upstream APIs, and never
  // share a rate-limit bucket between anonymous callers.
  let userId: string | null = null
  try {
    const session = await auth()
    userId = session?.userId ?? null
  } catch {
    userId = null
  }
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
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
    // Abort upstream calls when the client disconnects; every provider additionally
    // enforces its own timeout, so this signal never replaces those bounds.
    const { results, mode, providers, degraded, filteredByYear } = await searchAcademicPaperDetailed(body.query, body.limit, {
      yearFrom: body.yearFrom,
      yearTo: body.yearTo,
      domain: body.domain,
      signal: req.signal,
    })

    if (degraded) {
      const failing = Object.entries(providers)
        .filter(([, p]) => p.status === "error" || p.status === "timeout" || p.status === "rate_limited")
        .map(([name, p]) => `${name}=${p.status}`)
      console.warn(`[Academic Search] degraded (${failing.join(", ")}) for "${body.query.slice(0, 60)}"`)
    }

    return NextResponse.json({ results, mode, providers, degraded, filteredByYear })
  } catch (error: unknown) {
    console.error("[Academic Search] Error:", error)
    return NextResponse.json(
      { error: "Academic search failed" },
      { status: 500 }
    )
  }
}
