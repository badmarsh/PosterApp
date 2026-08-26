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
    const posterCardId = store.getState().project.outputs[0].cards[0].id;

    // Update the card in the poster output
    store.getState().updateCard(posterCardId, { title: 'Poster-only change' });
    
    // Switch to the new slides output
    store.getState().switchOutput(newOutputId);
    expect(store.getState().project.outputs[0].cards[0].id).not.toBe(posterCardId);

    // Switch back to poster output and verify the change persisted
    store.getState().switchOutput(posterId);
    expect(store.getState().project.outputs[0].cards.find((card) => card.id === posterCardId)?.title)
      .toBe('Poster-only change');
    expect(store.getState().project.outputs?.find((output) => output.id === posterId)?.cards
      .find((card) => card.id === posterCardId)?.title).toBe('Poster-only change');
  });
});
