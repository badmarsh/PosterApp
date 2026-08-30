import { Document, Paragraph, TextRun, Packer, SectionType, ImageRun, Table, TableRow, TableCell, AlignmentType, WidthType, HeadingLevel } from "docx"
import type { Project, OutputConfig } from "@/lib/poster-types"
import { fetchImageBufferAndDimensions, parseMarkdownToDocxParagraphs } from "./helpers"
import { sanitizeXmlString } from "@/lib/security"

export async function generateDocx(project: Project, outputConfig: OutputConfig, workspaceId?: string): Promise<Blob> {
  const isPoster = outputConfig.outputType === "poster"
  const children: any[] = []
  
  // Title
  children.push(new Paragraph({
    text: sanitizeXmlString(outputConfig.title || project.name),
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER
  }))
  
  // Authors
  children.push(new Paragraph({
    text: sanitizeXmlString(project.authors),
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.CENTER
  }))
  
  // Venue
  if (project.venue) {
    children.push(new Paragraph({
      text: sanitizeXmlString(project.venue),
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }))
  }

  // Iterate over cards
  for (const card of outputConfig.cards) {
    // Card Title
    children.push(new Paragraph({
      text: sanitizeXmlString(card.title),
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    }))
    
    // Content
    if (card.content) {
      const paragraphs = parseMarkdownToDocxParagraphs(card.content)
      children.push(...paragraphs)
    }
    
    // Table
    if (card.table && card.table.rows && card.table.rows.length > 0) {
      if (card.table.caption) {
         children.push(new Paragraph({ 
           children: [new TextRun({ text: card.table.caption, italics: true })], 
           alignment: AlignmentType.CENTER 
         }))
      }
      const tableRows = card.table.rows.map((row, rowIndex) => {
        return new TableRow({
          children: row.map(cell => new TableCell({
            children: parseMarkdownToDocxParagraphs(cell),
            shading: rowIndex === 0 && card.table.hasHeader ? { fill: "f0f0f0" } : undefined
          }))
        })
      })
      children.push(new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE }
      }))
    }
    
    // Figures
    if (card.figures && card.figures.length > 0) {
      for (const fig of card.figures) {
        try {
          const { buffer, width, height } = await fetchImageBufferAndDimensions(fig.url)
          children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: buffer,
                transformation: {
                  width: width,
                  height: height
                },
                type: "png" // default fallback
              })
            ]
          }))
          if (fig.caption) {
             children.push(new Paragraph({ 
               children: [new TextRun({ text: fig.caption, italics: true })], 
               alignment: AlignmentType.CENTER, 
               spacing: { after: 200 } 
             }))
          }
        } catch (e) {
          console.error("Failed to fetch image for DOCX", e)
          children.push(new Paragraph({ text: `[Image: ${fig.url}]` }))
        }
      }
    }
  }

  const doc = new Document({
    sections: [{
      properties: isPoster ? {
        type: SectionType.CONTINUOUS,
        column: {
          space: 708,
          count: 3
        }
      } : undefined,
      children: children
    }]
  })
  
  return Packer.toBlob(doc)
}
