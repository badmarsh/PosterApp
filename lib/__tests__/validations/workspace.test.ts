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
