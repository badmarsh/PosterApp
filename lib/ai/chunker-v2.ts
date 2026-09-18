/**
 * Structure-aware, token-aware hierarchical chunker (chunker v2).
 *
 * What it replaces and why
 * ------------------------
 * The v1 chunker (`document-chunker.ts::chunkMarkdown`) sized chunks in characters and kept a
 * flat list. That produced two concrete problems:
 *
 *   1. **Embedding/chunk mismatch.** A 1500-char Slovak chunk plus its contextual prefix is
 *      ~450–600 tokens; the embedding window is 512. The tail of the chunk never influenced the
 *      vector, so late-section evidence was unreachable by dense retrieval.
 *   2. **No hierarchy.** A hit could not be widened to its section or its neighbours, and there
 *      was no notion of "small unit for retrieval, large unit for reading".
 *
 * This module builds an explicit structural document model and emits a parent/child chunk tree:
 *
 *   document
 *   └── chapter        (heading level 1)
 *       └── section    (level 2)
 *           └── subsection (level 3+)
 *               └── paragraph | table | equation | figure_caption | citation
 *
 * Retrieval units are the **children** (small, precise). Reading units are the **parents**
 * (section-level, token-bounded). Every child carries `parentChunkId`, `previousChunkId`,
 * `nextChunkId`, page range, section path, source element ids, token/char counts and a content
 * hash — everything the evidence layer needs to trace a finding back to a page.
 *
 * Boundary preference (as specified): **subsection → paragraph → sentence → token fallback.**
 * Tables, equations, captions and bibliography entries are atomic: they are emitted whole even
 * when over budget (flagged `oversized`) rather than chopped, because a table without its
 * header row and an equation cut after `\frac{` are worse than useless.
 *
 * Pure and dependency-free (no Prisma, no inference) so it is fully unit-testable.
 *
 * @module chunker-v2
 */

import { createHash } from "crypto"
import { classifySectionKind, type SectionKind } from "./thesis-context"
import { FIGURE_CAPTION_LINE_RE, type ChunkKind } from "./chunking-config"
import { normalizeTablesToMarkdown, describeTableChunk } from "./text-splitter"
import { buildContextualPrefix, describeEquationChunk, type ContextLang } from "./chunk-context"
import { countTokens, packUnitsIntoTokenBudget, truncateToTokenBudget } from "./token-budget"

// ---------------------------------------------------------------------------
// Versions — recorded on every indexed object so reindexing can be triggered
// ---------------------------------------------------------------------------

/** Bump when the segmentation/hierarchy algorithm changes in a way that requires reindexing. */
export const CHUNKER_VERSION = "2.0.0"
/** Bump when the upstream parser output format changes. */
export const PARSER_VERSION = "mineru-md-1"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

export interface ChunkerOptions {
  /** Token budget for a retrieval (child) unit. Small on purpose: precision first. */
  childMaxTokens?: number
  /** Token budget for a reading (parent/section) unit. */
  parentMaxTokens?: number
  /** Tokens reserved for the contextual prefix inside the embedded text. */
  prefixReserveTokens?: number
  /** Characters per token used by the offline estimator. */
  charsPerToken?: number
  /** Emit section-level parent chunks (default true). */
  emitParents?: boolean
  lang?: ContextLang
  documentTitle?: string | null
  domain?: string | null
}

export const DEFAULT_CHILD_MAX_TOKENS = 256
export const DEFAULT_PARENT_MAX_TOKENS = 1024
export const DEFAULT_PREFIX_RESERVE_TOKENS = 96

/** Resolved from env so a deployment can retune without a code change. */
export function resolveChunkerOptions(opts: ChunkerOptions = {}): Required<Omit<ChunkerOptions, "documentTitle" | "domain">> & {
  documentTitle: string | null
  domain: string | null
} {
  return {
    childMaxTokens: opts.childMaxTokens ?? envInt("CHUNK_CHILD_TOKENS", DEFAULT_CHILD_MAX_TOKENS),
    parentMaxTokens: opts.parentMaxTokens ?? envInt("CHUNK_PARENT_TOKENS", DEFAULT_PARENT_MAX_TOKENS),
    prefixReserveTokens: opts.prefixReserveTokens ?? envInt("CHUNK_PREFIX_RESERVE_TOKENS", DEFAULT_PREFIX_RESERVE_TOKENS),
    charsPerToken: opts.charsPerToken ?? 3.6,
    emitParents: opts.emitParents ?? process.env.CHUNK_EMIT_PARENTS !== "false",
    lang: opts.lang ?? "sk",
    documentTitle: opts.documentTitle ?? null,
    domain: opts.domain ?? null,
  }
}

// ---------------------------------------------------------------------------
// Structural document model
// ---------------------------------------------------------------------------

export type ElementType = "paragraph" | "table" | "equation" | "figure_caption" | "citation"
export type ChunkTypeV2 = "section" | ElementType

/** A leaf element of the document model, with exact offsets into the source markdown. */
export interface DocElement {
  id: string
  type: ElementType
  /** Markdown text (HTML tables already normalised to pipe tables). */
  text: string
  startOffset: number
  endOffset: number
}

/** A heading-delimited section. `elements` are its *direct* children. */
export interface DocSection {
  id: string
  level: number
  title: string
  /** Heading stack, root first. */
  path: string[]
  kind: SectionKind
  startOffset: number
  endOffset: number
  elements: DocElement[]
  children: DocSection[]
}

export interface DocumentModel {
  documentId: string
  sections: DocSection[]
  charLength: number
  parserVersion: string
}

/** `{charOffset → page}` anchors, ascending. Produced from MinerU's `middle_json`. */
export interface PageAnchor {
  offset: number
  page: number
}

function shortHash(input: string, len = 16): string {
  return createHash("sha256").update(input, "utf8").digest("hex").slice(0, len)
}

// ---------------------------------------------------------------------------
// Offset-preserving segmentation
// ---------------------------------------------------------------------------

const PIPE_ROW_RE = /^\s*\|.*\|\s*$/
const DISPLAY_MATH_START = /^\s*\$\$/

/**
 * Splits a section body into typed elements **with exact offsets**.
 *
 * `splitIntoStructuralSegments()` in `text-splitter.ts` does the same classification but
 * discards offsets (and normalises HTML tables in place, which shifts them). Retrieval
 * provenance needs offsets, so the segmentation is redone here against the *raw* text and each
 * element stores its own normalised rendering. The predicates are the same ones the v1
 * chunker uses, and `lib/ai/__tests__/chunker-v2.test.ts` asserts the two agree on kinds.
 */
export function segmentSectionBody(body: string, baseOffset: number, sectionKind: SectionKind): DocElement[] {
  const elements: DocElement[] = []
  const lines = body.split("\n")
  // Absolute offset of the start of each line (including its trailing "\n").
  const lineStarts: number[] = []
  let cursor = baseOffset
  for (const line of lines) {
    lineStarts.push(cursor)
    cursor += line.length + 1
  }

  const push = (type: ElementType, startLine: number, endLineExclusive: number) => {
    const raw = lines.slice(startLine, endLineExclusive).join("\n")
    const text = type === "table" ? normalizeTablesToMarkdown(raw).trim() : raw.trim()
    if (!text) return
    const startOffset = lineStarts[startLine]
    const endOffset = lineStarts[Math.min(endLineExclusive, lines.length) - 1] + lines[Math.min(endLineExclusive, lines.length) - 1].length
    elements.push({
      id: `el-${shortHash(`${baseOffset}:${startOffset}:${endOffset}:${type}:${text.length}`, 16)}`,
      type,
      text,
      startOffset,
      endOffset,
    })
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // HTML table block (MinerU emits these for PDF tables).
    if (/<table[\s>]/i.test(line)) {
      let j = i
      while (j < lines.length && !/<\/table>/i.test(lines[j])) j++
      push("table", i, Math.min(j + 1, lines.length))
      i = j + 1
      continue
    }

    // Pipe table.
    if (PIPE_ROW_RE.test(line)) {
      let j = i
      while (j < lines.length && PIPE_ROW_RE.test(lines[j])) j++
      push("table", i, j)
      i = j
      continue
    }

    // Display math: single-line `$$ … $$` or a multi-line block.
    if (DISPLAY_MATH_START.test(line)) {
      const singleLine = /^\s*\$\$.*\$\$\s*$/.test(line) && line.trim().length > 4
      if (singleLine) {
        push("equation", i, i + 1)
        i++
        continue
      }
      let j = i + 1
      while (j < lines.length && !/\$\$\s*$/.test(lines[j])) j++
      push("equation", i, Math.min(j + 1, lines.length))
      i = j + 1
      continue
    }

    // Blank line → element separator.
    if (line.trim() === "") {
      i++
      continue
    }

    // Figure/table caption + one continuation line.
    if (FIGURE_CAPTION_LINE_RE.test(line)) {
      const end = i + 1 < lines.length && lines[i + 1].trim() !== "" && !FIGURE_CAPTION_LINE_RE.test(lines[i + 1]) ? i + 2 : i + 1
      push("figure_caption", i, end)
      i = end
      continue
    }

    // Paragraph: run of consecutive non-blank, non-structural lines.
    let j = i
    while (
      j < lines.length &&
      lines[j].trim() !== "" &&
      !PIPE_ROW_RE.test(lines[j]) &&
      !DISPLAY_MATH_START.test(lines[j]) &&
      !/<table[\s>]/i.test(lines[j]) &&
      !FIGURE_CAPTION_LINE_RE.test(lines[j])
    ) {
      j++
    }
    const block = lines.slice(i, j).join("\n").trim()
    if (sectionKind === "references" && isBibliographyEntry(block)) {
      // Bibliography entries are atomic: splitting one across chunks loses the citation.
      for (const entry of splitBibliographyEntries(block)) {
        const idx = lines.slice(i, j).indexOf(entry.split("\n")[0])
        const startLine = idx >= 0 ? i + idx : i
        push("citation", startLine, startLine + entry.split("\n").length)
      }
    } else {
      push("paragraph", i, j)
    }
    i = j
  }

  return elements
}

/** Heuristic: does this block look like a bibliography entry rather than prose? */
export function isBibliographyEntry(block: string): boolean {
  const first = block.split("\n")[0].trim()
  if (/^(\[\d+\]|\(\d+\)|\d+[.)]\s)/.test(first)) return true
  // "AUTHOR, A. Title. Place: Publisher, year. ISBN …"
  if (/^[\p{Lu}\p{Lu}'’-]{2,}[\p{L}'’-]*,\s*[A-ZÁČĎÉĚÍŇÓÔŘŠŤÚŮÝŽÀ-Þ]/u.test(first) && /\b(19|20)\d{2}\b/.test(block)) return true
  // DOI / ISBN / ISSN present anywhere → almost certainly a reference record.
  if (/\b(doi|isbn|issn)\s*[:.]?\s*[\dXx-]/i.test(block)) return true
  return false
}

/** Splits a references block into individual entries at line starts that begin a new record. */
export function splitBibliographyEntries(block: string): string[] {
  const lines = block.split("\n")
  const entries: string[] = []
  let current: string[] = []
  const startsEntry = (line: string) =>
    /^(\[\d+\]|\(\d+\)|\d+[.)]\s)/.test(line.trim()) ||
    (/^[\p{Lu}\p{Lu}'’-]{2,}[\p{L}'’-]*,\s/u.test(line.trim()) && current.length > 0)
  for (const line of lines) {
    if (line.trim() === "") continue
    if (startsEntry(line) && current.length > 0) {
      entries.push(current.join("\n"))
      current = [line]
    } else {
      current.push(line)
    }
  }
  if (current.length > 0) entries.push(current.join("\n"))
  return entries.length > 0 ? entries : [block]
}

// ---------------------------------------------------------------------------
// Document model construction
// ---------------------------------------------------------------------------

/** Maps a heading level onto the document → chapter → section → subsection hierarchy. */
export function levelToRole(level: number): "chapter" | "section" | "subsection" {
  if (level <= 1) return "chapter"
  if (level === 2) return "section"
  return "subsection"
}

/**
 * Parses Markdown into the structural document model.
 *
 * Headings `#`…`######` delimit sections; the heading stack gives chapter / section /
 * subsection. Text before the first heading becomes a synthetic "Preamble" section so nothing
 * is dropped.
 */
export function buildDocumentModel(markdown: string, documentId: string): DocumentModel {
  const text = markdown.replace(/\r\n/g, "\n")
  const headingRe = /^(#{1,6})\s+(.+)$/gm
  const headings: Array<{ level: number; title: string; startIdx: number; lineEnd: number }> = []
  let m: RegExpExecArray | null
  while ((m = headingRe.exec(text)) !== null) {
    headings.push({ level: m[1].length, title: m[2].trim(), startIdx: m.index, lineEnd: m.index + m[0].length })
  }

  const root: DocSection[] = []
  const stack: DocSection[] = []

  const makeSection = (level: number, title: string, startOffset: number, path: string[]): DocSection => ({
    id: `sec-${shortHash(`${documentId}:${level}:${path.join(">")}:${title}`, 16)}`,
    level,
    title,
    path,
    kind: "unknown",
    startOffset,
    endOffset: startOffset,
    elements: [],
    children: [],
  })

  const closeSection = (section: DocSection, endOffset: number) => {
    section.endOffset = endOffset
  }

  if (headings.length === 0) {
    const pre = makeSection(1, "Preamble", 0, ["Preamble"])
    pre.kind = classifySectionKind("Preamble", text)
    pre.elements = segmentSectionBody(text, 0, pre.kind)
    pre.endOffset = text.length
    root.push(pre)
    return { documentId, sections: root, charLength: text.length, parserVersion: PARSER_VERSION }
  }

  // Text before the first heading.
  const preambleText = text.slice(0, headings[0].startIdx)
  if (preambleText.trim()) {
    const pre = makeSection(1, "Preamble", 0, ["Preamble"])
    pre.kind = classifySectionKind("Preamble", preambleText)
    pre.elements = segmentSectionBody(preambleText, 0, pre.kind)
    pre.endOffset = headings[0].startIdx
    root.push(pre)
  }

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]
    const bodyStart = h.lineEnd
    const bodyEnd = i + 1 < headings.length ? headings[i + 1].startIdx : text.length
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      const popped = stack.pop()!
      closeSection(popped, h.startIdx)
    }
    const path = [...stack.map((s) => s.title), h.title]
    const section = makeSection(h.level, h.title, h.startIdx, path)
    const body = text.slice(bodyStart, bodyEnd).replace(/^\n+/, "")
    const bodyOffset = bodyStart + (text.slice(bodyStart, bodyEnd).length - text.slice(bodyStart, bodyEnd).replace(/^\n+/, "").length)
    section.kind = classifySectionKind(h.title, body)
    section.elements = segmentSectionBody(body, bodyOffset, section.kind)
    section.endOffset = bodyEnd
    if (stack.length === 0) root.push(section)
    else stack[stack.length - 1].children.push(section)
    stack.push(section)
  }
  while (stack.length > 0) {
    const popped = stack.pop()!
    closeSection(popped, text.length)
  }

  return { documentId, sections: root, charLength: text.length, parserVersion: PARSER_VERSION }
}

/** Depth-first walk over every section in document order. */
export function walkSections(sections: DocSection[], visit: (s: DocSection, depth: number) => void, depth = 0): void {
  for (const s of sections) {
    visit(s, depth)
    walkSections(s.children, visit, depth + 1)
  }
}

/** Collects every section that directly owns elements, in document order. */
export function collectLeafSections(model: DocumentModel): DocSection[] {
  const out: DocSection[] = []
  walkSections(model.sections, (s) => {
    if (s.elements.length > 0) out.push(s)
  })
  return out
}

// ---------------------------------------------------------------------------
// Page resolution
// ---------------------------------------------------------------------------

/** Resolves a character offset to a 1-based page, or `null` when no anchors are available. */
export function pageForOffset(offset: number, anchors: PageAnchor[] | null | undefined): number | null {
  if (!anchors || anchors.length === 0) return null
  let page = anchors[0].page
  // Anchors are ascending; a linear scan is fine for the few hundred anchors a thesis has.
  for (const a of anchors) {
    if (a.offset <= offset) page = a.page
    else break
  }
  return page
}

/**
 * Derives page anchors from MinerU's per-page markdown, when the caller can supply it.
 * `pageCharCounts[i]` is the character length of page *i+1* in the same markdown space.
 */
export function anchorsFromPageCharCounts(pageCharCounts: number[]): PageAnchor[] {
  const anchors: PageAnchor[] = []
  let offset = 0
  pageCharCounts.forEach((chars, idx) => {
    anchors.push({ offset, page: idx + 1 })
    offset += Math.max(chars, 1)
  })
  return anchors
}

/**
 * Derives page anchors from an image→page map by locating each image reference in the
 * markdown. This is what the ingestion route has available after MinerU parsing.
 */
export function anchorsFromImagePageMap(markdown: string, imagePages: Record<string, number>): PageAnchor[] {
  const anchors: PageAnchor[] = []
  for (const [filename, page] of Object.entries(imagePages)) {
    if (!filename) continue
    const needle = filename.replace(/^.*\//, "")
    let idx = markdown.indexOf(needle)
    if (idx < 0) idx = markdown.indexOf(needle.replace(/\.[a-z0-9]+$/i, ""))
    if (idx >= 0) anchors.push({ offset: idx, page })
  }
  return anchors.sort((a, b) => a.offset - b.offset)
}

// ---------------------------------------------------------------------------
// Chunk emission
// ---------------------------------------------------------------------------

/** Legacy `DocumentChunk.kind` values, so existing filters keep working. */
function toLegacyKind(type: ChunkTypeV2): ChunkKind {
  if (type === "table") return "table"
  if (type === "equation") return "equation"
  if (type === "figure_caption") return "figure_caption"
  return "prose"
}

export interface HierarchicalChunk {
  /** Deterministic id: stable across reindex for identical content. */
  id: string
  documentId: string
  /** Position in the emitted sequence (0-based). */
  ordinal: number
  content: string
  /** Anthropic-style contextual prefix. Embedded + FTS-indexed; never merged into content. */
  contextPrefix: string
  /** Text that is actually embedded (prefix + specialised description + content). */
  embeddingText: string
  heading: string | null
  chapter: string | null
  section: string | null
  subsection: string | null
  sectionPath: string | null
  sectionKind: SectionKind
  chunkType: ChunkTypeV2
  /** Backwards-compatible `DocumentChunk.kind`. */
  kind: ChunkKind
  pageStart: number | null
  pageEnd: number | null
  startOffset: number
  endOffset: number
  tokenCount: number
  characterCount: number
  contentHash: string
  parentChunkId: string | null
  previousChunkId: string | null
  nextChunkId: string | null
  sourceElementIds: string[]
  /** Section-level reading unit rather than a retrieval unit. */
  isParent: boolean
  /** True when the atomic element did not fit the budget and was emitted whole. */
  oversized: boolean
  chunkerVersion: string
  parserVersion: string
}

interface EmitContext {
  documentId: string
  anchors: PageAnchor[] | null
  opts: ReturnType<typeof resolveChunkerOptions>
  ordinal: number
}

function buildChunk(
  ctx: EmitContext,
  section: DocSection,
  part: {
    content: string
    type: ChunkTypeV2
    elementIds: string[]
    startOffset: number
    endOffset: number
    oversized?: boolean
    isParent?: boolean
    headingSuffix?: string
  }
): HierarchicalChunk {
  const { opts } = ctx
  const headingPath = section.path.join(" > ")
  const chapter = section.path[0] ?? null
  const sec = section.path[1] ?? (section.level === 1 ? section.title : null)
  const subsection = section.path.length > 2 ? section.path.slice(2).join(" > ") : null
  const contentHash = shortHash(part.content, 32)

  const contextPrefix = buildContextualPrefix({
    documentTitle: opts.documentTitle,
    domain: opts.domain,
    heading: section.title,
    headingPath,
    sectionKind: section.kind,
    kind: toLegacyKind(part.type),
    lang: opts.lang,
  })

  const headingLabel = part.isParent
    ? headingPath
    : part.headingSuffix
      ? `${section.title} ${part.headingSuffix}`
      : section.title

  // Structural elements get a retrieval description instead of raw scaffolding: a pipe table's
  // `|---|` rows and a LaTeX body waste the embedding window and never match a natural-language
  // question. Same rule the v1 chunker applies.
  let embeddingText: string
  let storedPrefix = contextPrefix
  if (part.type === "table") {
    const desc = describeTableChunk(part.content, headingLabel)
    embeddingText = `${contextPrefix} ${desc}`
    storedPrefix = `${contextPrefix} ${desc}`
  } else if (part.type === "equation") {
    const desc = describeEquationChunk(part.content, headingLabel)
    embeddingText = `${contextPrefix} ${desc}`
    storedPrefix = `${contextPrefix} ${desc}`
  } else {
    embeddingText = headingLabel ? `${contextPrefix} ${headingLabel}: ${part.content}` : `${contextPrefix} ${part.content}`
  }

  return {
    id: `chk-${shortHash(`${ctx.documentId}|${CHUNKER_VERSION}|${headingPath}|${part.type}|${contentHash}|${part.startOffset}`, 24)}`,
    documentId: ctx.documentId,
    ordinal: ctx.ordinal++,
    content: part.content,
    contextPrefix: storedPrefix,
    embeddingText,
    heading: headingLabel,
    chapter,
    section: sec,
    subsection,
    sectionPath: headingPath,
    sectionKind: section.kind,
    chunkType: part.type,
    kind: toLegacyKind(part.type),
    pageStart: pageForOffset(part.startOffset, ctx.anchors),
    pageEnd: pageForOffset(part.endOffset, ctx.anchors),
    startOffset: part.startOffset,
    endOffset: part.endOffset,
    tokenCount: countTokens(part.content, opts.charsPerToken),
    characterCount: part.content.length,
    contentHash,
    parentChunkId: null,
    previousChunkId: null,
    nextChunkId: null,
    sourceElementIds: part.elementIds,
    isParent: part.isParent ?? false,
    oversized: part.oversized ?? false,
    chunkerVersion: CHUNKER_VERSION,
    parserVersion: PARSER_VERSION,
  }
}

/**
 * Splits an over-budget prose paragraph into sentence units and re-packs them.
 * Implements the boundary preference: paragraph → sentence → token fallback.
 */
export function splitProseToTokenBudget(
  text: string,
  maxTokens: number,
  charsPerToken: number
): { pieces: string[]; oversized: boolean } {
  if (countTokens(text, charsPerToken) <= maxTokens) return { pieces: [text], oversized: false }

  // 1. Paragraph boundaries.
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  if (paragraphs.length > 1) {
    const packed = packUnitsIntoTokenBudget(paragraphs, maxTokens, charsPerToken)
    if (packed.oversized.length === 0) return { pieces: packed.groups.map((g) => g.join("\n\n")), oversized: false }
  }

  // 2. Sentence boundaries.
  const sentences = text
    .split(/(?<=[.!?…]["')\]]?)\s+(?=["'(\[]?[\p{Lu}\p{L}0-9])/u)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length > 1) {
    const packed = packUnitsIntoTokenBudget(sentences, maxTokens, charsPerToken)
    if (packed.oversized.length === 0) return { pieces: packed.groups.map((g) => g.join(" ")), oversized: false }
    // 3. Token fallback for the sentences that are individually over budget.
    const pieces: string[] = []
    for (const group of packed.groups) {
      for (const s of group) {
        if (countTokens(s, charsPerToken) <= maxTokens) pieces.push(s)
        else pieces.push(truncateToTokenBudget(s, maxTokens, charsPerToken))
      }
    }
    return { pieces, oversized: false }
  }

  // 4. Token fallback.
  return { pieces: [truncateToTokenBudget(text, maxTokens, charsPerToken)], oversized: false }
}

export interface ChunkDocumentResult {
  chunks: HierarchicalChunk[]
  sections: number
  elements: number
  oversizedCount: number
}

/**
 * Builds the full chunk tree for a document.
 *
 * @param markdown   Source markdown (as written by the ingestion pipeline).
 * @param documentId IngestFile id.
 * @param anchors    Optional page anchors; when absent, page fields are `null` rather than
 *                   guessed. Fabricating page numbers is explicitly prohibited by the
 *                   evidence validator, so "unknown" is the only acceptable answer.
 */
export function chunkDocument(
  markdown: string,
  documentId: string,
  anchors: PageAnchor[] | null = null,
  opts: ChunkerOptions = {}
): ChunkDocumentResult {
  const resolved = resolveChunkerOptions(opts)
  const model = buildDocumentModel(markdown, documentId)
  const ctx: EmitContext = { documentId, anchors, opts: resolved, ordinal: 0 }
  const chunks: HierarchicalChunk[] = []
  let elementCount = 0

  const leafSections = collectLeafSections(model)

  for (const section of leafSections) {
    elementCount += section.elements.length

    // --- children: the retrieval units -----------------------------------
    const childChunks: HierarchicalChunk[] = []
    for (const el of section.elements) {
      if (el.type === "paragraph" || el.type === "citation") {
        // Prose and bibliography text may be packed/split. Citations are pre-split into
        // entries by segmentSectionBody, so each arrives already atomic.
        if (el.type === "citation") {
          childChunks.push(
            buildChunk(ctx, section, {
              content: el.text,
              type: "citation",
              elementIds: [el.id],
              startOffset: el.startOffset,
              endOffset: el.endOffset,
              oversized: countTokens(el.text, resolved.charsPerToken) > resolved.childMaxTokens,
            })
          )
          continue
        }
        const { pieces, oversized } = splitProseToTokenBudget(el.text, resolved.childMaxTokens, resolved.charsPerToken)
        if (pieces.length === 1) {
          childChunks.push(
            buildChunk(ctx, section, {
              content: pieces[0],
              type: "paragraph",
              elementIds: [el.id],
              startOffset: el.startOffset,
              endOffset: el.endOffset,
              oversized,
            })
          )
        } else {
          // Offsets are approximated proportionally: the paragraph is contiguous, and the
          // split points are only used for page attribution.
          const span = el.endOffset - el.startOffset
          const totalChars = pieces.reduce((s, p) => s + p.length, 0) || 1
          let acc = el.startOffset
          pieces.forEach((piece, idx) => {
            const width = Math.round((piece.length / totalChars) * span)
            const start = idx === 0 ? el.startOffset : acc
            const end = idx === pieces.length - 1 ? el.endOffset : start + width
            acc = end
            childChunks.push(
              buildChunk(ctx, section, {
                content: piece,
                type: "paragraph",
                elementIds: [el.id],
                startOffset: start,
                endOffset: end,
                oversized,
                headingSuffix: pieces.length > 1 ? `[${idx + 1}/${pieces.length}]` : undefined,
              })
            )
          })
        }
        continue
      }

      // Structural elements are atomic — emitted whole even when over budget.
      childChunks.push(
        buildChunk(ctx, section, {
          content: el.text,
          type: el.type,
          elementIds: [el.id],
          startOffset: el.startOffset,
          endOffset: el.endOffset,
          oversized: countTokens(el.text, resolved.charsPerToken) > resolved.childMaxTokens,
        })
      )
    }

    if (childChunks.length === 0) continue

    // --- parent: the reading unit ----------------------------------------
    let parentId: string | null = null
    if (resolved.emitParents) {
      const headingLine = `${"#".repeat(Math.min(6, section.level))} ${section.title}`
      const body = section.elements
        .filter((e) => e.type === "paragraph" || e.type === "citation")
        .map((e) => e.text)
        .join("\n\n")
      const structuralSummary = section.elements
        .filter((e) => e.type !== "paragraph" && e.type !== "citation")
        .map((e) => `[${e.type}] ${e.text.split("\n")[0].slice(0, 160)}`)
        .join("\n")
      const combined = [headingLine, body, structuralSummary].filter(Boolean).join("\n\n")
      const parentText = truncateToTokenBudget(combined, resolved.parentMaxTokens, resolved.charsPerToken)
      const parent = buildChunk(ctx, section, {
        content: parentText,
        type: "section",
        elementIds: section.elements.map((e) => e.id),
        startOffset: section.startOffset,
        endOffset: section.endOffset,
        isParent: true,
      })
      chunks.push(parent)
      parentId = parent.id
    }

    for (const c of childChunks) c.parentChunkId = parentId
    chunks.push(...childChunks)
  }

  // --- sibling links across the whole document (document order) -----------
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]
    if (c.isParent) continue
    // Previous/next among non-parent chunks in the same section chain.
    for (let j = i - 1; j >= 0; j--) {
      if (!chunks[j].isParent) {
        c.previousChunkId = chunks[j].id
        break
      }
    }
    for (let j = i + 1; j < chunks.length; j++) {
      if (!chunks[j].isParent) {
        c.nextChunkId = chunks[j].id
        break
      }
    }
  }

  return {
    chunks,
    sections: leafSections.length,
    elements: elementCount,
    oversizedCount: chunks.filter((c) => c.oversized).length,
  }
}

/**
 * True when the configured chunker is the hierarchical one.
 * `CHUNKER=legacy` restores the pre-upgrade character-sized flat chunker.
 */
export function isHierarchicalChunkerEnabled(): boolean {
  const mode = (process.env.CHUNKER || "hierarchical").toLowerCase()
  return mode !== "legacy" && mode !== "v1"
}
