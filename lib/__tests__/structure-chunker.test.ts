import { describe, it, expect } from "vitest"
import { chunkMarkdown } from "@/lib/ai/document-chunker"
import { splitIntoStructuralSegments, buildTableEmbeddingText, splitIntoSubchunks } from "@/lib/ai/text-splitter"

describe("splitIntoStructuralSegments", () => {
  it("classifies pipe tables as table blocks and never breaks them up", () => {
    const text = `Some prose before the table.

| Model | Acc | F1 |
|---|---:|---:|
| Baseline | 0.81 | 0.79 |
| Ours | 0.92 | 0.91 |

Trailing prose after.`
    const segs = splitIntoStructuralSegments(text)
    const tables = segs.filter((s) => s.kind === "table")
    expect(tables).toHaveLength(1)
    expect(tables[0].text).toContain("| Baseline |")
    expect(tables[0].text).toContain("| Ours |")
    expect(segs.filter((s) => s.kind === "prose").length).toBeGreaterThanOrEqual(2)
  })

  it("keeps multi-line $$…$$ equations whole", () => {
    const text = `Pre-equation prose.

$$
\\mathcal{L} = -\\sum_{i=1}^{N} y_i \\log \\hat{y}_i
$$

Post prose.`
    const segs = splitIntoStructuralSegments(text)
    const eqs = segs.filter((s) => s.kind === "equation")
    expect(eqs).toHaveLength(1)
    expect(eqs[0].text).toContain("\\mathcal{L}")
    expect(eqs[0].text).toContain("$$")
  })

  it("detects figure captions (Obr./Figure/Tab.)", () => {
    const sk = splitIntoStructuralSegments("Obr. 3 – Architektúra systému.\nDetailný popis komponentov.")
    expect(sk.some((s) => s.kind === "figure_caption")).toBe(true)

    const en = splitIntoStructuralSegments("Figure 4: Training loss over epochs.\nThe curve converges after epoch 12.")
    expect(en.some((s) => s.kind === "figure_caption")).toBe(true)
  })
})

  it("converts MinerU-style HTML tables to markdown and classifies them as table blocks", () => {
    const text = [
      "Some prose before the table explaining the results.",
      "",
      '<table><tbody><tr><td>Model</td><td>Accuracy</td></tr><tr><td>Baseline</td><td>0.72</td></tr><tr><td>Ours</td><td>0.89</td></tr></tbody></table>',
      "",
      "Prose after the table.",
    ].join("\n")
    const segs = splitIntoStructuralSegments(text)
    const tableSeg = segs.find((s) => s.kind === "table")
    expect(tableSeg).toBeDefined()
    expect(tableSeg!.text).toContain("| Model | Accuracy |")
    expect(tableSeg!.text).toContain("Baseline")
    expect(tableSeg!.text).toContain("0.89")
  })

describe("buildTableEmbeddingText", () => {
  it("flattens tables into heading + column names + rows", () => {
    const md = `| Model | Acc |
|---|---:|
| Baseline | 0.81 |
| Ours | 0.92 |`
    const embed = buildTableEmbeddingText(md, "Výsledky experimentov")
    expect(embed).toContain("Výsledky experimentov")
    expect(embed).toContain("Columns: Model, Acc")
    expect(embed).toContain("Model = Ours")
    expect(embed).toContain("Acc = 0.92")
    // No raw separator scaffolding
    expect(embed).not.toContain("---")
  })
})

describe("splitIntoSubchunks — structural blocks never split", () => {
  it("keeps an oversized $$ equation intact", () => {
    const eq = `$$\n${"x^2 + y^2 = z^2 ".repeat(120)}\n$$`
    const out = splitIntoSubchunks(eq, 500, 80)
    // The equation survives as a single block even though it exceeds maxChars.
    expect(out.some((s) => s.includes("$$") && s.length > 500)).toBe(true)
  })

  it("keeps an oversized pipe table intact", () => {
    const rows = ["| A | B |", "|---|---|", ...Array.from({ length: 60 }, (_, i) => `| cell ${i} data | value ${i} |`)]
    const table = rows.join("\n")
    const out = splitIntoSubchunks(table, 800, 80)
    const tablePieces = out.filter((s) => s.includes("|"))
    // Header row and a data row stay together in the same piece.
    expect(tablePieces.some((p) => p.includes("| A | B |") && p.includes("cell 59"))).toBe(true)
  })
})

describe("chunkMarkdown — structure-aware kinds", () => {
  it("emits table / equation / figure_caption chunk kinds", () => {
    const md = `# Metodika

We describe the architecture below.

| Component | Role |
|---|---|
| Encoder | Embeds tokens |
| Decoder | Predicts tokens |

$$
E = mc^2
$$

Obr. 1 – Systémová architektúra.
Komponenty sú prepojené.`
    const chunks = chunkMarkdown(md, "doc1", { maxChunkChars: 4000 })
    const kinds = chunks.map((c) => c.kind)
    expect(kinds).toContain("table")
    expect(kinds).toContain("equation")
    expect(kinds).toContain("figure_caption")
    // Table content is intact
    const table = chunks.find((c) => c.kind === "table")
    expect(table?.content).toContain("Encoder")
    expect(table?.content).toContain("Decoder")
  })

  it("defaults prose chunks to kind=prose", () => {
    const md = "# Úvod\nToto je úvodný text práce bez špeciálnych blokov."
    const chunks = chunkMarkdown(md, "doc1")
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.every((c) => c.kind === "prose")).toBe(true)
  })
})
