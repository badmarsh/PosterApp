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
import { sanitizeXmlString } from "@/lib/security"
import { getEligibleFindings } from "@/lib/ai/review-composer"
import { stripLatexForPlainText } from "@/lib/thesis-review/latex-utils"

export async function generateThesisReviewDocx(
  review: ThesisReviewRecord,
  options: { anonymize?: boolean; anonymizeReviewer?: boolean; includeConfidential?: boolean } = {}
): Promise<Blob> {
  const children: any[] = []
  const isAnonymized = Boolean(options.anonymize || options.anonymizeReviewer)
  const isPaper = review.reviewKind === "paper"

  // Document Main Header
  children.push(
    new Paragraph({
      text: sanitizeXmlString(isPaper ? "ODBORNÁ RECENZIA VEDECKÉHO ČLÁNKU" : "POSUDOK ZÁVEREČNEJ PRÁCE"),
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
          children: [new Paragraph({ children: [new TextRun({ text: isPaper ? "Názov článku / Paper title:" : "Názov práce / Thesis title:", bold: true })] })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ text: sanitizeXmlString(review.thesisTitle) })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Autor / Author:", bold: true })] })],
        }),
        new TableCell({
          children: [new Paragraph({ text: sanitizeXmlString(review.studentName) })],
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
                text: `${review.reviewerName} (${isPaper ? "Odborný recenzent / Peer Reviewer" : review.reviewerRole === "supervisor" ? "Vedúci práce" : "Oponent"})`,
              }),
            ],
          }),
        ],
      })
    )
  }

  if (!isPaper && review.grade) {
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
            children: [new Paragraph({ children: [new TextRun({ text: isPaper ? "Publikačné odporúčanie:" : "Odporúčanie k obhajobe:", bold: true })] })],
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
        text: isPaper ? "1. Zhrnutie rukopisu (Manuscript Summary)" : "1. Zhrnutie práce a hlavný prínos (Executive Summary)",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    )
    children.push(
      new Paragraph({
        text: sanitizeXmlString(review.summary),
        spacing: { after: 200 },
      })
    )
  }

  // Key Strengths
  if (review.strengths && review.strengths.length > 0) {
    children.push(
      new Paragraph({
        text: isPaper ? "2. Podložené silné stránky rukopisu (Evidence-Grounded Strengths)" : "2. Silné stránky práce (Key Strengths)",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    )
    for (const str of review.strengths) {
      children.push(
        new Paragraph({
          text: sanitizeXmlString(`• ${str}`),
          spacing: { after: 100 },
        })
      )
    }
  }

  // Structured Findings (Major vs. Minor)
  const findings = getEligibleFindings(
    review.findings || [],
    options.includeConfidential ? "editor" : "author",
  )
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
            new TextRun({ text: sanitizeXmlString(`[${(f.category || "general").toUpperCase()}] ${f.title}`), bold: true }),
          ],
          spacing: { before: 150, after: 50 },
        })
      )
      children.push(
        new Paragraph({
          text: sanitizeXmlString(f.explanation),
          spacing: { after: 50 },
        })
      )
      if (f.recommendation) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Odporúčaná náprava: ", bold: true, italics: true }),
              new TextRun({ text: sanitizeXmlString(f.recommendation), italics: true }),
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
              new TextRun({ text: sanitizeXmlString(f.reviewerNotes) }),
            ],
            spacing: { after: 50 },
          })
        )
      }
      if (f.evidence?.[0]?.quote) {
        const rawQuote = f.evidence[0].quote
        const plainQuote = sanitizeXmlString(stripLatexForPlainText(rawQuote))
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Dôkaz v texte: ", bold: true, italics: true, color: "555555" }),
              new TextRun({ text: `"${plainQuote}"`, italics: true, color: "555555" }),
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
          text: sanitizeXmlString(`• [${f.category || "general"}] ${f.title}: ${f.explanation}`),
          spacing: { after: 80 },
        })
      )
    }
  }

  // Criteria Sections (for standard thesis reviews)
  if (findings.length === 0 && review.sections?.length > 0) {
    children.push(
      new Paragraph({
        text: isPaper ? "Odborné posúdenie jednotlivých kritérií" : "Hodnotenie jednotlivých kritérií",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    )
    for (const sec of review.sections) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: sanitizeXmlString(`${sec.criterionId || sec.sectionId}: `), bold: true }),
            ...(isPaper ? [] : [new TextRun({ text: sanitizeXmlString(`(Známka: ${sec.rating || "---"})`), italics: true })]),
          ],
          spacing: { before: 150, after: 50 },
        })
      )
      children.push(
        new Paragraph({
          text: sanitizeXmlString(sec.text),
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
        text: isPaper ? "5. Otázky pre autorov (Questions for the Authors)" : "5. Otázky k obhajobe",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    )
    questions.forEach((q: string, idx: number) => {
      children.push(
        new Paragraph({
          text: sanitizeXmlString(`${idx + 1}. ${q}`),
          spacing: { after: 80 },
        })
      )
    })
  }

  // Transparent AI-assistance disclosure is included in every formal export.
  children.push(
    new Paragraph({
      text: "Vyhlásenie o AI asistencii / AI Assistance Disclosure",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
    }),
    new Paragraph({
      text: "Koncept recenzie bol pripravený s podporou evidenciou podloženého AI asistenta PosterApp. Konečné odborné posúdenie a rozhodnutie patrí ľudskému recenzentovi.",
      spacing: { after: 200 },
    }),
  )

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
            text: isPaper
              ? "⚠ DÔVERNÉ / CONFIDENTIAL — Nesprístupňovať autorom rukopisu"
              : "⚠ DÔVERNÉ / CONFIDENTIAL — Nesprístupňovať autorovi práce",
            bold: true,
            color: "CC0000",
          }),
        ],
        spacing: { before: 200, after: 150 },
      })
    )
    children.push(
      new Paragraph({
        text: sanitizeXmlString(review.confidentialComments),
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
