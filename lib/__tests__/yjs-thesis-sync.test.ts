import { describe, it, expect } from "vitest"
import * as Y from "yjs"
import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"

describe("Yjs Multi-Client Thesis Review Synchronization", () => {
  it("determinstically synchronizes updates between Client A and Client B and resolves offline edits", () => {
    // 1. Client A and Client B create separate YDocs
    const docA = new Y.Doc()
    const docB = new Y.Doc()

    const mapA = docA.getMap<string>("thesisReviews")
    const mapB = docB.getMap<string>("thesisReviews")

    const initialReview: ThesisReviewRecord = {
      id: "rev-sync-1",
      studentName: "Marek",
      thesisTitle: "Distribuované systémy",
      thesisType: "master",
      reviewerRole: "opponent",
      grade: "B",
      recommendation: "Odporúčam",
      sections: [],
      defenseQuestions: [],
      citationIssues: [],
      reviewKind: "thesis",
      findings: [
        {
          id: "f1",
          category: "methodology",
          title: "Initial Title",
          explanation: "Initial explanation",
          recommendation: "Initial recommendation",
          severity: "minor",
          confidence: 0.9,
          evidence: [],
          status: "unreviewed",
          createdBy: "ai",
          includeInExport: true,
        },
      ],
      reportingStandard: "none",
      reportingGuidelineChecks: [],
      status: "draft",
      language: "sk",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Client A initializes the review
    mapA.set(initialReview.id, JSON.stringify(initialReview))

    // Sync A -> B
    const updateA1 = Y.encodeStateAsUpdate(docA)
    Y.applyUpdate(docB, updateA1)

    // B now has the review
    expect(mapB.has("rev-sync-1")).toBe(true)
    const reviewInB = JSON.parse(mapB.get("rev-sync-1")!) as ThesisReviewRecord
    expect(reviewInB.findings![0].title).toBe("Initial Title")

    // 2. Client A modifies finding title
    const updatedReviewA: ThesisReviewRecord = {
      ...initialReview,
      findings: [
        {
          ...initialReview.findings![0],
          title: "Edited by Reviewer A",
          status: "edited",
        },
      ],
    }
    mapA.set(initialReview.id, JSON.stringify(updatedReviewA))

    // Sync A -> B
    const updateA2 = Y.encodeStateAsUpdate(docA)
    Y.applyUpdate(docB, updateA2)

    const reviewInB2 = JSON.parse(mapB.get("rev-sync-1")!) as ThesisReviewRecord
    expect(reviewInB2.findings![0].title).toBe("Edited by Reviewer A")
    expect(reviewInB2.findings![0].status).toBe("edited")

    // 3. Client B accepts the finding
    const updatedReviewB: ThesisReviewRecord = {
      ...reviewInB2,
      findings: [
        {
          ...reviewInB2.findings![0],
          status: "accepted",
        },
      ],
    }
    mapB.set(initialReview.id, JSON.stringify(updatedReviewB))

    // Sync B -> A
    const updateB1 = Y.encodeStateAsUpdate(docB)
    Y.applyUpdate(docA, updateB1)

    const reviewInA2 = JSON.parse(mapA.get("rev-sync-1")!) as ThesisReviewRecord
    expect(reviewInA2.findings![0].status).toBe("accepted")

    // 4. Client A disconnects (does not receive updates for a while).
    // Client B makes a newer change: updates grade to "A"
    const newerReviewB: ThesisReviewRecord = {
      ...updatedReviewB,
      grade: "A",
    }
    mapB.set(initialReview.id, JSON.stringify(newerReviewB))

    // 5. Client A reconnects and receives the update
    const stateDiff = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA))
    Y.applyUpdate(docA, stateDiff)

    const reviewInAAfterReconnect = JSON.parse(mapA.get("rev-sync-1")!) as ThesisReviewRecord
    expect(reviewInAAfterReconnect.grade).toBe("A")
    expect(reviewInAAfterReconnect.findings![0].status).toBe("accepted")

    // Cleanup
    docA.destroy()
    docB.destroy()
  })

  it("verifies thesis reviews and bibliography use isolated namespaces in Yjs", () => {
    const doc = new Y.Doc()
    const thesisMap = doc.getMap("thesisReviews")
    const outputsMap = doc.getMap("outputs")

    thesisMap.set("rev-1", JSON.stringify({ id: "rev-1", type: "review" }))
    expect(outputsMap.has("rev-1")).toBe(false)
    expect(thesisMap.has("rev-1")).toBe(true)

    doc.destroy()
  })
})
