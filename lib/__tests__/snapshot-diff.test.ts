import { describe, it, expect } from 'vitest'
import { computeWorkspaceDiff } from '../snapshot-diff'

describe('snapshot-diff', () => {
  it('returns created message when old workspace is null', () => {
    const diff = computeWorkspaceDiff(null, { name: 'New' })
    expect(diff).toEqual(['Created initial project layout.'])
  })

  it('detects name and author changes', () => {
    const diff = computeWorkspaceDiff(
      { name: 'Old', authors: 'Me' }, 
      { name: 'New', authors: 'You' }
    )
    expect(diff).toContain('Renamed project to "New"')
    expect(diff).toContain('Updated authors list')
  })

  it('detects card additions, renames, content changes, and deletions', () => {
    const oldWs = { 
      cards: [
        { id: '1', title: 'Card 1', content: 'Short' },
        { id: '3', title: 'To Delete', content: 'Bye' }
      ] 
    }
    const newWs = { 
      cards: [
        { id: '1', title: 'Renamed', content: 'Short' },
        { id: '2', title: 'Card 2', content: 'This is a much longer content that exceeds 30 characters' }
      ] 
    }
    const diff = computeWorkspaceDiff(oldWs, newWs)
    
    expect(diff).toContain('Added new card: "Card 2"')
    expect(diff).toContain('Renamed card to "Renamed"')
    expect(diff).toContain('Deleted card: "To Delete"')
  })

  it('detects content length changes', () => {
    const oldWs = { cards: [{ id: '1', title: 'C', content: 'A' }] }
    const newWs = { cards: [{ id: '1', title: 'C', content: 'A'.repeat(50) }] }
    
    const diff = computeWorkspaceDiff(oldWs, newWs)
    expect(diff).toContain('Expanded content in "C" (+49 chars)')

    const newWs2 = { cards: [{ id: '1', title: 'C', content: 'A' }] }
    const diff2 = computeWorkspaceDiff(newWs, newWs2)
    expect(diff2).toContain('Shortened content in "C" (-49 chars)')
    
    const newWs3 = { cards: [{ id: '1', title: 'C', content: 'B' }] }
    const diff3 = computeWorkspaceDiff(oldWs, newWs3)
    expect(diff3).toContain('Edited text in "C"')
  })

  it('detects figure additions and deletions', () => {
    const oldWs = { cards: [{ id: '1', title: 'C', figures: [] }] }
    const newWs = { cards: [{ id: '1', title: 'C', figures: [{}] }] }
    
    const diff = computeWorkspaceDiff(oldWs, newWs)
    expect(diff).toContain('Added figure to "C"')

    const diff2 = computeWorkspaceDiff(newWs, oldWs)
    expect(diff2).toContain('Removed figure from "C"')
  })

  it('detects asset changes', () => {
    const diff = computeWorkspaceDiff(
      { assets: [] }, 
      { assets: [{}] }
    )
    expect(diff).toContain('Imported 1 new asset(s)')

    const diff2 = computeWorkspaceDiff(
      { assets: [{}, {}] }, 
      { assets: [] }
    )
    expect(diff2).toContain('Deleted 2 asset(s)')
  })
})