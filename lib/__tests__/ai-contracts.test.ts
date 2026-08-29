import { describe, it, expect } from "vitest"
import {
  LayoutWarningsSchema,
  ReviewTipsSchema,
  CardGenerationSchema,
  CompileFixesSchema,
  ShrinkContentSchema,
  StructureGenerationSchema,
  VisionCaptionSchema,
} from "../ai/contracts"

describe("lib/ai/contracts", () => {
  describe("LayoutWarningsSchema", () => {
    it("handles standard object format", () => {
      const res = LayoutWarningsSchema.safeParse({
        warnings: [
          {
            cardTitle: "Introduction",
            issue: "Text bleeding into footer",
            recommendation: "Reduce bullet count",
            estimatedOverflowCharacters: 40,
          },
        ],
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.warnings).toHaveLength(1)
        expect(res.data.warnings[0].cardTitle).toBe("Introduction")
        expect(res.data.warnings[0].estimatedOverflowCharacters).toBe(40)
      }
    })

    it("handles bare array responses from AI", () => {
      const res = LayoutWarningsSchema.safeParse([
        {
          cardTitle: "Methods",
          issue: "Image overflows column",
        },
      ])
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.warnings).toHaveLength(1)
        expect(res.data.warnings[0].cardTitle).toBe("Methods")
        expect(res.data.warnings[0].recommendation).toBe("Reduce content or adjust layout to fit.")
      }
    })

    it("handles alternative keys like 'issues' and string overflow numbers", () => {
      const res = LayoutWarningsSchema.safeParse({
        issues: [
          {
            title: "Results",
            description: "Table clipped at bottom",
            fix: "Shrink rows",
            overflowChars: "35 characters",
          },
        ],
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.warnings).toHaveLength(1)
        expect(res.data.warnings[0].cardTitle).toBe("Results")
        expect(res.data.warnings[0].issue).toBe("Table clipped at bottom")
        expect(res.data.warnings[0].recommendation).toBe("Shrink rows")
        expect(res.data.warnings[0].estimatedOverflowCharacters).toBe(35)
      }
    })

    it("handles empty object or empty array gracefully", () => {
      const res1 = LayoutWarningsSchema.safeParse({})
      expect(res1.success).toBe(true)
      if (res1.success) expect(res1.data.warnings).toEqual([])

      const res2 = LayoutWarningsSchema.safeParse([])
      expect(res2.success).toBe(true)
      if (res2.success) expect(res2.data.warnings).toEqual([])
    })
  })

  describe("ReviewTipsSchema", () => {
    it("handles bare array of tips", () => {
      const res = ReviewTipsSchema.safeParse([
        { severity: "warning", category: "citation", message: "Missing cite" },
      ])
      expect(res.success).toBe(true)
      if (res.success) expect(res.data.tips).toHaveLength(1)
    })

    it("gracefully catches unknown severity and category", () => {
      const res = ReviewTipsSchema.safeParse({
        tips: [{ severity: "critical", category: "spelling", message: "Fix spelling" }],
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.tips[0].severity).toBe("info")
        expect(res.data.tips[0].category).toBe("content")
      }
    })
  })

  describe("CardGenerationSchema", () => {
    it("handles alternative field names", () => {
      const res = CardGenerationSchema.safeParse({
        title: "Test Card",
        points: ["Point 1", "Point 2"],
        assets: [{ slot: "fig1", assetId: "ast_1" }],
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.bullets).toEqual(["Point 1", "Point 2"])
        expect(res.data.assignedAssets).toHaveLength(1)
      }
    })
  })

  describe("CompileFixesSchema", () => {
    it("handles bare array of patches", () => {
      const res = CompileFixesSchema.safeParse([
        { id: "c1", content: "fixed latex" },
      ])
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.patches).toHaveLength(1)
        expect(res.data.patches[0].id).toBe("c1")
      }
    })
  })

  describe("ShrinkContentSchema", () => {
    it("handles plain string and object shapes", () => {
      const res1 = ShrinkContentSchema.safeParse("shrunk text")
      expect(res1.success).toBe(true)
      if (res1.success) expect(res1.data.content).toBe("shrunk text")

      const res2 = ShrinkContentSchema.safeParse({ text: "shrunk text 2" })
      expect(res2.success).toBe(true)
      if (res2.success) expect(res2.data.content).toBe("shrunk text 2")
    })
  })

  describe("StructureGenerationSchema", () => {
    it("handles bare array and maps unknown patterns safely", () => {
      const res = StructureGenerationSchema.safeParse([
        { title: "Intro", pattern: "bullets" },
        { title: "Unknown", pattern: "exotic-pattern" },
      ])
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.cards).toHaveLength(2)
        expect(res.data.cards[0].pattern).toBe("bullets")
        expect(res.data.cards[1].pattern).toBe("bullets")
      }
    })
  })

  describe("VisionCaptionSchema", () => {
    it("handles partial fields", () => {
      const res = VisionCaptionSchema.safeParse({ caption: "An image plot" })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.originalCaption).toBe("An image plot")
      }
    })
  })
})
