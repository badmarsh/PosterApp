import * as fs from "fs"
import * as path from "path"
import { chunkMarkdown } from "../document-chunker"

export interface EvalCorpusChunk {
  id: string
  content: string
  heading: string | null
}

export interface EvalCorpusDocument {
  docId: string
  title: string
  path: string
  chunks: EvalCorpusChunk[]
}

interface CorpusManifestEntry {
  docId: string
  title: string
  path: string
}

interface ChunkIndexEntry {
  id: string
  heading: string | null
  preview: string
  chars: number
}

interface GoldenJudgmentReference {
  queryId: string
  chunkId: string
  grade: number
  annotatorId?: string
}

interface GoldenQueryReference {
  id: string
  judgments: GoldenJudgmentReference[]
}

/**
 * Generate benchmark IDs from exactly the same chunks production indexes.
 * Golden judgments refer to these IDs, so an evaluation-only splitter is unsafe.
 */
export function chunkCorpusMarkdown(markdown: string, docId: string): EvalCorpusChunk[] {
  return chunkMarkdown(markdown, docId).map((chunk, ordinal) => ({
    id: `${docId}_${String(ordinal).padStart(4, "0")}`,
    content: chunk.content,
    heading: chunk.heading,
  }))
}

/**
 * Check the committed chunk index produced by corpus-chunk-inspect.test.ts.
 * Besides the ID sequence, validate each chunk's heading, length, and saved
 * preview before any embedding or retrieval work starts.
 */
export function assertCorpusChunkIndexMatches(
  docId: string,
  chunks: readonly EvalCorpusChunk[],
  indexEntries: unknown,
): void {
  if (!Array.isArray(indexEntries)) {
    throw new Error(`Chunk index for ${docId} is missing or is not an array`)
  }
  if (chunks.length !== indexEntries.length) {
    throw new Error(
      `Chunk index count mismatch for ${docId}: production chunker returned ${chunks.length}, index has ${indexEntries.length}`,
    )
  }

  for (let ordinal = 0; ordinal < chunks.length; ordinal++) {
    const chunk = chunks[ordinal]
    const indexed = indexEntries[ordinal] as Partial<ChunkIndexEntry> | null
    const expectedId = `${docId}_${String(ordinal).padStart(4, "0")}`
    if (!indexed || typeof indexed !== "object") {
      throw new Error(`Chunk index entry ${docId}[${ordinal}] is invalid`)
    }
    if (chunk.id !== expectedId || indexed.id !== expectedId) {
      throw new Error(
        `Chunk ID mismatch for ${docId}[${ordinal}]: generated=${chunk.id}, indexed=${String(indexed.id)}, expected=${expectedId}`,
      )
    }
    if (indexed.heading !== chunk.heading) {
      throw new Error(`Chunk heading mismatch for ${chunk.id}`)
    }
    if (indexed.chars !== chunk.content.length) {
      throw new Error(
        `Chunk length mismatch for ${chunk.id}: generated=${chunk.content.length}, indexed=${String(indexed.chars)}`,
      )
    }
    if (indexed.preview !== chunk.content.substring(0, 150)) {
      throw new Error(`Chunk preview mismatch for ${chunk.id}`)
    }
  }
}

/** Load production chunks and validate their saved index metadata before evaluation. */
export function loadAndValidateCorpus(
  corpusDir: string,
  cwd = process.cwd(),
): EvalCorpusDocument[] {
  const manifestPath = path.join(corpusDir, "manifest.json")
  const chunkIndexPath = path.join(corpusDir, "chunks-index.json")
  if (!fs.existsSync(manifestPath)) throw new Error(`Corpus manifest not found: ${manifestPath}`)
  if (!fs.existsSync(chunkIndexPath)) throw new Error(`Corpus chunk index not found: ${chunkIndexPath}`)

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as CorpusManifestEntry[]
  const parsedChunkIndex: unknown = JSON.parse(fs.readFileSync(chunkIndexPath, "utf8"))
  if (!parsedChunkIndex || typeof parsedChunkIndex !== "object" || Array.isArray(parsedChunkIndex)) {
    throw new Error(`Corpus chunk index is invalid: ${chunkIndexPath}`)
  }
  const chunkIndex = parsedChunkIndex as Record<string, unknown>
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error(`Corpus manifest is empty or invalid: ${manifestPath}`)
  }

  const docIds = new Set<string>()
  for (const entry of manifest) {
    if (!entry || typeof entry.docId !== "string" || !entry.docId
      || typeof entry.title !== "string" || typeof entry.path !== "string" || !entry.path) {
      throw new Error(`Invalid corpus manifest entry in ${manifestPath}`)
    }
    if (docIds.has(entry.docId)) throw new Error(`Duplicate corpus docId: ${entry.docId}`)
    docIds.add(entry.docId)
  }

  const indexedDocIds = Object.keys(chunkIndex).sort()
  const manifestDocIds = [...docIds].sort()
  if (JSON.stringify(indexedDocIds) !== JSON.stringify(manifestDocIds)) {
    throw new Error(
      `Chunk-index documents do not match the corpus manifest: index=[${indexedDocIds.join(", ")}], manifest=[${manifestDocIds.join(", ")}]`,
    )
  }

  return manifest.map((entry) => {
    const markdownPath = path.resolve(cwd, entry.path)
    if (!fs.existsSync(markdownPath)) {
      throw new Error(`Corpus document not found: ${markdownPath}`)
    }
    const markdown = fs.readFileSync(markdownPath, "utf8")
    const chunks = chunkCorpusMarkdown(markdown, entry.docId)
    assertCorpusChunkIndexMatches(entry.docId, chunks, chunkIndex[entry.docId])
    return { ...entry, chunks }
  })
}

/**
 * Fail closed on stale/misaligned labels and unresolved multi-annotator
 * disagreements. Repeated judgments for a chunk are allowed only when grades
 * agree; this keeps the benchmark's unique-chunk metrics unambiguous.
 */
export function assertGoldenChunkReferences(
  queries: readonly GoldenQueryReference[],
  documents: readonly EvalCorpusDocument[],
): void {
  const corpusChunkIds = new Set(documents.flatMap((document) => document.chunks.map((chunk) => chunk.id)))
  const queryIds = new Set<string>()

  for (const query of queries) {
    if (!query || typeof query.id !== "string" || !query.id) {
      throw new Error("Golden query has no valid id")
    }
    if (queryIds.has(query.id)) throw new Error(`Duplicate golden query id: ${query.id}`)
    queryIds.add(query.id)
    if (!Array.isArray(query.judgments) || query.judgments.length === 0) {
      throw new Error(`Golden query ${query.id} has no judgments`)
    }

    const gradeByChunk = new Map<string, number>()
    const annotatorChunkPairs = new Set<string>()
    let relevantJudgments = 0
    for (const judgment of query.judgments) {
      if (!judgment || typeof judgment.queryId !== "string"
        || typeof judgment.chunkId !== "string" || !judgment.chunkId
        || typeof judgment.annotatorId !== "string" || !judgment.annotatorId) {
        throw new Error(`Invalid judgment record for ${query.id}`)
      }
      if (judgment.queryId !== query.id) {
        throw new Error(
          `Judgment queryId mismatch for ${query.id}: found ${String(judgment.queryId)}`,
        )
      }
      if (!Number.isInteger(judgment.grade) || judgment.grade < 0 || judgment.grade > 3) {
        throw new Error(`Invalid relevance grade for ${query.id}/${judgment.chunkId}: ${String(judgment.grade)}`)
      }
      if (!corpusChunkIds.has(judgment.chunkId)) {
        throw new Error(`Golden judgment references unknown corpus chunk ${judgment.chunkId} (${query.id})`)
      }
      const annotatorPair = JSON.stringify([judgment.chunkId, judgment.annotatorId])
      if (annotatorChunkPairs.has(annotatorPair)) {
        throw new Error(`Duplicate judgment by ${judgment.annotatorId} for ${query.id}/${judgment.chunkId}`)
      }
      annotatorChunkPairs.add(annotatorPair)

      const existingGrade = gradeByChunk.get(judgment.chunkId)
      if (existingGrade !== undefined && existingGrade !== judgment.grade) {
        throw new Error(
          `Annotator disagreement needs adjudication for ${query.id}/${judgment.chunkId}: ${existingGrade} vs ${judgment.grade}`,
        )
      }
      gradeByChunk.set(judgment.chunkId, judgment.grade)
      if (judgment.grade >= 1) relevantJudgments++
    }
    if (relevantJudgments === 0) throw new Error(`Golden query ${query.id} has no grade >= 1 judgments`)
  }
}
