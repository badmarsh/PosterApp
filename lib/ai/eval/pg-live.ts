/**
 * Live PostgreSQL + pgvector driver for the verification and benchmark harnesses.
 *
 * Why this exists
 * ---------------
 * Every other test in this repository mocks Prisma and asserts on *statement text*. That is a real
 * form of coverage — it proves routing, fusion, attribution and degradation — but it proves
 * nothing about query planning, HNSW recall, operator availability or `SET LOCAL` semantics. Those
 * only exist in a running server, and "the SQL string looks right" is not evidence that the
 * retrieval stack works.
 *
 * Two flavours, one interface:
 *
 *   * `postgres`      — a real server at `DATABASE_URL` (the project's `pgvector/pgvector:pg16`
 *                       container, or Supabase). This is the highest-fidelity option: real
 *                       planner, real HNSW build, real network, real pooler if you point it at one.
 *   * `pglite`        — PostgreSQL compiled to WebAssembly with the real pgvector C extension,
 *                       running in-process. Not a simulation: it executes the same executor, the
 *                       same index access method and the same `vector` operators. It cannot tell
 *                       you about throughput at scale or PgBouncer transaction pooling, and the
 *                       harness says so instead of implying otherwise.
 *
 * `pg` and `@electric-sql/pglite` are both loaded through runtime imports, so neither is required
 * at build time and the module is importable in environments that have neither.
 *
 * @module eval/pg-live
 */

import * as fs from "fs"
import * as path from "path"

export type LivePgFlavor = "postgres" | "pglite"

export interface LivePgQueryResult<T = Record<string, unknown>> {
  rows: T[]
  /** Wall-clock milliseconds for this statement. */
  ms: number
}

export interface LivePg {
  flavor: LivePgFlavor
  serverVersion: string
  pgvectorVersion: string | null
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<LivePgQueryResult<T>>
  exec(sql: string): Promise<void>
  /** Runs `fn` inside one transaction. `SET LOCAL` inside it must not leak afterwards. */
  transaction<T>(fn: (tx: Pick<LivePg, "query" | "exec">) => Promise<T>): Promise<T>
  close(): Promise<void>
}

// ---------------------------------------------------------------------------
// Opening
// ---------------------------------------------------------------------------

export interface OpenLivePgOptions {
  /** Connection string. When set and reachable, the `postgres` flavour is used. */
  connectionString?: string
  /** Force a flavour. */
  flavor?: LivePgFlavor
  /** Directory for the PGlite data dir. Omit for an in-memory instance. */
  dataDir?: string
}

/** The subset of node-postgres' Pool this module uses. Kept structural so `pg` stays optional. */
interface AnyPool {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>
  connect(): Promise<{
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>
    release(): void
  }>
  end(): Promise<void>
}

export class LivePgUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = "LivePgUnavailableError"
  }
}

/**
 * Opens a live PostgreSQL connection.
 *
 * Preference order: explicit `flavor`, then `DATABASE_URL`, then embedded PGlite. Throws
 * `LivePgUnavailableError` — never a bare import error — so callers can report "no live database
 * available" as a distinct, honest outcome rather than a crash.
 */
export async function openLivePg(opts: OpenLivePgOptions = {}): Promise<LivePg> {
  const requested = opts.flavor ?? (opts.connectionString || process.env.DATABASE_URL ? "postgres" : "pglite")
  const connStr = opts.connectionString ?? process.env.DATABASE_URL

  if (requested === "postgres") {
    if (!connStr) throw new LivePgUnavailableError("flavor=postgres requested but no connection string was provided")
    return openNodePostgres(connStr)
  }
  return openPglite(opts.dataDir)
}

async function openNodePostgres(connectionString: string): Promise<LivePg> {
  // `pg` is an *optional* peer: it is only needed to validate against a networked server, so it is
  // resolved through a computed specifier. That keeps TypeScript from treating it as a build-time
  // dependency (it is not in package.json) while still failing loudly at runtime when it is absent.
  let Pool: new (cfg: { connectionString: string; max: number }) => AnyPool
  try {
    const specifier = "pg"
    const mod = (await import(/* webpackIgnore: true */ specifier)) as { default?: { Pool?: never } }
    const candidate = (mod.default?.Pool ?? (mod as unknown as { Pool?: never }).Pool) as
      | (new (cfg: { connectionString: string; max: number }) => AnyPool)
      | undefined
    if (!candidate) throw new Error("the `pg` package does not export Pool")
    Pool = candidate
  } catch (err) {
    throw new LivePgUnavailableError(
      "the `pg` package is not installed, so a live PostgreSQL server cannot be reached. " +
        "Install it (`pnpm add -D pg`) or omit DATABASE_URL to use the embedded engine.",
      err
    )
  }
  const pool = new Pool({ connectionString, max: 4 })

  const run = async <T,>(sql: string, params: unknown[] | undefined, client: any): Promise<LivePgQueryResult<T>> => {
    const t0 = Date.now()
    const res = await client.query(sql, params)
    return { rows: res.rows as T[], ms: Date.now() - t0 }
  }

  const serverVersion = (await run<{ server_version: string }>("SHOW server_version", undefined, pool)).rows[0]?.server_version ?? "unknown"
  const pgv = await run<{ extversion: string }>(
    "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
    undefined,
    pool
  )

  return {
    flavor: "postgres",
    serverVersion,
    pgvectorVersion: pgv.rows[0]?.extversion ?? null,
    query: (sql, params) => run(sql, params, pool),
    exec: async (sql) => {
      await pool.query(sql)
    },
    transaction: async (fn) => {
      const client = await pool.connect()
      try {
        await client.query("BEGIN")
        const tx = {
          query: <T,>(sql: string, params?: unknown[]) => run<T>(sql, params, client),
          exec: async (sql: string) => {
            await client.query(sql)
          },
        }
        const out = await fn(tx)
        await client.query("COMMIT")
        return out
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {})
        throw err
      } finally {
        client.release()
      }
    },
    close: async () => {
      await pool.end()
    },
  }
}

async function openPglite(dataDir?: string): Promise<LivePg> {
  let PGlite: any
  let vector: any
  try {
    const mod = await import("@electric-sql/pglite")
    PGlite = (mod as { PGlite: any }).PGlite
    const v = await import("@electric-sql/pglite-pgvector")
    vector = (v as { vector: any }).vector
  } catch (err) {
    throw new LivePgUnavailableError(
      "@electric-sql/pglite is not installed. Install the dev dependencies " +
        "(`pnpm install`) or set DATABASE_URL to validate against a real server.",
      err
    )
  }

  const db = dataDir
    ? await PGlite.create({ dataDir, extensions: { vector } })
    : await PGlite.create({ extensions: { vector } })
  await db.exec("CREATE EXTENSION IF NOT EXISTS vector")

  const serverVersion = (await db.query("SHOW server_version")).rows[0]?.server_version ?? "unknown"
  const pgv = (await db.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'")).rows
  const pgvectorVersion = pgv[0]?.extversion ?? null

  const run = async <T,>(sql: string, params: unknown[] | undefined, target: any): Promise<LivePgQueryResult<T>> => {
    const t0 = Date.now()
    // PGlite accepts `$n` positional parameters exactly like node-postgres.
    const res = params && params.length > 0 ? await target.query(sql, params) : await target.query(sql)
    return { rows: (res.rows ?? []) as T[], ms: Date.now() - t0 }
  }

  return {
    flavor: "pglite",
    serverVersion,
    pgvectorVersion,
    query: (sql, params) => run(sql, params, db),
    exec: async (sql) => {
      await db.exec(sql)
    },
    transaction: async (fn) =>
      db.transaction(async (tx: any) => {
        return fn({
          query: <T,>(sql: string, params?: unknown[]) => run<T>(sql, params, tx),
          exec: async (sql: string) => {
            await tx.exec(sql)
          },
        })
      }),
    close: async () => {
      await db.close()
    },
  }
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

export interface MigrationResult {
  name: string
  ok: boolean
  ms: number
  error?: string
}

/**
 * Applies every every `prisma/migrations/<name>/migration.sql` in lexicographic (= chronological) order.
 *
 * This is the first point at which the schema in this repository is validated as *executable DDL*
 * rather than merely parseable by Prisma's schema builder. A migration that Prisma accepts but
 * PostgreSQL rejects fails here, with the statement that failed.
 *
 * `stopOnError` is true by default: a migration chain that half-applies is not a schema.
 */
export async function applyMigrations(
  db: LivePg,
  opts: { migrationsDir?: string; stopOnError?: boolean } = {}
): Promise<MigrationResult[]> {
  const dir = opts.migrationsDir ?? path.join(process.cwd(), "prisma", "migrations")
  const stopOnError = opts.stopOnError ?? true
  if (!fs.existsSync(dir)) return []

  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()

  const results: MigrationResult[] = []
  for (const name of names) {
    const file = path.join(dir, name, "migration.sql")
    if (!fs.existsSync(file)) continue
    const sql = fs.readFileSync(file, "utf8")
    const t0 = Date.now()
    try {
      await db.exec(sql)
      results.push({ name, ok: true, ms: Date.now() - t0 })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ name, ok: false, ms: Date.now() - t0, error: message })
      if (stopOnError) break
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Small helpers shared by the verification and benchmark harnesses
// ---------------------------------------------------------------------------

/** Renders a numeric vector as a pgvector literal. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`
}

/** Deterministic pseudo-random unit vector. Seeded so benchmark runs are reproducible. */
export function seededUnitVector(seed: number, dim: number): number[] {
  let s = seed >>> 0
  const next = () => {
    // xorshift32 — deterministic across engines, unlike Math.random().
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 0xffffffff
  }
  const v = Array.from({ length: dim }, () => next() - 0.5)
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1
  return v.map((x) => x / norm)
}

/** Exact cosine distance, used as the ground truth ANN recall is measured against. */
export function cosineDistance(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 1 : 1 - dot / denom
}
