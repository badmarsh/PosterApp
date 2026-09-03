import { describe, it, expect, vi } from "vitest"
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@prisma/client", () => ({ Prisma: { sql: () => "", empty: "", join: () => "" } }))
import { applyMMR, rerankChunks, compressChunks, buildFtsQuery, resolveCriterionFamily, resolveThesisDomainContext } from "@/lib/ai/vector-rag"

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
  it("domain regex no longer matches ai/it inside words", () => {
    expect(resolveThesisDomainContext({ thesisTitle: "Interný audit v bankovom sektore" } as any)).not.toContain("Informatika")
    expect(resolveThesisDomainContext({ thesisTitle: "Detailná analýza fotosyntézy" } as any)).not.toContain("Informatika")
    expect(resolveThesisDomainContext({ thesisTitle: "Využitie AI v diagnostike" } as any)).toContain("Informatika")
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
})
