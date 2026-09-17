/**
 * Contextual Retrieval (Anthropic-style chunk enrichment) — Objective B.
 *
 * Verifies that:
 *  - every chunk gets a 1–2 sentence contextual prefix (document title,
 *    research domain, hierarchical section path, section objective);
 *  - the prefix is fed to the EMBEDDING and stored in `contextPrefix`, while
 *    `content` stays VERBATIM (evidence-validator quote checks depend on it);
 *  - table chunks fold notable values / p-values into the indexed prefix
 *    (Objective E) and equation chunks get a symbol inventory.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// Minimal Prisma.Sql stand-in (same semantics as the supabase harness).
type FakeSql = { text: string; values: unknown[] }
const isSql = (v: unknown): v is FakeSql =>
  Boolean(v && typeof v === "object" && "text" in (v as object) && "values" in (v as object))
const sqlTag = (strings: TemplateStringsArray, ...values: unknown[]): FakeSql => {
  let text = ""
  const out: unknown[] = []
  strings.forEach((s, i) => {
    text += s
    if (i < values.length) {
      const v = values[i]
      if (isSql(v)) {
        text += v.text
        out.push(...v.values)
      } else {
        out.push(v)
        text += `⟨${out.length}⟩`
      }
    }
  })
  return { text, values: out }
}

vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: sqlTag,
    empty: { text: "", values: [] },
    join: (parts: unknown[], sep = ","): FakeSql => {
      let text = ""
      const values: unknown[] = []
      parts.forEach((p, i) => {
        if (i > 0) text += sep
        if (isSql(p)) {
          const offset = values.length
          text += p.text.replace(/⟨(\d+)⟩/g, (_m: string, n: string) => `⟨${offset + Number(n)}⟩`)
          values.push(...p.values)
        } else {
          values.push(p)
          text += `⟨${values.length}⟩`
        }
      })
      return { text, values }
    },
  },
}))

// ---------------------------------------------------------------------------
// buildContextualPrefix / describeEquationChunk / describeTableChunk (pure)
// ---------------------------------------------------------------------------

describe("buildContextualPrefix", () => {
  it("includes document title, domain, section path and objective (Slovak)", async () => {
    const { buildContextualPrefix } = await import("@/lib/ai/document-chunker")
    const prefix = buildContextualPrefix({
      documentTitle: "Diplomová práca final.pdf",
      domain: "Informatika, AI a dátové vedy",
      heading: "3.2 Štatistická analýza",
      headingPath: "Kapitola 3: Metodika > 3.2 Štatistická analýza",
      sectionKind: "methodology",
      kind: "prose",
      lang: "sk",
    })
    expect(prefix).toContain("Úryvok z práce „Diplomová práca final“")
    expect(prefix).toContain("(odbor: Informatika, AI a dátové vedy)")
    expect(prefix).toContain("sekcia „Kapitola 3: Metodika > 3.2 Štatistická analýza“")
    expect(prefix).toContain("metodiku")
    // 1–2 sentences
    expect(prefix.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2)
  })

  it("falls back to generic wording without metadata and supports cs/en", async () => {
    const { buildContextualPrefix } = await import("@/lib/ai/document-chunker")
    const sk = buildContextualPrefix({ sectionKind: "unknown" })
    expect(sk).toContain("Úryvok z akademickej práce")
    const en = buildContextualPrefix({ documentTitle: "Thesis", sectionKind: "results", lang: "en" })
    expect(en).toContain('Excerpt from the work "Thesis"')
    expect(en).toContain("presents experimental results")
    const cs = buildContextualPrefix({ sectionKind: "introduction", lang: "cs" })
    expect(cs).toContain("Úryvek z akademické práce")
  })

  it("annotates structural kinds (table / equation / figure caption)", async () => {
    const { buildContextualPrefix } = await import("@/lib/ai/document-chunker")
    expect(buildContextualPrefix({ kind: "table" })).toContain("dátovú tabuľku")
    expect(buildContextualPrefix({ kind: "equation" })).toContain("matematický vzorec")
    expect(buildContextualPrefix({ kind: "figure_caption" })).toContain("popis obrázka")
  })
})

describe("describeEquationChunk — symbol inventory", () => {
  it("names greek symbols and operators so non-LaTeX queries can match", async () => {
    const { describeEquationChunk } = await import("@/lib/ai/document-chunker")
    const out = describeEquationChunk("$$\\sigma = \\frac{1}{n}\\sum_{i=1}^{n} x_i \\approx \\mu$$", "3.2 Odchýlka")
    expect(out).toContain("3.2 Odchýlka")
    expect(out).toContain("matematický vzorec / equation")
    expect(out).toContain("sigma (σ)")
    expect(out).toContain("sum")
    expect(out).toContain("mu (μ)")
    expect(out).toContain("približne rovné")
    // Verbatim LaTeX tail preserved for exact-token embedding
    expect(out).toContain("\\sigma")
  })
})

describe("describeTableChunk — notable values & significance markers", () => {
  it("extracts column headers, extreme values and p-values", async () => {
    const { describeTableChunk } = await import("@/lib/ai/text-splitter")
    const md = `| Model | Presnosť | p-hodnota |
|---|---|---|
| Baseline | 0.81 | 0.214 |
| Navrhovaný | 0.94 | p < 0.001 |`
    const out = describeTableChunk(md, "Tab. 4.1 Porovnanie modelov")
    expect(out).toContain("Tab. 4.1 Porovnanie modelov")
    expect(out).toContain("Columns: Model, Presnosť, p-hodnota")
    // Notable extremes with row labels (statistical questions target these)
    expect(out).toContain("najnižšia hodnota 0.81 (Baseline)")
    expect(out).toContain("najvyššia hodnota 0.94 (Navrhovaný)")
    // Significance markers with column + row context
    expect(out).toContain("p < 0.001")
    expect(out).toContain("(Navrhovaný)")
    // Flattened rows retained
    expect(out).toContain("Model = Baseline")
  })

  it("falls back to raw content for non-tabular input", async () => {
    const { describeTableChunk } = await import("@/lib/ai/text-splitter")
    expect(describeTableChunk("not a table", "H")).toContain("not a table")
  })
})

// ---------------------------------------------------------------------------
// ingestDocumentChunks — prefix stored separately, content verbatim
// ---------------------------------------------------------------------------

describe("ingestDocumentChunks — contextual prefix storage", () => {
  const MARKDOWN = `# Kapitola 3: Metodika

## 3.2 Štatistická analýza
Parametre modelu boli nastavené na α = 0.05. Použili sme dvojfázový t-test s Bonferroniho korekciou.

| Model | Presnosť | p-hodnota |
|---|---|---|
| Baseline | 0.81 | 0.214 |
| Navrhovaný | 0.94 | p < 0.001 |

$$\\alpha = \\frac{p}{q}$$
`

  function importWithCapture() {
    const captured: {
      embedTexts: string[]
      insertSql: string[]
      insertValues: FakeSql[]
      ingestFileQueries: Array<{ id: string; workspaceId: string }>
      docTitleFromDb: string | null
    } = {
      embedTexts: [],
      insertSql: [],
      insertValues: [],
      ingestFileQueries: [],
      docTitleFromDb: "Kapitola 3 návrh.pdf",
    }

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        ingestFile: {
          updateMany: vi.fn(async () => ({})),
          findFirst: vi.fn(async (args: { where: { id: string; workspaceId: string } }) => {
            captured.ingestFileQueries.push(args.where)
            return captured.docTitleFromDb ? { name: captured.docTitleFromDb } : null
          }),
        },
        $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            documentChunk: { deleteMany: vi.fn(async () => ({})) },
            $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
              captured.insertSql.push(strings.join("⟨?⟩"))
              captured.insertValues.push(...(values.filter(isSql) as FakeSql[]))
              return 1
            },
          }
          return fn(tx)
        }),
      },
    }))
    vi.doMock("@/lib/ai/local-embeddings", () => ({
      generateLocalEmbedding: vi.fn(async (text: string) => {
        captured.embedTexts.push(text)
        return new Array(384).fill(0.1)
      }),
    }))
    vi.doMock("@/lib/ai/graph-extractor", () => ({
      extractAndStoreGraphEntities: vi.fn(async () => ({ nodes: 0, edges: 0 })),
    }))

    return { captured, promise: import("@/lib/ai/document-chunker") }
  }

  beforeEach(() => {
    vi.resetModules()
  })

  it("embeds prefix + content but stores content verbatim and prefix separately", async () => {
    const { captured, promise } = importWithCapture()
    const { ingestDocumentChunks } = await promise

    const res = await ingestDocumentChunks("ws-ctx", "doc-ctx", MARKDOWN, {
      ingestFileId: "file-ctx",
      documentTitle: "Diplomová práca final.pdf",
      domainContext: "Informatika, AI a dátové vedy",
    })

    expect(res.chunksCreated).toBeGreaterThan(0)
    expect(res.skipped).toBe(0)

    // INSERT writes the contextPrefix column…
    expect(captured.insertSql.join(" ")).toContain('"contextPrefix"')
    // …one row per chunk, each with [workspaceId, documentId, heading, content, tokens, embedding, kind, contextPrefix].
    // (The mocked Prisma.join flattens all bound values → regroup by row width 8.)
    const flat = captured.insertValues.flatMap((v) => v.values)
    const rows: unknown[][] = []
    for (let i = 0; i < flat.length; i += 8) rows.push(flat.slice(i, i + 8))
    expect(rows.length).toBe(res.chunksCreated)

    const proseRow = rows.find((r) => typeof r[3] === "string" && (r[3] as string).startsWith("Parametre modelu"))
    expect(proseRow).toBeDefined()
    // VERBATIM content — no prefix leakage into the quote-checked text.
    expect(proseRow![3]).toBe(
      "Parametre modelu boli nastavené na α = 0.05. Použili sme dvojfázový t-test s Bonferroniho korekciou."
    )
    // Separate contextual prefix with title, domain and section path.
    const prefix = proseRow![7] as string
    expect(prefix).toContain("Úryvok z práce „Diplomová práca final“")
    expect(prefix).toContain("Informatika, AI a dátové vedy")
    expect(prefix).toContain("Kapitola 3: Metodika > 3.2 Štatistická analýza")

    // Table chunk: prefix folds in the retrieval description (headers/extremes/p-values).
    const tableRow = rows.find((r) => typeof r[3] === "string" && (r[3] as string).includes("| Model |"))
    expect(tableRow).toBeDefined()
    const tablePrefix = tableRow![7] as string
    expect(tablePrefix).toContain("Úryvok z práce")
    expect(tablePrefix).toContain("Columns: Model, Presnosť, p-hodnota")
    expect(tablePrefix).toContain("p < 0.001")

    // Embedding text ALWAYS leads with the contextual prefix (Anthropic-style).
    const proseEmbed = captured.embedTexts.find((t) => t.includes("Parametre modelu"))
    expect(proseEmbed).toBeDefined()
    expect(proseEmbed!.startsWith("Úryvok z práce „Diplomová práca final“")).toBe(true)
    const tableEmbed = captured.embedTexts.find((t) => t.includes("Columns: Model"))
    expect(tableEmbed).toBeDefined()
    expect(tableEmbed).toContain("najvyššia hodnota 0.94")
  })

  it("looks the document title up from IngestFile when not provided", async () => {
    const { captured, promise } = importWithCapture()
    const { ingestDocumentChunks } = await promise

    await ingestDocumentChunks("ws-ctx", "doc-ctx", "# Kapitola\nObsah kapitoly s dostatočnou dĺžkou.", {
      ingestFileId: "file-ctx",
    })
    expect(captured.ingestFileQueries[0]).toEqual({ id: "file-ctx", workspaceId: "ws-ctx" })
    // Extension stripped from the file name in the prefix.
    const flatValues = captured.insertValues.flatMap((v) => v.values)
    const rowsForLookup: unknown[][] = []
    for (let i = 0; i < flatValues.length; i += 8) rowsForLookup.push(flatValues.slice(i, i + 8))
    const prefixRow = rowsForLookup.find((r) => typeof r[7] === "string")
    expect(prefixRow![7]).toContain("Kapitola 3 návrh")
    expect(prefixRow![7]).not.toContain(".pdf")
  })

  it("keeps chunking working without an IngestFile row (no title lookup)", async () => {
    const { captured, promise } = importWithCapture()
    captured.docTitleFromDb = null
    const { ingestDocumentChunks } = await promise

    const res = await ingestDocumentChunks("ws-ctx", "doc-ctx", "# A\n" + "Obsah. ".repeat(60), {})
    expect(res.chunksCreated).toBeGreaterThan(0)
    expect(captured.ingestFileQueries).toHaveLength(0)
    const flatValues = captured.insertValues.flatMap((v) => v.values)
    const rowsForLookup: unknown[][] = []
    for (let i = 0; i < flatValues.length; i += 8) rowsForLookup.push(flatValues.slice(i, i + 8))
    const prefixRow = rowsForLookup.find((r) => typeof r[7] === "string")
    expect(prefixRow![7]).toContain("Úryvok z akademickej práce")
  })
})
