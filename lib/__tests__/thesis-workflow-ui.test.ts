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

  it("correctly identifies scientific paper manuscripts and does not misclassify author PhD degree as dissertation", () => {
    const paperText = [
      "# Boson probability function for the moving system",
      "Mgr. Robert Astaloš, PhD.",
      "Institute of Experimental Physics SAS, Watsonova 47, 040 01 Košice, Slovak Republic",
      "",
      "## Abstract",
      "The probability function of a system of identical bosons is analyzed.",
      "",
      "## 1. Introduction",
      "Correlations of identical particles in high-energy collisions provide valuable insights.",
      "",
      "## References",
      "[1] G. Goldhaber et al., Phys. Rev. 120, 300 (1960).",
    ].join("\n")

    const extracted = extractSmartThesisMetadata(paperText, "boson_probability.pdf")
    expect(extracted.title).toContain("Boson probability function")
    expect(extracted.studentName).toContain("Robert Astaloš")
    expect(extracted.reviewKind).toBe("paper")
    expect(extracted.reviewerRole).toBe("reviewer")

    // Verify select value mapping
    const selectedDocType = extracted.reviewKind === "paper" ? "article" : extracted.thesisType
    expect(selectedDocType).toBe("article")
  })

  it("extracts clean title, PhD thesis type, and reviewKind directly from filename like phd_tesis_...", () => {
    const filename = "phd_tesis_Bose-Einstein correlations in 7 TeV proton-proton collisions in the ATLAS experiment.pdf"
    
    // Even when text is completely empty, it pre-fills title, type (phd), and reviewKind
    const extracted = extractSmartThesisMetadata("", filename)
    expect(extracted.title).toBe("Bose-Einstein correlations in 7 TeV proton-proton collisions in the ATLAS experiment")
    expect(extracted.thesisType).toBe("phd")
    expect(extracted.reviewKind).toBe("thesis")

    // Verify UI select mapping
    const selectedDocType = extracted.reviewKind === "paper" ? "article" : extracted.thesisType
    expect(selectedDocType).toBe("phd")
  })

  it("extracts student name and title from Slovak academic abstract bibliographic record", () => {
    const kelovaText = [
      "# UNIVERZITA MATEJA BELA V BANSKEJ BYSTRICI FAKULTA PRÍRODNÝCH VIED",
      "",
      "# HODNOTENIE VO VÝUČBE CHÉMIE Záverečná práca",
      "",
      "Vedúci záverečnej práce: doc. RNDr. Jarmila Kmeťová, PhD., MBA",
      "",
      "Mgr. Margaréta Keľová",
      "",
      "## ABSTRAKT",
      "",
      "KEĽOVÁ, Margaréta: Hodnotenie vo výučbe chémie. [Záverečná práca] / Margaréta Keľová – Univerzita Mateja Bela v Banskej Bystrici. Fakulta prírodných vied; Katedra chémie.",
    ].join("\n")

    const extracted = extractSmartThesisMetadata(kelovaText, "ZAVERECNA_PRACA_KELOVA.pdf")
    expect(extracted.title).toBe("Hodnotenie vo výučbe chémie")
    expect(extracted.studentName).toBe("Margaréta Keľová")
    expect(extracted.reviewerName).toContain("Jarmila Kmeťová")
    expect(extracted.institution).toContain("Univerzita Mateja Bela")
  })

  it("handles generic 'PhD Thesis 2.pdf' without setting title to '2' and avoids matching 'several experiments' as author", () => {
    const phdText = [
      "# Contents",
      "",
      "1 Introduction 1",
      "2 Measurement 15",
      "",
      "# 1 Bose-Einstein correlations in 7 TeV proton-proton collisions in the ATLAS experiment",
      "",
      "Bose-Einstein correlations have been observed by several experiments in high-energy physics.",
      "The ATLAS detector at the Large Hadron Collider was used to measure correlation functions.",
    ].join("\n")

    const extracted = extractSmartThesisMetadata(phdText, "PhD Thesis 2.pdf")
    // Title must not be "2"
    expect(extracted.title).not.toBe("2")
    expect(extracted.title).toContain("Bose-Einstein correlations")
    // Must NOT match "several experiments" as student/author
    expect(extracted.studentName).not.toContain("several")
    expect(extracted.studentName).not.toContain("experiments")
    expect(extracted.thesisType).toBe("phd")
    expect(extracted.reviewKind).toBe("thesis")
  })

  it("blocks Slovak chemistry / Kelova metadata contamination when document is a physics paper or thesis", () => {
    // Leaked text from another file in cache
    const contaminatedText = [
      "Mgr. Margaréta Keľová",
      "Hodnotenie vo výučbe chémie. Záverečná práca.",
      "doc. RNDr. Jarmila Kmeťová, PhD.",
      "Bose-Einstein correlations in ATLAS",
    ].join("\n")

    const extracted = extractSmartThesisMetadata(contaminatedText, "PhD Thesis 2.pdf")
    // Must discard the Slovak chemistry author and title
    expect(extracted.studentName).not.toBe("Margaréta Keľová")
    expect(extracted.studentName).toBe("")
    expect(extracted.title).not.toContain("výučbe chémie")
  })

  it("extracts boson paper metadata correctly without assigning student name or misclassifying type", () => {
    const bosonText = [
      "# The distribution function of bosons momentum in a moving system",
      "",
      "We consider a system of identical bosons in relativistic heavy-ion collisions.",
      "The two-particle correlation function is analyzed with pT and eta cuts.",
    ].join("\n")

    const filename = "boson probability function for the moving system for 13 TeV 2026 including pT and eta cuts.pdf"
    const extracted = extractSmartThesisMetadata(bosonText, filename)
    expect(extracted.title).toContain("distribution function of bosons")
    expect(extracted.studentName).toBe("")
    expect(extracted.reviewKind).toBe("paper")
  })
})


