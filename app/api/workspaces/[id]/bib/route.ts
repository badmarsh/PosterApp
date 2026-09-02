import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseBibKeys } from "@/lib/bib-parser"
import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { extractBibTeX } from "@/lib/services/bibtex-service"
import fs from "fs"
import path from "path"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    await requireWorkspaceAccess(id)

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { bibContent: true, bibKeys: true },
    })

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const bib = workspace.bibContent || ""
    const rawKeys = workspace.bibKeys
    let keys: string[] = []

    if (Array.isArray(rawKeys)) {
      keys = rawKeys as string[]
    } else if (typeof rawKeys === "string") {
      try {
        keys = JSON.parse(rawKeys)
      } catch {
        keys = parseBibKeys(bib)
      }
    } else {
      keys = parseBibKeys(bib)
    }

    return NextResponse.json({ bib, keys })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Bib GET] Error:", err)
    return NextResponse.json({ error: "Failed to load bibliography" }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    await requireWorkspaceEditor(id)

    const body = (await req.json()) as { bib: string }
    if (typeof body.bib !== "string") {
      return NextResponse.json({ error: "bib must be a string" }, { status: 400 })
    }

    const keys = parseBibKeys(body.bib)

    await prisma.workspace.update({
      where: { id },
      data: {
        bibContent: body.bib,
        bibKeys: keys,
      },
    })

    return NextResponse.json({ ok: true, keys })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Bib PUT] Error:", err)
    return NextResponse.json({ error: "Failed to update bibliography" }, { status: 500 })
  }
}

/**
 * POST /api/workspaces/[id]/bib — On-demand re-extraction of citations from parsed source documents.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let userId: string
  try {
    const access = await requireWorkspaceEditor(id)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(
    `${userId}:${id}:bib-extract`,
    3,
    60_000
  )
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limited — try again in ${Math.ceil(retryAfterMs / 1000)}s` },
      { status: 429 }
    )
  }

  try {
    const sourcesDir = path.join(process.cwd(), "workspaces", id, "sources")
    if (!fs.existsSync(sourcesDir)) {
      return NextResponse.json({ ok: true, count: 0, message: "No source files found" })
    }

    const files = fs.readdirSync(sourcesDir).filter((f) => f.endsWith(".md"))
    let totalExtracted = 0
    const allKeys: string[] = []

    for (const f of files) {
      try {
        const mdContent = fs.readFileSync(path.join(sourcesDir, f), "utf-8")
        const res = await extractBibTeX(mdContent, id)
        totalExtracted += res.count
        allKeys.push(...res.keys)
      } catch (err) {
        console.error(`[Bib POST] Failed extraction for ${f}:`, err)
      }
    }

    return NextResponse.json({
      ok: true,
      count: totalExtracted,
      keys: Array.from(new Set(allKeys)),
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Bib POST] Error:", err)
    return NextResponse.json({ error: "Failed to extract citations" }, { status: 500 })
  }
}
