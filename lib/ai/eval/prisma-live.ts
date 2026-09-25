/**
 * A thin Prisma-shaped adapter over a live PostgreSQL connection.
 *
 * Why this exists, and exactly what it does and does not fake
 * -----------------------------------------------------------
 * `prisma generate` cannot run in an environment without the engine binaries, so the retrieval
 * code cannot be pointed at a real server through the real client. But the thing that actually
 * needs validating is the **SQL the retrieval layer produces**, and that SQL is built with
 * `Prisma.sql` / `Prisma.join` / `Prisma.raw` from `@prisma/client/runtime/library` — which *is*
 * present and is Prisma's own implementation, not a copy of it.
 *
 * So this adapter:
 *
 *   * uses **Prisma's real `Sql` tagged template** (`runtime.sqltag`) to render every statement,
 *     which means the placeholder numbering, `join` flattening, `raw` inlining and `empty`
 *     behaviour are Prisma's, not a reimplementation;
 *   * executes the rendered `(text, values)` against the live connection unchanged.
 *
 * The ORM convenience calls (`prisma.graphNode.findMany({ where: … })`) are translated by a
 * deliberately small `where`-to-SQL mapper that supports only the operators the retrieval code
 * uses. That mapper is a shim and is labelled as one; the retrieval statements themselves are the
 * production strings. `lib/prisma.ts` exposes its client through a `globalThis` cache, so
 * installing this adapter requires no change to the modules under test.
 *
 * @module eval/prisma-live
 */

import type { LivePg } from "./pg-live"

// Prisma's runtime exports the tagged template as `sqltag` in the library build.
const runtime = require("@prisma/client/runtime/library") as {
  sqltag: (strings: TemplateStringsArray | string[], ...values: unknown[]) => PrismaSqlLike
  join: (values: unknown[], separator?: string) => PrismaSqlLike
  raw: (value: string) => PrismaSqlLike
  empty: PrismaSqlLike
  Sql: new (strings: string[], values: unknown[]) => PrismaSqlLike
}

export interface PrismaSqlLike {
  text: string
  values: unknown[]
  sql: string
  strings: string[]
}

/** The `Prisma` namespace the retrieval modules expect. These are Prisma's own implementations. */
export const Prisma = {
  sql: runtime.sqltag,
  join: runtime.join,
  raw: runtime.raw,
  empty: runtime.empty,
  Sql: runtime.Sql,
}

/** Renders a tagged template or an already-built `Sql` into `(text, values)`. */
export function renderStatement(
  strings: TemplateStringsArray | string[] | PrismaSqlLike,
  ...values: unknown[]
): { text: string; values: unknown[] } {
  if (isSqlLike(strings)) return { text: strings.text, values: strings.values }
  const rendered = runtime.sqltag(strings as TemplateStringsArray, ...values)
  return { text: rendered.text, values: rendered.values }
}

function isSqlLike(v: unknown): v is PrismaSqlLike {
  return Boolean(v && typeof v === "object" && "text" in (v as object) && "values" in (v as object))
}

// ---------------------------------------------------------------------------
// `where` → SQL (the shim part)
// ---------------------------------------------------------------------------

interface WhereFragment {
  sql: string
  values: unknown[]
}

/**
 * Translates the subset of Prisma's `where` syntax the retrieval code uses into a bound SQL
 * fragment. Supports: equality, `in`, `notIn`, `gte`/`lte`/`gt`/`lt`, `contains` (ILIKE),
 * `AND`/`OR`/`NOT`, and nested field filters. Anything else throws — silently ignoring an
 * unsupported operator would widen a result set and quietly break tenant isolation.
 */
export function whereToSql(where: Record<string, unknown> | undefined, offset = 0): WhereFragment {
  if (!where || Object.keys(where).length === 0) return { sql: "", values: [] }
  const parts: string[] = []
  const values: unknown[] = []
  let n = offset

  const next = () => `$${++n}`

  for (const [key, raw] of Object.entries(where)) {
    if (raw === undefined) continue
    if (key === "AND" || key === "OR") {
      const list = Array.isArray(raw) ? raw : [raw]
      const inner = list.map((w) => whereToSql(w as Record<string, unknown>, n))
      for (const i of inner) {
        values.push(...i.values)
        n += i.values.length
      }
      const joiner = key === "AND" ? " AND " : " OR "
      const rendered = inner.map((i) => (i.sql ? `(${i.sql})` : "")).filter(Boolean)
      if (rendered.length > 0) parts.push(`(${rendered.join(joiner)})`)
      continue
    }
    if (key === "NOT") {
      const list = Array.isArray(raw) ? raw : [raw]
      const inner = list.map((w) => whereToSql(w as Record<string, unknown>, n))
      for (const i of inner) {
        values.push(...i.values)
        n += i.values.length
      }
      const rendered = inner.map((i) => (i.sql ? `NOT (${i.sql})` : "")).filter(Boolean)
      if (rendered.length > 0) parts.push(rendered.join(" AND "))
      continue
    }

    const col = quoteColumn(key)
    if (raw === null) {
      parts.push(`${col} IS NULL`)
      continue
    }
    if (typeof raw === "object" && !Array.isArray(raw)) {
      const ops = raw as Record<string, unknown>
      for (const [op, val] of Object.entries(ops)) {
        switch (op) {
          case "in": {
            const arr = val as unknown[]
            if (arr.length === 0) {
              parts.push("1 = 0")
              continue
            }
            const ph = arr.map(() => next())
            values.push(...arr)
            parts.push(`${col} IN (${ph.join(", ")})`)
            break
          }
          case "notIn": {
            const arr = val as unknown[]
            if (arr.length === 0) continue
            const ph = arr.map(() => next())
            values.push(...arr)
            parts.push(`${col} NOT IN (${ph.join(", ")})`)
            break
          }
          case "gte":
            values.push(val)
            parts.push(`${col} >= ${next()}`)
            break
          case "gt":
            values.push(val)
            parts.push(`${col} > ${next()}`)
            break
          case "lte":
            values.push(val)
            parts.push(`${col} <= ${next()}`)
            break
          case "lt":
            values.push(val)
            parts.push(`${col} < ${next()}`)
            break
          case "contains":
            values.push(`%${val}%`)
            parts.push(`${col} ILIKE ${next()}`)
            break
          case "startsWith":
            values.push(`${val}%`)
            parts.push(`${col} ILIKE ${next()}`)
            break
          case "equals":
            if (val === null) parts.push(`${col} IS NULL`)
            else {
              values.push(val)
              parts.push(`${col} = ${next()}`)
            }
            break
          case "not":
            if (val === null) parts.push(`${col} IS NOT NULL`)
            else {
              values.push(val)
              parts.push(`${col} <> ${next()}`)
            }
            break
          default:
            throw new Error(`prisma-live: unsupported where operator "${op}" on column "${key}"`)
        }
      }
      continue
    }
    values.push(raw)
    parts.push(`${col} = ${next()}`)
  }

  return { sql: parts.join(" AND "), values }
}

/** Prisma model fields are camelCase; PostgreSQL columns keep that spelling and must be quoted. */
export function quoteColumn(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

const ORDER_DIRECTION: Record<string, string> = { asc: "ASC", desc: "DESC" }

function orderByToSql(orderBy: unknown): string {
  if (!orderBy) return ""
  const list = Array.isArray(orderBy) ? orderBy : [orderBy]
  const clauses: string[] = []
  for (const entry of list) {
    for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
      if (typeof v === "string") clauses.push(`${quoteColumn(k)} ${ORDER_DIRECTION[v.toLowerCase()] ?? "ASC"}`)
      else if (v && typeof v === "object") {
        // Nested relation ordering is not used by the retrieval code; refuse rather than guess.
        throw new Error(`prisma-live: nested orderBy on "${k}" is not supported`)
      }
    }
  }
  return clauses.length > 0 ? ` ORDER BY ${clauses.join(", ")}` : ""
}

// ---------------------------------------------------------------------------
// The adapter
// ---------------------------------------------------------------------------

export interface LivePrismaOptions {
  db: LivePg
  /** Model name → table name. Prisma's default is the model name, quoted. */
  tables?: Record<string, string>
}

export interface LivePrismaStats {
  queries: number
  statements: Array<{ text: string; ms: number; rows: number; tx: boolean }>
}

/**
 * Installs a live-database-backed client at `globalThis.prisma` (the cache `lib/prisma.ts` reads)
 * and returns it together with the statement log. The caller decides when to restore the previous
 * value.
 */
export function installLivePrisma(opts: LivePrismaOptions): { prisma: any; stats: LivePrismaStats; restore: () => void } {
  const { db } = opts
  const tables = opts.tables ?? {}
  const stats: LivePrismaStats = { queries: 0, statements: [] }

  /**
   * The handle every statement goes through. Rebound for the duration of a transaction.
   *
   * This indirection is not cosmetic: PGlite serialises access to its single connection, so a
   * statement issued on the outer handle while a transaction is open waits for that transaction to
   * finish — and the transaction waits for the statement. Every `$…Raw*` entry point must therefore
   * resolve the handle at *call* time, not at construction time.
   */
  let runner: Pick<LivePg, "query"> = db
  const inTx = () => runner !== db

  const exec = async (text: string, values: unknown[]): Promise<Record<string, unknown>[]> => {
    const res = await runner.query(text, values)
    stats.queries++
    stats.statements.push({ text: text.slice(0, 4000), ms: res.ms, rows: res.rows.length, tx: inTx() })
    return res.rows as Record<string, unknown>[]
  }

  const rawTag = (strings: TemplateStringsArray | string[] | PrismaSqlLike, ...values: unknown[]) => {
    const rendered = renderStatement(strings, ...values)
    return exec(rendered.text, rendered.values)
  }

  const model = (name: string) => {
    const table = quoteColumn(tables[name] ?? name)
    return {
      findMany: async (args: { where?: Record<string, unknown>; orderBy?: unknown; take?: number; select?: unknown } = {}) => {
        const w = whereToSql(args.where)
        const take = typeof args.take === "number" ? ` LIMIT ${Math.max(0, Math.floor(args.take))}` : ""
        return exec(`SELECT * FROM ${table}${w.sql ? ` WHERE ${w.sql}` : ""}${orderByToSql(args.orderBy)}${take}`, w.values)
      },
      findFirst: async (args: { where?: Record<string, unknown>; orderBy?: unknown } = {}) => {
        const rows = await model(name).findMany({ ...args, take: 1 })
        return rows[0] ?? null
      },
      findUnique: async (args: { where?: Record<string, unknown> }) => {
        const rows = await model(name).findMany({ ...args, take: 1 })
        return rows[0] ?? null
      },
      count: async (args: { where?: Record<string, unknown> } = {}) => {
        const w = whereToSql(args.where)
        const rows = await exec(`SELECT COUNT(*)::int AS count FROM ${table}${w.sql ? ` WHERE ${w.sql}` : ""}`, w.values)
        return rows[0]?.count ?? 0
      },
    }
  }

  const client: any = {
    $queryRaw: rawTag,
    $executeRaw: rawTag,
    $queryRawUnsafe: (text: string, ...values: unknown[]) => exec(text, values),
    $executeRawUnsafe: (text: string, ...values: unknown[]) => exec(text, values),
    $transaction: async (arg: unknown) => {
      if (typeof arg === "function") {
        const outer = runner
        return db.transaction(async (tx) => {
          // Rebind for the whole body. Every `$queryRaw` / `$executeRawUnsafe` the retrieval code
          // issues inside the transaction — including `SET LOCAL hnsw.ef_search` — has to run on
          // the transaction handle, or it queues behind the lock this transaction is holding.
          runner = tx
          try {
            return await (arg as (t: unknown) => Promise<unknown>)(client)
          } finally {
            runner = outer
          }
        })
      }
      const results: unknown[] = []
      for (const p of arg as Array<Promise<unknown>>) results.push(await p)
      return results
    },
    $connect: async () => {},
    $disconnect: async () => {},
  }
  for (const name of [
    "documentChunk",
    "graphNode",
    "graphEdge",
    "graphCommunity",
    "ingestFile",
    "workspace",
    "thesisReview",
    "evidence",
    "thesisClaim",
    "scholarlyPaper",
    "citationOccurrence",
    "retrievalTrace",
    "evalRun",
  ]) {
    client[name] = model(name.charAt(0).toUpperCase() + name.slice(1))
  }

  const g = globalThis as unknown as { prisma?: unknown }
  const previous = g.prisma
  g.prisma = client
  return { prisma: client, stats, restore: () => { g.prisma = previous } }
}
