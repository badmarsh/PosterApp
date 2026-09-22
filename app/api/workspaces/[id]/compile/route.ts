import { NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { compileWorkspace } from "@/lib/latex/compile-workspace"
import { isDemoProject } from "@/lib/mock-data"
import { summarizeCompileError } from "@/lib/latex/compile-summary"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const url = new URL(req.url)
    const expectedRevision = url.searchParams.get("revision")

    // Demo / showcase workspaces are not in the DB — allow unauthenticated compile with
    // client-supplied cards so the user sees exactly what the editor shows.
    if (isDemoProject(id)) {
      let body: { cards?: any[]; output?: any; forceRecompile?: boolean } = {}
      try { body = await req.json() } catch { /* empty body is fine */ }
      const result = await compileWorkspace(id, {
        installPdf: true,
        forceRecompile: body.forceRecompile ?? false,
        cards: body.cards,
        output: body.output,
      })
      if (!result.ok) {
        const code = result.error?.code
        if (code === "WORKSPACE_NOT_FOUND") return NextResponse.json({ error: result.error }, { status: 404 })
        if (code === "COMPILER_UNAVAILABLE") return NextResponse.json({ error: result.error }, { status: 503 })
        const summary = await summarizeCompileError(result.log, body.cards); return NextResponse.json({ ok: false, error: result.error ?? { code: "COMPILE_FAILED", message: "Compilation failed" }, log: result.log, summary }, { status: 422 })
      }
      return NextResponse.json({ ok: true, cached: result.cached ?? false, revision: result.revision ?? 1, log: result.log })
    }

    let bodyCards; try { const cloned = req.clone(); const parsedBody = await cloned.json(); if (Array.isArray(parsedBody?.cards)) bodyCards = parsedBody.cards; } catch {} const { workspace, userId } = await requireWorkspaceEditor(id)

    const { allowed, retryAfterMs } = await rateLimitAsync(
      `${userId}:${id}:compile`,
      10,
      60_000
    )
    if (!allowed) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: `Too many compilations — try again in ${Math.ceil(retryAfterMs / 1000)}s` } },
        { status: 429 }
      )
    }

    if (expectedRevision && workspace.revision !== parseInt(expectedRevision, 10)) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "Workspace modified concurrently" } }, { status: 409 })
    }

    const result = await compileWorkspace(id, {
      expectedRevision: expectedRevision ? parseInt(expectedRevision, 10) : undefined,
      installPdf: true,
    })

    if (!result.ok) {
      const code = result.error?.code
      if (code === "WORKSPACE_NOT_FOUND") {
        return NextResponse.json({ error: result.error }, { status: 404 })
      }
      if (code === "CONFLICT") {
        return NextResponse.json({ error: result.error }, { status: 409 })
      }
      if (code === "NO_OUTPUT") {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      if (code === "COMPILER_UNAVAILABLE") {
        return NextResponse.json({ error: result.error }, { status: 503 })
      }
      return NextResponse.json(
        {
          ok: false,
          error: result.error ?? { code: "COMPILE_FAILED", message: "Compilation failed" },
          log: result.log,
          summary: await summarizeCompileError(result.log, bodyCards),
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      ok: true,
      cached: result.cached ?? false,
      revision: result.revision ?? workspace.revision,
      log: result.log,
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error("[compile] failed", error instanceof Error ? error.name : "unknown")
    return NextResponse.json(
      {
        ok: false,
        error: { code: "COMPILE_FAILED", message: "Compilation failed" },
        log: error instanceof Error ? error.message : "Compiler failed",
      },
      { status: 500 }
    )
  }
}
