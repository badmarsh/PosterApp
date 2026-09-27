import { describe, expect, it } from "vitest"
import * as fs from "fs"
import * as path from "path"
import {
  assertCorpusChunkIndexMatches,
  assertGoldenChunkReferences,
  loadAndValidateCorpus,
} from "../corpus-chunk-alignment"

const corpusDir = path.resolve("data/eval/corpus")
const goldenDir = path.resolve("data/eval/golden-v2")

describe("golden corpus chunk alignment", () => {
  it("matches the frozen index using the production chunker", () => {
    const documents = loadAndValidateCorpus(corpusDir)
    expect(Object.fromEntries(documents.map((doc) => [doc.docId, doc.chunks.length]))).toEqual({
      "transformer-2017": 44,
      "bert-2018": 80,
      "llm-survey-2023": 149,
    })
  })

  it("rejects a stale chunk preview or count", () => {
    const document = loadAndValidateCorpus(corpusDir)[0]
    const indexPath = path.join(corpusDir, "chunks-index.json")
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"))
    const entries = index[document.docId] as Array<Record<string, unknown>>

    const stalePreview = entries.map((entry) => ({ ...entry }))
    stalePreview[2] = { ...stalePreview[2], preview: "a different chunk" }
    expect(() => assertCorpusChunkIndexMatches(document.docId, document.chunks, stalePreview))
      .toThrow(`Chunk preview mismatch for ${document.chunks[2].id}`)
    expect(() => assertCorpusChunkIndexMatches(document.docId, document.chunks, entries.slice(1)))
      .toThrow("Chunk index count mismatch")
  })

  it("resolves every frozen judgment and rejects unresolved annotator disagreements", () => {
    const documents = loadAndValidateCorpus(corpusDir)
    const queries = fs.readdirSync(goldenDir)
      .filter((file) => /^q-\d+\.json$/.test(file))
      .sort()
      .map((file) => JSON.parse(fs.readFileSync(path.join(goldenDir, file), "utf8")))

    expect(queries).toHaveLength(100)
    expect(() => assertGoldenChunkReferences(queries, documents)).not.toThrow()

    const chunkId = documents[0].chunks[0].id
    expect(() => assertGoldenChunkReferences([{
      id: "q-conflict",
      judgments: [
        { queryId: "q-conflict", chunkId, grade: 3, annotatorId: "annotator-a" },
        { queryId: "q-conflict", chunkId, grade: 2, annotatorId: "annotator-b" },
      ],
    }], documents)).toThrow("Annotator disagreement needs adjudication")

    expect(() => assertGoldenChunkReferences([{
      id: "q-missing",
      judgments: [{ queryId: "q-missing", chunkId: "unknown_0000", grade: 3, annotatorId: "annotator-a" }],
    }], documents)).toThrow("references unknown corpus chunk")
  })
})
