#!/usr/bin/env node
/**
 * Generate `public/showcases/posudok-diplomovka-ai.png` — the posudok showcase
 * thumbnail.
 *
 *   pnpm exec tsx scripts/generate-posudok-thumbnail.mjs
 *
 * The other showcase thumbnails are captures of compiled PDFs. A posudok is a
 * form, not a poster, and this environment has no TeX engine, so the thumbnail
 * is drawn from the *real* curated content (student, thesis title, the five
 * assessed criteria and their ratings, the weighted result, the classification)
 * using the same palette and treatment as the `posudok-sk` template. It is a
 * faithful page mockup with the document's actual text — not a grey wireframe.
 *
 * Sizing: 1240 × 1754 px is A4 at 150 dpi and matches the 7:10 card the showcase
 * gallery renders (`aspect-[7/10]`, `object-cover`).
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const OUT = path.join(ROOT, "public", "showcases", "posudok-diplomovka-ai.png")

const W = 1240
const H = 1754
const M = 92 // page margin
const INNER = W - M * 2
const ACCENT = "#1B3A6B"
const INK = "#111827"
const MUTED = "#6b7280"

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Greedy word wrap for the SVG (librsvg does not wrap text by itself). */
function wrap(text, maxChars) {
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ""
  for (const word of words) {
    if (line.length + word.length + 1 > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  return lines
}

const text = (x, y, content, opts = {}) =>
  `<text x="${x}" y="${y}" font-family="${opts.family ?? "DejaVu Serif, serif"}" font-size="${opts.size ?? 15}" ` +
  `fill="${opts.fill ?? INK}"${opts.weight ? ` font-weight="${opts.weight}"` : ""}` +
  `${opts.anchor ? ` text-anchor="${opts.anchor}"` : ""}${opts.italic ? ' font-style="italic"' : ""}>${esc(content)}</text>`

const paragraph = (x, y, content, { size = 13.5, maxChars = 108, leading = 19, fill = "#1f2937", weight, italic } = {}) =>
  wrap(content, maxChars)
    .map((line, i) => text(x, y + i * leading, line, { size, fill, weight, italic }))
    .join("")

const rule = (x, y, w, thick = 2, fill = ACCENT) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${thick}" fill="${fill}"/>`

const IDENTIFICATION = [
  ["Autor práce", "Bc. Martin Kováč"],
  ["Názov diplomovej práce", "Sémantická segmentácia pľúcnych lézií hlbokými reziduálnymi sieťami"],
  ["Typ práce", "Diplomová práca · Aplikovaná informatika a biofyzika · 2025/2026"],
  ["Vypracoval/a", "doc. RNDr. Róbert Astaloš, PhD. (vedúci práce)"],
]

const CRITERIA = [
  ["Splnenie stanovených cieľov a náročnosť zadania", "5 %", "95", "A"],
  ["Odborná úroveň a teoretická báza", "15 %", "95", "A"],
  ["Metodologická primeranosť a postup riešenia", "15 %", "85", "B"],
  ["Validita výsledkov a ich interpretácia", "10 %", "95", "A"],
  ["Diskusia a nadväznosť na ciele", "10 %", "95", "A"],
]

const SUMMARY =
  "Práca rieši sémantickú segmentáciu pľúcnych lézií z CT skenov pomocou hlbokých reziduálnych sietí. Autor navrhol modifikovanú ResNet/U-Net architektúru s hybridnou dice-loss funkciou a attention-gated prepojeniami a dôsledne ju validoval na verejnom referenčnom korpuse LIDC-IDRI."

const CRITIQUE =
  "Experimentálna časť je metodicky solídna; výhrady smerujú k voľbe hyperparametrov. Dataset a protokol: LIDC-IDRI (1018 pacientov) s 5-násobnou krížovou validáciou. Kvalita implementácie: modulárny PyTorch repozitár s unit testami a skriptom reprodukujúcim všetky tabuľky."

const STRENGTHS = [
  "Samostatnosť a iniciatíva: študent si sám dohodol spoluprácu s klinickým pracoviskom a zabezpečil anotácie pre validačnú množinu.",
  "Reprodukovateľnosť: kód, konfigurácie aj predtrénované váhy sú zverejnené s návodom na reprodukciu všetkých tabuliek.",
  "Klinická relevancia: metóda je validovaná spôsobom, ktorý zodpovedá reálnemu diagnostickému postupu.",
]

const CITATIONS = [
  "Chýbajúce DOI: pri položkách č. 12 a 27 chýba DOI alebo trvalý identifikátor; obe sú dohľadateľné v Crossref.",
  "Nekonzistentný štýl: tri položky skracujú názvy konferencií odlišne od zvyšku práce.",
]

const QUESTIONS = [
  "Ako by navrhovaný model reagoval na obrazové artefakty spôsobené pohybom pacienta pri nízko-dávkovom CT?",
  "Aká je výpočtová zložitosť inferencie jedného 3D objemu a je model nasaditeľný v reálnej klinickej prevádzke?",
]

function buildPage() {
  const parts = []
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`)

  // ---- letterhead ----------------------------------------------------------
  parts.push(text(M, M + 22, "Univerzita Komenského v Bratislave", { size: 25, weight: "bold" }))
  parts.push(text(M, M + 48, "Fakulta matematiky, fyziky a informatiky", { size: 17, fill: "#1f2937" }))
  parts.push(text(W - M, M + 18, "doc. RNDr. Róbert Astaloš, PhD.", { size: 14, anchor: "end", fill: MUTED }))
  parts.push(text(W - M, M + 38, "Katedra jadrovej fyziky a biofyziky", { size: 14, anchor: "end", fill: MUTED }))
  parts.push(text(W - M, M + 58, "V Bratislave, 21. mája 2026", { size: 14, anchor: "end", fill: MUTED }))
  parts.push(rule(M, M + 74, INNER, 5))
  parts.push(rule(M, M + 84, INNER, 1.4))

  // ---- title ---------------------------------------------------------------
  parts.push(text(W / 2, M + 152, "POSUDOK ZÁVEREČNEJ PRÁCE", { size: 31, weight: "bold", anchor: "middle" }))
  parts.push(rule(W / 2 - 250, M + 172, 500, 2.6))
  parts.push(rule(W / 2 - 170, M + 182, 340, 1.2))

  // ---- identification ------------------------------------------------------
  let y = M + 236
  parts.push(text(M, y, "IDENTIFIKAČNÉ ÚDAJE PRÁCE", { size: 17, weight: "bold", fill: ACCENT }))
  parts.push(rule(M, y + 9, INNER, 1.6, "#c7d2df"))
  y += 40
  const labelW = 300
  for (const [label, value] of IDENTIFICATION) {
    parts.push(text(M, y, `${label}:`, { size: 14.5, weight: "bold" }))
    const lines = wrap(value, 74)
    lines.forEach((line, i) => parts.push(text(M + labelW, y + i * 20, line, { size: 14.5, fill: "#1f2937" })))
    y += Math.max(1, lines.length) * 20 + 8
  }

  // ---- 1. executive summary -------------------------------------------------
  y += 26
  parts.push(text(M, y, "1. Zhrnutie práce a hlavný prínos (Executive Summary)", { size: 15.5, weight: "bold" }))
  parts.push(rule(M, y + 8, INNER, 1))
  y += 32
  parts.push(paragraph(M, y, SUMMARY, { maxChars: 108, leading: 19 }))
  y += wrap(SUMMARY, 108).length * 19 + 18

  // ---- 2. strengths ---------------------------------------------------------
  parts.push(text(M, y, "2. Silné stránky práce (Key Strengths)", { size: 15.5, weight: "bold" }))
  parts.push(rule(M, y + 8, INNER, 1))
  y += 30
  for (const item of STRENGTHS) {
    const lines = wrap(item, 108)
    parts.push(`<circle cx="${M + 4}" cy="${y - 5}" r="2.4" fill="${ACCENT}"/>`)
    lines.forEach((line, li) => parts.push(text(M + 18, y + li * 19, line, { size: 13.5, fill: "#1f2937" })))
    y += lines.length * 19 + 6
  }
  y += 16

  // ---- 3. weighted criteria table ------------------------------------------
  parts.push(text(M, y, "3. PREHĽAD HODNOTENIA KRITÉRIÍ", { size: 15.5, weight: "bold" }))
  parts.push(rule(M, y + 8, INNER, 1.6, "#c7d2df"))
  y += 34

  const ratingW = 92
  const weightW = 96
  const pointsW = 92
  const nameW = INNER - ratingW - weightW - pointsW
  const headerY = y
  parts.push(text(M, headerY, "Kritérium", { size: 14, weight: "bold" }))
  parts.push(text(M + nameW + weightW / 2, headerY, "Váha", { size: 14, weight: "bold", anchor: "middle" }))
  parts.push(text(M + nameW + weightW + pointsW / 2, headerY, "Body", { size: 14, weight: "bold", anchor: "middle" }))
  parts.push(text(M + INNER, headerY, "Hodnotenie", { size: 14, weight: "bold", anchor: "end" }))
  parts.push(rule(M, headerY + 10, INNER, 1.6))
  y = headerY + 36

  CRITERIA.forEach(([name, weight, points, rating], i) => {
    const lines = wrap(name, 62)
    lines.forEach((line, li) => parts.push(text(M, y + li * 18, line, { size: 13.5, fill: "#1f2937" })))
    parts.push(text(M + nameW + weightW / 2, y, weight, { size: 14, anchor: "middle", fill: "#1f2937" }))
    parts.push(text(M + nameW + weightW + pointsW / 2, y, points, { size: 14, anchor: "middle", fill: "#1f2937" }))
    const boxW = 34
    const boxX = M + INNER - boxW
    parts.push(
      `<rect x="${boxX}" y="${y - 17}" width="${boxW}" height="${boxW}" fill="none" stroke="#111827" stroke-width="1.4"/>`,
    )
    parts.push(text(boxX + boxW / 2, y + 6, rating, { size: 17, weight: "bold", anchor: "middle" }))
    y += Math.max(1, lines.length) * 18 + 8
  })
  parts.push(rule(M, y - 6, INNER, 1.6))
  y += 24
  parts.push(
    text(M, y, "Vážený priemer hodnotených kritérií:", { size: 14, fill: MUTED }) +
      text(M + 268, y, "92.3 % (A)", { size: 15, weight: "bold", fill: ACCENT }) +
      text(M + 400, y, "· 5 / 5 hodnotených kritérií", { size: 13.5, fill: MUTED }),
  )
  parts.push(
    text(M, y + 22, "Stupnica: A – výborne · B – veľmi dobre · C – dobre · D – uspokojivo · E – dostatočne · F – nedostatočne", {
      size: 12.5,
      italic: true,
      fill: MUTED,
    }),
  )
  y += 40

  // ---- 3. per-criterion commentary -----------------------------------------
  parts.push(text(M, y, "4. HODNOTENIE KRITÉRIÍ", { size: 15.5, weight: "bold" }))
  parts.push(rule(M, y + 8, INNER, 1.6, "#c7d2df"))
  y += 34
  const first = CRITERIA[2]
  parts.push(rule(M, y - 12, 4, 20))
  parts.push(text(M + 14, y, `3. ${first[0]}`, { size: 14.5, weight: "bold" }))
  parts.push(text(M + INNER, y, `Hodnotenie: ${first[3]}`, { size: 14, weight: "bold", anchor: "end" }))
  y += 26
  parts.push(paragraph(M, y, CRITIQUE, { maxChars: 108, leading: 19 }))
  y += wrap(CRITIQUE, 108).length * 19 + 22

  // ---- 4. defence questions -------------------------------------------------
  parts.push(text(M, y, "5. OTÁZKY K OBHAJOBE", { size: 15.5, weight: "bold" }))
  parts.push(rule(M, y + 8, INNER, 1.6, "#c7d2df"))
  y += 34
  QUESTIONS.forEach((question, i) => {
    const lines = wrap(question, 106)
    parts.push(text(M, y, `${i + 1}.`, { size: 13.5, weight: "bold" }))
    lines.forEach((line, li) => parts.push(text(M + 26, y + li * 19, line, { size: 13.5, fill: "#1f2937" })))
    y += lines.length * 19 + 8
  })

  // ---- 6. citation notes ----------------------------------------------------
  // The classification panel is anchored to the bottom of the page (as it is in
  // the generated document), so the flowing blocks must stop above it.
  let panelY = H - M - 210
  y = Math.min(y + 10, panelY - 88)
  parts.push(text(M, y, "6. POZNÁMKY K CITÁCIÁM", { size: 15.5, weight: "bold" }))
  parts.push(rule(M, y + 8, INNER, 1))
  y += 26
  for (const item of CITATIONS) {
    const lines = wrap(item, 108)
    parts.push(text(M, y, "•", { size: 13.5, fill: ACCENT }))
    lines.forEach((line, li) => parts.push(text(M + 18, y + li * 19, line, { size: 13.5, fill: "#1f2937" })))
    y += lines.length * 19 + 6
  }

  // ---- 7. classification + signature ---------------------------------------
  parts.push(text(M, panelY, "7. CELKOVÉ HODNOTENIE", { size: 15.5, weight: "bold" }))
  parts.push(rule(M, panelY + 8, INNER, 1.6, "#c7d2df"))
  parts.push(text(M, panelY + 44, "Navrhovaná klasifikácia:", { size: 15 }))
  parts.push(
    `<rect x="${M + 250}" y="${panelY + 22}" width="52" height="34" fill="none" stroke="#111827" stroke-width="1.6"/>`,
  )
  parts.push(text(M + 276, panelY + 47, "A", { size: 21, weight: "bold", anchor: "middle" }))
  parts.push(text(M + INNER, panelY + 44, "ECTS: A · 92.3 % · Výborne", { size: 14.5, anchor: "end", fill: "#1f2937" }))
  parts.push(
    text(M, panelY + 80, "Odporúčanie: Prácu odporúčam k obhajobe pred komisiou pre štátne záverečné skúšky na FMFI UK.", {
      size: 14.5,
      fill: "#1f2937",
    }),
  )
  const sigY = H - M - 58
  parts.push(rule(M, sigY, 400, 1, "#374151"))
  parts.push(text(M, sigY + 20, "Podpis hodnotiteľa/ky", { size: 12.5, fill: MUTED }))
  parts.push(rule(W - M - 320, sigY, 320, 1, "#374151"))
  parts.push(text(W - M - 320, sigY + 20, "Dátum: 21. mája 2026", { size: 12.5, fill: MUTED }))

  parts.push(
    text(W / 2, H - 24, "Posudok vedúceho diplomovej práce · PosterApp · vygenerované z hodnotiaceho rámca SK_ACADEMIC_RUBRIC_V1", {
      size: 11.5,
      fill: "#9ca3af",
      anchor: "middle",
    }),
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Posudok diplomovej práce — náhľad">${parts.join("")}</svg>\n`
}

const svg = buildPage()
const svgPath = OUT.replace(/\.png$/, ".svg")
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(svgPath, svg, "utf8")

let sharpMod = null
try {
  sharpMod = (await import("sharp")).default
} catch (err) {
  console.warn(`[posudok-thumbnail] sharp unavailable (${err.message}); wrote SVG only`)
}

if (sharpMod) {
  await sharpMod(Buffer.from(svg, "utf8")).png({ compressionLevel: 9 }).toFile(OUT)
  const { size } = fs.statSync(OUT)
  console.log(`[posudok-thumbnail] wrote ${path.relative(ROOT, OUT)} (${W}×${H}, ${Math.round(size / 1024)} KB)`)
} else {
  console.log(`[posudok-thumbnail] wrote ${path.relative(ROOT, svgPath)}`)
}
