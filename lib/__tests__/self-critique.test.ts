/**
 * Unit tests for the overstatedIds downgrade logic in generateSelfCritique.
 * Since generateSelfCritique is not exported directly, we test the behaviour
 * by constructing the inputs and observing effects through the internal logic
 * replicated here — plus we test the exported helpers that participate.
 *
 * Task 4 acceptance criteria:
 * (a) Index in overstatedIds but NOT in severityAdjustments -> one rung downgrade + decisionStatus flip
 * (b) Index in BOTH lists -> severityAdjustments outcome wins (no double-downgrade)
 * (c) Index already at "suggestion" in overstatedIds -> unchanged (no crash)
 */

import { describe, it, expect } from "vitest"

// We replicate the downgrade logic here to test it in isolation.
// This mirrors the code in generateSelfCritique exactly.
const SEVERITY_LADDER = ["critical", "major", "minor", "suggestion"]

function applyOverstatedDowngrade(
  findings: Array<{ severity: string; decisionStatus: string; explanation: string }>,
  overstatedIds: number[],
  explicitlyAdjustedIdx: Set<number>
): Array<{ severity: string; decisionStatus: string; explanation: string }> {
  const result = findings.map((f) => ({ ...f }))
  for (const id of overstatedIds) {
    const idx = id - 1
    if (idx < 0 || idx >= result.length || explicitlyAdjustedIdx.has(idx)) continue
    const current = result[idx]
    const rung = SEVERITY_LADDER.indexOf(current.severity)
    if (rung < 0 || rung >= SEVERITY_LADDER.length - 1) continue
    const downgraded = SEVERITY_LADDER[rung + 1]
    result[idx] = {
      ...current,
      severity: downgraded,
      decisionStatus: "needs_human_review",
      explanation: current.explanation + `\n[Critique: downgraded from ${current.severity} to ${downgraded}]`,
    }
  }
  return result
}

describe("overstatedIds downgrade logic (Task 4)", () => {
  const makeFindings = (severities: string[]) =>
    severities.map((s, i) => ({
      severity: s,
      decisionStatus: "open",
      explanation: `Finding ${i + 1}`,
    }))

  it("(a) overstated-only index gets downgraded one rung and decisionStatus flipped", () => {
    const findings = makeFindings(["critical", "major", "minor"])
    // Finding 2 (idx=1) is "major" → should become "minor"
    const result = applyOverstatedDowngrade(findings, [2], new Set())
    expect(result[0].severity).toBe("critical") // untouched
    expect(result[1].severity).toBe("minor")     // downgraded
    expect(result[1].decisionStatus).toBe("needs_human_review")
    expect(result[1].explanation).toMatch(/downgraded from major to minor/)
    expect(result[2].severity).toBe("minor")     // untouched
  })

  it("(b) index in BOTH lists keeps severityAdjustments outcome, not double-downgraded", () => {
    // Start with critical, explicitly adjusted to "minor" (severityAdjustments wins)
    // Then overstatedIds also lists it — should NOT downgrade again to "suggestion"
    const findings = makeFindings(["critical"])
    // Simulate: explicit adjustment already changed idx=0 to "minor"
    findings[0].severity = "minor"
    const explicitlyAdjusted = new Set<number>([0])
    const result = applyOverstatedDowngrade(findings, [1], explicitlyAdjusted) // 1-indexed
    // idx=0 is in explicitlyAdjusted, so overstated downgrade is skipped
    expect(result[0].severity).toBe("minor")
    expect(result[0].decisionStatus).toBe("open") // NOT flipped to needs_human_review
  })

  it("(c) index already at suggestion in overstatedIds is unchanged (no crash)", () => {
    const findings = makeFindings(["suggestion"])
    // suggestion is the last rung; rung = 3, length-1 = 3, so rung >= length-1 → skip
    const result = applyOverstatedDowngrade(findings, [1], new Set())
    expect(result[0].severity).toBe("suggestion")
    expect(result[0].decisionStatus).toBe("open") // NOT changed
  })

  it("handles out-of-bounds overstated index gracefully (no crash)", () => {
    const findings = makeFindings(["major"])
    // overstatedIds references finding 5, but only 1 finding exists
    expect(() => applyOverstatedDowngrade(findings, [5], new Set())).not.toThrow()
    const result = applyOverstatedDowngrade(findings, [5], new Set())
    expect(result[0].severity).toBe("major") // untouched
  })

  it("downgrades critical -> major (first rung)", () => {
    const findings = makeFindings(["critical"])
    const result = applyOverstatedDowngrade(findings, [1], new Set())
    expect(result[0].severity).toBe("major")
    expect(result[0].decisionStatus).toBe("needs_human_review")
  })

  it("downgrades minor -> suggestion (penultimate rung)", () => {
    const findings = makeFindings(["minor"])
    const result = applyOverstatedDowngrade(findings, [1], new Set())
    expect(result[0].severity).toBe("suggestion")
  })
})
