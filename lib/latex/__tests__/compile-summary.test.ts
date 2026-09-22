import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDeterministicSummary, summarizeCompileError } from '@/lib/latex/compile-summary'
import { generateAITextResponse } from '@/lib/ai/client'
import type { Card } from '@/lib/poster-types'

vi.mock('@/lib/ai/client', () => ({
  generateAITextResponse: vi.fn(),
}))

const mockGenerateAIText = vi.mocked(generateAITextResponse)

describe('compile-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDeterministicSummary', () => {
    it('returns a clean message for empty/null log', () => {
      expect(getDeterministicSummary('')).toBe('Compilation failed without compiler output.')
    })

    it('extracts missing $ error with card attribution and helpful hint', () => {
      const log = [
        '([path] ([path] No file main.aux. ([path]',
        '*geometry* driver: auto-detecting',
        '! Missing $ inserted.',
        '<inserted text>',
        '$',
        'l.100 } % ! Missing $ inserted.',
        'Transcript written on main.log.',
      ].join('\n')

      const cards = [
        {
          id: 'card_method',
          title: 'Methodology & Setup',
          content: 'Here is formula } % without math mode',
          column: 1,
          order: 1,
          pattern: 'bullets',
        },
      ]

      const summary = getDeterministicSummary(log, cards as Card[])
      expect(summary).toContain('Missing $ inserted')
      expect(summary).toContain('line 100')
      expect(summary).toContain('dollar sign ($)')
      expect(summary).not.toContain('[path]')
    })

    it('extracts undefined control sequence error', () => {
      const log = [
        '! Undefined control sequence.',
        'l.45 \\invalidcommand',
        '                      {arg}',
      ].join('\n')

      const summary = getDeterministicSummary(log)
      expect(summary).toContain('Undefined control sequence')
      expect(summary).toContain('line 45')
      expect(summary).toMatch(/unrecognized command/i)
    })
  })

  describe('summarizeCompileError', () => {
    it('uses fast AI model (role vision) to summarize error', async () => {
      mockGenerateAIText.mockResolvedValueOnce(
        'V karte "Methodology" na riadku 100 chýba dolár ($) okolo matematického vzorca. Zabaľte vzorec do $...$.'
      )

      const log = [
        '! Missing $ inserted.',
        'l.100 $ x = y }',
      ].join('\n')

      const cards = [
        {
          id: 'card_method',
          title: 'Methodology',
          content: 'x = y }',
          column: 1,
          order: 1,
          pattern: 'bullets',
        },
      ]

      const summary = await summarizeCompileError(log, cards as Card[])
      expect(summary).toBe(
        'V karte "Methodology" na riadku 100 chýba dolár ($) okolo matematického vzorca. Zabaľte vzorec do $...$.'
      )
      expect(mockGenerateAIText).toHaveBeenCalledTimes(1)
      expect(mockGenerateAIText).toHaveBeenCalledWith(
        'compile-summary',
        expect.objectContaining({
          role: 'vision',
          maxTokens: 150,
          temperature: 0.1,
        })
      )
    })

    it('falls back to deterministic summary when AI call fails', async () => {
      mockGenerateAIText.mockRejectedValueOnce(new Error('AI network timeout'))

      const log = [
        '! Missing $ inserted.',
        'l.80 formula without dollar',
      ].join('\n')

      const summary = await summarizeCompileError(log)
      expect(summary).toContain('Missing $ inserted')
      expect(summary).toContain('line 80')
      expect(summary).not.toContain('[path]')
    })
  })
})