import { PrismaClient } from '@prisma/client'

const ARENA_URL = process.env.ARENA_DATABASE_URL || process.env.DATABASE_URL
if (!ARENA_URL) {
  throw new Error('ARENA_DATABASE_URL or DATABASE_URL must be set in environment')
}

async function main() {
  const p = new PrismaClient({ datasources: { db: { url: ARENA_URL } } })
  try {
    const wc = await p.workspace.count()
    const dc = await p.documentChunk.count()
    const ic = await p.ingestFile.count()
    console.log({ workspaces: wc, chunks: dc, ingestFiles: ic })

    const ws = await p.workspace.findUnique({ where: { id: 'phd-analysis-2-jes' } })
    console.log('target workspace:', ws ? 'EXISTS' : 'NOT FOUND')

    const chunkCount = await p.documentChunk.count({ where: { workspaceId: 'phd-analysis-2-jes' } })
    console.log('existing chunks for phd-analysis-2-jes:', chunkCount)
  } catch (e) {
    console.error('DB ERROR:', (e as Error).message)
  } finally {
    await p.()
  }
}

main()
