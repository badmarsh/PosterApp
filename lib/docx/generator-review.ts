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
  const isGrant = review.reviewKind === "grant"
  const isEditorial = isPaper || isGrant

  // Document Main Header
  children.push(
    new Paragraph({
      text: sanitizeXmlString(isGrant ? "ODBORNÉ HODNOTENIE GRANTOVÉHO NÁVRHU" : isPaper ? "ODBORNÁ RECENZIA VEDECKÉHO ČLÁNKU" : "POSUDOK ZÁVEREČNEJ PRÁCE"),
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
          children: [new Paragraph({ children: [new TextRun({ text: isGrant ? "Názov projektu / Project title:" : isPaper ? "Názov článku / Paper title:" : "Názov práce / Thesis title:", bold: true })] })],
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
                text: `${review.reviewerName} (${isGrant ? "Hodnotiteľ grantového návrhu / Grant reviewer" : isPaper ? "Odborný recenzent / Peer Reviewer" : review.reviewerRole === "supervisor" ? "Vedúci práce" : review.reviewerRole === "self" ? "Autor / Self-review" : "Oponent"})`,
              }),
            ],
          }),
        ],
      })
    )
  }

  if (!isEditorial && review.grade) {
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

  const finalRecommendation = review.finalRecommendation || review.recommendation
  if (finalRecommendation) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: isGrant ? "Odporúčanie k financovaniu / Funding recommendation:" : isPaper ? "Publikačné odporúčanie / Publication recommendation:" : "Odporúčanie k obhajobe:", bold: true })] })],
          }),
          new TableCell({
            children: [new Paragraph({ text: finalRecommendation })],
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
  const isDoctoralOpponent = review.reviewKind === "thesis" && review.thesisType === "phd" && review.reviewerRole === "opponent"
  const statutoryClause: string | undefined = review.phdEnrichment?.statutoryClause
  const findingStrengths = isEditorial
    ? []
    : buckets.strengths
        .filter((f) => f.evidence?.some((e) => e.verified))
        .map((f) => f.explanation || f.title)
  const strengths: string[] = [...new Set([...(review.strengths || []), ...findingStrengths])].filter(Boolean)

  let sectionNo = 0
  const heading = (title: string) =>
    new Paragraph({
      text: sanitizeXmlString(isEditorial ? title : `${++sectionNo}. ${title}`),
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    })

  if (review.summary) {
    children.push(heading(isGrant ? "Zhrnutie grantového návrhu (Grant Proposal Summary)" : isPaper ? "Zhrnutie rukopisu (Manuscript Summary)" : "Zhrnutie práce a hlavný prínos (Executive Summary)"))
    children.push(new Paragraph({ text: sanitizeXmlString(review.summary), spacing: { after: 200 } }))
  }

  if (strengths.length > 0) {
    children.push(
      heading(isGrant ? "Silné stránky grantového návrhu (Grant Proposal Strengths)" : isPaper ? "Podložené silné stránky rukopisu (Evidence-Grounded Strengths)" : "Silné stránky práce (Key Strengths)")
    )
    for (const str of strengths) {
      children.push(new Paragraph({ text: sanitizeXmlString(`\u2022 ${str}`), spacing: { after: 100 } }))
    }
  }

  if (buckets.major.length > 0) {
    children.push(heading(isGrant ? "Zásadné riziká financovania (Major Funding Risks)" : "Zásadné pripomienky (Major Concerns)"))
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
    children.push(heading(isGrant ? "Menšie odporúčania k návrhu (Minor Proposal Recommendations)" : "Drobné pripomienky (Minor Concerns)"))
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
    const statutoryHeading = review.language === "cs"
      ? "Zákonné podmínky doktorského studijního programu"
      : review.language === "en"
        ? "Statutory Requirements of the Doctoral Study Programme"
        : "Zákonné podmienky doktorského študijného programu"
    children.push(heading(statutoryHeading))
    children.push(new Paragraph({ text: sanitizeXmlString(statutoryClause), spacing: { after: 200 } }))
    const conclusionHeading = review.language === "cs"
      ? "Závěrečné stanovisko"
      : review.language === "en"
        ? "Conclusive Statement"
        : "Záverečné stanovisko"
    const conclusiveRecommendation = finalRecommendation
    if (conclusiveRecommendation?.trim()) {
      children.push(heading(conclusionHeading))
      children.push(new Paragraph({ text: sanitizeXmlString(conclusiveRecommendation.trim()), spacing: { after: 200 } }))
    }
  }

  if (review.reportingGuidelineChecks?.length) {
    children.push(heading(isGrant ? "Kontroly súladu, etiky a riadenia" : "Reporting Guideline Compliance"))
    for (const check of review.reportingGuidelineChecks) {
      children.push(new Paragraph({
        text: sanitizeXmlString(`[${check.status.toUpperCase()}] ${check.item}: ${check.notes}`),
        bullet: { level: 0 },
        indent: { left: 360 },
        spacing: { after: 80 },
      }))
    }
  }

  // Criteria Sections (for standard thesis reviews)
  if (findings.length === 0 && review.sections?.length > 0) {
    children.push(
      new Paragraph({
        text: isEditorial ? (isGrant ? "Posúdenie grantových kritérií" : "Odborné posúdenie jednotlivých kritérií") : `${++sectionNo}. Hodnotenie jednotlivých kritérií`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    )
    for (const sec of review.sections) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: sanitizeXmlString(`${sec.criterionId || sec.sectionId}: `), bold: true }),
            ...(isEditorial ? [] : [new TextRun({ text: sanitizeXmlString(`(Známka: ${sec.rating || "---"})`), italics: true })]),
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

  // Questions for authors/applicants or thesis defence.
  const questions = isEditorial ? (review.questionsForAuthors ?? []) : (review.defenseQuestions ?? [])
  if (questions.length > 0) {
    children.push(
      heading(isEditorial
        ? (isGrant ? "Otázky pre žiadateľa (Questions for the Applicant)" : "Otázky pre autorov (Questions for the Authors)")
        : "Otázky k obhajobe")
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
    heading("Vyhlásenie o AI asistencii / AI Assistance Disclosure"),
    new Paragraph({
      text: isGrant
        ? "Návrh hodnotenia pripravil AI asistent PosterApp. Konečné rozhodnutie o financovaní patrí ľudskej hodnotiacej komisii."
        : "Koncept recenzie bol pripravený s podporou evidenciou podloženého AI asistenta PosterApp. Konečné odborné posúdenie a rozhodnutie patrí ľudskému recenzentovi.",
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
            text: isGrant
              ? "⚠ DÔVERNÉ / CONFIDENTIAL — Nesprístupňovať žiadateľovi"
              : isPaper
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
