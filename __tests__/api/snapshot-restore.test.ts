import { describe, it, expect } from "vitest"
import { z } from "zod"

/**
 * Mirror of the SnapshotDataSchema from app/api/workspaces/[id]/history/[snapId]/route.ts.
 * We replicate it here (rather than importing the route) so we can test schema validation
 * in isolation without pulling in Next.js route handler dependencies.
 */
const SnapshotDataSchema = z.object({
  name: z.string().optional(),
  authors: z.string().optional(),
  venue: z.string().optional(),
  bibContent: z.string().nullable().optional(),
  bibKeys: z.any().optional(),
  agentEvents: z.any().optional(),
  chatMessages: z.any().optional(),
  logoUrl: z.string().nullable().optional(),
  secondaryLogoUrl: z.string().nullable().optional(),
  outputs: z.array(z.object({
    id: z.string(),
    outputType: z.string(),
    templateId: z.string(),
    title: z.string(),
    themeColor: z.string().nullable().optional(),
    isActive: z.boolean().default(false),
    authors: z.string().nullable().optional(),
    venue: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
    secondaryLogoUrl: z.string().nullable().optional(),
    sourceIds: z.any().optional(),
    cards: z.array(z.object({
      id: z.string(),
      title: z.string().default(""),
      column: z.number().int().nullable().optional(),
      order: z.number().int(),
      pattern: z.string(),
      content: z.string().default(""),
      table: z.any().optional(),
      figures: z.any().optional(),
      figureLayout: z.string().default("single"),
      sourceIds: z.any().optional(),
      heightBudget: z.number().nullable().optional(),
      validation: z.string().default("valid"),
      generatedLatex: z.string().nullable().optional(),
      slideNotes: z.string().nullable().optional(),
    })).default([]),
  })).optional(),
  assets: z.array(z.object({
    id: z.string(),
    fileId: z.string().default("unknown-file"),
    filename: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    kind: z.string().default("figure"),
    page: z.number().int().default(1),
    section: z.string().nullable().optional(),
    bbox: z.string().nullable().optional(),
    confidence: z.string().default("high"),
    heading: z.string().nullable().optional(),
    snippet: z.string().nullable().optional(),
    thumbnailUrl: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    tableRows: z.any().optional(),
    assignedCardId: z.string().nullable().optional(),
    assignedSlot: z.string().nullable().optional(),
  })).optional(),
})

describe("Snapshot Zod schema validation", () => {
  it("parses a minimal snapshot with venue and authors", () => {
    const input = {
      venue: "NeurIPS",
      authors: "Alice",
    }

    const result = SnapshotDataSchema.parse(input)

    expect(result.venue).toBe("NeurIPS")
    expect(result.authors).toBe("Alice")
  })

  it("preserves venue and authors through a round-trip (parse then re-parse)", () => {
    const original = {
      name: "My Poster",
      venue: "NeurIPS",
      authors: "Alice",
      bibContent: "@article{key}",
    }

    const parsed = SnapshotDataSchema.parse(original)
    // Simulate JSON round-trip (as stored in DB snapshot column)
    const serialized = JSON.stringify(parsed)
    const restored = SnapshotDataSchema.parse(JSON.parse(serialized))

    expect(restored.venue).toBe("NeurIPS")
    expect(restored.authors).toBe("Alice")
    expect(restored.name).toBe("My Poster")
    expect(restored.bibContent).toBe("@article{key}")
  })

  it("accepts a full snapshot with outputs, cards, and assets", () => {
    const input = {
      name: "Full Poster",
      venue: "ICML",
      authors: "Alice, Bob",
      outputs: [
        {
          id: "out_1",
          outputType: "poster",
          templateId: "atlas",
          title: "Main Poster",
          isActive: true,
          cards: [
            {
              id: "card_1",
              title: "Introduction",
              order: 0,
              pattern: "bullets",
              content: "Hello world",
            },
          ],
        },
      ],
      assets: [
        {
          id: "asset_1",
          filename: "fig1.png",
          kind: "figure",
        },
      ],
    }

    const result = SnapshotDataSchema.parse(input)

    expect(result.outputs).toHaveLength(1)
    expect(result.outputs![0].cards).toHaveLength(1)
    expect(result.outputs![0].cards[0].validation).toBe("valid") // default
    expect(result.assets).toHaveLength(1)
    expect(result.assets![0].confidence).toBe("high") // default
    expect(result.assets![0].fileId).toBe("unknown-file") // default
  })

  it("rejects a snapshot with invalid output id type", () => {
    const input = {
      outputs: [
        {
          id: 123, // should be string
          outputType: "poster",
          templateId: "atlas",
          title: "Test",
          cards: [],
        },
      ],
    }

    expect(() => SnapshotDataSchema.parse(input)).toThrow()
  })

  it("rejects a card with non-integer order", () => {
    const input = {
      outputs: [
        {
          id: "out_1",
          outputType: "poster",
          templateId: "atlas",
          title: "Test",
          cards: [
            {
              id: "card_1",
              order: 1.5, // not an integer
              pattern: "bullets",
            },
          ],
        },
      ],
    }

    expect(() => SnapshotDataSchema.parse(input)).toThrow()
  })

  it("applies default values for optional card fields", () => {
    const input = {
      outputs: [
        {
          id: "out_1",
          outputType: "poster",
          templateId: "atlas",
          title: "Test",
          cards: [
            {
              id: "card_1",
              order: 0,
              pattern: "bullets",
            },
          ],
        },
      ],
    }

    const result = SnapshotDataSchema.parse(input)
    const card = result.outputs![0].cards[0]

    expect(card.title).toBe("")
    expect(card.content).toBe("")
    expect(card.figureLayout).toBe("single")
    expect(card.validation).toBe("valid")
  })
})
