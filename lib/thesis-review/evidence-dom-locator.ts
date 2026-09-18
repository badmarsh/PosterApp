/**
 * Robust DOM-level evidence locator & highlighter for thesis review.
 *
 * Locates quotes in rendered manuscript DOM (supporting KaTeX math, Markdown tables,
 * diacritics, and varied whitespace), highlights the matching element with animated
 * feedback, and smoothly scrolls it to the center of the viewport.
 */

export function normalizeText(str: string): string {
  if (!str) return ""
  return str
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim()
}

/**
 * Extracts multiple matching candidates from a raw evidence quote:
 * 1. Full quote (cleaned of outer quotes)
 * 2. Math-stripped quote (LaTeX $...$, \[...\], \(...\), and citations [N] stripped)
 * 3. Phrases: distinct continuous textual segments (>= 12 chars)
 * 4. Distinctive keywords: words >= 4 chars not in common stop word list
 */
export function extractQuoteMatchCandidates(rawQuote: string): {
  full: string
  cleaned: string
  phrases: string[]
  keywords: string[]
} {
  if (!rawQuote) {
    return { full: "", cleaned: "", phrases: [], keywords: [] }
  }

  // Strip outer quotes
  let text = rawQuote.trim().replace(/^["'`„“»«]+|["'`„“»«]+$/g, "").trim()

  const full = text

  // Strip LaTeX math blocks and citation brackets
  const cleaned = text
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\\\[[\s\S]*?\\\]/g, " ")
    .replace(/\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, " ")
    .replace(/\$[^$]+\$/g, " ")
    .replace(/\\\([^)]+\\\)/g, " ")
    .replace(/\[\d+(?:[,\s-]+\d+)*\]/g, " ")
    .replace(/\\cite\{[^}]+\}/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  // Extract candidate phrases (split on punctuation, line breaks, math)
  const rawPhrases = text
    .split(/[.,;:!?\n\r"“„»«()\[\]]|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$]+\$/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 14)

  // Sort phrases by length descending (longest unique phrase first)
  const phrases = Array.from(new Set(rawPhrases)).sort((a, b) => b.length - a.length)

  // Stop words for keyword extraction
  const STOP_WORDS = new Set([
    "this", "that", "with", "from", "were", "been", "have", "they", "which",
    "their", "then", "into", "also", "using", "used", "than", "more", "most",
    "tento", "tato", "toto", "bolo", "boli", "bude", "budu", "ktory", "ktora",
    "ktore", "pred", "medzi", "podla", "preto", "takto", "velmi", "dalej"
  ])

  const words = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9áäčďéíĺľňóôŕšťúýž]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))

  const keywords = Array.from(new Set(words))

  return { full, cleaned, phrases, keywords }
}

/** Clears previous evidence highlights and match classes from container */
export function clearEvidenceHighlights(container: HTMLElement): void {
  if (!container) return

  // 1. Unwrap all mark[data-evidence-match]
  const marks = Array.from(container.querySelectorAll("mark[data-evidence-match]"))
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark)
      parent.normalize()
    }
  })

  // 2. Remove block-level match classes
  const blocks = Array.from(container.querySelectorAll(".evidence-block-matched"))
  blocks.forEach((el) => {
    el.classList.remove(
      "evidence-block-matched",
      "ring-2",
      "ring-primary",
      "ring-offset-2",
      "ring-offset-background",
      "bg-primary/10",
      "dark:bg-primary/15",
      "rounded-xl",
      "p-2.5",
      "transition-all",
      "duration-500"
    )
    el.removeAttribute("data-evidence-block")
  })
}

/**
 * Searches and wraps the matched phrase inside text nodes of an element.
 */
function highlightPhraseInTextNodes(el: HTMLElement, phrase: string): boolean {
  if (typeof document === "undefined") return false
  const normPhrase = normalizeText(phrase)
  if (normPhrase.length < 4) return false

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
  const textNodes: Text[] = []
  let n: Text | null
  while ((n = walker.nextNode() as Text | null)) {
    if (n.nodeValue && n.nodeValue.trim().length > 0) {
      textNodes.push(n)
    }
  }

  for (const tNode of textNodes) {
    const val = tNode.nodeValue || ""
    const normVal = normalizeText(val)
    const idx = normVal.indexOf(normPhrase)
    if (idx !== -1) {
      // Find approximate start and length in original string
      const searchLen = Math.min(phrase.length, val.length)
      const origLower = val.toLowerCase()
      const phraseLower = phrase.toLowerCase()
      let start = origLower.indexOf(phraseLower)
      let matchLength = phrase.length

      if (start === -1) {
        // Find best fuzzy boundaries by length
        start = Math.max(0, idx)
        matchLength = Math.min(val.length - start, phrase.length)
      }

      if (start >= 0 && start < val.length) {
        const span = document.createElement("mark")
        span.setAttribute("data-evidence-match", "true")
        span.className = "bg-primary/25 dark:bg-primary/40 text-foreground border-b-2 border-primary font-semibold rounded px-1 py-0.5 shadow-2xs"

        const matchedText = val.substring(start, start + matchLength)
        const afterText = val.substring(start + matchLength)

        tNode.nodeValue = val.substring(0, start)
        span.textContent = matchedText

        const parent = tNode.parentNode
        if (parent) {
          const next = tNode.nextSibling
          parent.insertBefore(span, next)
          if (afterText) {
            parent.insertBefore(document.createTextNode(afterText), span.nextSibling)
          }
          return true
        }
      }
    }
  }

  return false
}

/**
 * Finds the best-matching element for a quote inside the container,
 * applies visual highlighting, and scrolls the element into view.
 */
export function locateAndHighlightEvidence(
  container: HTMLElement,
  rawQuote: string,
  sectionHeading?: string
): HTMLElement | null {
  if (!container || !rawQuote || rawQuote.trim().length < 3) return null

  clearEvidenceHighlights(container)

  const candidates = extractQuoteMatchCandidates(rawQuote)
  const normFull = normalizeText(candidates.full)
  const normCleaned = normalizeText(candidates.cleaned)

  // Query block elements inside markdown container
  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>(
      "div.leading-relaxed, p, li, blockquote, tr, td, h1, h2, h3, h4, figure"
    )
  )

  if (blocks.length === 0) return null

  let bestBlock: HTMLElement | null = null
  let bestMatchedPhrase: string = ""
  let bestScore = -1

  for (const block of blocks) {
    const text = block.textContent || ""
    if (text.trim().length < 5) continue
    const normText = normalizeText(text)

    // Tier 1: Full quote or cleaned quote substring match
    if (normFull.length >= 10 && normText.includes(normFull)) {
      bestBlock = block
      bestMatchedPhrase = candidates.full
      bestScore = 1000
      break
    }
    if (normCleaned.length >= 10 && normText.includes(normCleaned)) {
      bestBlock = block
      bestMatchedPhrase = candidates.cleaned
      bestScore = 900
      break
    }

    // Tier 2: Distinctive phrase match
    for (const phrase of candidates.phrases) {
      const normP = normalizeText(phrase)
      if (normP.length >= 12 && normText.includes(normP)) {
        const score = 500 + normP.length
        if (score > bestScore) {
          bestScore = score
          bestBlock = block
          bestMatchedPhrase = phrase
        }
      }
    }

    // Tier 3: Keyword overlap match
    if (candidates.keywords.length >= 2 && bestScore < 500) {
      let matchedCount = 0
      for (const kw of candidates.keywords) {
        if (normText.includes(kw)) matchedCount++
      }
      const ratio = matchedCount / candidates.keywords.length
      if (ratio >= 0.5 && matchedCount >= 2) {
        const score = 200 + Math.round(ratio * 100)
        if (score > bestScore) {
          bestScore = score
          bestBlock = block
          // Use the first matched keyword or cleaned fragment
          bestMatchedPhrase = candidates.phrases[0] || candidates.keywords[0] || ""
        }
      }
    }
  }

  // Tier 4: Heading fallback if sectionHeading is provided and no block matched
  if (!bestBlock && sectionHeading) {
    const normHeading = normalizeText(sectionHeading)
    for (const block of blocks) {
      if (/^h[1-4]$/i.test(block.tagName)) {
        if (normalizeText(block.textContent || "").includes(normHeading)) {
          bestBlock = block
          bestMatchedPhrase = ""
          break
        }
      }
    }
  }

  if (!bestBlock) return null

  // 1. Highlight inner text if a phrase matched
  if (bestMatchedPhrase) {
    highlightPhraseInTextNodes(bestBlock, bestMatchedPhrase)
  }

  // 2. Decorate the block element
  bestBlock.setAttribute("data-evidence-match", "true")
  bestBlock.setAttribute("data-evidence-block", "true")
  bestBlock.classList.add(
    "evidence-block-matched",
    "ring-2",
    "ring-primary",
    "ring-offset-2",
    "ring-offset-background",
    "bg-primary/10",
    "dark:bg-primary/15",
    "rounded-xl",
    "p-2.5",
    "transition-all",
    "duration-500"
  )

  // 3. Smoothly scroll into center of the viewport
  bestBlock.scrollIntoView({ behavior: "smooth", block: "center" })

  // 4. Smooth fade out of ring after 3 seconds, keeping subtle background
  if (typeof globalThis !== "undefined" && typeof globalThis.setTimeout === "function") {
    globalThis.setTimeout(() => {
      bestBlock?.classList.remove("ring-2", "ring-primary", "ring-offset-2")
    }, 3000)
  }

  return bestBlock
}

/**
 * Highlights all occurrences of a search query in the container and scrolls to the first.
 */
export function highlightSearchQuery(
  container: HTMLElement,
  query: string
): { count: number; firstMatch: HTMLElement | null } {
  if (!container) return { count: 0, firstMatch: null }

  // Clear previous search highlights
  const prevMarks = Array.from(container.querySelectorAll("mark[data-search-match]"))
  prevMarks.forEach((mark) => {
    const parent = mark.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark)
      parent.normalize()
    }
  })

  const trimmed = query.trim()
  if (trimmed.length < 2) return { count: 0, firstMatch: null }

  const normQuery = normalizeText(trimmed)
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  const textNodes: Text[] = []
  let n: Text | null
  while ((n = walker.nextNode() as Text | null)) {
    if (n.nodeValue && n.nodeValue.trim().length > 0) {
      textNodes.push(n)
    }
  }

  let count = 0
  let firstMatch: HTMLElement | null = null

  for (const tNode of textNodes) {
    const val = tNode.nodeValue || ""
    const normVal = normalizeText(val)
    let idx = normVal.indexOf(normQuery)
    if (idx !== -1) {
      const parent = tNode.parentNode as HTMLElement
      if (!parent || parent.tagName === "SCRIPT" || parent.tagName === "STYLE") continue

      const span = document.createElement("mark")
      span.setAttribute("data-search-match", "true")
      span.className = "bg-yellow-300/60 dark:bg-yellow-500/40 text-foreground rounded px-0.5"

      const start = idx
      const end = start + trimmed.length
      const matchedText = val.substring(start, end)
      const afterText = val.substring(end)

      tNode.nodeValue = val.substring(0, start)
      span.textContent = matchedText

      parent.insertBefore(span, tNode.nextSibling)
      if (afterText) {
        parent.insertBefore(document.createTextNode(afterText), span.nextSibling)
      }

      count++
      if (!firstMatch) firstMatch = span
    }
  }

  if (firstMatch) {
    firstMatch.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return { count, firstMatch }
}
