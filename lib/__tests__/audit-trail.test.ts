import { describe, it, expect } from "vitest"
import { createAuditLogEntry, verifyAuditChain } from "@/lib/audit/audit-trail"

describe("Academic Audit Trail Engine", () => {
  it("creates valid cryptographic audit entries in a verifiable chain", () => {
    const entry1 = createAuditLogEntry(
      "ws-1",
      "rev-1",
      "AI_GENERATION",
      { name: "Docent Kováč", role: "opponent" },
      { model: "gemini-3-flash", temperature: 0.1 }
    )

    const entry2 = createAuditLogEntry(
      "ws-1",
      "rev-1",
      "MANUAL_GRADE_OVERRIDE",
      { name: "Docent Kováč", role: "opponent" },
      { oldGrade: "B", newGrade: "A", rationale: "Mimoriadna kvalita praktickej časti" },
      entry1.entryHash
    )

    const entry3 = createAuditLogEntry(
      "ws-1",
      "rev-1",
      "DECISION_CONFIRMATION",
      { name: "Docent Kováč", role: "opponent" },
      { confirmedGrade: "A", recommendation: "Odporúčam na obhajobu" },
      entry2.entryHash
    )

    expect(verifyAuditChain([entry1, entry2, entry3])).toBe(true)
  })

  it("detects tampered audit entries and breaks chain verification", () => {
    const entry1 = createAuditLogEntry(
      "ws-1",
      "rev-1",
      "AI_GENERATION",
      { name: "Oponent" },
      { model: "gemini-3-flash" }
    )

    const entry2 = createAuditLogEntry(
      "ws-1",
      "rev-1",
      "MANUAL_GRADE_OVERRIDE",
      { name: "Oponent" },
      { oldGrade: "B", newGrade: "A" },
      entry1.entryHash
    )

    // Tamper with payload details in entry2
    const tamperedEntry2 = {
      ...entry2,
      details: { oldGrade: "B", newGrade: "FX" }, // Tampered
    }

    expect(verifyAuditChain([entry1, tamperedEntry2])).toBe(false)
  })
})
