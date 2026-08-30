/**
 * Regression test for DOCX generator: confidential comments separation.
 *
 * Bug: generateThesisReviewDocx accepted `includeConfidential` option but never
 * wrote review.confidentialComments to the document body — confidential text was
 * silently dropped even when explicitly requested.
 *
 * Fix: lib/docx/generator-review.ts now appends a red-labelled confidential
 * section when options.includeConfidential === true and confidentialComments is non-empty.
 */

import { describe, it, expect } from "vitest"
import JSZip from "jszip"
import { generateThesisReviewDocx } from "@/lib/docx/generator-review"
import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"

const CONFIDENTIAL_TEXT = "DÔVERNÉ: Kandidát má slabé písomné vyjadrovanie."

const mockReview: ThesisReviewRecord = {
  id: "test-docx-regression-01",
  studentName: "Martin Kováč",
  thesisTitle: "Analýza distribuovaných systémov",
  thesisType: "master",
  reviewKind: "thesis",
  reviewerRole: "supervisor",
  reviewerName: "Prof. Jana Nováková",
  institution: "FIT CVUT",
  department: "Katedra informatiky",
  language: "sk",
  status: "draft",
  grade: "B",
  recommendation: "Odporúčam",
  summary: "Práca spĺňa požiadavky na záverečnú prácu.",
  strengths: ["Dobrá experimentálna časť"],
  findings: [],
  sections: [],
  defenseQuestions: ["Aká je časová zložitosť vášho algoritmu?"],
  citationIssues: [],
  reportingStandard: "none",
  reportingGuidelineChecks: [],
  suggestedGrade: "B",
  finalGrade: "A",
  suggestedRecommendation: "accept_minor",
  finalRecommendation: "accept",
  confirmedAt: new Date().toISOString(),
  confidentialComments: CONFIDENTIAL_TEXT,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

async function getDocXml(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer())
  const zip = await JSZip.loadAsync(buffer)
  return zip.files["word/document.xml"].async("string")
}

async function getZipEntries(blob: Blob): Promise<string[]> {
  const buffer = Buffer.from(await blob.arrayBuffer())
  const zip = await JSZip.loadAsync(buffer)
  return Object.keys(zip.files)
}

describe("DOCX generator — confidential comments separation (regression)", () => {
  it("does NOT include confidentialComments in default export (includeConfidential=false)", async () => {
    const blob = await generateThesisReviewDocx(mockReview, { includeConfidential: false })
    const xml = await getDocXml(blob)
    expect(xml).not.toContain(CONFIDENTIAL_TEXT)
    expect(xml).not.toContain("DÔVERNÉ")
  })

  it("includes confidentialComments section when includeConfidential=true", async () => {
    const blob = await generateThesisReviewDocx(mockReview, { includeConfidential: true })
    const xml = await getDocXml(blob)
    expect(xml).toContain(CONFIDENTIAL_TEXT)
    expect(xml).toContain("DÔVERNÉ")
  })

  it("marks confidential section with CC0000 red color and warning label", async () => {
    const blob = await generateThesisReviewDocx(mockReview, { includeConfidential: true })
    const xml = await getDocXml(blob)
    // The confidential label uses TextRun with color CC0000
    expect(xml).toContain("CC0000")
    expect(xml).toContain("Nesprístupňovať")
  })

  it("produces a valid DOCX ZIP with all required OOXML relationships", async () => {
    const blob = await generateThesisReviewDocx(mockReview)
    const entries = await getZipEntries(blob)

    const required = [
      "[Content_Types].xml",
      "_rels/.rels",
      "word/document.xml",
      "word/_rels/document.xml.rels",
      "word/styles.xml",
    ]
    for (const r of required) {
      expect(entries, `Missing required OOXML entry: ${r}`).toContain(r)
    }
  })

  it("includes wordprocessingml namespace in Content-Types", async () => {
    const blob = await generateThesisReviewDocx(mockReview)
    const buffer = Buffer.from(await blob.arrayBuffer())
    const zip = await JSZip.loadAsync(buffer)
    const ctXml = await zip.files["[Content_Types].xml"].async("string")
    expect(ctXml).toContain("wordprocessingml")
  })

  it("does NOT include confidential when omitted (no option passed)", async () => {
    const blob = await generateThesisReviewDocx(mockReview)
    const xml = await getDocXml(blob)
    expect(xml).not.toContain(CONFIDENTIAL_TEXT)
  })
})
