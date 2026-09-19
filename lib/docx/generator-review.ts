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
import { bucketFindings } from "@/lib/ai/review-bucketing"
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

  // Executive summary, strengths, concerns and the statutory clause. All four
  // buckets are derived from the shared `bucketFindings` helper so that a
  // strength can never be rendered as a "concern" (see lib/ai/review-bucketing)
  // and so that section numbers stay sequential when a block is empty.
  const findings = getEligibleFindings(
    review.findings || [],
    options.includeConfidential ? "editor" : "author",
  )
  const buckets = bucketFindings(findings)
  const isDoctoralOpponent = !isPaper && review.thesisType === "phd" && review.reviewerRole === "opponent"
  const statutoryClause: string | undefined = review.phdEnrichment?.statutoryClause
  const findingStrengths = isPaper
    ? []
    : buckets.strengths
        .filter((f) => f.evidence?.some((e) => e.verified))
        .map((f) => f.explanation || f.title)
  const strengths: string[] = [...new Set([...(review.strengths || []), ...findingStrengths])].filter(Boolean)

  let sectionNo = 0
  const heading = (title: string) =>
    new Paragraph({
      text: sanitizeXmlString(isPaper ? title : `${++sectionNo}. ${title}`),
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    })

  if (review.summary) {
    children.push(heading(isPaper ? "Zhrnutie rukopisu (Manuscript Summary)" : "Zhrnutie práce a hlavný prínos (Executive Summary)"))
    children.push(new Paragraph({ text: sanitizeXmlString(review.summary), spacing: { after: 200 } }))
  }

  if (strengths.length > 0) {
    children.push(
      heading(isPaper ? "Podložené silné stránky rukopisu (Evidence-Grounded Strengths)" : "Silné stránky práce (Key Strengths)")
    )
    for (const str of strengths) {
      children.push(new Paragraph({ text: sanitizeXmlString(`\u2022 ${str}`), spacing: { after: 100 } }))
    }
  }

  if (buckets.major.length > 0) {
    children.push(heading("Zásadné pripomienky (Major Concerns)"))
    for (const f of buckets.major) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: sanitizeXmlString(`[${(f.category || "general").toUpperCase()}] ${f.title}`), bold: true }),
          ],
          spacing: { before: 150, after: 50 },
        })
      )
      children.push(new Paragraph({ text: sanitizeXmlString(f.explanation), spacing: { after: 50 } }))
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
        const plainQuote = sanitizeXmlString(stripLatexForPlainText(f.evidence[0].quote))
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

  if (buckets.minor.length > 0) {
    children.push(heading("Drobné pripomienky (Minor Concerns)"))
    for (const f of buckets.minor) {
      children.push(
        new Paragraph({
          text: sanitizeXmlString(`\u2022 [${f.category || "general"}] ${f.title}: ${f.explanation}`),
          spacing: { after: 80 },
        })
      )
    }
  }

  if (isDoctoralOpponent && statutoryClause?.trim()) {
    children.push(heading("Zákonné podmienky doktorského študijného programu"))
    children.push(new Paragraph({ text: sanitizeXmlString(statutoryClause), spacing: { after: 200 } }))
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
