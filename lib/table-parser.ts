import { decodeHtmlEntities } from "./utils"

export interface ParsedTableResult {
  /** Rectangular 2D array of string cells where every row has the same length */
  rows: string[][]
  /** Clean extracted title/header from banner row if found (e.g. "Téma: filtrácia") */
  title?: string
  /** Number of columns */
  colCount: number
  /** Number of data rows */
  rowCount: number
}

/**
 * Parses raw HTML table (from MinerU middle_json or OCR) into a clean, normalized
 * rectangular 2D array of strings with HTML entities decoded and colspans handled.
 */
export function parseHtmlTable(html: string): ParsedTableResult {
  if (!html || typeof html !== "string") {
    return { rows: [], colCount: 0, rowCount: 0 }
  }

  // 1. Clean script / style tags
  const cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")

  // 2. Extract <tr> elements
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const rawRows: { cells: { text: string; colspan: number; rowspan: number }[] }[] = []

  let trMatch: RegExpExecArray | null
  while ((trMatch = trRegex.exec(cleanHtml)) !== null) {
    const rowContent = trMatch[1]
    const cells: { text: string; colspan: number; rowspan: number }[] = []

    const tdRegex = /<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi
    let tdMatch: RegExpExecArray | null
    while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
      const attrs = tdMatch[2] || ""
      const rawCellText = tdMatch[3] || ""

      // Extract colspan
      const colspanMatch = /colspan=["']?(\d+)["']?/i.exec(attrs)
      const colspan = colspanMatch ? Math.max(1, parseInt(colspanMatch[1], 10)) : 1

      // Extract rowspan
      const rowspanMatch = /rowspan=["']?(\d+)["']?/i.exec(attrs)
      const rowspan = rowspanMatch ? Math.max(1, parseInt(rowspanMatch[1], 10)) : 1

      // Clean text: strip tags, decode entities, normalize spaces
      let cellText = rawCellText
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, " ")
      cellText = decodeHtmlEntities(cellText)
      cellText = cellText.replace(/\s+/g, " ").trim()

      cells.push({ text: cellText, colspan, rowspan })
    }

    if (cells.length > 0) {
      rawRows.push({ cells })
    }
  }

  if (rawRows.length === 0) {
    return { rows: [], colCount: 0, rowCount: 0 }
  }

  // 3. Build a 2D grid that correctly handles rowspan and colspan
  const grid: (string | null)[][] = []
  
  for (let r = 0; r < rawRows.length; r++) {
    grid[r] = []
  }

  for (let r = 0; r < rawRows.length; r++) {
    const rowData = rawRows[r]
    let colIndex = 0

    for (const cell of rowData.cells) {
      // Find the next available column index not occupied by an earlier rowspan
      while (grid[r][colIndex] !== undefined && grid[r][colIndex] !== null) {
        colIndex++
      }

      // Fill current and spanned cells
      for (let rs = 0; rs < cell.rowspan; rs++) {
        const targetRow = r + rs
        if (!grid[targetRow]) {
          grid[targetRow] = []
        }
        for (let cs = 0; cs < cell.colspan; cs++) {
          const targetCol = colIndex + cs
          if (rs === 0 && cs === 0) {
            grid[targetRow][targetCol] = cell.text
          } else {
            grid[targetRow][targetCol] = ""
          }
        }
      }

      colIndex += cell.colspan
    }
  }

  // 4. Determine max columns across all rows to enforce rectangular table
  let maxCols = 0
  for (const row of grid) {
    maxCols = Math.max(maxCols, row.length)
  }

  if (maxCols === 0) {
    return { rows: [], colCount: 0, rowCount: 0 }
  }

  // 5. Fill any undefined / null holes with empty string
  const normalizedRows: string[][] = []
  for (const row of grid) {
    const cleanRow: string[] = []
    for (let c = 0; c < maxCols; c++) {
      cleanRow.push(row[c] ?? "")
    }
    // Only include row if at least one cell has content
    if (cleanRow.some((cell) => cell.length > 0)) {
      normalizedRows.push(cleanRow)
    }
  }

  if (normalizedRows.length === 0) {
    return { rows: [], colCount: 0, rowCount: 0 }
  }

  // 6. Check for leading title/header row (e.g. "Téma: filtrácia" or "Som si istý na 50 %")
  let extractedTitle: string | undefined
  if (normalizedRows.length > 1) {
    const firstRowNonEmpty = normalizedRows[0].filter((c) => c.length > 0)
    if (firstRowNonEmpty.length === 1 && maxCols > 1) {
      const candidateTitle = firstRowNonEmpty[0]
      if (
        /^(téma|tabuľka|table|vzor|zoznam|graf|prehľad|rozdelenie|otázka|výsledky|som si istý)/i.test(candidateTitle) ||
        candidateTitle.length > 15
      ) {
        extractedTitle = candidateTitle
      }
    }
  }

  return {
    rows: normalizedRows,
    title: extractedTitle,
    colCount: maxCols,
    rowCount: normalizedRows.length,
  }
}
