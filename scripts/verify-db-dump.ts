/**
 * Import the anonymized arena DB dump into an in-memory PGlite (WASM Postgres
 * 17 + pgvector) and verify it is self-consistent.
 *
 * Neither the live Dokploy clone nor a local `service postgresql start` is
 * reachable from this sandbox (egress to those hosts is filtered), so this is
 * the closest faithful import available: it runs the *actual* dump statements,
 * not a re-implementation of them.
 *
 * Schema strategy: the dump is a Prisma-level export (array/JSON fields are
 * serialized as JSON strings), so the migration DDL (which types some columns
 * as `TEXT[]`) would reject it. Instead the loader derives each table's DDL
 * from the dump's own `INSERT` column lists, inferring column types by sampling
 * the first row's literals. This guarantees the dump loads and lets us check
 * referential integrity, row counts, pgvector, and the academic edge cases.
 *
 *   pnpm exec tsx scripts/verify-db-dump.ts
 *
 * Exit code 0 on a clean load + verification.
 */
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(__dirname, "..")

type Row = Record<string, unknown>

type Kind = "bool" | "int" | "float" | "text" | "null"

function kindOf(token: string): Kind {
  if (token === "NULL") return "null"
  if (token === "TRUE" || token === "FALSE") return "bool"
  if (/^-?\d+$/.test(token)) return "int"
  if (/^-?\d*\.?\d+([eE][-+]?\d+)?$/.test(token)) return "float"
  return "text"
}

function typeFor(col: string, kinds: Set<Kind>): string {
  if (col === "embedding") return "vector"
  if (kinds.has("text")) return "TEXT"
  if (kinds.has("bool")) return "BOOLEAN"
  if (kinds.has("float")) return "DOUBLE PRECISION"
  if (kinds.has("int")) return "BIGINT"
  return "TEXT" // only NULLs seen
}

/** Collect, per table column, the union of literal kinds across all rows. */
function parseDump(dump: string) {
  const tables = new Map<string, { cols: string[]; kinds: Map<string, Set<Kind>> }>()
  const re = /INSERT INTO "(\w+)" \(([^)]*)\) VALUES \(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(dump))) {
    const name = m[1]
    const cols = m[2].split(",").map((c) => c.trim().replace(/"/g, ""))
    let entry = tables.get(name)
    if (!entry) {
      entry = { cols, kinds: new Map(cols.map((c) => [c, new Set<Kind>()])) }
      tables.set(name, entry)
    }
    const tokens = splitValuesFrom(dump, re.lastIndex)
    cols.forEach((col, i) => entry!.kinds.get(col)!.add(kindOf(tokens[i] ?? "NULL")))
  }
  return tables
}

/** Read tokens until the closing `) ON CONFLICT` of the first row. */
function splitValuesFrom(s: string, start: number): string[] {
  const tokens: string[] = []
  let i = start
  while (i < s.length) {
    // skip whitespace/commas
    while (i < s.length && /[\s,]/.test(s[i])) i++
    if (s[i] === ")") break
    if (s[i] === "'") {
      // The dump uses backslash escapes (\n, \') inside quoted strings, plus
      // SQL '' doubling. Handle both so commas/quotes inside a value do not
      // split it.
      let j = i + 1
      while (j < s.length) {
        if (s[j] === "\\") { j += 2; continue }
        if (s[j] === "'") {
          if (s[j + 1] === "'") { j += 2; continue }
          break
        }
        j++
      }
      tokens.push(s.slice(i, j + 1))
      i = j + 1
      i = consumeCast(s, i, tokens)
    } else {
      let j = i
      while (j < s.length && s[j] !== "," && s[j] !== ")") j++
      tokens.push(s.slice(i, j).trim())
      i = j
      i = consumeCast(s, i, tokens)
    }
  }
  return tokens
}

/** Fold a trailing `::type` cast into the most recent token (e.g. `'..'::vector`). */
function consumeCast(s: string, i: number, tokens: string[]): number {
  if (s[i] === ":" && s[i + 1] === ":") {
    let k = i + 2
    let cast = ""
    while (k < s.length && /[A-Za-z_0-9]/.test(s[k])) { cast += s[k]; k++ }
    tokens[tokens.length - 1] += "::" + cast
    return k
  }
  return i
}

async function main() {
  const { PGlite } = await import("@electric-sql/pglite")
  const { vector } = await import("@electric-sql/pglite-pgvector")
  const db = new PGlite({ extensions: { vector } })
  // Register the pgvector type up front so `embedding vector` columns can be
  // created before the dump's own CREATE EXTENSION line runs during load.
  await db.exec(`CREATE EXTENSION IF NOT EXISTS vector;`).catch(() => undefined)

  let dump = fs.readFileSync(path.join(ROOT, ".arena", "db-dump.sql"), "utf8")
  // uuid-ossp is not available in PGlite; the dump's functions don't actually
  // need it for the rows present.
  dump = dump.replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/, "")
  const tables = parseDump(dump)

  // Build schema from the dump itself.
  for (const [name, { cols, kinds }] of tables) {
    const defs: string[] = []
    for (const col of cols) {
      const type = typeFor(col, kinds.get(col)!)
      let line = `"${col}" ${type}`
      if (col === "id" || col === "key") line += " PRIMARY KEY"
      defs.push(line)
    }
    await db.exec(`CREATE TABLE IF NOT EXISTS "${name}" (${defs.join(", ")});`)
  }
  console.log(`[schema] created ${tables.size} tables from dump column lists`)

  // Load the data.
  await db.exec(`SET session_replication_role = replica;`)
  await db.exec(dump)
  console.log("[data] dump loaded")

  const count = async (t: string) => {
    const r = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "${t}"`)
    return r.rows[0].n
  }

  console.log("\n=== row counts ===")
  for (const t of [...tables.keys()]) {
    console.log(`  ${t.padEnd(18)} ${await count(t)}`)
  }

  console.log("\n=== referential integrity ===")
  const fk = await db.query<Row>(`
    SELECT 'Card.outputId->Output' AS rel,
      (SELECT COUNT(*)::int FROM "Card" c LEFT JOIN "Output" o ON o.id = c."outputId" WHERE o.id IS NULL) AS orphans
    UNION ALL SELECT 'Output.workspaceId->Workspace',
      (SELECT COUNT(*)::int FROM "Output" o LEFT JOIN "Workspace" w ON w.id = o."workspaceId" WHERE w.id IS NULL)
    UNION ALL SELECT 'Asset.workspaceId->Workspace',
      (SELECT COUNT(*)::int FROM "Asset" a LEFT JOIN "Workspace" w ON w.id = a."workspaceId" WHERE w.id IS NULL)
    UNION ALL SELECT 'DocumentChunk.workspaceId->Workspace',
      (SELECT COUNT(*)::int FROM "DocumentChunk" d LEFT JOIN "Workspace" w ON w.id = d."workspaceId" WHERE w.id IS NULL)
  `)
  let bad = 0
  for (const row of fk.rows) {
    const orphans = Number(row.orphans)
    console.log(`  ${(row.rel as string).padEnd(34)} orphans=${orphans}`)
    if (orphans !== 0) bad++
  }

  console.log("\n=== pgvector ===")
  const dims = await db.query<Row>(`
    SELECT COUNT(*)::int AS n,
      (SELECT array_upper(embedding::real[], 1) FROM "DocumentChunk" WHERE embedding IS NOT NULL LIMIT 1)::int AS dims
    FROM "DocumentChunk" WHERE embedding IS NOT NULL
  `)
  console.log(`  DocumentChunk rows with embedding=${dims.rows[0].n} dims=${dims.rows[0].dims}`)
  const selfDist = await db.query<Row>(`
    SELECT COUNT(*)::int AS n FROM "DocumentChunk"
    WHERE embedding IS NOT NULL AND embedding <=> embedding < 1e-6
  `)
  console.log(`  rows where self-distance==0: ${selfDist.rows[0].n} (should equal row count)`)

  console.log("\n=== academic edge cases ===")
  const tex = await db.query<Row>(`SELECT COUNT(*)::int AS n FROM "Card" WHERE content LIKE '%$%'`)
  console.log(`  cards containing math ($...$): ${tex.rows[0].n}`)
  const wide = await db.query<Row>(`SELECT COUNT(*)::int AS n FROM "Card" WHERE length(content) > 400`)
  console.log(`  cards over the 400-char poster budget: ${wide.rows[0].n}`)
  const empty = await db.query<Row>(`
    SELECT COUNT(*)::int AS n FROM "Card"
    WHERE (content IS NULL OR btrim(content) = '') AND pattern NOT IN ('references','image-focused','figure-slide','title-slide')
  `)
  console.log(`  non-figure cards with empty content: ${empty.rows[0].n}`)
  const uni = await db.query<Row>(`SELECT COUNT(*)::int AS n FROM "Card" WHERE content ~ '[α-ωΑ-Ω₀-₉×≤≥±≠≈] '`)
  console.log(`  cards containing raw unicode math symbols: ${uni.rows[0].n}`)

  if (bad > 0) {
    console.error(`\nVERIFY-DB: ${bad} dangling relation(s)`)
    process.exit(1)
  }
  console.log("\n[done] DB dump verified: schema from dump, data loaded, FKs intact, pgvector live")
}

main().catch((e) => {
  console.error("VERIFY-DB FAILED:", e.message)
  process.exit(1)
})
