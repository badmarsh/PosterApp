import { describe, it, expect } from "vitest"
import JSZip from "jszip"
import { generateThesisReviewDocx } from "@/lib/docx/generator-review"
import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"

describe("DOCX OpenXML Structural Integrity", () => {
  const sampleReview: ThesisReviewRecord = {
    id: "rev-docx-1",
    studentName: "Mária Šrámková",
    thesisTitle: "Neurónové architektúry pre spracovanie reči",
    thesisType: "master",
    reviewerRole: "opponent",
    reviewerName: "prof. Ing. Ivan Králik, DrSc.",
    institution: "Technická univerzita",
    department: "Katedra kybernetiky",
    grade: "A",
    recommendation: "Prácu odporúčam na obhajobu.",
    summary: "Diplomová práca sa zaoberá modernými transformerovými modelmi v rečových technológiách.",
    strengths: ["Dôkladná teoretická analýza", "Kvalitné experimentálne výsledky na slovenskom korpuse"],
    findings: [
      {
        id: "f1",
        category: "methodology",
        title: "Chýbajúca normalizácia audio signálu",
        explanation: "V kapitole 4.1 nie je špecifikovaná vzorkovacia frekvencia ani normalizácia hlasitosti.",
        recommendation: "Doplniť informáciu o 16 kHz resamplingu.",
        severity: "major",
        confidence: 0.92,
        evidence: [{ quote: "zvukové nahrávky boli použité v pôvodnom stave", verified: true }],
        status: "accepted",
        createdBy: "ai",
        includeInExport: true,
      },
    ],
    reportingStandard: "none",
    reportingGuidelineChecks: [],
    defenseQuestions: ["Aký vplyv mal okolitý hluk na presnosť modelu?"],
    sections: [],
    citationIssues: [],
    status: "draft",
    language: "sk",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  it("generates a valid ZIP container with PK header and required OpenXML files", async () => {
    const blob = await generateThesisReviewDocx(sampleReview)
    expect(blob).toBeTruthy()
    expect(blob.size).toBeGreaterThan(1000)

    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Check PK ZIP Header (\x50\x4B\x03\x04)
    expect(buffer[0]).toBe(0x50)
    expect(buffer[1]).toBe(0x4b)
    expect(buffer[2]).toBe(0x03)
    expect(buffer[3]).toBe(0x04)

    // Unzip and inspect package structure
    const zip = await JSZip.loadAsync(buffer)

    // Mandatory OpenXML package parts
    expect(zip.file("[Content_Types].xml")).toBeTruthy()
    expect(zip.file("_rels/.rels")).toBeTruthy()
    expect(zip.file("word/document.xml")).toBeTruthy()

    // Read word/document.xml content
    const documentXml = await zip.file("word/document.xml")!.async("text")
    expect(documentXml).toContain("Mária Šrámková")
    expect(documentXml).toContain("Neurónové architektúry pre spracovanie reči")
    expect(documentXml).toContain("Chýbajúca normalizácia audio signálu")
    expect(documentXml).toContain("Aký vplyv mal okolitý hluk na presnosť modelu?")
    expect(documentXml).toContain("prof. Ing. Ivan Králik, DrSc.")
  })

  it("anonymizes reviewer details when anonymize: true option is set", async () => {
    const blob = await generateThesisReviewDocx(sampleReview, { anonymize: true })
    const arrayBuffer = await blob.arrayBuffer()
    const zip = await JSZip.loadAsync(Buffer.from(arrayBuffer))
    const documentXml = await zip.file("word/document.xml")!.async("text")

    expect(documentXml).not.toContain("Ivan Králik")
  })
})
