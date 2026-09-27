/**
 * Strips monotonic margin line numbers from extracted ATLAS-note / thesis PDFs.
 *
 * pdfjs reads the line-number gutter as ordinary text, so a draft comes out as
 * `97 The use of hadronically decaying W boson`. Those tokens dominate the
 * embedding window and break verbatim quote checks (`97 The use` is not in the
 * author's prose). The stripper runs only when a long, nearly +1 sequence is
 * present, so ordinary numbered lists and years are left alone.
 */

export interface MarginLineStrip {
  text: string
  stripped: number
  applied: boolean
}

// The token after the gutter number may be a word ("The use") or a section
// number ("2.1 Reco-to-truth"). The monotonic-chain test, not this regex,
// decides whether the prefix is a line number.
const NUMBERED = /^((?:#{1,6}\s+)?)(\d{2,4})\s+(\S.*)$/

interface Hit {
  index: number
  n: number
}

export function stripMarginLineNumbers(markdown: string): MarginLineStrip {
  if (!markdown) return { text: markdown, stripped: 0, applied: false }
  const lines = markdown.split("\n")
  const hits: Hit[] = []
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.startsWith("<!--")) continue
    const m = NUMBERED.exec(trimmed)
    if (!m) continue
    hits.push({ index: i, n: Number(m[2]) })
  }
  if (hits.length < 40) return { text: markdown, stripped: 0, applied: false }

  // Walk in document order and keep only a +1/+2 chain. Figure labels and
  // page numbers fail this test and stay in the text.
  let last = -1
  const accepted: Hit[] = []
  for (const hit of hits) {
    if (accepted.length === 0) {
      if (continues(hits, hit)) {
        accepted.push(hit)
        last = hit.n
      }
      continue
    }
    const d = hit.n - last
    if (d >= 1 && d <= 2) {
      accepted.push(hit)
      last = hit.n
    }
  }
  if (accepted.length < 40) return { text: markdown, stripped: 0, applied: false }

  const drop = new Map(accepted.map((h) => [h.index, h.n]))
  const out = lines.map((line, i) => {
    if (!drop.has(i)) return line
    return line.replace(/^(\s*(?:#{1,6}\s+)?)(\d{2,4})\s+/, "$1")
  })
  return { text: out.join("\n"), stripped: accepted.length, applied: true }
}

function continues(hits: Hit[], start: Hit): boolean {
  let last = start.n
  let steps = 0
  for (const hit of hits) {
    if (hit.index <= start.index) continue
    const d = hit.n - last
    if (d >= 1 && d <= 2) {
      last = hit.n
      steps++
      if (steps >= 4) return true
    }
    if (hit.n > last + 8) break
  }
  return false
}
