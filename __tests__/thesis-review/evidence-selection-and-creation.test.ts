import { describe, it, expect } from "vitest"
import {
  parseInlineMath,
  parseTableFromText,
  formatPreviewSnippet,
} from "@/components/thesis-review/evidence-quote-viewer"
import { stripLatexForPlainText } from "@/lib/thesis-review/latex-utils"
import { generateThesisReviewLatex } from "@/lib/latex/generator-thesis-review"
import { generateThesisReviewDocx } from "@/lib/docx/generator-review"
import { computeScoreFromFindings } from "@/lib/ai/review-engine"
import type { ReviewFinding } from "@/lib/ai/review-types"
import JSZip from "jszip"

describe("Evidence Selection, Math Typesetting & Finding Creation Workflow", () => {
  // Realistic multi-line fit parameter table from Chapter 5 of Astaloš's PhD thesis
  const astalosFitTableSelection = [
    "fit    Gaussian    Exponential    Lévy",
    "$\\alpha$    $\\equiv 2$    $\\equiv 1$    $0.81 \\pm 0.01 \\pm 0.18$",
    "$C_0$    $0.9778 \\pm 0.0002$    $0.9740 \\pm 0.0002$    $0.9725 \\pm 0.0003$",
    "$\\lambda$    $0.302 \\pm 0.002 \\pm 0.019$    $0.701 \\pm 0.006 \\pm 0.067$    $1.016 \\pm 0.030 \\pm 0.407$",
    "$R$ [fm]    $1.046 \\pm 0.005 \\pm 0.114$    $2.021 \\pm 0.012 \\pm 0.281$    $2.960 \\pm 0.094 \\pm 1.309$",
    "$\\chi^2/\\text{ndf}$    $5932 / 95$    $1963 / 95$    $1755 / 94$",
  ].join("\n")

  describe("1. Floating Selection Bar & Math Parsing", () => {
    it("detects selected table fragment and parses structured rows and headers", () => {
      const tableData = parseTableFromText(astalosFitTableSelection)
      expect(tableData).not.toBeNull()
      expect(tableData?.headers).toEqual(["fit", "Gaussian", "Exponential", "Lévy"])
      expect(tableData?.rows).toHaveLength(5)

      // Row 0: Alpha parameters
      expect(tableData?.rows[0][0]).toBe("$\\alpha$")
      expect(tableData?.rows[0][1]).toBe("$\\equiv 2$")
      expect(tableData?.rows[0][2]).toBe("$\\equiv 1$")
      expect(tableData?.rows[0][3]).toBe("$0.81 \\pm 0.01 \\pm 0.18$")

      // Row 4: Chi2/ndf
      expect(tableData?.rows[4][0]).toBe("$\\chi^2/\\text{ndf}$")
      expect(tableData?.rows[4][3]).toBe("$1755 / 94$")
    })

    it("formats a balanced preview snippet without cutting inside KaTeX delimiters", () => {
      const { snippet, isTruncated } = formatPreviewSnippet(astalosFitTableSelection, 95)
      expect(isTruncated).toBe(true)

      // Dollar count must be balanced (even number of $)
      const dollarCount = (snippet.match(/(?<!\\)\$/g) || []).length
      expect(dollarCount % 2).toBe(0)

      // Inline math can be parsed without throwing
      const mathParts = parseInlineMath(snippet)
      expect(mathParts.length).toBeGreaterThan(1)
      expect(mathParts.some((p) => p.kind === "math")).toBe(true)
    })
  })

  describe("2. Finding Creation with Table Evidence", () => {
    it("creates a valid ReviewFinding with rendered table evidence and pre-filled section heading", () => {
      const heading = "5.1 Entire sample"
      const prefilledTitle = heading ? `Pripomienka k sekcii: ${heading}` : "Odborná pripomienka k vybranému textu"

      const finding: ReviewFinding = {
        id: "custom-finding-1",
        criterionId: "analytical_execution",
        category: "results",
        title: prefilledTitle,
        explanation: "Lévyho fit vykazuje signifikantne nižšie chi2/ndf (1755/94) v porovnaní s Gaussovským modelom (5932/95).",
        recommendation: "Diskutovať fyzikálnu interpretáciu Lévyho parametra stability alpha = 0.81.",
        severity: "minor",
        confidence: 1.0,
        status: "accepted",
        includeInExport: true,
        createdBy: "reviewer",
        evidence: [
          {
            quote: astalosFitTableSelection,
            sectionHeading: heading,
            verified: true,
            state: "verified-exact",
          },
        ],
      }

      expect(finding.title).toBe("Pripomienka k sekcii: 5.1 Entire sample")
      expect(finding.evidence[0].quote).toContain("$\\chi^2/\\text{ndf}$")

      // Calculating score correctly deducts -2 for substantive minor finding
      const score = computeScoreFromFindings([finding])
      expect(score).toBe(98)
    })
  })

  describe("3. Multi-Format Export with Math & Table Evidence", () => {
    const customFinding: ReviewFinding = {
      id: "f-table-export",
      criterionId: "analytical_execution",
      category: "results",
      title: "Pripomienka k sekcii: 5.1 Entire sample",
      explanation: "Lévyho model poskytuje lepší opis dát.",
      recommendation: "Doplniť teoretické zdôvodnenie.",
      severity: "major",
      confidence: 1.0,
      status: "accepted",
      includeInExport: true,
      createdBy: "reviewer",
      evidence: [
        {
          quote: astalosFitTableSelection,
          sectionHeading: "5.1 Entire sample",
          verified: true,
          state: "verified-exact",
        },
      ],
    }

    const reviewRecord = {
      id: "rev-export-test",
      studentName: "Róbert Astaloš",
      thesisTitle: "Bose-Einstein correlations in 7 TeV pp collisions",
      thesisType: "phd" as const,
      reviewerRole: "opponent",
      reviewerName: "prof. RNDr. Peter Prešnajder, DrSc.",
      institution: "Univerzita Komenského v Bratislave",
      department: "Katedra teoretickej fyziky",
      grade: "A",
      recommendation: "Prácu jednoznačne odporúčam na obhajobu.",
      summary: "Dizertačná práca sa zaoberá meraním dvojčasticových Bose-Einsteinových korelácií na detektore ATLAS.",
      strengths: ["Veľký rozsah experimentálnej analýzy", "Dôsledná systematika"],
      findings: [customFinding],
      sections: [],
      defenseQuestions: ["Ako vplýva voľba referenčnej vzorky na hodnotu polomeru R?"],
      citationIssues: [],
      language: "sk",
      template: "posudok-sk" as const,
      includeConfidential: false,
    }

    it("exports DOCX with evidence converted to readable Unicode (no raw LaTeX commands)", async () => {
      const blob = await generateThesisReviewDocx(reviewRecord as any)
      const ab = await blob.arrayBuffer()
      const zip = await JSZip.loadAsync(ab)
      const docXml = await zip.file("word/document.xml")!.async("string")

      // Must contain author and thesis metadata
      expect(docXml).toContain("Róbert Astaloš")
      expect(docXml).toContain("Bose-Einstein correlations")

      // Must contain Unicode-rendered mathematical symbols
      expect(docXml).toContain("α")
      expect(docXml).toContain("±")
      expect(docXml).toContain("λ")
      expect(docXml).toContain("χ^2/ndf")

      // Must NOT contain unrendered LaTeX markup in plain text
      expect(docXml).not.toContain("$\\alpha$")
      expect(docXml).not.toContain("\\text{ndf}")
    })

    it("exports LaTeX with math and multi-line evidence properly typeset", () => {
      const tex = generateThesisReviewLatex(reviewRecord as any)

      // Document structure
      expect(tex).toContain("\\begin{document}")
      expect(tex).toContain("Róbert Astaloš")
      expect(tex).toContain("1. Zhrnutie práce a hlavný prínos")
      expect(tex).toContain("2. Silné stránky práce")
      expect(tex).toContain("3. Zásadné pripomienky (Major Concerns)")
      expect(tex).toContain("[RESULTS] Pripomienka k sekcii: 5.1 Entire sample")

      // LaTeX must keep math delimiters intact for KaTeX / pdfLaTeX compilation
      expect(tex).toContain("$\\alpha$")
      expect(tex).toContain("$0.81 \\pm 0.01 \\pm 0.18$")
      expect(tex).toContain("Dôkaz v texte:")

      // Defense questions
      expect(tex).toContain("Ako vplýva voľba referenčnej vzorky")
      expect(tex).toContain("\\end{document}")
    })
  })
})
