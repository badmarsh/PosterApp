import { test, expect } from '@playwright/test';
import { BeamerSlidesGenerator } from '../../lib/latex/generator-slides';
import { TikzPosterGenerator } from '../../lib/latex/generator-poster';
import { StandardPaperGenerator } from '../../lib/latex/generator-paper';
import { validateCard } from '../../lib/latex/validation';
import { estimateHeight } from '../../lib/latex/layout';

test.describe('LaTeX Generation Resilience', () => {
  test('gracefully handles malformed JSON table and figures data without throwing', () => {
    // 1. Construct a malformed project and card
    const malformedCard = {
      id: 'card_malformed',
      title: 'Malformed Card',
      pattern: 'bullets-table',
      order: 1,
      content: 'Some text',
      figureLayout: 'single',
      validation: 'valid',
      // INTENTIONAL CORRUPTION:
      table: { hasHeader: true, rows: "not-an-array-lol" },
      figures: { "0": { url: "wrong" } }, 
      sourceIds: "not-an-array-either"
    } as any;
    
    const project = {
      id: 'proj_1',
      name: 'Resilience Test',
      outputs: [],
      cards: [malformedCard],
      assets: []
    } as any;

    const outputConfig = {
      id: 'out_1',
      outputType: 'slides',
      templateId: 'beamer-atlas',
      title: 'Test',
      isActive: true,
      cards: [malformedCard]
    } as any;
    
    // 2. Validate it doesn't crash the validation logic
    expect(() => validateCard(malformedCard)).not.toThrow();
    
    // 3. Validate it doesn't crash the layout logic
    expect(() => estimateHeight(malformedCard)).not.toThrow();
    
    // 4. Validate it doesn't crash Slides generator
    const slidesGen = new BeamerSlidesGenerator('beamer-atlas');
    expect(() => slidesGen.generateDocument(project, outputConfig)).not.toThrow();
    
    // 5. Validate it doesn't crash Poster generator
    const posterGen = new TikzPosterGenerator('atlas');
    expect(() => posterGen.generateDocument(project, outputConfig)).not.toThrow();
    
    // 6. Validate it doesn't crash Paper generator
    const paperGen = new StandardPaperGenerator('article-twocol');
    expect(() => paperGen.generateDocument(project, outputConfig)).not.toThrow();
  });
});
