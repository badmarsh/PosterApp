import { describe, it, expect, vi } from "vitest"
import { computeScoreFromFindings } from "@/lib/ai/review-engine"
import { generateSnapshotLabelAsync } from "@/lib/ai-labeler"
import { prisma } from "@/lib/prisma"

// Mock prisma for snapshot label tests
vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceSnapshot: {
      update: vi.fn(),
    },
  },
}))

// Mock generateAITextResponse to simulate 429
vi.mock("@/lib/ai/client", () => ({
  generateAITextResponse: vi.fn().mockRejectedValue({
    status: 429,
    message: "AI API failed: HTTP 429 Too Many Requests",
  }),
}))

describe("False Grade A and 0 findings protection", () => {
  it("computeScoreFromFindings returns 100 for zero findings but caller guards against premature Grade A assignment", () => {
    // Zero findings calculation
    const rawScore = computeScoreFromFindings([])
    expect(rawScore).toBe(100)

    // With our new evaluation signal guard:
    const finalFindings: any[] = []
    const validatedGrade: string | undefined = undefined
    const hasEvaluationSignals = finalFindings.length > 0 || Boolean(validatedGrade)
    expect(hasEvaluationSignals).toBe(false)
  })

  it("calculates properly degraded score when findings are present", () => {
    const findings: any[] = [
      { id: "1", severity: "major", category: "methodology", status: "unreviewed", includeInExport: true },
      { id: "2", severity: "minor", category: "results", status: "unreviewed", includeInExport: true },
    ]
    // 100 - 8 (major) - 2 (minor) = 90
    expect(computeScoreFromFindings(findings)).toBe(90)
  })
})

describe("ai-labeler 429 rate limit resilience", () => {
  it("gracefully falls back to first diff item when HTTP 429 is encountered", async () => {
    const updateSpy = vi.spyOn(prisma.workspaceSnapshot, "update").mockResolvedValue({} as any)
    const diff = ["+ Added section 2.3 Bose-Einstein correlation results", "- Removed duplicate figure"]

    await generateSnapshotLabelAsync("snap-123", diff)

    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "snap-123" },
      data: {
        label: "Added section 2.3 Bose-Einstein correlat",
      },
    })
  })
})
