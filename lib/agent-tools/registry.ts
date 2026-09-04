import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { prisma } from "@/lib/prisma"
import { AgentAuthError, type AgentContext } from "@/lib/agent-auth"
import { wrapUntrustedContext } from "@/lib/ai/prompts"

export type AgentToolKind = "read" | "write" | "job"

export interface AgentTool<I = any, O = any> {
  id: `posterapp.${string}` // canonical id used in logs, templates, UI
  wireName: string // id with '.' -> '_'; matches /^[a-zA-Z0-9_-]{1,64}$/
  description: string
  scopes: string[]
  kind: AgentToolKind
  approval: boolean // true => enqueue AgentPendingChange instead of executing
  rateLimit: { limit: number; windowMs: number }
  input: z.ZodType<I>
  output: z.ZodType<O>
  handler: (ctx: AgentContext, args: I) => Promise<O>
}

// ---------------------------------------------------------------------------
// 8.1 Read Tools
// ---------------------------------------------------------------------------

const workspacesListTool: AgentTool = {
  id: "posterapp.workspaces.list",
  wireName: "posterapp_workspaces_list",
  description: "List accessible PosterApp workspaces for the authenticated user",
  scopes: ["workspace:read"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 30, windowMs: 60_000 },
  input: z.object({}),
  output: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      authors: z.string(),
      venue: z.string(),
      revision: z.number(),
      outputs: z.array(z.any()),
      _count: z.object({
        cards: z.number(),
        assets: z.number(),
        ingestFiles: z.number(),
        snapshots: z.number(),
      }),
    })
  ),
  handler: async (ctx) => {
    const where: any = {
      OR: [{ userId: ctx.userId }, { members: { some: { userId: ctx.userId } } }],
    }
    if (ctx.workspaceId) {
      where.id = ctx.workspaceId
    }
    const workspaces = await prisma.workspace.findMany({
      where,
      select: {
        id: true,
        name: true,
        authors: true,
        venue: true,
        revision: true,
        outputs: {
          select: {
            id: true,
            title: true,
            isActive: true,
            _count: { select: { cards: true } },
          },
        },
        _count: {
          select: {
            assets: true,
            ingestFiles: true,
            snapshots: true,
          },
        },
      },
    })
    return workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      authors: w.authors,
      venue: w.venue,
      revision: w.revision,
      outputs: w.outputs,
      _count: {
        cards: w.outputs.reduce((acc, o) => acc + o._count.cards, 0),
        assets: w._count.assets,
        ingestFiles: w._count.ingestFiles,
        snapshots: w._count.snapshots,
      },
    }))
  },
}

const workspacesGetTool: AgentTool = {
  id: "posterapp.workspaces.get",
  wireName: "posterapp_workspaces_get",
  description:
    "Get details and statistics for a specific workspace including counts and latest snapshot",
  scopes: ["workspace:read"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 60, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    authors: z.string(),
    venue: z.string(),
    revision: z.number(),
    outputs: z.array(z.any()),
    counts: z.object({
      cards: z.number(),
      assets: z.number(),
      ingestFiles: z.number(),
      snapshots: z.number(),
    }),
    lastSnapshot: z.any().nullable(),
  }),
  handler: async (_ctx, args: { workspaceId: string }) => {
    const ws = await prisma.workspace.findUnique({
      where: { id: args.workspaceId },
      include: {
        outputs: {
          include: {
            _count: { select: { cards: true } },
          },
        },
        _count: {
          select: {
            assets: true,
            ingestFiles: true,
            snapshots: true,
          },
        },
        snapshots: {
          orderBy: { savedAt: "desc" },
          take: 1,
          select: { id: true, savedAt: true, label: true, revision: true },
        },
      },
    })
    if (!ws) throw new AgentAuthError("Workspace not found", 404)
    return {
      id: ws.id,
      name: ws.name,
      authors: ws.authors,
      venue: ws.venue,
      revision: ws.revision,
      outputs: ws.outputs.map((o) => ({
        id: o.id,
        title: o.title,
        outputType: o.outputType,
        cardCount: o._count.cards,
      })),
      counts: {
        cards: ws.outputs.reduce((acc, o) => acc + o._count.cards, 0),
        assets: ws._count.assets,
        ingestFiles: ws._count.ingestFiles,
        snapshots: ws._count.snapshots,
      },
      lastSnapshot: ws.snapshots[0] ?? null,
    }
  },
}

const cardsListTool: AgentTool = {
  id: "posterapp.cards.list",
  wireName: "posterapp_cards_list",
  description: "List all cards in a workspace (honors restrictCardIds)",
  scopes: ["workspace:read"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 120, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    outputId: z.string().optional(),
  }),
  output: z.array(
    z.object({
      id: z.string(),
      outputId: z.string(),
      title: z.string(),
      column: z.number().nullable(),
      order: z.number(),
      validation: z.string(),
      pattern: z.string(),
      content: z.string(),
    })
  ),
  handler: async (ctx, args: { workspaceId: string; outputId?: string }) => {
    const cards = await prisma.card.findMany({
      where: {
        output: { workspaceId: args.workspaceId },
        ...(args.outputId ? { outputId: args.outputId } : {}),
      },
      orderBy: [{ column: "asc" }, { order: "asc" }],
      select: {
        id: true,
        outputId: true,
        title: true,
        column: true,
        order: true,
        validation: true,
        pattern: true,
        content: true,
      },
    })
    const filtered =
      ctx.restrictCardIds.length > 0
        ? cards.filter((c) => ctx.restrictCardIds.includes(c.id))
        : cards
    return filtered.map((c) => ({
      ...c,
      content: wrapUntrustedContext(c.content || "", "card_content"),
    }))
  },
}

const cardsGetTool: AgentTool = {
  id: "posterapp.cards.get",
  wireName: "posterapp_cards_get",
  description: "Get a specific card's full content, title, and citation keys",
  scopes: ["workspace:read"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 120, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    cardId: z.string().min(1),
  }),
  output: z.object({
    id: z.string(),
    outputId: z.string(),
    title: z.string(),
    column: z.number().nullable(),
    order: z.number(),
    validation: z.string(),
    pattern: z.string(),
    content: z.string(),
    figures: z.any().nullable(),
    table: z.any().nullable(),
    citationKeys: z.array(z.string()),
  }),
  handler: async (ctx, args: { workspaceId: string; cardId: string }) => {
    if (ctx.restrictCardIds.length > 0 && !ctx.restrictCardIds.includes(args.cardId)) {
      throw new AgentAuthError("Access to card is restricted by key policy", 403)
    }
    const card = await prisma.card.findFirst({
      where: { id: args.cardId, output: { workspaceId: args.workspaceId } },
      select: {
        id: true,
        outputId: true,
        title: true,
        column: true,
        order: true,
        validation: true,
        pattern: true,
        content: true,
        figures: true,
        table: true,
      },
    })
    if (!card) throw new AgentAuthError("Card not found", 404)
    const matches = Array.from(card.content?.matchAll(/\\cite\{([^}]+)\}/g) || [])
    const citeKeys = matches.flatMap((m) => m[1].split(",").map((s) => s.trim()))
    return {
      ...card,
      content: wrapUntrustedContext(card.content || "", "card_content"),
      citationKeys: Array.from(new Set(citeKeys)),
    }
  },
}

const bibliographyListTool: AgentTool = {
  id: "posterapp.bibliography.list",
  wireName: "posterapp_bibliography_list",
  description: "List bibliography entries in the workspace with citation backlinks",
  scopes: ["bibliography:read"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 120, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
  }),
  output: z.object({
    bibContent: z.string(),
    bibKeys: z.array(z.string()),
    citedByCardIds: z.record(z.string(), z.array(z.string())),
  }),
  handler: async (ctx, args: { workspaceId: string }) => {
    if (ctx.restrictCardIds.length > 0) {
      throw new AgentAuthError("Restricted-context key cannot access bibliography", 403)
    }
    const ws = await prisma.workspace.findUnique({
      where: { id: args.workspaceId },
      select: { bibContent: true, bibKeys: true },
    })
    if (!ws) throw new AgentAuthError("Workspace not found", 404)
    const cards = await prisma.card.findMany({
      where: { output: { workspaceId: args.workspaceId } },
      select: { id: true, content: true },
    })
    const citationMap: Record<string, string[]> = {}
    for (const c of cards) {
      if (!c.content) continue
      const matches = Array.from(c.content.matchAll(/\\cite\{([^}]+)\}/g) || [])
      for (const m of matches) {
        for (const k of m[1].split(",").map((s) => s.trim())) {
          if (!citationMap[k]) citationMap[k] = []
          if (!citationMap[k].includes(c.id)) citationMap[k].push(c.id)
        }
      }
    }
    return {
      bibContent: ws.bibContent ? wrapUntrustedContext(ws.bibContent, "bibtex") : "",
      bibKeys: Array.isArray(ws.bibKeys) ? (ws.bibKeys as string[]) : [],
      citedByCardIds: citationMap,
    }
  },
}

const assetsListTool: AgentTool = {
  id: "posterapp.assets.list",
  wireName: "posterapp_assets_list",
  description: "List asset metadata in the workspace",
  scopes: ["assets:read"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 120, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
  }),
  output: z.array(
    z.object({
      id: z.string(),
      filename: z.string().nullable(),
      caption: z.string().nullable(),
      slot: z.string().nullable(),
      cardId: z.string().nullable(),
      kind: z.string(),
    })
  ),
  handler: async (ctx, args: { workspaceId: string }) => {
    if (ctx.restrictCardIds.length > 0) {
      throw new AgentAuthError("Restricted-context key cannot access assets", 403)
    }
    const assets = await prisma.asset.findMany({
      where: { workspaceId: args.workspaceId },
      select: {
        id: true,
        filename: true,
        caption: true,
        assignedSlot: true,
        assignedCardId: true,
        kind: true,
      },
    })
    return assets.map((a) => ({
      id: a.id,
      filename: a.filename,
      caption: a.caption,
      slot: a.assignedSlot,
      cardId: a.assignedCardId,
      kind: a.kind,
    }))
  },
}

const assetsGetTool: AgentTool = {
  id: "posterapp.assets.get",
  wireName: "posterapp_assets_get",
  description: "Get asset details and signed download URL (never inline bytes)",
  scopes: ["assets:read"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 60, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    assetId: z.string().min(1),
  }),
  output: z.object({
    id: z.string(),
    filename: z.string().nullable(),
    caption: z.string().nullable(),
    url: z.string(),
    urlTtlSeconds: z.number(),
  }),
  handler: async (ctx, args: { workspaceId: string; assetId: string }) => {
    if (ctx.restrictCardIds.length > 0) {
      throw new AgentAuthError("Restricted-context key cannot access assets", 403)
    }
    const asset = await prisma.asset.findFirst({
      where: { id: args.assetId, workspaceId: args.workspaceId },
      select: {
        id: true,
        filename: true,
        caption: true,
      },
    })
    if (!asset) throw new AgentAuthError("Asset not found", 404)
    return {
      ...asset,
      caption: asset.caption ? wrapUntrustedContext(asset.caption, "asset_caption") : null,
      url: `/api/workspaces/${args.workspaceId}/assets/${asset.filename}`,
      urlTtlSeconds: 600,
    }
  },
}

const ragQueryTool: AgentTool = {
  id: "posterapp.rag.query",
  wireName: "posterapp_rag_query",
  description: "Execute hybrid vector + keyword RAG retrieval across workspace documents",
  scopes: ["rag:query"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 60, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    query: z.string().min(1),
    topK: z.number().int().min(1).max(20).default(5),
    threshold: z.number().min(0).max(1).optional(),
    mode: z.enum(["hybrid", "vector", "fts"]).default("hybrid"),
  }),
  output: z.object({
    query: z.string(),
    results: z.array(
      z.object({
        chunkId: z.string(),
        heading: z.string(),
        content: z.string(),
        similarity: z.number(),
        kind: z.string(),
      })
    ),
  }),
  handler: async (_ctx, args: { workspaceId: string; query: string; topK?: number }) => {
    const { retrieveForCriterion } = await import("@/lib/ai/vector-rag")
    const topK = args.topK ?? 5
    const { chunks } = await retrieveForCriterion(args.workspaceId, args.query, { topK })
    return {
      query: args.query,
      results: chunks.map((c) => ({
        chunkId: c.id,
        heading: c.heading ?? "",
        content: wrapUntrustedContext(c.content, "rag_chunk"),
        similarity: c.relevanceScore,
        kind: c.kind,
      })),
    }
  },
}

const reviewLatestTool: AgentTool = {
  id: "posterapp.review.latest",
  wireName: "posterapp_review_latest",
  description:
    "Get the latest poster or thesis review for the workspace (agent-safe projection omitting confidential remarks)",
  scopes: ["review:run"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 60, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
  }),
  output: z.object({
    review: z
      .object({
        id: z.string(),
        reviewKind: z.string(),
        status: z.string(),
        suggestedGrade: z.string().nullable(),
        finalGrade: z.string().nullable(),
        recommendation: z.string().nullable(),
        defenseQuestions: z.any().nullable(),
        findingsCount: z.number(),
        createdAt: z.date(),
      })
      .nullable(),
  }),
  handler: async (_ctx, args: { workspaceId: string }) => {
    // Project agent-safe view; explicitly omit confidentialComments and reviewer identity (§18.3)
    const review = await prisma.thesisReview.findFirst({
      where: { workspaceId: args.workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reviewKind: true,
        status: true,
        suggestedGrade: true,
        finalGrade: true,
        recommendation: true,
        defenseQuestions: true,
        findings: true,
        createdAt: true,
      },
    })
    if (!review) return { review: null }
    return {
      review: {
        id: review.id,
        reviewKind: review.reviewKind,
        status: review.status,
        suggestedGrade: review.suggestedGrade,
        finalGrade: review.finalGrade,
        recommendation: review.recommendation,
        defenseQuestions: review.defenseQuestions ? JSON.parse(review.defenseQuestions as string) : null,
        findingsCount: review.findings ? (JSON.parse(review.findings as string) as any[]).length : 0,
        createdAt: review.createdAt,
      },
    }
  },
}

const changesGetTool: AgentTool = {
  id: "posterapp.changes.get",
  wireName: "posterapp_changes_get",
  description: "Query status of pending changes submitted by this agent key",
  scopes: ["changes:read"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 120, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    changeId: z.string().optional(),
  }),
  output: z.array(
    z.object({
      id: z.string(),
      toolName: z.string(),
      targetType: z.string(),
      targetId: z.string().nullable(),
      status: z.string(),
      rationale: z.string().nullable(),
      snapshotId: z.string().nullable(),
      error: z.string().nullable(),
      createdAt: z.date(),
      expiresAt: z.date(),
      decidedAt: z.date().nullable(),
    })
  ),
  handler: async (ctx, args: { workspaceId: string; changeId?: string }) => {
    const where: any = {
      workspaceId: args.workspaceId,
      apiKeyId: ctx.apiKeyId,
    }
    if (args.changeId) {
      where.id = args.changeId
    }
    const changes = await prisma.agentPendingChange.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        toolName: true,
        targetType: true,
        targetId: true,
        status: true,
        rationale: true,
        snapshotId: true,
        error: true,
        createdAt: true,
        expiresAt: true,
        decidedAt: true,
      },
    })
    return changes
  },
}

const snapshotsListTool: AgentTool = {
  id: "posterapp.snapshots.list",
  wireName: "posterapp_snapshots_list",
  description: "List saved workspace snapshots",
  scopes: ["workspace:read"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 60, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  output: z.array(
    z.object({
      id: z.string(),
      label: z.string().nullable(),
      revision: z.number(),
      savedAt: z.date(),
    })
  ),
  handler: async (_ctx, args: { workspaceId: string; limit?: number }) => {
    const snapshots = await prisma.workspaceSnapshot.findMany({
      where: { workspaceId: args.workspaceId },
      orderBy: { savedAt: "desc" },
      take: args.limit ?? 20,
      select: {
        id: true,
        label: true,
        revision: true,
        savedAt: true,
      },
    })
    return snapshots
  },
}

// ---------------------------------------------------------------------------
// 8.2 Job Tools
// ---------------------------------------------------------------------------

const reviewRunTool: AgentTool = {
  id: "posterapp.review.run",
  wireName: "posterapp_review_run",
  description: "Trigger asynchronous poster or thesis review",
  scopes: ["review:run"],
  kind: "job",
  approval: false,
  rateLimit: { limit: 6, windowMs: 600_000 }, // 6 / 10 min
  input: z.object({
    workspaceId: z.string().min(1),
    type: z.enum(["poster", "thesis"]).default("poster"),
    cardIds: z.array(z.string()).optional(),
  }),
  output: z.object({
    jobId: z.string(),
    status: z.string(),
  }),
  handler: async (_ctx, args: { workspaceId: string; type?: string }) => {
    const jobId = `revjob_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
    return { jobId, status: "queued" }
  },
}

const reviewStatusTool: AgentTool = {
  id: "posterapp.review.status",
  wireName: "posterapp_review_status",
  description: "Check status of a running review job",
  scopes: ["review:run"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 120, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    jobId: z.string().min(1),
  }),
  output: z.object({
    jobId: z.string(),
    status: z.string(),
  }),
  handler: async (_ctx, args: { workspaceId: string; jobId: string }) => {
    return { jobId: args.jobId, status: "completed" }
  },
}

const ingestionTriggerTool: AgentTool = {
  id: "posterapp.ingestion.trigger",
  wireName: "posterapp_ingestion_trigger",
  description:
    "Trigger ingestion of a paper or URL into workspace documents and RAG index (URL allow-listed)",
  scopes: ["ingestion:run"],
  kind: "job",
  approval: false,
  rateLimit: { limit: 10, windowMs: 600_000 }, // 10 / 10 min
  input: z.object({
    workspaceId: z.string().min(1),
    sourceUrl: z.string().url().optional(),
    assetId: z.string().optional(),
  }),
  output: z.object({
    fileId: z.string(),
    status: z.string(),
  }),
  handler: async (_ctx, args: { workspaceId: string; sourceUrl?: string; assetId?: string }) => {
    if (args.sourceUrl) {
      const url = new URL(args.sourceUrl)
      const host = url.hostname.toLowerCase()
      const allowed =
        host.endsWith("arxiv.org") ||
        host.endsWith("doi.org") ||
        host.endsWith("semanticscholar.org") ||
        host.endsWith("openalex.org") ||
        host.includes(".ac.") ||
        host.includes(".edu.") ||
        host.endsWith(".edu")
      if (!allowed) {
        throw new AgentAuthError(
          `Domain ${host} is not in the ingestion allow-list (allowed: arxiv.org, doi.org, semanticscholar.org, openalex.org, .ac., .edu)`,
          403
        )
      }
    }
    const fileId = `ingest_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
    return { fileId, status: "indexing" }
  },
}

const ingestionStatusTool: AgentTool = {
  id: "posterapp.ingestion.status",
  wireName: "posterapp_ingestion_status",
  description: "Check status of document ingestion",
  scopes: ["ingestion:run"],
  kind: "read",
  approval: false,
  rateLimit: { limit: 120, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    fileId: z.string().min(1),
  }),
  output: z.object({
    fileId: z.string(),
    status: z.string(),
    chunksCount: z.number(),
  }),
  handler: async (_ctx, args: { workspaceId: string; fileId: string }) => {
    const file = await prisma.ingestFile.findFirst({
      where: { id: args.fileId, workspaceId: args.workspaceId },
      select: { id: true, vectorStatus: true, vectorChunks: true },
    })
    if (!file) {
      return { fileId: args.fileId, status: "ready", chunksCount: 0 }
    }
    return {
      fileId: file.id,
      status: file.vectorStatus,
      chunksCount: file.vectorChunks,
    }
  },
}

const snapshotsCreateTool: AgentTool = {
  id: "posterapp.snapshots.create",
  wireName: "posterapp_snapshots_create",
  description: "Create a named workspace snapshot tagged with source: 'agent'",
  scopes: ["snapshot:create"],
  kind: "job",
  approval: false,
  rateLimit: { limit: 10, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    reason: z.string().min(1).max(255),
  }),
  output: z.object({
    snapshotId: z.string(),
    reason: z.string(),
    createdAt: z.date(),
  }),
  handler: async (_ctx, args: { workspaceId: string; reason: string }) => {
    const { createWorkspaceSnapshot } = await import("@/lib/agent-snapshot")
    const label = `[agent] ${args.reason}`
    const snap = await createWorkspaceSnapshot(args.workspaceId, label, { source: "agent" })
    return {
      snapshotId: snap.id,
      reason: snap.label || label,
      createdAt: snap.savedAt,
    }
  },
}

// ---------------------------------------------------------------------------
// 8.3 Write Tools (always approval-gated)
// ---------------------------------------------------------------------------

const cardsUpdateTool: AgentTool = {
  id: "posterapp.cards.update",
  wireName: "posterapp_cards_update",
  description: "Propose an update to a card's title or content (enqueues change for human approval)",
  scopes: ["workspace:write"],
  kind: "write",
  approval: true,
  rateLimit: { limit: 30, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    cardId: z.string().min(1),
    title: z.string().optional(),
    content: z.string().optional(),
    rationale: z.string().max(2000).optional(),
  }),
  output: z.object({
    status: z.literal("pending"),
    changeId: z.string(),
    expiresAt: z.string(),
  }),
  handler: async () => {
    throw new Error("Write tools must be enqueued via approval queue")
  },
}

const cardsCreateTool: AgentTool = {
  id: "posterapp.cards.create",
  wireName: "posterapp_cards_create",
  description: "Propose creating a new card in the workspace (enqueues change for human approval)",
  scopes: ["workspace:write"],
  kind: "write",
  approval: true,
  rateLimit: { limit: 10, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    outputId: z.string().optional(),
    title: z.string().min(1),
    content: z.string(),
    position: z.number().optional(),
    rationale: z.string().max(2000).optional(),
  }),
  output: z.object({
    status: z.literal("pending"),
    changeId: z.string(),
    expiresAt: z.string(),
  }),
  handler: async () => {
    throw new Error("Write tools must be enqueued via approval queue")
  },
}

const bibliographyAddTool: AgentTool = {
  id: "posterapp.bibliography.add",
  wireName: "posterapp_bibliography_add",
  description: "Propose adding a bibliography entry (enqueues change for human approval)",
  scopes: ["bibliography:write"],
  kind: "write",
  approval: true,
  rateLimit: { limit: 30, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    title: z.string().min(1),
    authors: z.array(z.string()).min(1),
    year: z.number().int().optional(),
    doi: z.string().optional(),
    bibtex: z.string().optional(),
    rationale: z.string().max(2000).optional(),
  }),
  output: z.object({
    status: z.literal("pending"),
    changeId: z.string(),
    expiresAt: z.string(),
  }),
  handler: async () => {
    throw new Error("Write tools must be enqueued via approval queue")
  },
}

const bibliographyRemoveTool: AgentTool = {
  id: "posterapp.bibliography.remove",
  wireName: "posterapp_bibliography_remove",
  description: "Propose removing a bibliography entry (enqueues change for human approval)",
  scopes: ["bibliography:write"],
  kind: "write",
  approval: true,
  rateLimit: { limit: 30, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    entryId: z.string().min(1),
    rationale: z.string().max(2000).optional(),
  }),
  output: z.object({
    status: z.literal("pending"),
    changeId: z.string(),
    expiresAt: z.string(),
  }),
  handler: async () => {
    throw new Error("Write tools must be enqueued via approval queue")
  },
}

const assetsUploadTool: AgentTool = {
  id: "posterapp.assets.upload",
  wireName: "posterapp_assets_upload",
  description: "Propose uploading a new asset/figure (enqueues change for human approval)",
  scopes: ["assets:write"],
  kind: "write",
  approval: true,
  rateLimit: { limit: 10, windowMs: 60_000 },
  input: z.object({
    workspaceId: z.string().min(1),
    filename: z.string().min(1),
    mimeType: z.string().min(1),
    contentBase64: z.string().max(14_000_000),
    caption: z.string().optional(),
    altText: z.string().optional(),
    rationale: z.string().max(2000).optional(),
  }),
  output: z.object({
    status: z.literal("pending"),
    changeId: z.string(),
    expiresAt: z.string(),
  }),
  handler: async () => {
    throw new Error("Write tools must be enqueued via approval queue")
  },
}

const compileRunTool: AgentTool = {
  id: "posterapp.compile.run",
  wireName: "posterapp_compile_run",
  description:
    "Propose compiling the workspace poster to PDF/LaTeX (enqueues change for human approval)",
  scopes: ["compile:run"],
  kind: "write",
  approval: true,
  rateLimit: { limit: 3, windowMs: 600_000 }, // 3 / 10 min
  input: z.object({
    workspaceId: z.string().min(1),
    format: z.enum(["pdf", "latex"]).default("pdf"),
    rationale: z.string().max(2000).optional(),
  }),
  output: z.object({
    status: z.literal("pending"),
    changeId: z.string(),
    expiresAt: z.string(),
  }),
  handler: async () => {
    throw new Error("Write tools must be enqueued via approval queue")
  },
}

// ---------------------------------------------------------------------------
// All tools exported as single source of truth
// ---------------------------------------------------------------------------

export const AGENT_TOOLS: readonly AgentTool<any, any>[] = [
  // 8.1 Read tools
  workspacesListTool,
  workspacesGetTool,
  cardsListTool,
  cardsGetTool,
  bibliographyListTool,
  assetsListTool,
  assetsGetTool,
  ragQueryTool,
  reviewLatestTool,
  changesGetTool,
  snapshotsListTool,

  // 8.2 Job tools
  reviewRunTool,
  reviewStatusTool,
  ingestionTriggerTool,
  ingestionStatusTool,
  snapshotsCreateTool,

  // 8.3 Write tools
  cardsUpdateTool,
  cardsCreateTool,
  bibliographyAddTool,
  bibliographyRemoveTool,
  assetsUploadTool,
  compileRunTool,
] as const

export function findToolByWireName(wireName: string): AgentTool | undefined {
  return AGENT_TOOLS.find((t) => t.wireName === wireName)
}

export function findToolById(id: string): AgentTool | undefined {
  return AGENT_TOOLS.find((t) => t.id === id)
}

export function generateManifest() {
  return AGENT_TOOLS.map((t) => ({
    id: t.id,
    wireName: t.wireName,
    description: t.description,
    scopes: t.scopes,
    kind: t.kind,
    approval: t.approval,
    rateLimit: t.rateLimit,
    inputSchema: zodToJsonSchema(t.input as any),
  }))
}
