import { TextRun, Paragraph } from "docx"
import { sanitizeXmlString } from "@/lib/security"

export async function fetchImageBufferAndDimensions(url: string): Promise<{ buffer: ArrayBuffer; width: number; height: number }> {
  // If the url starts with /api/workspaces, we need to make sure we include the origin since it's client side
  // But fetch automatically resolves relative URLs on the client.
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch image: ${url}`)
  
  const blob = await response.blob()
  const buffer = await blob.arrayBuffer()
  
  // Calculate dimensions using browser API
  let width = 400
  let height = 300
  try {
    const img = await createImageBitmap(blob)
    width = img.width
    height = img.height
    // Scale down if too large (Word pages are typically ~600px wide)
    const MAX_WIDTH = 400
    if (width > MAX_WIDTH) {
      const ratio = MAX_WIDTH / width
      width = MAX_WIDTH
      height = height * ratio
    }
  } catch (e) {
    console.warn("Could not determine image dimensions", e)
  }
  
  return { buffer, width, height }
}

export function parseMarkdownToDocxParagraphs(text: string): Paragraph[] {
  if (!text) return []
  const paragraphs: Paragraph[] = []
  
  const lines = text.split("\n")
  for (const line of lines) {
    if (!line.trim()) continue
    
    const runs: TextRun[] = []
    const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("* ")
    const cleanLine = isBullet ? line.trim().substring(2) : line
    
    // Very basic markdown parsing for bold, italic, code
    const boldParts = cleanLine.split(/\*\*([^*]+)\*\*/)
    
    boldParts.forEach((part, index) => {
      if (index % 2 === 1) { 
        runs.push(new TextRun({ text: sanitizeXmlString(part), bold: true }))
      } else {
        const italicParts = part.split(/(?<!\*)\*([^*]+)\*(?!\*)/)
        italicParts.forEach((iPart, iIndex) => {
          if (iIndex % 2 === 1) { 
            runs.push(new TextRun({ text: sanitizeXmlString(iPart), italics: true }))
          } else if (iPart) {
             const codeParts = iPart.split(/`([^`]+)`/)
             codeParts.forEach((cPart, cIndex) => {
               if (cIndex % 2 === 1) {
                 runs.push(new TextRun({ text: sanitizeXmlString(cPart), font: "Courier New" }))
               } else if (cPart) {
                 runs.push(new TextRun({ text: sanitizeXmlString(cPart) }))
               }
             })
          }
        })
      }
    })

    if (isBullet) {
      paragraphs.push(new Paragraph({
        children: runs,
        bullet: { level: 0 }
      }))
    } else {
      paragraphs.push(new Paragraph({ children: runs }))
    }
  }

  return paragraphs
}
