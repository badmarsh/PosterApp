/**
 * Chunker losslessness — the "no silent deletion" regression suite.
 *
 * The invariant under test is the one the retrieval stack depends on:
 *
 *     JOINED_RETRIEVAL_CONTENT ≈ ORIGINAL_CONTENT
 *
 * Every meaningful token of the source must survive into some retrieval unit, and no retrieval
 * unit may contain text the source does not. Whitespace, markdown scaffolding and diacritic *form*
 * are ignored (the chunker normalises tables on purpose and evidence validation is
 * diacritic-tolerant); words, numbers, p-values, symbols and LaTeX are not.
 *
 * Each case here is a construct that a naive splitter gets wrong: decimal commas, p-values,
 * section numbering, abbreviations, pipe/HTML tables, display and inline LaTeX, ISO-690
 * bibliography entries, bullet lists, SK/CS diacritics, a single 4k-char paragraph, and mixed
 * trilingual content. They are regression tests because each one has, at some point in this
 * repository's history, been silently damaged.
 */

import { describe, it, expect } from "vitest"
import { chunkDocument, auditChunkCoverage, splitSentences, splitClauses, CHUNKER_VERSION } from "@/lib/ai/chunker-v2"

/** Runs the full chunker and returns the coverage audit for one markdown document. */
function audit(markdown: string, opts: Parameters<typeof chunkDocument>[3] = {}) {
  const { chunks } = chunkDocument(markdown, "doc-audit", null, opts)
  return { report: auditChunkCoverage(markdown, chunks, "doc-audit"), chunks }
}

const CASES: Array<{ name: string; markdown: string; mustContain: string[] }> = [
  {
    name: "decimal numbers and Slovak decimal commas",
    markdown: `# Kapitola 4: Výsledky

Priemerná presnosť modelu dosiahla hodnotu 0,943, čo zodpovedá zlepšeniu o 3,14 percentuálneho bodu.
Smerodajná odchýlka bola 0,05 a medián 12,5. Hodnota pi bola 3.14159 v anglickom zápise.
`,
    mustContain: ["0,943", "3,14", "0,05", "12,5", "3.14159"],
  },
  {
    name: "p-values, confidence intervals and sample sizes",
    markdown: `## 4.2 Štatistická analýza

Rozdiel medzi skupinami bol štatisticky významný (t(58) = 2,71; p = 0,009; d = 0,71).
95% interval spoľahlivosti bol [0,12; 0,48]. Veľkosť súboru n = 142 respondentov.
Hladina významnosti alpha bola nastavená na 0.05 pred zberom dát.
`,
    mustContain: ["p", "0,009", "0,71", "0,12", "0,48", "142", "0.05", "58"],
  },
  {
    name: "section numbering is never read as a sentence boundary",
    markdown: `# Kapitola 3: Metodika

## 3.1 Návrh experimentu

Postup popísaný v podkapitole 3.1.2 bol použitý bez zmeny. Viď tiež kapitolu 2.3 a obrázok 4.
Výsledky sú v tabuľke 3.
`,
    mustContain: ["3.1.2", "2.3", "3"],
  },
  {
    name: "abbreviations do not split sentences",
    markdown: `## 1.2 Predchádzajúce práce

Práca Novák et al. z roku 2019 popisuje podobný prístup. Autori Horváth a kol. dosiahli presnosť 0,87.
Použili sme metódu cf. pôvodný článok. Odpoveď bola kladná, resp. čiastočne kladná.
`,
    mustContain: ["et", "al", "kol", "cf", "resp", "0,87", "2019"],
  },
  {
    name: "markdown pipe table stays whole",
    markdown: `## 4.1 Porovnanie modelov

| Model | Presnosť | F1 | p-hodnota |
|-------|----------|------|-----------|
| CNN   | 0,912    | 0,901 | 0,003     |
| RNN   | 0,884    | 0,879 | 0,041     |
| Navrhovaný | 0,943 | 0,938 | <0,001  |

Tabuľka ukazuje, že navrhovaný model dosahuje najlepšie výsledky.
`,
    mustContain: ["0,912", "0,884", "0,943", "0,938", "0,003", "0,041", "F1", "Presnosť"],
  },
  {
    name: "HTML table (MinerU output) stays whole",
    markdown: `## 4.3 Výsledky meraní

<table><tr><td>Metóda</td><td>Chyba</td></tr><tr><td>A</td><td>1,23</td></tr><tr><td>B</td><td>0,98</td></tr></table>

Merania boli opakované trikrát.
`,
    mustContain: ["1,23", "0,98", "Metóda", "Chyba"],
  },
  {
    name: "LaTeX display and inline equations keep every symbol",
    markdown: `## 3.3 Matematický model

Stratová funkcia je definovaná ako

$$\\mathcal{L}(\\theta) = -\\frac{1}{N}\\sum_{i=1}^{N} y_i \\log \\hat{y}_i + \\lambda \\|\\theta\\|_2^2$$

kde $\\lambda = 0,001$ je regularizačný parameter a $\\alpha \\leq \\beta$ platí pre všetky $i$.
Gradient $\\nabla_\\theta \\mathcal{L}$ je počítaný analyticky.
`,
    mustContain: ["mathcal", "lambda", "theta", "nabla", "alpha", "beta", "0,001"],
  },
  {
    name: "ISO-690 bibliography entries stay atomic",
    markdown: `# Zoznam bibliografických odkazov

NOVÁK, J. a HORVÁTH, P. Detekcia objektov v reálnom čase. Bratislava: Vydavateľstvo STU, 2019. ISBN 978-80-227-1234-5.
SMITH, A. B., JONES, C. D. Deep learning approaches. In: Proceedings of CVPR. 2021, s. 1234-1243. DOI: 10.1109/CVPR.2021.00123.
[1] LEE, K. Transformer architectures. arXiv:2103.14030, 2021.
`,
    mustContain: ["978-80-227-1234-5", "10.1109", "2103.14030", "1234-1243", "2019", "2021"],
  },
  {
    name: "bullet lists keep every item",
    markdown: `## 2.4 Prínosy práce

- Navrhli sme nový prístup k segmentácii.
- Dosiahli sme zlepšenie o 3,1 % oproti stavu umenia.
- Zverejnili sme dataset s 12 500 anotáciami.
- Overili sme reprodukovateľnosť na troch architektúrach.

Každý prínos je podrobnejšie rozvedený v príslušnej kapitole.
`,
    mustContain: ["segmentácii", "3,1", "12", "500", "anotáciami", "reprodukovateľnosť"],
  },
  {
    name: "Slovak/Czech diacritics survive intact",
    markdown: `# Úvod

Ľubovoľný reťazec s diakritikou: á ä č ď é í ĺ ľ ň ó ô ŕ š ť ú ý ž Á Ä Č Ď É Í Ĺ Ľ Ň Ó Ô Ŕ Š Ť Ú Ý Ž.
Čeština: příliš žluťoučký kůň úpěl ďábelské ódy. Přesnosť merania bola overená.
`,
    mustContain: ["diakritikou", "žluťoučký", "Přesnosť", "merania"],
  },
  {
    name: "a single very long paragraph is fully preserved",
    markdown: `# Kapitola 5: Diskusia

${"Táto veta popisuje jeden aspekt diskusie a je dostatočne dlhá na to, aby presiahla rozpočet tokenov pre jeden chunk. ".repeat(60)}`,
    mustContain: ["diskusie", "rozpočet", "tokenov"],
  },
  {
    name: "multilingual SK/CS/EN document",
    markdown: `# Introduction

This thesis presents a novel approach to object detection in real time.

# Kapitola 1: Úvod

Táto práca sa zaoberá detekciou objektov v reálnom čase.

# Kapitola 2: Metodika

Metodika vychází z předchozích prací a byla ověřena na třech datasetech.
`,
    mustContain: ["novel", "approach", "detekciou", "reálnom", "Metodika", "datasetech"],
  },
  {
    name: "figure captions and mixed structure",
    markdown: `## 4.4 Vizuálne výsledky

Obrázok 4.1: Porovnanie segmentačných máp pre tri architektúry.

$$mAP = \\frac{1}{n}\\sum_{i=1}^{n} AP_i$$

| Architektúra | mAP |
|---|---|
| A | 0,512 |
| B | 0,548 |
`,
    mustContain: ["mAP", "0,512", "0,548", "segmentačných"],
  },
]

describe("chunker losslessness — JOINED_RETRIEVAL_CONTENT ≈ ORIGINAL_CONTENT", () => {
  for (const c of CASES) {
    it(`${c.name}: no meaningful source token is dropped`, () => {
      const { report } = audit(c.markdown)
      expect(report.coverage).toBe(1)
      expect(report.missingTokens).toEqual([])
      expect(report.uncoveredElements).toEqual([])
      expect(report.ok).toBe(true)
    })

    it(`${c.name}: every structurally important literal is retrievable verbatim`, () => {
      const { chunks } = audit(c.markdown)
      const joined = chunks.filter((x) => !x.isParent).map((x) => x.content).join("\n")
      for (const literal of c.mustContain) {
        expect(joined, `missing literal ${JSON.stringify(literal)}`).toContain(literal)
      }
    })

    it(`${c.name}: nothing is fabricated`, () => {
      const { report } = audit(c.markdown)
      expect(report.fabricatedChunks).toEqual([])
    })
  }

  it("never emits a truncated retrieval unit (the […] marker must not exist)", () => {
    for (const c of CASES) {
      const { chunks } = audit(c.markdown)
      for (const ch of chunks) {
        if (ch.isParent) continue
        expect(ch.content.endsWith("[…]"), `chunk ${ch.id} was truncated`).toBe(false)
      }
    }
  })

  it("flags oversized units instead of chopping them", () => {
    const longRun = `# Kapitola\n\n${"jednoslovný ".repeat(900)}`
    const { report, chunks } = audit(longRun)
    expect(report.coverage).toBe(1)
    expect(report.oversizedUnits).toBeGreaterThan(0)
    const oversized = chunks.find((c) => c.oversized)
    expect(oversized).toBeDefined()
    expect(oversized!.content).toContain("jednoslovný")
  })

  it("every retrieval unit carries offsets, section path, element ids and version", () => {
    const md = `# Kapitola 3: Metodika\n\n## 3.1 Návrh\n\nNavrhli sme model.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n`
    const { chunks } = audit(md)
    for (const c of chunks.filter((x) => !x.isParent)) {
      expect(c.startOffset).toBeGreaterThanOrEqual(0)
      expect(c.endOffset).toBeGreaterThan(c.startOffset)
      expect(c.sectionPath).toBeTruthy()
      expect(c.sourceElementIds.length).toBeGreaterThan(0)
      expect(c.chunkerVersion).toBe(CHUNKER_VERSION)
      expect(c.tokenEstimatorVersion).toBeTruthy()
      // pageStart is null here because no anchors were supplied — never synthesised.
      expect(c.pageStart).toBeNull()
    }
  })

  it("page attribution is present when anchors are supplied and null when they are not", () => {
    const md = `# A\n\n${"text ".repeat(400)}\n\n# B\n\n${"druhý ".repeat(400)}`
    const { chunks } = chunkDocument(md, "doc-pages", [{ page: 1, offset: 0 }, { page: 2, offset: 1200 }])
    const units = chunks.filter((c) => !c.isParent)
    expect(units.length).toBeGreaterThan(1)
    expect(new Set(units.map((u) => u.pageStart))).toContain(1)
    const { chunks: noAnchors } = chunkDocument(md, "doc-noanchor")
    expect(noAnchors.filter((c) => !c.isParent).every((c) => c.pageStart === null)).toBe(true)
  })

  it("audit detects a deliberately deleted token (the guard is not vacuous)", () => {
    const md = `# Kapitola\n\nUnikátny termín xylofón sa vyskytuje iba raz v celom texte dokumentu.`
    const { chunks } = chunkDocument(md, "doc-neg")
    const sabotaged = chunks.map((c) => ({ ...c, content: c.content.replace("xylofón", "") }))
    const report = auditChunkCoverage(md, sabotaged, "doc-neg")
    expect(report.coverage).toBeLessThan(1)
    expect(report.missingTokens).toContain("xylofon")
    expect(report.ok).toBe(false)
  })
})

describe("sentence / clause boundary safety", () => {
  it("keeps decimals, section numbers and abbreviations intact", () => {
    expect(splitSentences("p = 0.05 a výsledok bol významný.")).toEqual(["p = 0.05 a výsledok bol významný."])
    expect(splitSentences("Viď kapitolu 3.1 a podkapitolu 3.1.2.")).toEqual(["Viď kapitolu 3.1 a podkapitolu 3.1.2."])
    expect(splitSentences("Novák et al. publikovali prácu. Bola citovaná.")).toEqual([
      "Novák et al. publikovali prácu.",
      "Bola citovaná.",
    ])
    expect(splitSentences("J. Novák a A. B. Smith spolupracovali. Výsledok bol dobrý.")).toEqual([
      "J. Novák a A. B. Smith spolupracovali.",
      "Výsledok bol dobrý.",
    ])
  })

  it("does not split inside display math", () => {
    const text = "Rovnica $$a. b = c$$ platí. Ďalšia veta."
    const parts = splitSentences(text)
    expect(parts.join(" ")).toContain("$$a. b = c$$")
  })

  it("keeps a decimal comma and math content inside one clause", () => {
    const parts = splitClauses("Hodnota bola 3,14 a parameter $\\alpha = 0,5$; potom nasleduje záver.")
    expect(parts.length).toBe(2)
    expect(parts[0]).toContain("3,14")
    expect(parts[0]).toContain("$\\alpha = 0,5$")
  })
})
