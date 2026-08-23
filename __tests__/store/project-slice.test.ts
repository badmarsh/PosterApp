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
    const posterId = store.getState().project.activeOutputId;
    const posterCardId = store.getState().project.cards[0].id;

    store.getState().updateCard(posterCardId, { title: 'Poster-only change' });
    store.getState().switchOutput('out_slides_metropolis');
    expect(store.getState().project.cards[0].id).toBe('sl_title');

    store.getState().switchOutput(posterId);
    expect(store.getState().project.cards.find((card) => card.id === posterCardId)?.title)
      .toBe('Poster-only change');
    expect(store.getState().project.outputs.find((output) => output.id === posterId)?.cards
      .find((card) => card.id === posterCardId)?.title).toBe('Poster-only change');
  });
});
