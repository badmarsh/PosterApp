import { describe, it, expect } from "vitest"
import { WorkspaceSchema, CardSchema, WorkspaceCreateSchema } from "../../validations/workspace"

describe("Workspace validation schemas", () => {
  describe("WorkspaceSchema", () => {
    it("accepts minimal workspace", () => {
      const result = WorkspaceSchema.safeParse({ name: "Test" })
      expect(result.success).toBe(true)
    })

    it("rejects card with invalid column", () => {
      const result = WorkspaceSchema.safeParse({
        cards: [{ id: "c1", column: 99, order: 0, pattern: "bullets" }],
      })
      expect(result.success).toBe(false)
    })

    it("accepts new outputs format", () => {
      const result = WorkspaceSchema.safeParse({
        outputs: [
          {
            id: "out1",
            outputType: "poster",
            templateId: "atlas",
            title: "Test",
            isActive: true,
            cards: [],
          },
        ],
        activeOutputId: "out1",
      })
      expect(result.success).toBe(true)
    })

    it("accepts legacy flat format", () => {
      const result = WorkspaceSchema.safeParse({
        name: "Legacy",
        cards: [{ id: "c1", order: 0, pattern: "bullets" }],
      })
      expect(result.success).toBe(true)
    })

    it("rejects negative order", () => {
      const result = WorkspaceSchema.safeParse({
        cards: [{ id: "c1", order: -1, pattern: "bullets" }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe("CardSchema", () => {
    it("accepts valid card", () => {
      const result = CardSchema.safeParse({
        id: "c1",
        order: 0,
        pattern: "bullets",
      })
      expect(result.success).toBe(true)
    })

    it("rejects missing id", () => {
      const result = CardSchema.safeParse({
        order: 0,
        pattern: "bullets",
      })
      expect(result.success).toBe(false)
    })

    it("deserializes stringified table, figures, and sourceIds", () => {
      const result = CardSchema.safeParse({
        id: "c1",
        order: 0,
        pattern: "bullets-table",
        table: JSON.stringify({ hasHeader: true, caption: "Test", rows: [["A", "B"]] }),
        figures: JSON.stringify([{ id: "f1", url: "http://example.com/fig.png" }]),
        sourceIds: JSON.stringify(["src-1", "src-2"]),
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.table).toEqual({ hasHeader: true, caption: "Test", rows: [["A", "B"]] })
        expect(result.data.figures).toEqual([{ id: "f1", url: "http://example.com/fig.png" }])
        expect(result.data.sourceIds).toEqual(["src-1", "src-2"])
      }
    })
  })

  describe("WorkspaceCreateSchema", () => {
    it("accepts valid create payload", () => {
      const result = WorkspaceCreateSchema.safeParse({ id: "ws-1", name: "Test" })
      expect(result.success).toBe(true)
    })

    it("rejects invalid id", () => {
      const result = WorkspaceCreateSchema.safeParse({ id: "bad id!", name: "Test" })
      expect(result.success).toBe(false)
    })

    it("rejects short id", () => {
      const result = WorkspaceCreateSchema.safeParse({ id: "ab", name: "Test" })
      expect(result.success).toBe(false)
    })

    it("rejects missing name", () => {
      const result = WorkspaceCreateSchema.safeParse({ id: "ws-1" })
      expect(result.success).toBe(false)
    })

    it("defaults outputType to poster", () => {
      const result = WorkspaceCreateSchema.safeParse({ id: "ws-1", name: "Test" })
      if (result.success) {
        expect(result.data.outputType).toBe("poster")
      }
    })
  })
})
