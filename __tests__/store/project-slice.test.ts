import { describe, it, expect } from 'vitest';
import { createEditorStore } from '@/components/editor-store';

describe('project-slice', () => {
  it('updates project title via updateProject', () => {
    const store = createEditorStore();
    
    store.getState().updateProject({ posterTitle: 'New Title' });
    expect(store.getState().project.posterTitle).toBe('New Title');
  });

  it('selects and clears card selection', () => {
    const store = createEditorStore();
    
    store.getState().selectCard('card-1');
    expect(store.getState().selectedCardId).toBe('card-1');
    
    store.getState().selectCard(null);
    expect(store.getState().selectedCardId).toBeNull();
  });

  it('keeps edits with the output that owns them across output switches', () => {
    const store = createEditorStore();
    
    // Add a new output first since sampleProject only has one
    store.getState().addOutput('slides', 'metropolis');
    const newOutputId = store.getState().project.activeOutputId;
    
    // Switch back to the original output
    const posterId = store.getState().project.outputs![0].id;
    store.getState().switchOutput(posterId);
    const getActiveCards = () => {
      const p = store.getState().project
      return p.outputs.find(o => o.id === p.activeOutputId)?.cards ?? []
    }
    const posterCardId = getActiveCards()[0].id;

    // Update the card in the poster output
    store.getState().updateCard(posterCardId, { title: 'Poster-only change' });
    
    // Switch to the new slides output
    store.getState().switchOutput(newOutputId);
    expect(getActiveCards()[0].id).not.toBe(posterCardId);

    // Switch back to poster output and verify the change persisted
    store.getState().switchOutput(posterId);
    expect(getActiveCards().find((card) => card.id === posterCardId)?.title)
      .toBe('Poster-only change');
    expect(store.getState().project.outputs?.find((output) => output.id === posterId)?.cards
      .find((card) => card.id === posterCardId)?.title).toBe('Poster-only change');
  });

  it('seeds a new output with the template example instead of empty blocks', () => {
    const store = createEditorStore();

    store.getState().addOutput('poster', 'atlas');
    const output = store.getState().project.outputs!.find(
      (o) => o.id === store.getState().project.activeOutputId,
    )!;

    // Real content, not a skeleton of empty blocks.
    expect(output.cards.length).toBeGreaterThan(8);
    expect(output.cards.every((c) => c.content.trim().length > 0 || c.pattern === 'references')).toBe(true);
    expect(output.cards.some((c) => c.figures.length > 0)).toBe(true);
    expect(output.cards.some((c) => (c.table?.rows?.length ?? 0) > 0)).toBe(true);

    // Citations resolve: the example's bibliography travels with the cards.
    const cited = output.cards
      .flatMap((c) => [...c.content.matchAll(/\\cite\{([^}]+)\}/g)])
      .flatMap((m) => m[1].split(',').map((k) => k.trim()));
    expect(cited.length).toBeGreaterThan(0);
    const keys = new Set(store.getState().bibEntries.map((e) => e.key || e.id));
    expect([...new Set(cited)].filter((k) => !keys.has(k))).toEqual([]);
    expect(store.getState().bibContent).toContain('@');
  });

  it('still creates empty blocks when a count is requested', () => {
    const store = createEditorStore();
    store.getState().addOutput('paper', 'ieee-conf', 4);
    const output = store.getState().project.outputs!.find(
      (o) => o.id === store.getState().project.activeOutputId,
    )!;
    expect(output.cards).toHaveLength(4);
    expect(output.cards.every((c) => c.content === '')).toBe(true);
  });

  it('does not duplicate bibliography keys when two outputs share a subject', () => {
    const store = createEditorStore();
    store.getState().addOutput('paper', 'article-twocol');
    const afterFirst = store.getState().bibEntries.length;
    store.getState().addOutput('paper', 'article-single');
    const keys = store.getState().bibEntries.map((e) => e.key || e.id);
    expect(new Set(keys).size).toBe(keys.length);
    expect(store.getState().bibEntries.length).toBeGreaterThanOrEqual(afterFirst);
  });
});
