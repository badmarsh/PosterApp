/**
 * Builds the bounded context payload sent to the DeerFlow agent (server-only).
 *
 * Safety rule: the agent never receives raw PDFs, base64 images, workspace
 * paths, or credentials. It gets a bounded markdown summary + an inventory of
 * document titles and card titles so it can reason about the poster while it
 * researches — the sources themselves stay in PosterApp.
 */
import "server-only"
import { loadSourceContext } from "@/lib/ai/context"
import { prisma, type Prisma } from "@/lib/prisma"
import { safeJsonParse } from "@/lib/db-helpers"
import type { DeerflowLanguage } from "./contracts"

export const MAX_CONTEXT_CHARS = 40_000

export interface DeerflowContextBuildOptions {
  workspaceId: string
  language: DeerflowLanguage
  includeAssets: boolean
  sourceIds?: string[]
}

export interface DeerflowContext {
  language: DeerflowLanguage
  sources: Array<{ id: string; name: string; heading?: string | null }>
  sourceSummary: string
  cards: Array<{ id: string; title: string }>
  assets: Array<{ id: string; filename: string; kind: string; caption?: string | null }>
  truncated: boolean
}

interface IngestFileRow {
  id: string
  name: string
}

interface OutputRow {
  templateId: string
  cards: Array<{ id: string; title: string }>
}

interface AssetRow {
  id: string
  filename: string | null
  kind: string
  caption: string | null
}

/**
 * Loads workspace context for a DeerFlow run. Character-bounded to mirror the
 * chat route's MAX_SOURCE_CHARS; never throws on missing files.
 */
export async function buildDeerflowContext(options: DeerflowContextBuildOptions): Promise<DeerflowContext> {
  const { workspaceId, language, includeAssets, sourceIds } = options

  const sourceSummary = await loadSourceContext({
    workspaceId,
    sourceIds,
    maxChars: MAX_CONTEXT_CHARS,
  }).catch(() => "")

  let sources: DeerflowContext["sources"] = []
  let cards: DeerflowContext["cards"] = []
  let assets: DeerflowContext["assets"] = []

  try {
    const [ingestFiles, outputs, assetRows] = await Promise.all([
      prisma.ingestFile.findMany({
        where: { workspaceId, dismissed: false },
        select: { id: true, name: true },
        orderBy: { id: "desc" },
        take: 30,
      }) as Promise<IngestFileRow[]>,
      prisma.output.findMany({
        where: { workspaceId },
        select: {
          templateId: true,
          cards: { select: { id: true, title: true }, orderBy: { order: "asc" }, take: 60 },
        },
        take: 5,
      }) as Promise<OutputRow[]>,
      includeAssets
        ? (prisma.asset.findMany({
            where: { workspaceId },
            select: { id: true, filename: true, kind: true, caption: true },
            take: 80,
          }) as Promise<AssetRow[]>)
        : Promise.resolve([]),
    ])

    sources = ingestFiles.map((f) => ({ id: f.id, name: f.name }))
    cards = (outputs.find((o) => o.cards.length > 0)?.cards ?? outputs[0]?.cards ?? []).map((c) => ({
      id: c.id,
      title: c.title,
    }))
    assets = assetRows.map((a) => ({
      id: a.id,
      filename: a.filename ?? a.id,
      kind: a.kind,
      caption: a.caption,
    }))
  } catch (err) {
    // Context is best-effort; the agent can still run with the focus prompt.
    console.error("[deerflow] context load failed:", err)
  }

  return {
    language,
    sources,
    sourceSummary,
    cards,
    assets: includeAssets ? assets : [],
    truncated: sourceSummary.length >= MAX_CONTEXT_CHARS,
  }
}

/** Reads the workspace's asset id set for proposal normalization. */
export async function getWorkspaceAssetIds(workspaceId: string): Promise<Set<string>> {
  const rows = (await prisma.asset.findMany({
    where: { workspaceId },
    select: { id: true },
  })) as Array<{ id: string }>
  return new Set(rows.map((r) => r.id))
}

/** Reads existing bib keys for dedupe checks (mirrors the bib GET route). */
export function parseWorkspaceBibKeys(bibContent: string | null, bibKeys: Prisma.JsonValue | null): string[] {
  if (Array.isArray(bibKeys)) return bibKeys.map(String).filter(Boolean)
  if (typeof bibKeys === "string") {
    try {
      const parsed: unknown = JSON.parse(bibKeys)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch {
      // fall through
    }
  }
  if (bibContent) {
    const keys = [...bibContent.matchAll(/@\w+\s*\{\s*([^,\s]+)/g)].map((m) => m[1].trim())
    return keys
  }
  return []
}

/** Reads the workspace JSON fields defensively (same pattern as workspace GET). */
export function parseWorkspaceJson<T>(value: Prisma.JsonValue | string | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === "string") return safeJsonParse(value, fallback)
  return value as T
}
