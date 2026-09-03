import { describe, it, expect, beforeEach } from "vitest"
import { useThesisReviewStore } from "@/components/thesis-review/use-thesis-review-store"
import { extractSmartThesisMetadata } from "@/components/thesis-review/thesis-metadata-panel"

describe("Thesis Workflow UI & Store Integration Tests", () => {
  beforeEach(() => {
    useThesisReviewStore.setState({
      reviews: [],
      activeReview: null,
      sourceMarkdown: "",
      isLoadingSource: false,
      isGenerating: false,
      isMetadataValid: false,
      formMetadata: {
        studentName: "",
        thesisTitle: "",
        thesisType: "master",
        reviewerRole: "opponent",
        reviewerName: "",
        institution: "Slovenská technická univerzita v Bratislave",
        department: "FIIT",
        language: "sk",
        academicYear: "2025/2026",
        reviewKind: "thesis",
        targetVenue: "",
        reportingStandard: "none",
      },
      confidentialityAgreed: true,
      skipCitationAudit: false,
      selectedFileId: "",
    })
  })

  it("updates formMetadata and automatically recalculates isMetadataValid", () => {
    const store = useThesisReviewStore.getState()
    expect(store.isMetadataValid).toBe(false)

    // Fill title
    store.updateFormMetadata({ thesisTitle: "Detekcia zraniteľností v smart kontraktoch" })
    expect(useThesisReviewStore.getState().isMetadataValid).toBe(false)

    // Fill student name
    store.updateFormMetadata({ studentName: "Bc. Peter Novák" })
    expect(useThesisReviewStore.getState().isMetadataValid).toBe(true)

    // Uncheck confidentiality agreement
    store.setConfidentialityAgreed(false)
    expect(useThesisReviewStore.getState().isMetadataValid).toBe(false)

    // Re-check confidentiality agreement
    store.setConfidentialityAgreed(true)
    expect(useThesisReviewStore.getState().isMetadataValid).toBe(true)
  })

  it("extracts smart thesis metadata from manuscript front matter text", () => {
    const sampleText = `# SLOVENSKÁ TECHNICKÁ UNIVERZITA V BRATISLAVE
## Fakulta informatiky a informačných technológií
### Názov práce: Optimalizácia distribuovaných databázových systémov
### Autor: Bc. Lucia Vargová
### Vedúci práce: doc. Ing. Peter Kováč, PhD.
### Diplomová práca
Bratislava, máj 2026`

    const extracted = extractSmartThesisMetadata(sampleText, "vargova_diplomovka.pdf")
    expect(extracted.title).toBe("Optimalizácia distribuovaných databázových systémov")
    expect(extracted.studentName).toContain("Lucia Vargová")
    expect(extracted.thesisType).toBe("master")
    expect(extracted.reviewerName).toContain("Peter Kováč")
  })

  it("never picks section labels like Contents/Abstract as the thesis title", () => {
    // English MinerU output: first ATX heading is the TOC page "Contents".
    const enText = [
      "# Contents",
      "",
      "1 Introduction 1",
      "2 Methods 5",
      "",
      "# The distribution function of bosons momentum in a moving system",
      "",
      "## Abstract",
      "We study two identical bosons…",
    ].join("\n")
    const en = extractSmartThesisMetadata(enText, "Contents.pdf")
    expect(en.title).not.toMatch(/^contents$/i)
    expect(en.title).toContain("distribution function of bosons")

    // Junk filename + junk heading must not yield a junk title.
    const sk = extractSmartThesisMetadata("# Obsah\n\nÚvod … 1\n", "Contents.pdf")
    expect(sk.title).not.toMatch(/^obsah$/i)
    expect(sk.title).not.toMatch(/^contents$/i)
  })

  it("manages generation options independently from thesis metadata", () => {
    const store = useThesisReviewStore.getState()
    expect(store.skipCitationAudit).toBe(false)

    store.setSkipCitationAudit(true)
    expect(useThesisReviewStore.getState().skipCitationAudit).toBe(true)

    store.setSelectedFileId("doc-abc-123")
    expect(useThesisReviewStore.getState().selectedFileId).toBe("doc-abc-123")
  })

  it("toggles and tracks active reviews and source markdown", () => {
    const store = useThesisReviewStore.getState()
    const mockReview: any = {
      id: "rev-test-1",
      studentName: "Ján Novák",
      thesisTitle: "Neurónové siete",
      thesisType: "master",
      reviewerRole: "opponent",
      sections: [],
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    store.setActiveReview(mockReview)
    expect(useThesisReviewStore.getState().activeReview?.id).toBe("rev-test-1")

    store.setActiveReview(null)
    expect(useThesisReviewStore.getState().activeReview).toBeNull()
  })
})
