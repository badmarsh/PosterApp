import { describe, it, expect } from "vitest"
import * as Y from "yjs"
import {
  hydrateReviewIntoYDoc,
  updateFindingInYDoc,
  updateDecisionInYDoc,
  extractReviewFromYDoc,
  getGranularReviewStructure,
} from "@/lib/ai/yjs-granular-sync"
import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"

describe("Granular Multi-Client Yjs Synchronization", () => {
  const sampleReview: ThesisReviewRecord = {
    id: "rev-collab-1",
    studentName: "Samuel Horváth",
    thesisTitle: "Distribuované systémy a CRDT",
    thesisType: "master",
    reviewerRole: "opponent",
    grade: "B",
    suggestedGrade: "B",
    finalGrade: null,
    recommendation: "Odporúčam",
    suggestedRecommendation: "Odporúčam",
    finalRecommendation: null,
    summary: "Diplomová práca analyzuje replikáciu stavu v kolaboratívnych systémoch.",
    strengths: ["Dôkladný teoretický rozbor"],
    findings: [
      {
        id: "f-x",
        category: "methodology",
        title: "Finding X: Otázka konvergencie",
        explanation: "Chýba formálny dôkaz kauzality.",
        recommendation: "Doplniť dôkaz.",
        severity: "major",
        confidence: 0.9,
        evidence: [],
        status: "unreviewed",
        includeInExport: true,
        createdBy: "ai",
      },
      {
        id: "f-y",
        category: "results",
        title: "Finding Y: Latencia synchronizácie",
        explanation: "Merania prebehli iba na lokálnej sieti.",
        recommendation: "Otestovať WAN prostredie.",
        severity: "minor",
        confidence: 0.85,
        evidence: [],
        status: "unreviewed",
        includeInExport: true,
        createdBy: "ai",
      },
    ],
    reportingStandard: "none",
    reportingGuidelineChecks: [],
    defenseQuestions: [],
    citationIssues: [],
    sections: [],
    confirmedAt: null,
    status: "draft",
    language: "sk",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Helper to sync two docs bidirectionally via binary update exchange
  function syncDocs(docA: Y.Doc, docB: Y.Doc) {
    const updateA = Y.encodeStateAsUpdate(docA)
    const updateB = Y.encodeStateAsUpdate(docB)
    Y.applyUpdate(docB, updateA)
    Y.applyUpdate(docA, updateB)
  }

  it("executes full 12-step multi-client concurrency and reconnection lifecycle", () => {
    // 1. Client A and Client B load the same review into independent Y.Docs
    const docA = new Y.Doc()
    const docB = new Y.Doc()

    hydrateReviewIntoYDoc(docA, sampleReview, "client-a-init")
    syncDocs(docA, docB)

    const revA1 = extractReviewFromYDoc(docA, sampleReview.id, sampleReview)
    const revB1 = extractReviewFromYDoc(docB, sampleReview.id, sampleReview)
    expect(revA1.findings).toHaveLength(2)
    expect(revB1.findings).toHaveLength(2)

    // 2. Client A edits reviewer text of finding X
    const findingX = { ...(revA1.findings ?? []).find((f) => f.id === "f-x")!, reviewerNotes: "Poznámka od recenzenta A" }
    updateFindingInYDoc(docA, sampleReview.id, findingX, "client-a")

    // 3. Client B concurrently edits status of finding Y to 'accepted'
    const findingY = { ...(revB1.findings ?? []).find((f) => f.id === "f-y")!, status: "accepted" as const }
    updateFindingInYDoc(docB, sampleReview.id, findingY, "client-b")

    // 4. Update sync: Both changes are retained without collision
    syncDocs(docA, docB)

    const revA2 = extractReviewFromYDoc(docA, sampleReview.id)
    const revB2 = extractReviewFromYDoc(docB, sampleReview.id)

    expect((revA2.findings ?? []).find((f) => f.id === "f-x")?.reviewerNotes).toBe("Poznámka od recenzenta A")
    expect((revA2.findings ?? []).find((f) => f.id === "f-y")?.status).toBe("accepted")
    expect((revB2.findings ?? []).find((f) => f.id === "f-x")?.reviewerNotes).toBe("Poznámka od recenzenta A")
    expect((revB2.findings ?? []).find((f) => f.id === "f-y")?.status).toBe("accepted")

    // 5. Client A updates decision to Grade A while Client B edits summary
    updateDecisionInYDoc(docA, sampleReview.id, { finalGrade: "A", confirmedAt: new Date().toISOString() }, "client-a")
    const { metadataMap: metaB } = getGranularReviewStructure(docB, sampleReview.id)
    metaB.set("summary", "Aktualizované zhrnutie od klienta B")

    // 6. Sync: Both independent fields remain
    syncDocs(docA, docB)

    const revA3 = extractReviewFromYDoc(docA, sampleReview.id)
    expect(revA3.finalGrade).toBe("A")
    expect(revA3.summary).toBe("Aktualizované zhrnutie od klienta B")

    // 7. Client A disconnects (we stop syncing updates to docA)
    // 8. Client B makes a newer change while A is offline
    const docBReview = extractReviewFromYDoc(docB, sampleReview.id)
    const findingXModifiedByB = {
      ...((docBReview.findings ?? []).find((f) => f.id === "f-x")!),
      severity: "critical" as const,
      recommendation: "Kritická oprava vyžadovaná komisiou",
    }
    updateFindingInYDoc(docB, sampleReview.id, findingXModifiedByB, "client-b")

    // 9. Client A reconnects and exchanges updates
    syncDocs(docA, docB)

    // 10. Newer change from B is correctly applied on A
    const revA4 = extractReviewFromYDoc(docA, sampleReview.id)
    expect((revA4.findings ?? []).find((f) => f.id === "f-x")?.severity).toBe("critical")
    expect((revA4.findings ?? []).find((f) => f.id === "f-x")?.recommendation).toBe("Kritická oprava vyžadovaná komisiou")

    // 11. Full state preserved cleanly after reload
    expect(revA4.finalGrade).toBe("A")
    expect(revA4.summary).toBe("Aktualizované zhrnutie od klienta B")
    expect(revA4.findings).toHaveLength(2)

    // 12. Cleanup
    docA.destroy()
    docB.destroy()
  })
})
