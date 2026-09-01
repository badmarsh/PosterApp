import { describe, it, expect } from "vitest"
import {
  computeSourceRevision,
  extractDocumentStructure,
  computeStructuralQualitySignals,
  buildSourceQualityReport,
  classifyDisciplineAndThesisType,
  computeAcademicMetrics,
  buildTOCTree,
} from "@/lib/ai/document-understanding"

describe("Document Understanding & Intelligence Engine", () => {
  const sampleThesisMarkdown = `
# Kvantová koherencia v supravodivých qubitových systémoch

## Abstrakt
Táto dizertačná práca skúma kvantovú koherenciu a dekoherenčné mechanizmy v supravodivých qubitoch.
Naším cieľom je navrhnúť mikrovlnný rezonátor s nízkymi dielektrickými stratami.

**Kľúčové slová:** kvantová koherencia, supravodivý qubit, Josephsonov prechod, dekoherencia

## 1. Úvod a formulácia problému
Výskum kvantových počítačov naráža na problém dekoherencie spôsobenej interakciou s prostredím.
Cieľom práce je charakterizovať relaxačné časy T1 a defázovacie časy T2 v závislosti od geometrie rezonátora.

## 2. Teoretické východiská
Hamiltonián transmonového qubitu je daný vzťahom H = 4E_c(n - n_g)^2 - E_J cos(phi).
Josephsonova energia E_J určuje nelinearitu systému.

## 3. Metodológia a experimentálne usporiadanie
Experimenty boli vykonané v riediacom kryostate pri teplote 15 mK.
Použili sme vektorový obvodový analyzátor (VNA) a mikrovlnné generátory so synchrónnym vzorkovaním.

Tabuľka 1: Parametre qubitových vzoriek
| Vzorka | E_J / h (GHz) | E_C / h (MHz) | T1 (us) |
|---|---|---|---|
| Q1 | 14.2 | 280 | 45.2 |
| Q2 | 12.8 | 295 | 52.1 |

Obrázok 1: Schéma mikrovlnného rezonátora a kryogénneho zapojenia.

## 4. Výsledky a diskusia
Merania preukázali predĺženie koherenčného času T1 o 35% pri optimalizácii dielektrického rozhrania.
Dosiahnuté výsledky sú v zhode s teoretickým modelom stratových dielektrických tangens.

## 5. Záver
Práca úspešne splnila všetky stanovené ciele. Navrhnuté riešenie je priamo využiteľné pre škálovateľné kvantové procesory.

## Literatúra
1. Devoret, M. H., & Schoelkopf, R. J. (2013). Superconducting circuits for quantum information: an outlook. Science, 339(6124), 1169-1174.
2. Koch, J., et al. (2007). Charge-insensitive qubit design derived from the Cooper pair box. Physical Review A, 76(4), 042319.
3. Barends, R., et al. (2013). Coherent Josephson qubit suitable for scalable quantum computing. Nature, 497(7449), 500-503.
4. Krantz, P., et al. (2019). A quantum engineer's guide to superconducting qubits. Applied Physics Reviews, 6(2), 021318.
5. Wendin, G. (2017). Quantum information processing with superconducting circuits: a review. Reports on Progress in Physics, 80(10), 106001.
6. Clarke, J., & Wilhelm, F. K. (2008). Superconducting quantum bits. Nature, 453(7198), 1031-1042.
7. Oliver, W. D., & Welander, P. B. (2013). Materials in superconducting quantum bits. MRS Bulletin, 38(10), 816-825.
8. Gambetta, J. M., et al. (2017). Building logical qubits in a superconducting quantum processor. npj Quantum Information, 3(1), 1-7.
9. Arute, F., et al. (2019). Quantum supremacy using a programmable superconducting processor. Nature, 574(7779), 505-510.
10. Kjaergaard, M., et al. (2020). Superconducting qubits: Current state of play. Annual Review of Condensed Matter Physics, 11, 369-395.
`

  it("computes deterministic source revision hashes", () => {
    const hash1 = computeSourceRevision(sampleThesisMarkdown)
    const hash2 = computeSourceRevision(sampleThesisMarkdown)
    const hash3 = computeSourceRevision(sampleThesisMarkdown + " extra character")

    expect(hash1).toBe(hash2)
    expect(hash1.length).toBeGreaterThanOrEqual(16)
    expect(hash1).not.toBe(hash3)
  })

  it("extracts document structure, TOC, abstract, figures, tables, and references", () => {
    const structure = extractDocumentStructure(sampleThesisMarkdown)

    expect(structure.abstract).toContain("Táto dizertačná práca skúma kvantovú koherenciu")
    expect(structure.keywords.some((k) => k.includes("kvantová koherencia"))).toBe(true)
    expect(structure.sections.length).toBeGreaterThanOrEqual(6)
    expect(structure.tablesCount).toBeGreaterThanOrEqual(1)
    expect(structure.figuresCount).toBeGreaterThanOrEqual(1)
    expect(structure.detectedReferenceLines.length).toBeGreaterThanOrEqual(10)
    expect(structure.detectedReferenceLines[0]).toContain("Devoret")
  })

  it("computes structural quality signals accurately", () => {
    const structure = extractDocumentStructure(sampleThesisMarkdown)
    const signals = computeStructuralQualitySignals(structure, sampleThesisMarkdown.length, "sk")

    const wordCountSignal = signals.find((s) => s.id === "sig-word-count")
    expect(wordCountSignal).toBeDefined()
    expect(wordCountSignal?.value).toBeGreaterThan(100)

    const refSignal = signals.find((s) => s.id === "sig-references")
    expect(refSignal).toBeDefined()
    expect(refSignal?.status).toBe("good")
  })

  it("builds source quality report and passes quality gate for complete manuscript", () => {
    const report = buildSourceQualityReport(sampleThesisMarkdown, {
      thesisTitle: "Kvantová koherencia",
    }, "sk")

    expect(report.sourceRevision).toBeDefined()
    expect(report.signals.length).toBeGreaterThan(0)
    expect(report.limitations.length).toBe(0)
    expect(report.canProceedToDeepReview).toBe(true)
  })

  it("classifies STEM/Physics discipline and doctoral thesis type with explainable source anchors", () => {
    const classification = classifyDisciplineAndThesisType(sampleThesisMarkdown, {
      thesisTitle: "Kvantová koherencia v supravodivých qubitových systémoch",
      department: "Katedra experimentálnej fyziky",
      institution: "Fakulta matematiky, fyziky a informatiky UK",
      thesisType: "phd",
    }, "sk")

    expect(classification.primaryDiscipline).toContain("Fyzika")
    expect(classification.thesisType).toBe("experimental_physics")
    expect(classification.confidence).toBeGreaterThan(0.7)
    expect(classification.sourceAnchors.length).toBeGreaterThan(0)
    expect(classification.rationale.toLowerCase()).toContain("fyzik")
  })

  it("classifies Cybersecurity & Ethical Hacking thesis accurately without false Physics fallback", () => {
    const hackingMarkdown = `
# Etický hacking a ochrana webových aplikací

## Abstrakt
Diplomová práce se zabývá etickým hackingem, penetračním testováním a ochranou webových aplikací.
Analyzujeme zranitelnosti XSS, SQL injection, CSRF a command injection v prostředí Kali Linux a DVWA s využitím Burp Suite.

## 1. Úvod
Webové aplikace čelí rostoucímu počtu kybernetických hrozeb. Cílem je demonstrovat útoky a navrhnout bezpečnostní opatření.

## 2. Teoretická východiska
Etický hacking představuje autorizované penetrační testování za účelem nalezení bezpečnostních zranitelností před zneužitím útočníky.

## 3. Metodika a realizace testů
Provedení útoků SQL injection, XSS a brute force v testovacím prostředí DVWA.

## 4. Výsledky a komparace
Úspěšnost nasazených ochran před a po aplikaci bezpečnostních patchů.

## 5. Závěr
Navržené postupy efektivně eliminují identifikované zranitelnosti.

## 8 Seznam použitých zdrojů
[1] Stuttard, D., Pinto, M. (2011). The Web Application Hacker's Handbook. Wiley.
[2] OWASP Foundation. (2021). Top 10 Web Application Security Risks.
[3] Regueiro, C. (2018). Kali Linux Revealed. OffSec.
`

    const structure = extractDocumentStructure(hackingMarkdown)
    expect(structure.hasReferencesSection).toBe(true)
    expect(structure.detectedReferenceLines.length).toBeGreaterThanOrEqual(3)

    const classification = classifyDisciplineAndThesisType(hackingMarkdown, {
      thesisTitle: "Etický hacking a ochrana webových aplikací",
      thesisType: "master",
    }, "sk")

    expect(classification.primaryDiscipline).toContain("kybernetická bezpečnosť")
    expect(classification.thesisType).toBe("cybersecurity_audit")
    expect(classification.confidence).toBeGreaterThan(0.8)

    const metrics = computeAcademicMetrics(hackingMarkdown, structure, { thesisType: "master" }, "sk")
    expect(metrics.balance.theoryRatio).toBeGreaterThan(0)
    expect(metrics.balance.practicalRatio).toBeGreaterThan(0)
    expect(metrics.lexical.typeTokenRatio).toBeGreaterThan(0.2)
    expect(metrics.citations.totalReferences).toBeGreaterThanOrEqual(3)
    expect(metrics.imrad.completenessScore).toBeGreaterThan(50)
  })
})
