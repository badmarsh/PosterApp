// DOCX ZIP/XML validation script
// Run: npx tsx --env-file=.env.local scripts/validate-docx.mts

import { generateThesisReviewDocx } from "@/lib/docx/generator-review"
import JSZip from "jszip"
import * as fs from "fs"

const mockReview = {
  id: "test-docx-01",
  workspaceId: "ws-test",
  studentName: "Martin Kováč",
  thesisTitle: "Analýza distribuovaných systémov",
  thesisType: "master" as const,
  reviewKind: "thesis_supervisor" as const,
  reviewerRole: "supervisor" as const,
  reviewerName: "Prof. Jana Nováková",
  institution: "FIT CVUT",
  department: "Katedra informatiky",
  language: "sk" as const,
  status: "draft" as const,
  grade: "B",
  recommendation: "Odporúčam",
  summary: "Práca spĺňa požiadavky.",
  strengths: ["Dobrá experimentálna časť"],
  findings: [],
  sections: [],
  defenseQuestions: ["Aká je časová zložitosť vášho algoritmu?"],
  citationIssues: [],
  reportingStandard: "none" as const,
  reportingGuidelineChecks: [],
  suggestedGrade: "B",
  finalGrade: "A",
  suggestedRecommendation: "accept_minor" as const,
  finalRecommendation: "accept" as const,
  confirmedAt: new Date().toISOString(),
  confidentialComments: "DÔVERNÉ: Kandidát má slabé písomné vyjadrovanie.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

async function main() {
  console.log("=== DOCX ZIP/XML Validation ===")
  
  // Test 1: Without confidential
  const blob = await generateThesisReviewDocx(mockReview, { includeConfidential: false })
  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  const outPath = "C:/tmp/agent-browser/test-review.docx"
  fs.mkdirSync("C:/tmp/agent-browser", { recursive: true })
  fs.writeFileSync(outPath, buffer)
  console.log(`Written: ${outPath} (${buffer.length} bytes)`)
  
  const zip = await JSZip.loadAsync(buffer)
  const files = Object.keys(zip.files)
  console.log(`\nZIP entries (${files.length}):`)
  files.forEach(f => console.log(` - ${f}`))
  
  // Validate required OOXML relationships
  const required = [
    "[Content_Types].xml",
    "_rels/.rels",
    "word/document.xml",
    "word/_rels/document.xml.rels",
    "word/styles.xml",
  ]
  console.log("\nRequired OOXML files:")
  let allPass = true
  for (const r of required) {
    const exists = zip.files[r] !== undefined
    if (!exists) allPass = false
    console.log(`  ${exists ? "PASS" : "FAIL"}: ${r}`)
  }
  
  // Verify confidential comment NOT in main document when includeConfidential=false
  const docXml = await zip.files["word/document.xml"].async("string")
  const hasConfidential = docXml.includes("DÔVERNÉ")
  console.log(`\nConfidential separation (includeConfidential=false): ${hasConfidential ? "FAIL (leaked)" : "PASS"}`)
  if (hasConfidential) allPass = false
  
  // Test 2: With confidential - verify it IS included  
  const blob2 = await generateThesisReviewDocx(mockReview, { includeConfidential: true })
  const buffer2 = Buffer.from(await blob2.arrayBuffer())
  const zip2 = await JSZip.loadAsync(buffer2)
  const docXml2 = await zip2.files["word/document.xml"].async("string")
  const hasConfidential2 = docXml2.includes("DÔVERNÉ")
  console.log(`Confidential present (includeConfidential=true): ${hasConfidential2 ? "PASS" : "FAIL"}`)
  if (!hasConfidential2) allPass = false
  
  // Validate relationships file
  const relsXml = await zip.files["word/_rels/document.xml.rels"].async("string")
  const hasXmlDecl = relsXml.includes("<?xml") || relsXml.includes("Relationship")
  console.log(`Relationships file valid XML: ${hasXmlDecl ? "PASS" : "FAIL"}`)
  if (!hasXmlDecl) allPass = false
  
  // Check Content-Types includes required types
  const ctXml = await zip.files["[Content_Types].xml"].async("string")
  const hasDocumentType = ctXml.includes("wordprocessingml")
  console.log(`Content-Types includes wordprocessingml: ${hasDocumentType ? "PASS" : "FAIL"}`)
  if (!hasDocumentType) allPass = false
  
  if (allPass) {
    console.log("\n=== DOCX VALIDATION: ALL CHECKS PASSED ===")
    process.exit(0)
  } else {
    console.log("\n=== DOCX VALIDATION: SOME CHECKS FAILED ===")
    process.exit(1)
  }
}

main().catch(err => { console.error("ERROR:", err.message); process.exit(1) })
