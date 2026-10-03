import { describe, it, expect, vi } from "vitest"
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@prisma/client", () => ({ Prisma: { sql: () => "", empty: "", join: () => "" } }))
import { applyMMR, rerankChunks, compressChunks, buildFtsQuery, domainQueryPrefix, expandQuery, generateHypotheticalDocument, getThesisCriterionQueryExpansion, resolveCriterionFamily, resolveThesisDomainContext } from "@/lib/ai/vector-rag"

describe("vector-rag fixes", () => {
  it("buildFtsQuery OR-joins informative tokens", () => {
    expect(buildFtsQuery("Metodika a metodológia výskumu, návrh experimentu a dataset")).toBe("metodika OR metodológia OR výskumu OR návrh OR experimentu OR dataset")
  })
  it("criterion family maps rubric ids", () => {
    expect(resolveCriterionFamily("methodology_rigor")).toBe("methodology")
    expect(resolveCriterionFamily("results_validity")).toBe("results")
    expect(resolveCriterionFamily("goal_definition")).toBe("goals")
    expect(resolveCriterionFamily("citations_quality")).toBe("citations")
  })
  it("classifies a jet-calibration title as physics, not generic academic", () => {
    expect(resolveThesisDomainContext({ thesisTitle: "JES and JER from hadronic W bosons" } as any)).toContain("Fyzika")
    expect(resolveThesisDomainContext({ thesisTitle: "Jet energy scale and resolution from hadronic W bosons" } as any)).toContain("Fyzika")
  })

  it("does not prepend a Slovak field label to an English dense query", () => {
    expect(domainQueryPrefix("Akademický výskum, STEM a aplikované vedy", "en")).toBe("")
    expect(domainQueryPrefix("STEM, Fyzika", "en")).toBe("")
    expect(domainQueryPrefix("Časticová fyzika, femtoskopia", "sk")).toBe("Časticová fyzika, femtoskopia")
    expect(domainQueryPrefix("Particle physics, ATLAS jet calibration", "en")).toBe("Particle physics, ATLAS jet calibration")
  })

  it("domain regex no longer matches ai/it inside words", () => {
    expect(resolveThesisDomainContext({ thesisTitle: "Interný audit v bankovom sektore" } as any)).not.toContain("Informatika")
    expect(resolveThesisDomainContext({ thesisTitle: "Detailná analýza fotosyntézy" } as any)).not.toContain("Informatika")
    expect(resolveThesisDomainContext({ thesisTitle: "Využitie AI v diagnostike" } as any)).toContain("Informatika")
  })

  it("returns no physics or generic domain prior for absent or sparse metadata", () => {
    expect(resolveThesisDomainContext()).toBe("")
    expect(resolveThesisDomainContext({})).toBe("")
    expect(resolveThesisDomainContext({ thesisTitle: "A study of local practices" } as any)).toBe("")
  })

  it("expands criterion queries with SK/CS/EN terms and emits cautious multilingual HyDE", async () => {
    const skExpansion = getThesisCriterionQueryExpansion("methodology_rigor", "sk")
    const csExpansion = getThesisCriterionQueryExpansion("methodology_rigor", "cs")
    const enExpansion = getThesisCriterionQueryExpansion("methodology_rigor", "en")
    expect(skExpansion).toContain("metodológia")
    expect(csExpansion).toContain("metodologie")
    expect(enExpansion).toContain("methodology")
    expect(expandQuery("Ako bola zvolená metodika?", skExpansion)).toHaveLength(3)

    const sk = await generateHypotheticalDocument("Ako bola zvolená metodika?", "", "sk")
    const cs = await generateHypotheticalDocument("Jak byla zvolena metodika?", "", "cs")
    const en = await generateHypotheticalDocument("How was the method selected?", "", "en")
    expect(sk).toContain("Nepredpokladá sa žiadna konkrétna metóda")
    expect(cs).toContain("Nepředpokládá se žádná konkrétní metoda")
    expect(en).toContain("No specific method or outcome is assumed")
    for (const hypothetical of [sk, cs, en]) {
      expect(hypothetical).not.toMatch(/confirms our hypotheses|potvrzujú stanovené hypotézy|potvrzují stanovené hypotézy/i)
      expect(hypothetical).not.toMatch(/STEM, Fyzika|STEM \/ Physics/)
    }
  })
  it("MMR with normalised relevance prefers relevant chunk over diverse-but-irrelevant", () => {
    const chunks = [
      { id: "a", heading: null, content: "neural network training loss converges after fifty epochs on the dataset", similarity: 1 },
      { id: "b", heading: null, content: "neural network training loss converges after fifty epochs on the dataset extra", similarity: 0.95 },
      { id: "c", heading: null, content: "the weather in bratislava was mild and pleasant throughout the whole spring", similarity: 0.0 },
    ]
    const out = applyMMR(chunks, 2, 0.7).map((c) => c.id)
    expect(out[0]).toBe("a")
    // b is a near-duplicate of a → c should be chosen for diversity only if its relevance isn't zero; with λ=0.7 b (0.95 rel, high overlap) vs c (0 rel, 0 overlap):
    // 0.7*0.95 - 0.3*jaccard(≈0.85) ≈ 0.41 vs 0 → b wins. Diversity no longer dominates.
    expect(out[1]).toBe("b")
  })
  it("reranker boosts cannot swamp normalised similarity", async () => {
    const q = "výsledky experimentov namerané hodnoty diskusia interpretácia"
    const chunks = [
      { id: "top", heading: "Kapitola 5", content: "x".repeat(300), similarity: 1 },
      { id: "kw", heading: "Výsledky a diskusia", content: "výsledky experimentov namerané hodnoty diskusia interpretácia ".repeat(5), similarity: 0.5 },
    ]
    const out = await rerankChunks(q, chunks, { criterionId: "results_validity" })
    // keyword chunk gets at most +0.15+0.15+0.15 = 0.45 → 0.95 < 1.0
    expect(out[0].id).toBe("top")
  })
  it("compression keeps tables and decimals", () => {
    const table = "| Model | Acc |\n|---|---|\n| CNN | 0.91 |\n| RNN | 0.87 |\n| SVM | 0.80 |"
    const filler = "Toto je úplne nesúvisiaca veta o počasí v meste. ".repeat(12)
    const c = { id: "t", heading: null, content: `${filler}\n\n${table}\n\nPresnosť dosiahla 94.2% na testovacej sade výsledkov. ${filler}` }
    const out = compressChunks("presnosť výsledkov testovacej", [c], 3)
    expect(out[0].content).toContain("| CNN | 0.91 |")
    expect(out[0].content).toContain("94.2%")
  })

  it("preserves formulas, equation numbers, statistics, citation anchors and abbreviations", () => {
    const unrelated = "Unrelated background passage about a different topic with no useful evidence here."
    const content = [
      "Prof. Smith describes the measurement method, e.g. the repeated baseline procedure, in detail.",
      ...Array.from({ length: 8 }, () => unrelated),
      "The fitted result is reported in Equation (3.1), with p < 0.05 and N = 40.",
      "$$\nE = mc^2\n$$",
      "The source passage is linked to [c-1234567890abcdef] and (Smith, 2020).",
      ...Array.from({ length: 4 }, () => unrelated),
    ].join("\n\n")
    const [compressed] = compressChunks("measurement method", [{ id: "evidence", heading: null, content }], 4)

    expect(compressed.content.length).toBeLessThan(content.length)
    expect(compressed.content).toContain("Prof. Smith")
    expect(compressed.content).toContain("e.g.")
    expect(compressed.content).toContain("Equation (3.1)")
    expect(compressed.content).toContain("p < 0.05")
    expect(compressed.content).toContain("N = 40")
    expect(compressed.content).toContain("E = mc^2")
    expect(compressed.content).toContain("[c-1234567890abcdef]")
    expect(compressed.content).toContain("(Smith, 2020)")
  })
})
