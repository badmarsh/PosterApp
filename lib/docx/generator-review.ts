/**
 * DOCX Generator for Professional Peer Reviews and University Posudky.
 *
 * Generates beautifully formatted Microsoft Word (.docx) documents with:
 * - Institutional header table
 * - Executive summary & strengths
 * - Major vs. Minor structured findings
 * - Reporting guideline tables
 * - Defense questions
 * - Signature block
 */

import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  HeadingLevel,
  BorderStyle,
} from "docx"
import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"

export async function generateThesisReviewDocx(
  review: ThesisReviewRecord,
  options: { anonymize?: boolean; anonymizeReviewer?: boolean; includeConfidential?: boolean } = {}
): Promise<Blob> {
  const children: any[] = []
  const isAnonymized = Boolean(options.anonymize || options.anonymizeReviewer)

  // Document Main Header
  children.push(
    new Paragraph({
      text: review.reviewKind === "paper" ? "ODBORNÝ POSUDOK VEDECKÉHO ČLÁNKU" : "POSUDOK ZÁVEREČNEJ PRÁCE",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  )

  // Metadata Table
  const tableRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: "Názov práce / Title:", bold: true })] })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ text: review.thesisTitle })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Autor / Author:", bold: true })] })],
        }),
        new TableCell({
          children: [new Paragraph({ text: review.studentName })],
        }),
      ],
    }),
  ]

  if (isAnonymized) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Recenzent / Reviewer:", bold: true })] })],
          }),
          new TableCell({
            children: [
              new Paragraph({
                text: "Anonymný recenzent / Blind Reviewer",
              }),
            ],
          }),
        ],
      })
    )
  } else if (review.reviewerName) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Recenzent / Reviewer:", bold: true })] })],
          }),
          new TableCell({
            children: [
              new Paragraph({
                text: `${review.reviewerName} (${review.reviewerRole === "supervisor" ? "Vedúci práce" : "Oponent / Peer Reviewer"})`,
              }),
            ],
          }),
        ],
      })
    )
  }

  if (review.grade) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Klasifikácia / Grade:", bold: true })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: review.grade, bold: true })] })],
          }),
        ],
      })
    )
  }

  if (review.recommendation) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Záverečné odporúčanie:", bold: true })] })],
          }),
          new TableCell({
            children: [new Paragraph({ text: review.recommendation })],
          }),
        ],
      })
    )
  }

  children.push(
    new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  )

  children.push(new Paragraph({ text: "", spacing: { after: 300 } }))

  // Executive Summary
  if (review.summary) {
    children.push(
      new Paragraph({
        text: "1. Zhrnutie práce a hlavný prínos (Executive Summary)",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    )
    children.push(
      new Paragraph({
        text: review.summary,
        spacing: { after: 200 },
      })
    )
  }

  // Key Strengths
  if (review.strengths && review.strengths.length > 0) {
    children.push(
      new Paragraph({
        text: "2. Silné stránky práce (Key Strengths)",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    )
    for (const str of review.strengths) {
      children.push(
        new Paragraph({
          text: `• ${str}`,
          spacing: { after: 100 },
        })
      )
    }
  }

  // Structured Findings (Major vs. Minor)
  const findings = (review.findings || []).filter((f) => f.includeInExport && f.status !== "rejected")
  const majorFindings = findings.filter((f) => f.severity === "critical" || f.severity === "major")
  const minorFindings = findings.filter((f) => f.severity === "minor" || f.severity === "suggestion")

  if (majorFindings.length > 0) {
    children.push(
      new Paragraph({
        text: "3. Zásadné pripomienky (Major Concerns)",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    )
    for (const f of majorFindings) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${(f.category || "general").toUpperCase()}] ${f.title}`, bold: true }),
          ],
          spacing: { before: 150, after: 50 },
        })
      )
      children.push(
        new Paragraph({
          text: f.explanation,
          spacing: { after: 50 },
        })
      )
      if (f.recommendation) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Odporúčaná náprava: ", bold: true, italics: true }),
              new TextRun({ text: f.recommendation, italics: true }),
            ],
            spacing: { after: 50 },
          })
        )
      }
      if (f.reviewerNotes) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Poznámka recenzenta: ", bold: true }),
              new TextRun({ text: f.reviewerNotes }),
            ],
            spacing: { after: 50 },
          })
        )
      }
      if (f.evidence?.[0]?.quote) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Dôkaz v texte: "${f.evidence[0].quote}"`, italics: true, color: "555555" }),
            ],
            spacing: { after: 100 },
          })
        )
      }
    }
  }

  if (minorFindings.length > 0) {
    children.push(
      new Paragraph({
        text: "4. Drobné pripomienky (Minor Concerns)",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    )
    for (const f of minorFindings) {
      children.push(
        new Paragraph({
          text: `• [${f.category || "general"}] ${f.title}: ${f.explanation}`,
          spacing: { after: 80 },
        })
      )
    }
  }

  // Criteria Sections (for standard thesis reviews)
  if (findings.length === 0 && review.sections?.length > 0) {
    children.push(
      new Paragraph({
        text: "Hodnotenie jednotlivých kritérií",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    )
    for (const sec of review.sections) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${sec.criterionId || sec.sectionId}: `, bold: true }),
            new TextRun({ text: `(Známka: ${sec.rating || "---"})`, italics: true }),
          ],
          spacing: { before: 150, after: 50 },
        })
      )
      children.push(
        new Paragraph({
          text: sec.text,
          spacing: { after: 100 },
        })
      )
    }
  }

  // Questions for Authors / Defense Questions
  const questions = review.questionsForAuthors || review.defenseQuestions || []
  if (questions.length > 0) {
    children.push(
      new Paragraph({
        text: "5. Otázky a pripomienky na autora / obhajobu",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    )
    questions.forEach((q: string, idx: number) => {
      children.push(
        new Paragraph({
          text: `${idx + 1}. ${q}`,
          spacing: { after: 80 },
        })
      )
    })
  }

  // Signature Block
  if (!options.anonymize) {
    children.push(
      new Paragraph({
        text: "",
        spacing: { before: 500 },
      })
    )
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Dátum: ............................", bold: false }),
          new TextRun({ text: "\t\t\tPodpis recenzenta: ............................", bold: false }),
        ],
        spacing: { before: 400 },
      })
    )
  }

  // Confidential Comments — strictly separated, only when includeConfidential=true
  if (options.includeConfidential && review.confidentialComments?.trim()) {
    children.push(
      new Paragraph({
        text: "",
        spacing: { before: 600 },
      })
    )
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "⚠ DÔVERNÉ / CONFIDENTIAL — Nesprístupňovať autorovi práce",
            bold: true,
            color: "CC0000",
          }),
        ],
        spacing: { before: 200, after: 150 },
      })
    )
    children.push(
      new Paragraph({
        text: review.confidentialComments,
        spacing: { after: 200 },
      })
    )
  }

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  })

  return await Packer.toBlob(doc)
}
