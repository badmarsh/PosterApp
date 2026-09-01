import { describe, it, expect } from "vitest"
import { parseHtmlTable } from "../table-parser"
import { decodeHtmlEntities } from "../utils"

describe("decodeHtmlEntities", () => {
  it("decodes hex entities like &#x27; into apostrophe", () => {
    expect(decodeHtmlEntities("Roztried&#x27; laboratórne pomôcky")).toBe("Roztried' laboratórne pomôcky")
    expect(decodeHtmlEntities("uhl&#x27;ovodikov")).toBe("uhl'ovodikov")
  })

  it("decodes decimal entities like &#39; and &#160;", () => {
    expect(decodeHtmlEntities("It&#39;s a test&#160;value")).toBe("It's a test value")
  })

  it("decodes named entities like &quot;, &amp;, &lt;, &gt;, &nbsp;", () => {
    expect(decodeHtmlEntities("&quot;Hello&quot; &amp; &lt;World&gt;&nbsp;!")).toBe('"Hello" & <World> !')
  })

  it("decodes double-encoded entities", () => {
    expect(decodeHtmlEntities("&amp;#x27;")).toBe("'")
  })

  it("handles null, undefined and empty strings", () => {
    expect(decodeHtmlEntities(null)).toBe("")
    expect(decodeHtmlEntities(undefined)).toBe("")
    expect(decodeHtmlEntities("")).toBe("")
  })
})

describe("parseHtmlTable", () => {
  it("parses standard HTML table into rectangular rows", () => {
    const html = `
      <table>
        <tr><th>Column 1</th><th>Column 2</th></tr>
        <tr><td>Value A</td><td>Value B</td></tr>
        <tr><td>Value C</td><td>Value D</td></tr>
      </table>
    `
    const result = parseHtmlTable(html)
    expect(result.rowCount).toBe(3)
    expect(result.colCount).toBe(2)
    expect(result.rows).toEqual([
      ["Column 1", "Column 2"],
      ["Value A", "Value B"],
      ["Value C", "Value D"],
    ])
  })

  it("decodes HTML entities inside table cells", () => {
    const html = `
      <table>
        <tr><th>Názov</th><th>Popis</th></tr>
        <tr><td>Roztried&#x27; pomôcky</td><td>uhl&#x27;ovodiky &amp; kyseliny</td></tr>
      </table>
    `
    const result = parseHtmlTable(html)
    expect(result.rows[1]).toEqual([
      "Roztried' pomôcky",
      "uhl'ovodiky & kyseliny",
    ])
  })

  it("correctly handles colspan and ensures all rows have equal column length", () => {
    const html = `
      <table>
        <tr><th colspan="3">Téma: filtrácia</th></tr>
        <tr><td colspan="3">Roztried&#x27; laboratórne pomôcky podľa potreby na filtráciu</td></tr>
        <tr><td>potrebujem</td><td>nepotrebujem</td><td>asi potrebujem</td></tr>
        <tr><td>kadička</td><td>odmerný valec</td><td>stojan</td></tr>
      </table>
    `
    const result = parseHtmlTable(html)
    expect(result.colCount).toBe(3)
    expect(result.title).toBe("Téma: filtrácia")
    expect(result.rows.every((row) => row.length === 3)).toBe(true)
    expect(result.rows[0]).toEqual(["Téma: filtrácia", "", ""])
    expect(result.rows[1]).toEqual(["Roztried' laboratórne pomôcky podľa potreby na filtráciu", "", ""])
    expect(result.rows[2]).toEqual(["potrebujem", "nepotrebujem", "asi potrebujem"])
  })

  it("handles rowspan across multiple rows", () => {
    const html = `
      <table>
        <tr><td rowspan="2">Group A</td><td>Item 1</td></tr>
        <tr><td>Item 2</td></tr>
        <tr><td>Group B</td><td>Item 3</td></tr>
      </table>
    `
    const result = parseHtmlTable(html)
    expect(result.colCount).toBe(2)
    expect(result.rows[0]).toEqual(["Group A", "Item 1"])
    expect(result.rows[1]).toEqual(["", "Item 2"])
    expect(result.rows[2]).toEqual(["Group B", "Item 3"])
  })

  it("handles empty or invalid html gracefully", () => {
    expect(parseHtmlTable("")).toEqual({ rows: [], colCount: 0, rowCount: 0 })
    expect(parseHtmlTable("<div>not a table</div>")).toEqual({ rows: [], colCount: 0, rowCount: 0 })
  })
})
