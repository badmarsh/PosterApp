import { NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { compileWorkspace } from "@/lib/latex/compile-workspace"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const url = new URL(req.url)
    const expectedRevision = url.searchParams.get("revision")

    const { workspace, userId } = await requireWorkspaceEditor(id)

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
