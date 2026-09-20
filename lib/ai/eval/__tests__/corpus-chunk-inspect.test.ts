import { describe, it, expect } from 'vitest'
import { chunkMarkdown } from '@/lib/ai/document-chunker'
import * as fs from 'fs'
import * as path from 'path'

describe('corpus chunk inspection', () => {
  it('chunks downloaded docs and writes index with stable IDs', () => {
    const docs = ['transformer-2017', 'bert-2018', 'llm-survey-2023']
    const result: Record<string, unknown[]> = {}

    for (const docId of docs) {
      const mdPath = path.resolve('data/eval/corpus', docId + '.md')
      if (!fs.existsSync(mdPath)) { console.log('Missing:', mdPath); continue }
      const md = fs.readFileSync(mdPath, 'utf8')
      const chunks = chunkMarkdown(md, docId)
      result[docId] = chunks.map((c, i) => ({
        id: docId + '_' + String(i).padStart(4, '0'),
        heading: c.heading,
        preview: c.content.substring(0, 150),
        chars: c.content.length,
      }))
      console.log(docId + ':', chunks.length, 'chunks')
    }

    fs.mkdirSync('data/eval/corpus', { recursive: true })
    fs.writeFileSync(
      'data/eval/corpus/chunks-index.json',
      JSON.stringify(result, null, 2)
    )
    console.log('Chunk index written with stable IDs.')
    expect(Object.keys(result).length).toBe(3)
  })

  it('loads golden judgments from data/eval/golden-v2/', () => {
    const goldenDir = path.resolve('data/eval/golden-v2')
    expect(fs.existsSync(goldenDir)).toBe(true)
    const files = fs.readdirSync(goldenDir).filter(f => f.endsWith('.json'))
    expect(files.length).toBeGreaterThanOrEqual(5)
    console.log('Golden files:', files.length, '->', files.join(', '))
    for (const file of files) {
      const q = JSON.parse(fs.readFileSync(path.join(goldenDir, file), 'utf8'))
      expect(q.id).toBeTruthy()
      expect(q.query).toBeTruthy()
      expect(Array.isArray(q.judgments)).toBe(true)
      expect(q.judgments.length).toBeGreaterThan(0)
      console.log('  ' + q.id + ': ' + q.judgments.length + ' judgments, query=' + q.query.substring(0,60))
    }
  })
})

