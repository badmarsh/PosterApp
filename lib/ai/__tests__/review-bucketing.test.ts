import { describe, expect, it } from "vitest"
import {
  bucketFindings,
  buildDoctoralStatutoryClause,
  checkStatutoryPosudok,
  type FindingBucket,
} from "../review-bucketing"
import type { ReviewFinding } from "../review-types"
import { buildReviewExportText, checkExportCompleteness } from "../review-export-check"

function finding(partial: Partial<ReviewFinding>): ReviewFinding {
  return {
    id: partial.id || "f-1",
    category: "methodology",
    title: "Titul",
    explanation: "Vysvetlenie",
    recommendation: "",
    severity: "suggestion",
    confidence: 0.9,
    evidence: [],
    status: "accepted",
    includeInExport: true,
    createdBy: "ai",
    ...partial,
  } as ReviewFinding
}

function bucketOf(f: Partial<ReviewFinding>): FindingBucket {
  const b = bucketFindings([finding(f)])
  if (b.strengths.length) return "strength"
  if (b.major.length) return "major"
  if (b.minor.length) return "minor"
  return "major" // unreachable, keeps the helper total
}

describe("bucketFindings — a merit is never a concern", () => {
  it("routes strength findings out of the minor bucket regardless of severity", () => {
    expect(bucketOf({ findingType: "strength", severity: "suggestion" })).toBe("strength")
    expect(bucketOf({ findingType: "strength", severity: "minor" })).toBe("strength")
    // A strength the model mislabelled as serious is still not a concern.
    expect(bucketOf({ findingType: "strength", severity: "major" })).toBe("strength")
  })

  it("keeps ordinary concerns in their severity buckets", () => {
    expect(bucketOf({ findingType: "risk", severity: "critical" })).toBe("major")
    expect(bucketOf({ findingType: "risk", severity: "major" })).toBe("major")
    expect(bucketOf({ findingType: "weakness", severity: "minor" })).toBe("minor")
    expect(bucketOf({ findingType: "recommendation", severity: "suggestion" })).toBe("minor")
    expect(bucketOf({ severity: "info" })).toBe("minor")
  })

  it("splits a mixed list into exactly three disjoint buckets", () => {
    const buckets = bucketFindings([
      finding({ id: "a", findingType: "strength", severity: "suggestion" }),
      finding({ id: "b", findingType: "strength", severity: "suggestion" }),
      finding({ id: "c", findingType: "risk", severity: "major" }),
      finding({ id: "d", findingType: "weakness", severity: "minor" }),
    ])
    expect(buckets.strengths.map((f) => f.id)).toEqual(["a", "b"])
    expect(buckets.major.map((f) => f.id)).toEqual(["c"])
    expect(buckets.minor.map((f) => f.id)).toEqual(["d"])
  })
})

describe("buildDoctoralStatutoryClause — the right section of the right act", () => {
  it("cites § 67 of Act 131/2002 for Slovak doctoral theses", () => {
    const clause = buildDoctoralStatutoryClause({ language: "sk" })!
    expect(clause).toContain("§ 67")
    expect(clause).toContain("131/2002")
    // § 54 is habilitation/professorship — never a doctoral-thesis basis.
    expect(clause).not.toContain("§ 54")
    expect(clause).toContain("udelenie akademického titulu")
    expect(clause).toContain("PhD")
  })

  it("cites § 54a of Act 111/1998 for Czech theses", () => {
    const clause = buildDoctoralStatutoryClause({ language: "cs" })!
    expect(clause).toContain("§ 54a")
    expect(clause).toContain("111/1998")
  })

  it("detects jurisdiction from the institution when the language is English", () => {
    expect(buildDoctoralStatutoryClause({ language: "en", institution: "Slovenská technická univerzita" })).toContain("§ 67")
    expect(buildDoctoralStatutoryClause({ language: "en", institution: "Universita Karlova" })).toContain("§ 54a")
    // Radboud University follows neither legal system: no citation must be invented.
    expect(buildDoctoralStatutoryClause({ language: "en", institution: "Radboud Universiteit" })).toBeUndefined()
  })
})

describe("checkStatutoryPosudok", () => {
  const doctoralOpponent = {
    thesisType: "phd",
    reviewerRole: "opponent",
    language: "sk",
    institution: "Univerzita Komenského v Bratislave, Fakulta matematiky, fyziky a informatiky",
    reviewKind: "thesis",
  }

  it("does not apply to non-doctoral or non-opponent reviews", () => {
    const r = checkStatutoryPosudok({ input: { ...doctoralOpponent, thesisType: "master" }, text: "hocijaký text" })
    expect(r.applies).toBe(false)
    expect(r.ok).toBe(true)
  })

  it("flags a review that only lists praise", () => {
    const result = checkStatutoryPosudok({
      input: doctoralOpponent,
      text: "Dizertačná práca je na vysokej odbornej úrovni. Výborná práca.",
      citationIssues: [],
    })
    expect(result.applies).toBe(true)
    expect(result.ok).toBe(false)
    expect(result.conclusiveStatementMissing).toBe(true)
    expect(result.problems.join(" ")).toContain("záverečné stanovisko")
  })

  it("accepts a review that covers the statutory items and closes with a verdict", () => {
    const text = [
      "Téma je vysoko aktuálna a nadväzuje na súčasný stav odboru.",
      "Zvolené metódy — meranie korelačných funkcií, fitting, unfolding — sú správné a v dostatočnej detailnej miere opísané.",
      "Výsledky práce prinášajú nové poznatky: porovnanie referenčných vzoriek a ich vplyv na polomer.",
      "Prínos pre rozvoj fyziky vysokých energií je metodologický a interpretačný.",
      "Cieľ práce bol splnený.",
      "Práca spĺňa všetky podmienky na dizertačnú prácu podľa zákona č. 131/2002 Z. z.",
      "Dizertačnú prácu odporúčam na obhajobu a navrhujem udelenie akademického titulu PhD s klasifikačným stupňom prospech.",
    ].join("\n\n")
    const result = checkStatutoryPosudok({ input: doctoralOpponent, text, citationIssues: [] })
    expect(result.missing).toEqual([])
    expect(result.conclusiveStatementMissing).toBe(false)
    expect(result.ok).toBe(true)
  })

  it("matches the conclusive statement regardless of diacritics", () => {
    const withDiacritics = "Dizertacnu pracu odporucam na obhajobu."
    const without = "Dizertačnú prácu odporúčam na obhajobu."
    const a = checkStatutoryPosudok({ input: doctoralOpponent, text: `${without}\nAktuálnosť, metódy, výsledky, prínos pre rozvoj vedy, splnenie cieľa.` })
    const b = checkStatutoryPosudok({ input: doctoralOpponent, text: `${withDiacritics}\nAktualnost, metody, vysledky, prinos pre rozvoj vedy, splnenie ciel'a.` })
    expect(a.conclusiveStatementMissing).toBe(false)
    expect(b.conclusiveStatementMissing).toBe(false)
  })

  it("flags excerpt-bound claims and contradictory citation notes", () => {
    const result = checkStatutoryPosudok({
      input: doctoralOpponent,
      text: "Prácu odporúčam na obhajobu; hodnotenie vychádza z dostupných úryvkov rukopisu.",
      citationIssues: ["0 unverified references found; reference [5] is unverified."],
    })
    expect(result.excerptBoundClaims).toBe(true)
    expect(result.citationNotesContradiction).toBe(true)
    expect(result.ok).toBe(false)
  })
})

describe("review-export-check", () => {
  it("flattens strengths, findings and the statutory clause into the checked text", () => {
    const text = buildReviewExportText({
      summary: "Zhrnutie",
      recommendation: "Prácu odporúčam na obhajobu.",
      strengths: ["Silná stránka"],
      findings: [finding({ title: "Pripomienka", explanation: "Chýba diskusia", severity: "major" })],
      phdEnrichment: { statutoryClause: "Práca spĺňa podmienky podľa § 67 zákona 131/2002 Z. z." },
    })
    expect(text).toContain("Zhrnutie")
    expect(text).toContain("Silná stránka")
    expect(text).toContain("Chýba diskusia")
    expect(text).toContain("§ 67")
    expect(text).not.toContain("undefined")
  })

  it("surfaces the missing statutory items for a doctoral posudok export", () => {
    const result = checkExportCompleteness({
      thesisType: "phd",
      reviewerRole: "opponent",
      reviewKind: "thesis",
      language: "sk",
      summary: "Práca je dobrá.",
      strengths: ["Precízne spracovanie"],
      findings: [finding({ findingType: "strength", severity: "suggestion", explanation: "Výborná štatistika" })],
      citationIssues: [],
    })
    expect(result.applies).toBe(true)
    expect(result.ok).toBe(false)
    expect(result.missing.length).toBeGreaterThan(0)
    expect(result.conclusiveStatementMissing).toBe(true)
  })

  it("does not warn for a master's thesis", () => {
    const result = checkExportCompleteness({
      thesisType: "master",
      reviewerRole: "opponent",
      reviewKind: "thesis",
      language: "sk",
      summary: "Krátky text bez zákonných náležitostí.",
    })
    expect(result.applies).toBe(false)
    expect(result.problems).toEqual([])
  })
})

describe("review-formatters export shape", () => {
  it("numbers sections without holes and never files a strength as a concern", async () => {
    const { formatReviewToMarkdown } = await import("@/lib/export/review-formatters")
    const md = formatReviewToMarkdown({
      thesisType: "phd",
      reviewerRole: "opponent",
      reviewKind: "thesis",
      language: "sk",
      thesisTitle: "Testovacia dizertačná práca",
      studentName: "J. Novák",
      summary: "Práca meria korelácie.",
      strengths: [],
      recommendation: "Prácu odporúčam na obhajobu.",
      findings: [
        finding({
          id: "s1",
          findingType: "strength",
          severity: "suggestion",
          title: "Výborné systémové chyby",
          explanation: "Systémové chyby sú plne kvantifikované.",
          evidence: [{ quote: "systémové chyby", verified: true }],
        }),
        finding({
          id: "m1",
          findingType: "weakness",
          severity: "minor",
          category: "formal",
          title: "Preklepy",
          explanation: "Drobné preklepy v abstrakte.",
        }),
      ],
      phdEnrichment: {
        statutoryClause: "Predložená dizertačná práca spĺňa podmienky podľa § 67 zákona č. 131/2002 Z. z.",
      },
      defenseQuestions: ["Otázka?"],
      citationIssues: [],
      sections: [],
      status: "draft",
      createdAt: "",
      updatedAt: "",
    } as any)

    expect(md).toContain("## 1. Zhrnutie práce")
    expect(md).toContain("## 2. Silné stránky práce")
    expect(md).toContain("Systémové chyby sú plne kvantifikované")
    // no major concerns -> "Drobné pripomienky" is section 3, not 4
    expect(md).toContain("## 3. Drobné pripomienky / Minor Concerns")
    expect(md).not.toContain("Zásadné pripomienky")
    // statutory + conclusive blocks follow
    expect(md).toContain("4. Zákonné podmienky doktorského študijného programu")
    expect(md).toContain("5. Záverečné stanovisko")
    expect(md).toContain("prospel / neprospel")
    expect(md).toContain("## 6. Otázky na autora / Questions for Authors")
  })
})

describe("composer: conclusive-statement placeholder", () => {
  it("marks a doctoral review without the conclusive statement", async () => {
    const { composeFullReviewNarrative } = await import("@/lib/ai/review-composer")
    const composed = composeFullReviewNarrative(
      {
        thesisType: "phd",
        reviewerRole: "opponent",
        reviewKind: "thesis",
        language: "sk",
        thesisTitle: "Dizertačná práca",
        studentName: "J. Novák",
        summary: "Zhrnutie.",
        recommendation: "",
        findings: [],
        sections: [],
        defenseQuestions: [],
        citationIssues: [],
        status: "draft",
        createdAt: "",
        updatedAt: "",
      } as any,
      "author",
      "sk"
    )
    const evalSection = composed.sections.find((s) => s.id === "evaluation_summary")
    expect(evalSection?.content).toContain("DOPNIŤ")
  })

  it("stays silent when the conclusive statement is present", async () => {
    const { composeFullReviewNarrative } = await import("@/lib/ai/review-composer")
    const composed = composeFullReviewNarrative(
      {
        thesisType: "phd",
        reviewerRole: "opponent",
        reviewKind: "thesis",
        language: "sk",
        thesisTitle: "Dizertačná práca",
        studentName: "J. Novák",
        summary: "Zhrnutie.",
        recommendation: "Dizertačnú prácu spĺňajúcu podmienky podľa § 67 zákona č. 131/2002 Z. z. odporúčam na obhajobu.",
        findings: [],
        sections: [],
        defenseQuestions: [],
        citationIssues: [],
        status: "draft",
        createdAt: "",
        updatedAt: "",
      } as any,
      "author",
      "sk"
    )
    const evalSection = composed.sections.find((s) => s.id === "evaluation_summary")
    expect(evalSection?.content).not.toContain("DOPNIŤ")
  })
})

describe("gate sensitivity (regression against the real case)", () => {
  it("accepts a § 67-complete review and rejects a praise-only one", () => {
    const complete = [
      "Téma je aktuálna a nadväzuje na súčasný stav odboru vysokých energií.",
      "Zvolené metódy (korelačné funkcie, fitting, unfolding) sú opísané úplne a reprodukovateľne.",
      "Výsledky prinášajú nové poznatky: kvantitatívny vplyv voľby referenčného súboru.",
      "Prínos pre rozvoj vedy je metodologický a interpretačný.",
      "Cieľ práce bol splnený.",
      "Dizertačná práca spĺňa podmienky podľa § 67 zákona 131/2002. Dizertačnú prácu odporúčam na obhajobu.",
      "Navrhujem udelenie akademického titulu PhD s klasifikačným stupňom prospech.",
    ].join("\n\n")
    expect(checkStatutoryPosudok({
      input: { thesisType: "phd", reviewerRole: "opponent", language: "sk", reviewKind: "thesis", institution: "Univerzita Komenského" },
      text: complete,
    }).ok).toBe(true)

    const praiseOnly = [
      "Dizertačná práca je na vysokej odbornej úrovni.",
      "Medzi prínosy patrí spracovanie dát, validácia s CMS, prehľad literatúry.",
      "Drobné pripomienky: výborná štatistika; precízne grafy; jasné označenie referencií.",
    ].join("\n\n")
    const bad = checkStatutoryPosudok({
      input: { thesisType: "phd", reviewerRole: "opponent", language: "sk", reviewKind: "thesis", institution: "Univerzita Komenského" },
      text: praiseOnly,
    })
    expect(bad.missing.length).toBe(5)
    expect(bad.conclusiveStatementMissing).toBe(true)
    expect(bad.ok).toBe(false)
  })
})
