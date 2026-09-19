/**
 * Index representation versioning.
 *
 * Why this exists
 * ---------------
 * A vector index is only meaningful relative to the exact chain of transformations that produced
 * it: which parser produced the markdown, which chunker split it, which token estimator sized the
 * chunks, which model embedded them, at what width, under what schema. Change any link and every
 * stored vector is silently wrong — worse, it is still *readable*, so retrieval keeps returning
 * results that no longer mean anything.
 *
 * The columns exist (`DocumentChunk.parserVersion`, `.chunkerVersion`, `.embeddingModelVersion`,
 * `.schemaVersion`) but nothing ever compared them against the live configuration, and two of the
 * six versions in the chain had no column at all. This module is the single place that:
 *
 *   1. names the whole chain (`IndexManifest`),
 *   2. compares a stored chunk's chain against the live one (`diffManifest`),
 *   3. decides what that difference requires (`classifyStaleness`), and
 *   4. refuses to write a vector whose width disagrees with the column
 *      (`assertVectorWidth`) — the failure mode that turns a model upgrade into a corrupt index.
 *
 * Nothing here talks to the database; the callers pass rows in. That keeps it testable without a
 * Prisma client and makes the decision auditable.
 *
 * @module index-version
 */

import { CHUNKER_VERSION, PARSER_VERSION } from "./chunker-v2"
import { TOKEN_ESTIMATOR_VERSION } from "./token-budget"
import { getEmbeddingModel } from "./model-registry"

/**
 * Bumped when the *meaning* of stored columns changes in a way that invalidates retrieval, e.g.
 * the evidence model gained hierarchy columns, or a column started being populated that queries
 * already filtered on. Additive nullable columns that no query depends on do NOT bump this.
 */
export const INDEX_SCHEMA_VERSION = "2.0"

/** Every version that participates in the representation of an indexed chunk. */
export interface IndexManifest {
  parserVersion: string
  chunkerVersion: string
  tokenEstimatorVersion: string
  embeddingModel: string
  embeddingBackend: string
  embeddingDimensions: number
  schemaVersion: string
}

/** Builds the manifest for the *currently configured* pipeline. */
export function currentManifest(): IndexManifest {
  const cfg = getEmbeddingModel().getModelInfo()
  const backend = cfg.backend
  return {
    parserVersion: PARSER_VERSION,
    chunkerVersion: CHUNKER_VERSION,
    tokenEstimatorVersion: TOKEN_ESTIMATOR_VERSION,
    embeddingModel: cfg.id,
    embeddingBackend: backend,
    embeddingDimensions: getEmbeddingModel().getDimensions(),
    schemaVersion: INDEX_SCHEMA_VERSION,
  }
}

/**
 * A stable key for the manifest, used as `DocumentChunk.indexVersion` and as the idempotency key
 * for reindex jobs. Sorted so field order cannot change the hash.
 */
export function manifestKey(m: IndexManifest): string {
  return [
    `parser=${m.parserVersion}`,
    `chunker=${m.chunkerVersion}`,
    `tokens=${m.tokenEstimatorVersion}`,
    `emb=${m.embeddingModel}`,
    `backend=${m.embeddingBackend}`,
    `dim=${m.embeddingDimensions}`,
    `schema=${m.schemaVersion}`,
  ].join("|")
}

/** What a stored row claims about how it was produced. NULL means "unknown", never "current". */
export interface StoredVersions {
  parserVersion?: string | null
  chunkerVersion?: string | null
  tokenEstimatorVersion?: string | null
  embeddingModelVersion?: string | null
  embeddingDimensions?: number | null
  schemaVersion?: string | null
}

/** One link in the chain that no longer matches. */
export interface ManifestDiff {
  field: keyof IndexManifest
  stored: string | null
  current: string
}

export function diffManifest(stored: StoredVersions, current: IndexManifest = currentManifest()): ManifestDiff[] {
  const diffs: ManifestDiff[] = []
  const cmp = (field: keyof IndexManifest, storedValue: string | number | null | undefined) => {
    const cur = String(current[field])
    const was = storedValue === null || storedValue === undefined ? null : String(storedValue)
    if (was !== cur) diffs.push({ field, stored: was, current: cur })
  }
  cmp("parserVersion", stored.parserVersion)
  cmp("chunkerVersion", stored.chunkerVersion)
  cmp("tokenEstimatorVersion", stored.tokenEstimatorVersion)
  cmp("embeddingModel", stored.embeddingModelVersion)
  cmp("embeddingDimensions", stored.embeddingDimensions)
  cmp("schemaVersion", stored.schemaVersion)
  return diffs
}

export type StalenessLevel =
  /** Row is current; no work needed. */
  | "fresh"
  /** Content is fine, but the vector was produced by a different model/width. */
  | "reembed"
  /** Chunk boundaries themselves changed; the document must be re-chunked. */
  | "rechunk"
  /** The stored row does not record its provenance. Treated as rechunk: unknown is not current. */
  | "unknown"

export interface StalenessVerdict {
  level: StalenessLevel
  diffs: ManifestDiff[]
  /** Human-readable reason, safe to show an operator. */
  reason: string
}

/**
 * Classifies one stored row.
 *
 * The ordering matters and is deliberate:
 *   * a chunker/parser change invalidates boundaries ⇒ `rechunk` (a re-embed would keep stale spans)
 *   * a model/width change keeps boundaries but invalidates vectors ⇒ `reembed`
 *   * a token-estimator change alters *sizing*, so boundaries move ⇒ `rechunk`
 *   * a schema change alone is a `rechunk` only when it is a major bump, otherwise `reembed`
 *   * `NULL` provenance is `unknown`, and `unknown` is never treated as fresh.
 */
export function classifyStaleness(stored: StoredVersions, current: IndexManifest = currentManifest()): StalenessVerdict {
  const diffs = diffManifest(stored, current)
  if (diffs.length === 0) return { level: "fresh", diffs, reason: "index representation is current" }

  const fields = new Set(diffs.map((d) => d.field))
  const has = (f: keyof IndexManifest) => fields.has(f)

  if (has("parserVersion") || has("chunkerVersion") || has("tokenEstimatorVersion")) {
    return {
      level: "rechunk",
      diffs,
      reason: `chunk boundaries changed (${[...fields].join(", ")}) — document must be re-chunked and re-embedded`,
    }
  }
  if (has("embeddingModel") || has("embeddingDimensions") || has("embeddingBackend")) {
    return {
      level: "reembed",
      diffs,
      reason: `embedding representation changed (${[...fields].join(", ")}) — vectors must be recomputed`,
    }
  }
  return {
    level: "rechunk",
    diffs,
    reason: `index schema changed (${[...fields].join(", ")}) — reindex required`,
  }
}

/**
 * Classifies a whole document/workspace index.
 *
 * Returns the *worst* verdict across rows, because a mixed index is the dangerous case: half the
 * vectors come from model A and half from model B, and cosine distances between them are
 * meaningless. `mixed` is reported explicitly so an operator sees it rather than getting an
 * average that hides it.
 */
export function classifyIndexStaleness(
  rows: StoredVersions[],
  current: IndexManifest = currentManifest()
): StalenessVerdict & { rowCount: number; freshCount: number; unknownCount: number; mixed: boolean } {
  const verdicts = rows.map((r) => classifyStaleness(r, current))
  const freshCount = verdicts.filter((v) => v.level === "fresh").length
  const unknownCount = rows.filter(
    (r) =>
      r.parserVersion == null &&
      r.chunkerVersion == null &&
      r.embeddingModelVersion == null &&
      r.schemaVersion == null
  ).length

  if (rows.length === 0) {
    return {
      level: "unknown",
      diffs: [],
      reason: "no chunks indexed for this scope",
      rowCount: 0,
      freshCount: 0,
      unknownCount: 0,
      mixed: false,
    }
  }

  const levels = new Set(verdicts.map((v) => v.level))
  const mixed = levels.size > 1
  const worst: StalenessLevel = levels.has("rechunk")
    ? "rechunk"
    : levels.has("reembed")
      ? "reembed"
      : levels.has("unknown")
        ? "unknown"
        : "fresh"

  const representative = verdicts.find((v) => v.level === worst) ?? verdicts[0]
  const reason = mixed
    ? `mixed index: ${freshCount}/${rows.length} rows current, remainder need ${worst} — ${representative.reason}`
    : representative.reason

  return {
    level: worst,
    diffs: representative.diffs,
    reason,
    rowCount: rows.length,
    freshCount,
    unknownCount,
    mixed,
  }
}

/** True when the index can be trusted as-is. Anything else requires reindexing. */
export function isIndexFresh(rows: StoredVersions[], current?: IndexManifest): boolean {
  if (rows.length === 0) return false
  return classifyIndexStaleness(rows, current).level === "fresh"
}

// ---------------------------------------------------------------------------
// Width guard
// ---------------------------------------------------------------------------

export interface WidthCheck {
  ok: boolean
  /** Width of the pgvector column the rows would be written to. */
  columnDimensions: number | null
  /** Width the active model actually produces. */
  modelDimensions: number
  error?: string
}

/**
 * Refuses to write a vector whose width disagrees with the target column.
 *
 * Without this, switching `EMBEDDING_MODEL` from the 384-dim MiniLM default to 1024-dim BGE-M3
 * fails deep inside a bulk INSERT with a raw Postgres message, *after* the previous chunks were
 * already deleted — i.e. the operator loses their index and gets an opaque error. Checking first
 * turns that into a refusal with an actionable message.
 *
 * `columnDimensions: null` means the column width could not be determined; that is a pass, because
 * refusing on missing information would block ingestion for every deployment that has not wired
 * the introspection query.
 */
export function assertVectorWidth(columnDimensions: number | null, modelDimensions?: number): WidthCheck {
  const model = modelDimensions ?? getEmbeddingModel().getDimensions()
  if (columnDimensions === null || columnDimensions === undefined) {
    return { ok: true, columnDimensions: null, modelDimensions: model }
  }
  if (columnDimensions !== model) {
    return {
      ok: false,
      columnDimensions,
      modelDimensions: model,
      error:
        `Embedding width mismatch: the active model produces ${model}-dimensional vectors but ` +
        `"DocumentChunk.embedding" is vector(${columnDimensions}). Refusing to index — a vector ` +
        `written by one model must never be read back as another. Either set ` +
        `EMBEDDING_TRUNCATE_DIM=${columnDimensions} (Matryoshka models only), resize the column ` +
        `with prisma/scripts/resize-embedding.sql, or revert EMBEDDING_MODEL.`,
    }
  }
  return { ok: true, columnDimensions, modelDimensions: model }
}

/**
 * SQL that reads the declared width of the embedding column. Kept here (not inline at the call
 * site) so the ingest path, the reindex path and the verification script all ask the same
 * question in the same way.
 */
export const EMBEDDING_COLUMN_WIDTH_SQL = `
  SELECT COALESCE(atttypmod, 0)::int AS dim
  FROM pg_attribute
  WHERE attrelid = '"DocumentChunk"'::regclass AND attname = 'embedding'
`.trim()
