import { describe, it, expect } from 'vitest'
import { hasUnsafeLatex, validateCard } from '@/lib/latex'
import { sanitizeCiteKeys } from '@/lib/ai/prompts'
import type { Card } from '@/lib/poster-types'

/**
 * Unit tests for the F5 validation logic used in convertOutputAction.
 *
 * The convert flow validates converted content by combining:
 *   1. hasUnsafeLatex(newContent) → string[]
 *   2. validateCard({ ...targetCard, content: newContent }).filter(error) → string[]
 *   3. sanitizeCiteKeys(bullets, bibKeys) → string[]
 *
 * These tests exercise that pipeline directly without requiring Zustand store mocking.
 */

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'blk_test_1',
    title: 'Test Card',
    pattern: 'bullets',
    content: '',
    ...overrides,
  }
}

describe('convertOutputAction validation pipeline', () => {
  describe('hasUnsafeLatex — dangerous command detection', () => {
    it('flags \\write18 as prohibited', () => {
      const issues = hasUnsafeLatex('\\write18{rm -rf /}')
      expect(issues).toContainEqual(expect.stringContaining('prohibited command \\write'))
    })

    it('flags \\input{/etc/passwd} as prohibited', () => {
      const issues = hasUnsafeLatex('\\input{/etc/passwd}')
      expect(issues).toContainEqual(expect.stringContaining('prohibited command \\input'))
    })

    it('flags \\def and \\gdef', () => {
      const issues = hasUnsafeLatex('\\def\\evil{hacked} \\gdef\\also{bad}')
      expect(issues).toContainEqual(expect.stringContaining('prohibited command \\def'))
      expect(issues).toContainEqual(expect.stringContaining('prohibited command \\gdef'))
    })

    it('returns empty for safe LaTeX content', () => {
      const issues = hasUnsafeLatex('\\textbf{Important result}: $E=mc^2$ \\cite{einstein1905}')
      expect(issues).toEqual([])
    })

    it('detects unbalanced braces', () => {
      const issues = hasUnsafeLatex('\\textbf{unclosed')
      expect(issues).toContain('unbalanced {}')
    })

    it('returns empty for empty string', () => {
      expect(hasUnsafeLatex('')).toEqual([])
    })

    it('returns empty for non-string input', () => {
      expect(hasUnsafeLatex(null as any)).toEqual([])
    })
  })

  describe('validateCard — structural card validation', () => {
    it('flags empty title as error', () => {
      const card = makeCard({ title: '  ' })
      const msgs = validateCard(card).filter(m => m.level === 'error')
      expect(msgs.some(m => m.field === 'title')).toBe(true)
    })

    it('flags invalid block ID format', () => {
      const card = makeCard({ id: 'invalid-id' })
      const msgs = validateCard(card).filter(m => m.level === 'error')
      expect(msgs.some(m => m.field === 'id')).toBe(true)
    })

    it('flags missing content for bullets pattern', () => {
      const card = makeCard({ pattern: 'bullets', content: '' })
      const msgs = validateCard(card).filter(m => m.level === 'error')
      expect(msgs.some(m => m.field === 'content')).toBe(true)
    })

    it('allows empty content for image-focused pattern', () => {
      const card = makeCard({
        id: 'blk_img_1',
        pattern: 'image-focused',
        content: '',
        figures: [{ url: 'https://example.com/img.png', caption: 'Figure' }],
      })
      const msgs = validateCard(card).filter(m => m.level === 'error' && m.field === 'content')
      expect(msgs).toEqual([])
    })

    it('flags unsafe LaTeX in content as warning', () => {
      const card = makeCard({ content: '\\write18{rm -rf /}' })
      const msgs = validateCard(card)
      expect(msgs.some(m => m.level === 'warning' && m.field === 'content')).toBe(true)
    })
  })

  describe('sanitizeCiteKeys — hallucinated key removal', () => {
    it('removes hallucinated cite keys not in valid set', () => {
      const bullets = ['Key finding \\cite{real2024, fake2024, alsoFake2023}']
      const result = sanitizeCiteKeys(bullets, ['real2024'])
      expect(result[0]).toContain('\\cite{real2024}')
      expect(result[0]).not.toContain('fake2024')
      expect(result[0]).not.toContain('alsoFake2023')
    })

    it('drops entire \\cite{} when no keys are valid', () => {
      const bullets = ['Result \\cite{hallucinated1, hallucinated2}']
      const result = sanitizeCiteKeys(bullets, ['real2024'])
      expect(result[0]).not.toContain('\\cite')
    })

    it('preserves all cite keys when all are valid', () => {
      const bullets = ['Finding \\cite{a, b, c}']
      const result = sanitizeCiteKeys(bullets, ['a', 'b', 'c'])
      expect(result[0]).toContain('\\cite{a, b, c}')
    })

    it('handles empty bibKeys (no valid keys available)', () => {
      const bullets = ['Text \\cite{anything}']
      const result = sanitizeCiteKeys(bullets, [])
      expect(result[0]).not.toContain('\\cite')
    })

    it('handles Set input for bibKeys', () => {
      const bullets = ['Text \\cite{a, b}']
      const result = sanitizeCiteKeys(bullets, new Set(['a']))
      expect(result[0]).toContain('\\cite{a}')
      expect(result[0]).not.toContain('b')
    })
  })

  describe('combined validation pipeline (as used in convertOutputAction)', () => {
    it('passes for clean converted content', () => {
      const newContent = '* Finding 1: Result is significant \\cite{smith2024}\n\n* Finding 2: Effect size is large'
      const targetCard = makeCard({ content: newContent })
      const bibKeys = ['smith2024']

      const unsafeIssues = hasUnsafeLatex(newContent)
      const cardErrors = validateCard({ ...targetCard, content: newContent })
        .filter(m => m.level === 'error')
        .map(m => m.message)
      const allErrors = [...unsafeIssues, ...cardErrors]

      expect(allErrors).toEqual([])
    })

    it('catches dangerous LaTeX in converted content', () => {
      const newContent = '* Malicious \\write18{rm -rf /}'
      const targetCard = makeCard({ content: newContent })

      const unsafeIssues = hasUnsafeLatex(newContent)
      expect(unsafeIssues.length).toBeGreaterThan(0)
    })

    it('catches structural card errors in converted content', () => {
      const targetCard = makeCard({ id: 'bad-id', content: '* Some content' })

      const cardErrors = validateCard({ ...targetCard, content: '* Some content' })
        .filter(m => m.level === 'error')
        .map(m => m.message)
      expect(cardErrors.length).toBeGreaterThan(0)
    })

    it('sanitizes cite keys then validates the result', () => {
      const rawBullets = ['Finding \\cite{real2024, hallucinated}']
      const bibKeys = ['real2024']
      const sanitized = sanitizeCiteKeys(rawBullets, bibKeys)
      const newContent = sanitized.map(b => b.startsWith('* ') ? b : `* ${b}`).join('\n\n')

      const targetCard = makeCard({ content: newContent })
      const unsafeIssues = hasUnsafeLatex(newContent)
      const cardErrors = validateCard({ ...targetCard, content: newContent })
        .filter(m => m.level === 'error')
        .map(m => m.message)

      expect(unsafeIssues).toEqual([])
      expect(cardErrors).toEqual([])
      expect(newContent).toContain('\\cite{real2024}')
      expect(newContent).not.toContain('hallucinated')
    })

    it('aggregates both unsafe LaTeX and card errors', () => {
      const newContent = '\\input{/etc/passwd} and more'
      const targetCard = makeCard({ id: 'invalid-id-format', content: newContent })

      const unsafeIssues = hasUnsafeLatex(newContent)
      const cardErrors = validateCard({ ...targetCard, content: newContent })
        .filter(m => m.level === 'error')
        .map(m => m.message)
      const allErrors = [...unsafeIssues, ...cardErrors]

      expect(allErrors.length).toBeGreaterThanOrEqual(2)
    })
  })
})
