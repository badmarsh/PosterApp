#!/usr/bin/env node
/**
 * Generate the figure set that ships with PosterApp's curated demo content.
 *
 *   node scripts/generate-demo-figures.mjs
 *
 * Curated demo cards reference these as app-relative URLs (`/figures/x.png`),
 * which `materializePublicFigures()` copies into the LaTeX staging directory at
 * compile/export time. Both an SVG (browser/canvas) and a PNG (pdflatex) are
 * written, because pdflatex cannot read SVG.
 *
 * The artwork is hand-drawn vector primitives rather than an external charting
 * dependency: it has to look like a figure from a real paper — axes, ticks,
 * error bands, legends — and it must never change silently with a library
 * update. Geometry is deterministic, so re-running produces identical bytes.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const OUT = path.join(ROOT, "public", "figures")

const W = 720
const H = 480

// ---------------------------------------------------------------------------
// Small drawing helpers
// ---------------------------------------------------------------------------
const INK = "#111827"
const MUTED = "#6b7280"
const GRID = "#e5e7eb"
const SERIES = ["#b2182b", "#2166ac", "#4d9221", "#d9820b"]

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** A plot frame with axes, ticks and an optional grid. */
function axes({ x0, y0, w, h, xTicks = [], yTicks = [], xLabel = "", yLabel = "", grid = true }) {
  const parts = [
    grid
      ? yTicks
          .map(
            (t) =>
              `<line x1="${x0}" y1="${y0 + h - t.y}" x2="${x0 + w}" y2="${y0 + h - t.y}" stroke="${GRID}" stroke-width="1"/>`,
          )
          .join("")
      : "",
    `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="${INK}" stroke-width="1.4"/>`,
    yTicks
      .map(
        (t) =>
          `<g><line x1="${x0 - 5}" y1="${y0 + h - t.y}" x2="${x0}" y2="${y0 + h - t.y}" stroke="${INK}" stroke-width="1.2"/>` +
          `<text x="${x0 - 9}" y="${y0 + h - t.y + 4}" font-size="12" fill="${MUTED}" text-anchor="end" font-family="Times New Roman, serif">${esc(t.label)}</text></g>`,
      )
      .join(""),
    xTicks
      .map(
        (t) =>
          `<g><line x1="${x0 + t.x}" y1="${y0 + h}" x2="${x0 + t.x}" y2="${y0 + h + 5}" stroke="${INK}" stroke-width="1.2"/>` +
          `<text x="${x0 + t.x}" y="${y0 + h + 19}" font-size="12" fill="${MUTED}" text-anchor="middle" font-family="Times New Roman, serif">${esc(t.label)}</text></g>`,
      )
      .join(""),
    xLabel
      ? `<text x="${x0 + w / 2}" y="${y0 + h + 42}" font-size="13" fill="${INK}" text-anchor="middle" font-family="Times New Roman, serif">${esc(xLabel)}</text>`
      : "",
    yLabel
      ? `<text x="${x0 - 52}" y="${y0 + h / 2}" font-size="13" fill="${INK}" text-anchor="middle" font-family="Times New Roman, serif" transform="rotate(-90 ${x0 - 52} ${y0 + h / 2})">${esc(yLabel)}</text>`
      : "",
  ]
  return parts.join("")
}

function legend({ x, y, labels, colors = SERIES }) {
  return labels
    .map(
      (label, i) =>
        `<g><line x1="${x}" y1="${y + i * 20}" x2="${x + 26}" y2="${y + i * 20}" stroke="${colors[i % colors.length]}" stroke-width="2.6"/>` +
        `<text x="${x + 33}" y="${y + i * 20 + 4}" font-size="12.5" fill="${INK}" font-family="Times New Roman, serif">${esc(label)}</text></g>`,
    )
    .join("")
}

/** Catmull-Rom-ish smoothing over points, emitted as a path. */
function smoothPath(points) {
  if (points.length < 2) return ""
  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    const cx = (x1 + x2) / 2
    d += ` C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
  }
  return d
}

/** Deterministic pseudo-random in [-1, 1] so the art never changes between runs. */
function noise(i, salt = 1) {
  const x = Math.sin((i + 1) * 12.9898 * salt) * 43758.5453
  return 2 * (x - Math.floor(x)) - 1
}

const svg = (body, w = W, h = H) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">` +
  `<rect width="${w}" height="${h}" fill="#ffffff"/>${body}</svg>\n`

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

/** 1. Model architecture: modality encoders → fusion → safety-filtered policy. */
function pipelineArchitecture() {
  const box = (x, y, w, h, label, sub, fill) =>
    `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${fill}" stroke="${INK}" stroke-width="1.3"/>` +
    `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 1 : h / 2 + 4)}" font-size="11.5" font-weight="600" fill="${INK}" text-anchor="middle" font-family="Liberation Serif, Times New Roman, serif">${esc(label)}</text>` +
    (sub
      ? `<text x="${x + w / 2}" y="${y + h / 2 + 12}" font-size="9.5" fill="${MUTED}" text-anchor="middle" font-family="Liberation Serif, Times New Roman, serif">${esc(sub)}</text>`
      : "") +
    `</g>`

  const arrow = (x1, y1, x2, y2, label) =>
    `<g><defs><marker id="a${x1}x${y1}" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path d="M0,0 L7.5,3 L0,6 z" fill="${INK}"/></marker></defs>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="1.4" marker-end="url(#a${x1}x${y1})"/>` +
    (label
      ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 4}" font-size="9.5" fill="${MUTED}" text-anchor="middle" font-family="Liberation Serif, Times New Roman, serif">${esc(label)}</text>`
      : "") +
    `</g>`

  const body = [
    `<text x="360" y="30" font-size="15" font-weight="600" fill="${INK}" text-anchor="middle" font-family="Liberation Serif, Times New Roman, serif">Safety-constrained vision-language-action policy</text>`,
    `<text x="360" y="50" font-size="11.5" fill="${MUTED}" text-anchor="middle" font-family="Liberation Serif, Times New Roman, serif">fused latent state &#8594; constrained action head, 42 Hz closed loop</text>`,

    box(24, 150, 140, 48, "Vision encoder", "ViT-L/14 · 304 M", "#eef2ff"),
    box(24, 212, 140, 48, "Language encoder", "T5-Large · 341 M", "#eef2ff"),
    box(24, 274, 140, 48, "Proprioception", "1 kHz state vector", "#eef2ff"),
    box(204, 176, 136, 120, "Cross-attention", "fusion · 8 heads", "#fef3c7"),
    box(378, 150, 140, 62, "Latent dynamics", "GRU, 512-d", "#dcfce7"),
    box(378, 260, 140, 62, "Safety critic", "CBF filter", "#fee2e2"),
    box(556, 176, 140, 120, "Action head", "42 Hz · 7-DoF", "#e0e7ff"),

    arrow(164, 176, 204, 206, ""),
    arrow(164, 236, 204, 236, ""),
    arrow(164, 296, 204, 266, ""),
    arrow(340, 208, 378, 186, "zₜ"),
    arrow(340, 268, 378, 290, "risk"),
    arrow(518, 182, 556, 208, "π(a|z)"),
    arrow(518, 290, 556, 264, "shield"),

    `<rect x="24" y="352" width="672" height="46" rx="6" fill="#f8fafc" stroke="${GRID}"/>`,
    `<text x="38" y="372" font-size="11" font-weight="600" fill="${INK}" font-family="Liberation Serif, Times New Roman, serif">Control barrier filter</text>`,
    `<text x="38" y="388" font-size="10" fill="${MUTED}" font-family="Liberation Serif, Times New Roman, serif">aₜ = argmin ‖a − π(zₜ)‖² subject to ḣ(zₜ, a) + α h(zₜ) ≥ 0 ·  interventions logged at 0.7 % of 12 400 closed-loop episodes.</text>`,
  ].join("")
  return svg(body, 720, 420)
}

/** 2. Learning curves with confidence bands. */
function trainingCurves() {
  const x0 = 78
  const y0 = 52
  const w = 400
  const h = 330
  const xs = Array.from({ length: 13 }, (_, i) => i)
  const curves = [
    { label: "Ours (constrained)", base: 0.95, rate: 0.5, color: SERIES[0] },
    { label: "DreamerV3", base: 0.74, rate: 0.42, color: SERIES[1] },
    { label: "SAC + HER", base: 0.55, rate: 0.38, color: SERIES[2] },
    { label: "BC baseline", base: 0.38, rate: 0.3, color: SERIES[3] },
  ]
  const px = (i) => x0 + (i / (xs.length - 1)) * w
  const py = (v) => y0 + h - v * h

  const series = curves
    .map((c, ci) => {
      const pts = xs.map((i) => {
        const v = c.base * (1 - Math.exp(-c.rate * i)) * (1 + 0.012 * noise(i, ci + 2))
        return [px(i), py(Math.max(0.02, Math.min(0.99, v)))]
      })
      const bandPts = xs.map((i) => [px(i), py(Math.max(0.01, Math.min(0.995, c.base * (1 - Math.exp(-c.rate * i)) + 0.045))), py(Math.max(0.01, c.base * (1 - Math.exp(-c.rate * i)) - 0.045))])
      const band =
        `M ${bandPts[0][0]} ${bandPts[0][2]} ` +
        bandPts.map((p) => `L ${p[0]} ${p[1]}`).join(" ") +
        " " +
        bandPts
          .slice()
          .reverse()
          .map((p) => `L ${p[0]} ${p[2]}`)
          .join(" ") +
        " Z"
      return (
        `<path d="${band}" fill="${c.color}" opacity="0.16"/>` +
        `<path d="${smoothPath(pts)}" fill="none" stroke="${c.color}" stroke-width="2.4"/>`
      )
    })
    .join("")

  const body =
    axes({
      x0,
      y0,
      w,
      h,
      xTicks: xs.filter((i) => i % 4 === 0).map((i) => ({ x: px(i) - x0, label: String(i * 25) })),
      yTicks: [0, 0.25, 0.5, 0.75, 1].map((v) => ({ y: v * h, label: v.toFixed(2) })),
      xLabel: "Environment steps (×10³)",
      yLabel: "Success rate",
    }) +
    series +
    `<rect x="${x0 + w + 14}" y="${y0 + 10}" width="196" height="${curves.length * 20 + 14}" fill="#ffffff" stroke="${GRID}" rx="4"/>` +
    legend({ x: x0 + w + 24, y: y0 + 30, labels: curves.map((c) => c.label), colors: curves.map((c) => c.color) })
  return svg(body)
}

/** 3. Grouped bars with error bars and a dashed target line. */
function latencyBars() {
  const x0 = 76
  const y0 = 56
  const w = 520
  const h = 322
  const groups = [
    { label: "Tokenizer", values: [12.4, 11.1, 8.2] },
    { label: "Prefill", values: [48.5, 45.0, 31.6] },
    { label: "Decode", values: [22.8, 21.4, 9.7] },
    { label: "Scheduler", values: [9.2, 13.5, 6.1] },
    { label: "Post-proc.", values: [5.4, 5.2, 4.9] },
  ]
  const seriesLabels = ["Monolithic", "Batched", "Ours (speculative)"]
  const max = 60
  const py = (v) => y0 + h - (v / max) * h
  const groupW = w / groups.length
  const barW = 15

  const bars = groups
    .map((g, gi) => {
      const gx = x0 + gi * groupW + groupW * 0.12
      return g.values
        .map((v, si) => {
          const x = gx + si * (barW + 4)
          const err = 0.06 * v + 1.2
          return (
            `<rect x="${x}" y="${py(v)}" width="${barW}" height="${y0 + h - py(v)}" fill="${SERIES[si]}" opacity="0.85"/>` +
            `<line x1="${x + barW / 2}" y1="${py(v - err)}" x2="${x + barW / 2}" y2="${py(v + err)}" stroke="${INK}" stroke-width="1.1"/>` +
            `<line x1="${x + barW / 2 - 3}" y1="${py(v - err)}" x2="${x + barW / 2 + 3}" y2="${py(v - err)}" stroke="${INK}" stroke-width="1.1"/>` +
            `<line x1="${x + barW / 2 - 3}" y1="${py(v + err)}" x2="${x + barW / 2 + 3}" y2="${py(v + err)}" stroke="${INK}" stroke-width="1.1"/>`
          )
        })
        .join("") +
        `<text x="${x0 + gi * groupW + groupW / 2}" y="${y0 + h + 20}" font-size="12.5" fill="${INK}" text-anchor="middle" font-family="Times New Roman, serif">${esc(g.label)}</text>`
    })
    .join("")

  const body =
    axes({
      x0,
      y0,
      w,
      h,
      yTicks: [0, 15, 30, 45, 60].map((v) => ({ y: (v / max) * h, label: String(v) })),
      yLabel: "Latency (ms, p99)",
    }) +
    bars +
    `<line x1="${x0}" y1="${py(20)}" x2="${x0 + w}" y2="${py(20)}" stroke="${MUTED}" stroke-width="1.4" stroke-dasharray="7 5"/>` +
    `<text x="${x0 + w - 6}" y="${py(20) - 7}" font-size="11.5" fill="${MUTED}" text-anchor="end" font-family="Times New Roman, serif">20 ms budget</text>` +
    legend({ x: x0 + 12, y: y0 + 24, labels: seriesLabels, colors: SERIES })
  return svg(body)
}

/** 4. HEP detector cross-section (half-view, layers labelled). */
function detectorCrossSection() {
  const cx = 360
  const cy = 240
  const layers = [
    { r: 62, stroke: "#94a3b8", fill: "#f1f5f9", label: "Beam pipe", dashed: false },
    { r: 96, stroke: "#0ea5e9", fill: "#e0f2fe", label: "Inner tracker (Si)", dashed: false },
    { r: 138, stroke: "#f59e0b", fill: "#fef3c7", label: "ECAL · LAr", dashed: false },
    { r: 186, stroke: "#ef4444", fill: "#fee2e2", label: "HCAL · tiles", dashed: false },
    { r: 244, stroke: "#64748b", fill: "none", label: "Muon system", dashed: true },
  ]
  const arcs = layers
    .map(
      (l, i) =>
        `<circle cx="${cx}" cy="${cy}" r="${l.r}" fill="${i < 4 ? l.fill : "none"}" stroke="${l.stroke}" stroke-width="${i === 4 ? 3 : 2}" ${l.dashed ? 'stroke-dasharray="10 7"' : ""}/>`,
    )
    .join("")

  // Charged track: gentle helix; muon escapes all layers.
  const track = Array.from({ length: 60 }, (_, i) => {
    const t = i / 59
    const angle = -2.35 + t * 0.62
    const radius = 88 + t * 165
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]
  })
  const muon = track.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const labels = [
    { text: "Inner tracker", x: cx + 100, y: cy - 62 },
    { text: "ECAL", x: cx + 148, y: cy - 104 },
    { text: "HCAL", x: cx + 196, y: cy - 150 },
    { text: "Muon chambers", x: cx + 252, y: cy - 208 },
  ]
    .map(
      (l, i) =>
        `<g><line x1="${l.x - 8}" y1="${l.y + 4}" x2="${l.x - 34}" y2="${l.y + 22}" stroke="${MUTED}" stroke-width="1"/>` +
        `<text x="${l.x}" y="${l.y}" font-size="12.5" fill="${INK}" font-family="Times New Roman, serif">${esc(l.text)}</text>` +
        `<text x="${l.x}" y="${l.y + 14}" font-size="11" fill="${MUTED}" font-family="Times New Roman, serif">${["σ = 12 µm", "σ/E = 9%/√E", "σ/E = 52%/√E", "p > 4 GeV"][i]}</text></g>`,
    )
    .join("")

  const body = [
    `<text x="${W / 2}" y="30" font-size="15" font-weight="600" fill="${INK}" text-anchor="middle" font-family="Times New Roman, serif">Detector cross-section (r–φ view, one quadrant)</text>`,
    arcs,
    `<circle cx="${cx}" cy="${cy}" r="4" fill="${INK}"/>`,
    `<text x="${cx + 10}" y="${cy + 18}" font-size="11.5" fill="${MUTED}" font-family="Times New Roman, serif">pp collision</text>`,
    `<polyline points="${muon}" fill="none" stroke="${SERIES[0]}" stroke-width="1.8"/>`,
    labels,
    legend({ x: 40, y: 402, labels: ["Reconstructed track", "Neutral cluster"], colors: [SERIES[0], SERIES[2]] }),
  ].join("")
  return svg(body)
}

/** 5. Invariant-mass histogram with a Gaussian + background fit. */
function massSpectrum() {
  const x0 = 76
  const y0 = 56
  const w = 560
  const h = 322
  const bins = 48
  const px = (i) => x0 + (i / bins) * w
  const py = (v) => y0 + h - v * h
  const counts = Array.from({ length: bins }, (_, i) => {
    const x = i / bins
    const bg = 0.3 * Math.exp(-2.6 * x) + 0.1
    const peak = 0.52 * Math.exp(-Math.pow((x - 0.63) / 0.045, 2))
    const second = 0.16 * Math.exp(-Math.pow((x - 0.83) / 0.06, 2))
    return Math.max(0.02, bg + peak + second + 0.022 * noise(i, 7))
  })
  const barW = w / bins - 2
  const bars = counts
    .map((v, i) => `<rect x="${px(i) + 1}" y="${py(v)}" width="${barW}" height="${y0 + h - py(v)}" fill="#94a3b8" opacity="0.55"/>`)
    .join("")
  const fitPts = Array.from({ length: bins }, (_, i) => {
    const x = i / bins
    return [px(i) + barW / 2, py(0.3 * Math.exp(-2.6 * x) + 0.1 + 0.52 * Math.exp(-Math.pow((x - 0.63) / 0.045, 2)))]
  })

  const body =
    axes({
      x0,
      y0,
      w,
      h,
      xTicks: [0, 0.25, 0.5, 0.75, 1].map((v) => ({ x: v * w, label: (v * 1000).toFixed(0) })),
      yTicks: [0, 0.2, 0.4, 0.6].map((v) => ({ y: v * h, label: v.toFixed(1) })),
      xLabel: "Invariant mass m(γγ) [GeV]",
      yLabel: "Events / (0.5 GeV)",
    }) +
    bars +
    `<path d="${smoothPath(fitPts)}" fill="none" stroke="${SERIES[1]}" stroke-width="2.4"/>` +
    `<line x1="${px(0.63) + barW / 2}" y1="${py(0.72)}" x2="${px(0.63) + barW / 2}" y2="${py(0.62)}" stroke="${INK}" stroke-width="1.2"/>` +
    `<text x="${px(0.63) + barW / 2 + 8}" y="${py(0.72)}" font-size="12" fill="${INK}" font-family="Times New Roman, serif">m = 630.4 ± 1.1 GeV</text>` +
    `<text x="${px(0.63) + barW / 2 + 8}" y="${py(0.72) + 15}" font-size="11.5" fill="${MUTED}" font-family="Times New Roman, serif">local significance 5.8σ</text>` +
    legend({ x: x0 + 16, y: y0 + 22, labels: ["Observed data", "Signal + background fit"], colors: ["#94a3b8", SERIES[1]] })
  return svg(body)
}

/** 6. Dose–response sigmoids with error bars. */
function doseResponse() {
  const x0 = 80
  const y0 = 54
  const w = 520
  const h = 320
  const curves = [
    { label: "Wild type", ec50: 0.42, top: 0.98, color: SERIES[0] },
    { label: "ΔRBD variant", ec50: 1.15, top: 0.92, color: SERIES[1] },
    { label: "P22L escape", ec50: 3.4, top: 0.86, color: SERIES[2] },
    { label: "Combination", ec50: 0.22, top: 0.99, color: SERIES[3] },
  ]
  const logMin = -1.2
  const logMax = 2.4
  const px = (lx) => x0 + ((lx - logMin) / (logMax - logMin)) * w
  const py = (v) => y0 + h - v * h

  const series = curves
    .map((c, ci) => {
      const pts = Array.from({ length: 60 }, (_, i) => {
        const lx = logMin + ((logMax - logMin) * i) / 59
        const hill = c.top / (1 + Math.pow(10, (Math.log10(c.ec50) - lx) * 1.35))
        return [px(lx), py(hill)]
      })
      const points = [0.1, 0.25, 0.5, 1, 2, 4, 8].map((conc, i) => {
        const lx = Math.log10(conc)
        const v = c.top / (1 + Math.pow(10, (Math.log10(c.ec50) - lx) * 1.35)) * (1 + 0.06 * noise(i, ci + 5))
        const err = 0.05
        return (
          `<line x1="${px(lx)}" y1="${py(v - err)}" x2="${px(lx)}" y2="${py(v + err)}" stroke="${c.color}" stroke-width="1.3"/>` +
          `<circle cx="${px(lx)}" cy="${py(v)}" r="3.4" fill="#ffffff" stroke="${c.color}" stroke-width="1.8"/>`
        )
      })
      return `<path d="${smoothPath(pts)}" fill="none" stroke="${c.color}" stroke-width="2.3"/>${points.join("")}`
    })
    .join("")

  const body =
    axes({
      x0,
      y0,
      w,
      h,
      xTicks: [-1, 0, 1, 2].map((v) => ({ x: px(v) - x0, label: `10^${v}` })),
      yTicks: [0, 0.25, 0.5, 0.75, 1].map((v) => ({ y: v * h, label: v.toFixed(2) })),
      xLabel: "Antibody concentration (nM)",
      yLabel: "Neutralisation fraction",
    }) +
    series +
    legend({ x: x0 + 8, y: y0 + 24, labels: curves.map((c) => `${c.label} (EC₅₀ ${c.ec50} nM)`), colors: curves.map((c) => c.color) })
  return svg(body)
}

/** 7. Knockdown screen: bars + individual replicates. */
function knockdownScreen() {
  const x0 = 80
  const y0 = 54
  const w = 480
  const h = 320
  const guides = [
    { label: "NT control", value: 0.04 },
    { label: "gRNA-1", value: 0.62 },
    { label: "gRNA-2", value: 0.71 },
    { label: "gRNA-3", value: 0.94 },
    { label: "gRNA-4", value: 0.88 },
    { label: "ensemble", value: 0.97 },
  ]
  const py = (v) => y0 + h - v * h
  const bw = w / guides.length

  const bars = guides
    .map((g, i) => {
      const x = x0 + i * bw + bw * 0.22
      const width = bw * 0.56
      const replicates = Array.from({ length: 4 }, (_, r) => {
        const v = Math.max(0.01, Math.min(1.05, g.value + 0.035 * noise(r, i + 11)))
        return `<circle cx="${x + (width * (r + 0.5)) / 4}" cy="${py(v)}" r="3" fill="${INK}" opacity="0.55"/>`
      }).join("")
      return (
        `<rect x="${x}" y="${py(g.value)}" width="${width}" height="${y0 + h - py(g.value)}" fill="${i === guides.length - 1 ? SERIES[0] : SERIES[1]}" opacity="${i === guides.length - 1 ? 0.9 : 0.65}"/>` +
        replicates +
        `<text x="${x + width / 2}" y="${py(g.value) - 10}" font-size="11.5" fill="${INK}" text-anchor="middle" font-family="Times New Roman, serif">${g.value.toFixed(2)}</text>` +
        `<text x="${x + width / 2}" y="${y0 + h + 20}" font-size="12.5" fill="${INK}" text-anchor="middle" font-family="Times New Roman, serif">${esc(g.label)}</text>`
      )
    })
    .join("")

  const body =
    axes({
      x0,
      y0,
      w,
      h,
      yTicks: [0, 0.25, 0.5, 0.75, 1].map((v) => ({ y: v * h, label: v.toFixed(2) })),
      yLabel: "Viral RNA knockdown",
    }) +
    bars +
    `<text x="${W / 2}" y="${y0 + h + 48}" font-size="12" fill="${MUTED}" text-anchor="middle" font-family="Times New Roman, serif">Messenger RNA normalised to NT control; points are individual biological replicates (n = 4)</text>`
  return svg(body)
}

/** 8. Lensing convergence map with contours and critical curve. */
function lensingMap() {
  const grid = 15
  const cell = 380 / grid
  const ox = 40
  const oy = 60
  const field = (ix, iy) => {
    const x = (ix / grid) * 2 - 1
    const y = (iy / grid) * 2 - 1
    const halo = 0.9 * Math.exp(-(x * x + y * y) / 0.35)
    const sub = 0.42 * Math.exp(-(((x - 0.45) ** 2 + (y + 0.3) ** 2) / 0.045))
    const sub2 = 0.3 * Math.exp(-(((x + 0.55) ** 2 + (y - 0.25) ** 2) / 0.03))
    return Math.min(1, halo + sub + sub2)
  }
  const cells = []
  for (let iy = 0; iy < grid; iy++) {
    for (let ix = 0; ix < grid; ix++) {
      const v = field(ix + 0.5, iy + 0.5)
      const lightness = 96 - v * 62
      cells.push(
        `<rect x="${ox + ix * cell}" y="${oy + (grid - 1 - iy) * cell}" width="${cell + 0.5}" height="${cell + 0.5}" fill="hsl(212 72% ${lightness.toFixed(1)}%)"/>`,
      )
    }
  }
  const contours = [0.25, 0.45, 0.65].map((level) => {
    const points = []
    for (let iy = 0; iy < grid; iy++) {
      for (let ix = 0; ix < grid; ix++) {
        if (Math.abs(field(ix + 0.5, iy + 0.5) - level) < 0.03) {
          points.push(`<circle cx="${ox + (ix + 0.5) * cell}" cy="${oy + (grid - iy - 0.5) * cell}" r="1.4" fill="${INK}" opacity="0.5"/>`)
        }
      }
    }
    return points.join("")
  })
  const body = [
    `<text x="${W / 2}" y="30" font-size="15" font-weight="600" fill="${INK}" text-anchor="middle" font-family="Times New Roman, serif">Reconstructed convergence κ (subhalo candidates ringed)</text>`,
    cells.join(""),
    contours.join(""),
    `<rect x="${ox}" y="${oy}" width="${grid * cell}" height="${grid * cell}" fill="none" stroke="${INK}" stroke-width="1.2"/>`,
    `<circle cx="${ox + 0.725 * grid * cell}" cy="${oy + (grid - 0.35) * grid * cell}" r="26" fill="none" stroke="${SERIES[0]}" stroke-width="2.2"/>`,
    `<text x="${ox + 0.725 * grid * cell + 32}" y="${oy + (grid - 0.35) * grid * cell - 18}" font-size="12" fill="${SERIES[0]}" font-family="Times New Roman, serif">M ≈ 10⁷ M☉</text>`,
    `<circle cx="${ox + 0.225 * grid * cell}" cy="${oy + (grid - 0.625) * grid * cell}" r="22" fill="none" stroke="${SERIES[0]}" stroke-width="2.2"/>`,
    `<text x="${ox + 0.225 * grid * cell - 30}" y="${oy + (grid - 0.625) * grid * cell - 30}" font-size="12" fill="${SERIES[0]}" font-family="Times New Roman, serif">M ≈ 3 × 10⁶ M☉</text>`,
    `<text x="${ox}" y="${oy + grid * cell + 22}" font-size="12" fill="${MUTED}" font-family="Times New Roman, serif">1′</text>`,
    `<line x1="${ox}" y1="${oy + grid * cell + 18}" x2="${ox + 64}" y2="${oy + grid * cell + 18}" stroke="${INK}" stroke-width="1.6"/>`,
    `<text x="${ox + 420}" y="${oy + 60}" font-size="12" fill="${MUTED}" font-family="Times New Roman, serif">JWST/NIRCam F150W · 0.028″/px</text>`,
  ].join("")
  return svg(body, 700, 480)
}

// ---------------------------------------------------------------------------
// Write SVG + PNG
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Posudok figures — the criteria profile and the weighted result of each
// curated thesis review. Six languages, so a German Gutachten shows a German
// chart rather than a Slovak one with a translated axis label.
// ---------------------------------------------------------------------------

const POSUDOK_LANGS = {
  sk: {
    profileTitle: "Profil hodnotenia kritérií",
    resultTitle: "Vážený výsledok podľa kritérií",
    criteria: ["Ciele", "Teória", "Metodika", "Výsledky", "Diskusia"],
    weighted: "Vážený priemer",
    declared: "Celkové hodnotenie",
  },
  cs: {
    profileTitle: "Profil hodnocení kritérií",
    resultTitle: "Vážený výsledek podle kritérií",
    criteria: ["Téma", "Metodika", "Analýza", "Výsledky", "Citace"],
    weighted: "Vážený průměr",
    declared: "Celkové hodnocení",
  },
  en: {
    profileTitle: "Criteria profile",
    resultTitle: "Weighted result by criterion",
    criteria: ["Objectives", "Method", "Execution", "Ethics", "Limits"],
    weighted: "Weighted average",
    declared: "Overall assessment",
  },
  de: {
    profileTitle: "Profil der Kriterienbewertung",
    resultTitle: "Gewichtetes Ergebnis je Kriterium",
    criteria: ["Relevanz", "Methodik", "Durchführung", "Ergebnisse", "Aufbau"],
    weighted: "Gewichteter Mittelwert",
    declared: "Gesamtbewertung",
  },
  pl: {
    profileTitle: "Profil oceny kryteriów",
    resultTitle: "Wynik ważony według kryteriów",
    criteria: ["Oryginalność", "Metodyka", "Realizacja", "Wyniki", "Cytowania"],
    weighted: "Średnia ważona",
    declared: "Ocena ogólna",
  },
  hu: {
    profileTitle: "Szempontok értékelési profilja",
    resultTitle: "Súlyozott eredmény szempontonként",
    criteria: ["Célkitűzés", "Elmélet", "Módszertan", "Végrehajtás", "Korlátok"],
    weighted: "Súlyozott átlag",
    declared: "Összesített értékelés",
  },
}

/** Per-language scores behind the two posudok figures (points 0–100). */
const POSUDOK_DATA = {
  sk: { points: [95, 95, 85, 95, 95], weights: [5, 15, 15, 10, 10], declared: 92.3, grade: "A" },
  cs: { points: [95, 85, 95, 85, 75], weights: [5, 15, 10, 10, 5], declared: 85.0, grade: "B" },
  en: { points: [95, 95, 95, 95, 85], weights: [5, 15, 10, 5, 5], declared: 90.0, grade: "A" },
  de: { points: [95, 85, 95, 85, 85], weights: [5, 15, 10, 10, 5], declared: 84.2, grade: "B" },
  pl: { points: [95, 85, 95, 95, 85], weights: [10, 15, 10, 10, 5], declared: 88.5, grade: "A" },
  hu: { points: [95, 85, 85, 95, 85], weights: [5, 15, 15, 10, 5], declared: 82.0, grade: "B" },
}

/** Radar chart over the rubric criteria, one ring per ECTS band boundary. */
function posudokProfile(lang) {
  const copy = POSUDOK_LANGS[lang]
  const data = POSUDOK_DATA[lang]
  const cx = 300
  const cy = 232
  const R = 138
  const n = data.points.length
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const at = (i, value) => [cx + Math.cos(angle(i)) * R * (value / 100), cy + Math.sin(angle(i)) * R * (value / 100)]

  const rings = [50, 70, 85, 100]
    .map((level) => {
      const pts = Array.from({ length: n }, (_, i) => at(i, level).map((v) => v.toFixed(1)).join(",")).join(" ")
      const band = level >= 85 ? "#9ecae1" : level >= 70 ? "#c7e3f4" : "#e8f1f8"
      return `<polygon points="${pts}" fill="${level === 100 ? "#ffffff" : band}" fill-opacity="${level === 100 ? 1 : 0.5}" stroke="#94a3b8" stroke-width="1"/>`
    })
    .join("")

  const spokes = Array.from({ length: n }, (_, i) => {
    const [x, y] = at(i, 100)
    const [lx, ly] = at(i, 122)
    const anchor = Math.abs(lx - cx) < 6 ? "middle" : lx > cx ? "start" : "end"
    return (
      `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#94a3b8" stroke-width="1"/>` +
      `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" font-size="12.5" fill="${INK}" text-anchor="${anchor}" font-family="Times New Roman, serif">${esc(copy.criteria[i])}</text>` +
      `<text x="${lx.toFixed(1)}" y="${(ly + 19).toFixed(1)}" font-size="11" fill="${MUTED}" text-anchor="${anchor}" font-family="Times New Roman, serif">${data.points[i]} % \u00b7 w=${data.weights[i]} %</text>`
    )
  }).join("")

  const polygon = Array.from({ length: n }, (_, i) => at(i, data.points[i]).map((v) => v.toFixed(1)).join(",")).join(" ")
  const dots = Array.from({ length: n }, (_, i) => {
    const [x, y] = at(i, data.points[i])
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${SERIES[0]}"/>`
  }).join("")

  return svg(
    `<text x="40" y="46" font-size="17" font-weight="bold" fill="${INK}" font-family="Times New Roman, serif">${esc(copy.profileTitle)}</text>` +
      `<text x="40" y="68" font-size="12.5" fill="${MUTED}" font-family="Times New Roman, serif">${esc(copy.weighted)}: ${data.declared.toFixed(1)} % (ECTS ${data.grade})</text>` +
      rings +
      spokes +
      `<polygon points="${polygon}" fill="${SERIES[0]}" fill-opacity="0.22" stroke="${SERIES[0]}" stroke-width="2.2"/>` +
      dots +
      `<text x="680" y="448" font-size="11.5" text-anchor="end" fill="${MUTED}" font-family="Times New Roman, serif">100 = A, 85 = B, 70 = C, 50 = E</text>`,
  )
}

/** Weighted result per criterion, against the declared overall percentage. */
function posudokResult(lang) {
  const copy = POSUDOK_LANGS[lang]
  const data = POSUDOK_DATA[lang]
  const x0 = 252
  const y0 = 132
  const w = 330
  const barH = 26
  const gap = 18
  const h = data.points.length * (barH + gap) - gap

  const bars = data.points
    .map((point, i) => {
      const y = y0 + i * (barH + gap)
      const width = (point / 100) * w
      const weightWidth = (data.weights[i] / 100) * width
      return (
        `<text x="${x0 - 12}" y="${y + barH / 2 + 4}" font-size="12.5" fill="${INK}" text-anchor="end" font-family="Times New Roman, serif">${esc(copy.criteria[i])}</text>` +
        `<rect x="${x0}" y="${y}" width="${w}" height="${barH}" fill="#f1f5f9"/>` +
        `<rect x="${x0}" y="${y}" width="${width.toFixed(1)}" height="${barH}" fill="${SERIES[0]}" fill-opacity="0.28"/>` +
        `<rect x="${x0}" y="${y}" width="${weightWidth.toFixed(1)}" height="${barH}" fill="${SERIES[0]}"/>` +
        `<text x="${x0 + w - 6}" y="${y + barH / 2 + 4}" font-size="11.5" fill="${MUTED}" text-anchor="end" font-family="Times New Roman, serif">${point} %</text>`
      )
    })
    .join("")

  const meanX = x0 + (data.declared / 100) * w
  return svg(
    `<text x="40" y="44" font-size="17" font-weight="bold" fill="${INK}" font-family="Times New Roman, serif">${esc(copy.resultTitle)}</text>` +
      legend({ x: 40, y: 112, labels: [copy.weighted, copy.declared], colors: [SERIES[0], SERIES[1]] }) +
      `<text x="40" y="204" font-size="12" fill="${MUTED}" font-family="Times New Roman, serif">ECTS ${data.grade}</text>` +
      `<line x1="${x0}" y1="${y0 - 8}" x2="${x0 + w}" y2="${y0 - 8}" stroke="#cbd5e1" stroke-width="1"/>` +
      `<line x1="${x0}" y1="${y0 + h}" x2="${x0 + w}" y2="${y0 + h}" stroke="#cbd5e1" stroke-width="1"/>` +
      bars +
      `<line x1="${meanX.toFixed(1)}" y1="${y0 - 26}" x2="${meanX.toFixed(1)}" y2="${y0 + h + 14}" stroke="${SERIES[1]}" stroke-width="2.2" stroke-dasharray="6 4"/>` +
      `<text x="${meanX.toFixed(1)}" y="${y0 + h + 44}" font-size="12" fill="${SERIES[1]}" text-anchor="middle" font-family="Times New Roman, serif">${esc(copy.declared)}: ${data.declared.toFixed(1)} %</text>` +
      `<text x="680" y="448" font-size="11.5" fill="${MUTED}" text-anchor="end" font-family="Times New Roman, serif">${copy.weighted} ${data.declared.toFixed(1)} % \u00b7 ECTS ${data.grade}</text>`,
  )
}

const POSUDOK_FIGURES = Object.fromEntries(
  Object.keys(POSUDOK_LANGS).flatMap((lang) => [
    [`posudok-profile-${lang}`, posudokProfile(lang)],
    [`posudok-result-${lang}`, posudokResult(lang)],
  ]),
)

const FIGURES = {
  "pipeline-architecture": pipelineArchitecture(),
  "training-curves": trainingCurves(),
  "latency-bars": latencyBars(),
  "detector-cross-section": detectorCrossSection(),
  "mass-spectrum": massSpectrum(),
  "dose-response": doseResponse(),
  "knockdown-screen": knockdownScreen(),
  "lensing-map": lensingMap(),
  ...POSUDOK_FIGURES,
}

fs.mkdirSync(OUT, { recursive: true })

let sharpMod = null
try {
  sharpMod = (await import("sharp")).default
} catch (err) {
  console.warn(`[demo-figures] sharp unavailable (${err.message}); writing SVG only`)
}

for (const [name, markup] of Object.entries(FIGURES)) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), markup, "utf8")
  if (sharpMod) {
    // 2× raster so the figure stays sharp when a poster scales it to 40 cm wide.
    await sharpMod(Buffer.from(markup)).resize({ width: 1440 }).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${name}.png`))
  }
  console.log(`[demo-figures] wrote ${name}.svg${sharpMod ? " + .png" : ""}`)
}
console.log(`[demo-figures] ${Object.keys(FIGURES).length} figures → public/figures/`)
