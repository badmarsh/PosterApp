import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth"
import { randomUUID } from "crypto"
import { cleanFormula, slugifyEquationKey, type EquationItem } from "@/lib/equation-types"
import { validateEquationKaTeX } from "@/lib/services/equation-service"
import { rateLimitAsync } from "@/lib/rate-limit"
import { safeApiError } from "@/lib/security"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    await requireWorkspaceAccess(id)

    const assets = await prisma.asset.findMany({
      where: {
        workspaceId: id,
        kind: "equation",
      },
      orderBy: { page: "asc" }
    })

    const equations: EquationItem[] = assets.map((a, idx) => ({
      id: a.id,
      key: a.heading || slugifyEquationKey(a.caption || `eq_${idx + 1}`, idx + 1),
      formula: cleanFormula(a.snippet || ""),
      name: a.caption || `Equation ${idx + 1}`,
      description: a.section || undefined,
      contextSnippet: a.bbox || undefined,
      page: a.page,
      fileId: a.fileId,
      workspaceId: a.workspaceId,
    }))

    return NextResponse.json({ equations })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Equations GET] Error:", err)
    return safeApiError("Failed to load equations", 500)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { userId } = await requireWorkspaceEditor(id)

    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:equation-create`, 20, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many equation requests", retryAfterMs },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }

    const body = await req.json() as Partial<EquationItem>
    const rawFormula = body.formula?.trim() || ""
    if (!rawFormula) {
      return NextResponse.json({ error: "Formula cannot be empty" }, { status: 400 })
    }

    const formula = cleanFormula(rawFormula)
    const name = body.name?.trim() || `Equation: ${formula.slice(0, 30)}`
    const key = body.key?.trim() ? (body.key.startsWith("eq:") ? body.key : `eq:${body.key}`) : slugifyEquationKey(name)
    const description = body.description?.trim() || ""
    const contextSnippet = body.contextSnippet?.trim() || ""

    const assetId = randomUUID()
    const uniqueFilename = `custom_equation_${Date.now()}_${assetId.slice(0, 8)}.tex`

    const created = await prisma.asset.create({
      data: {
        id: assetId,
        workspaceId: id,
        fileId: body.fileId || "custom",
        filename: uniqueFilename,
        url: `/api/workspaces/${id}/assets/${uniqueFilename}`,
        thumbnailUrl: `/api/workspaces/${id}/assets/${uniqueFilename}`,
        kind: "equation",
        page: body.page || 1,
        heading: key,
        caption: name,
        snippet: formula,
        section: description || undefined,
        bbox: contextSnippet || undefined,
        confidence: "high",
      }
    })

    const equation: EquationItem = {
      id: created.id,
      key: created.heading || key,
      formula: created.snippet || formula,
      name: created.caption || name,
      description: created.section || undefined,
      contextSnippet: created.bbox || undefined,
      page: created.page,
      fileId: created.fileId,
      workspaceId: created.workspaceId,
    }

    return NextResponse.json({ ok: true, equation })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Equations POST] Error:", err)
    return NextResponse.json({ error: "Failed to create equation" }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { userId } = await requireWorkspaceEditor(id)

    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:equation-update`, 20, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many equation update requests", retryAfterMs },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }

    const body = await req.json() as Partial<EquationItem> & { id: string }
    if (!body.id) {
      return NextResponse.json({ error: "Missing equation ID" }, { status: 400 })
    }

    const existing = await prisma.asset.findFirst({
      where: { id: body.id, workspaceId: id, kind: "equation" }
    })
    if (!existing) {
      return NextResponse.json({ error: "Equation not found" }, { status: 404 })
    }

    const rawFormula = body.formula !== undefined ? body.formula.trim() : existing.snippet || ""
    const formula = cleanFormula(rawFormula)
    const name = body.name !== undefined ? body.name.trim() : existing.caption || ""
    const key = body.key !== undefined ? (body.key.startsWith("eq:") ? body.key : `eq:${body.key}`) : existing.heading || slugifyEquationKey(name)
    const description = body.description !== undefined ? body.description.trim() : existing.section || ""
    const contextSnippet = body.contextSnippet !== undefined ? body.contextSnippet.trim() : existing.bbox || ""

    const updated = await prisma.asset.update({
      where: { id: body.id },
      data: {
        heading: key,
        caption: name,
        snippet: formula,
        section: description || undefined,
        bbox: contextSnippet || undefined,
        page: body.page !== undefined ? body.page : existing.page,
      }
    })

    const equation: EquationItem = {
      id: updated.id,
      key: updated.heading || key,
      formula: updated.snippet || formula,
      name: updated.caption || name,
      description: updated.section || undefined,
      contextSnippet: updated.bbox || undefined,
      page: updated.page,
      fileId: updated.fileId,
      workspaceId: updated.workspaceId,
    }

    return NextResponse.json({ ok: true, equation })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Equations PUT] Error:", err)
    return safeApiError("Failed to update equation", 500)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Editor role is appropriate for deleting workspace equation assets
    const { userId } = await requireWorkspaceEditor(id)

    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:equation-delete`, 20, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many equation delete requests", retryAfterMs },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }

    const url = new URL(req.url)
    const eqId = url.searchParams.get("id")
    if (!eqId) {
      return NextResponse.json({ error: "Missing equation ID" }, { status: 400 })
    }

    await prisma.asset.deleteMany({
      where: {
        id: eqId,
        workspaceId: id,
        kind: "equation",
      }
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Equations DELETE] Error:", err)
    return safeApiError("Failed to delete equation", 500)
  }
}
