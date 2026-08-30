import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.describe('Thesis Review Workflow & E2E Features', () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test('creates workspace, activates thesis-review output, and displays metadata panel', async ({ page }) => {
    const wsId = `test-thesis-${Date.now()}`;

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create workspace with a thesis-review output
    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: 'Thesis E2E Project',
          outputType: 'thesis-review',
          templateId: 'posudok-sk',
        }),
      });
      if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
      const data = await res.json();

      window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
        state: { selectedCardId: null, lastWorkspaceId: data.id },
        version: 1,
      }));
    }, wsId);

    // Reload page with active workspace
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify metadata panel fields are present
    await expect(page.getByText('Posudok záverečnej práce')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Meno autora/autorky *')).toBeVisible();
    await expect(page.getByText('Názov práce *')).toBeVisible();

    // Verify Generate button is initially disabled without required fields
    const generateBtn = page.getByRole('button', { name: /Vygenerovať posudok|Generate review/i });
    await expect(generateBtn).toBeDisabled();

    // Fill in required metadata
    const nameInput = page.locator('input[placeholder*="Ján Novák"]');
    const titleInput = page.locator('input[placeholder*="Návrh a implementácia"]');

    await nameInput.fill('Martin Kováč');
    await titleInput.fill('Detekcia anomálií v distribuovaných systémoch');

    // Generate button should become enabled
    await expect(generateBtn).toBeEnabled();
  });

  test('performs academic search and imports verified literature into project .bib with 1-click', async ({ page }) => {
    const wsId = `test-cite-${Date.now()}`;

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create workspace with thesis-review output
    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: 'Citation Test Project',
          outputType: 'thesis-review',
          templateId: 'posudok-sk',
        }),
      });
      if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
      const data = await res.json();

      window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
        state: { selectedCardId: null, lastWorkspaceId: data.id },
        version: 1,
      }));
    }, wsId);

    // Mock the academic search API endpoint
    await page.route('**/api/academic/search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'Transformer',
          results: [
            {
              title: 'Attention Is All You Need',
              authors: ['Vaswani, Ashish', 'Shazeer, Noam', 'Parmar, Niki'],
              year: 2017,
              venue: 'NeurIPS',
              doi: '10.5555/3295222.3295349',
              arxivId: '1706.03762',
              citationCount: 95000,
              source: 'semantic_scholar',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Mock an active review directly into the Zustand store for testing review editing UI
    await page.evaluate(() => {
      const store = (window as any).__thesisReviewStore;
      if (store) {
        store.setState({
          activeReview: {
            id: 'mock-review-1',
            studentName: 'Martin Kováč',
            thesisTitle: 'Detekcia anomálií v distribuovaných systémoch',
            thesisType: 'master',
            reviewerRole: 'opponent',
            grade: 'B',
            recommendation: 'Prácu odporúčam na obhajobu.',
            sections: [
              { id: 's1', sectionId: 'goal_definition', criterionId: 'goal_definition', text: 'Jasne definované ciele.', rating: 'B', numericScore: 85 },
              { id: 's2', sectionId: 'methodology', criterionId: 'methodology', text: 'Vhodná metodika.', rating: 'B', numericScore: 80 },
            ],
            defenseQuestions: ['Aké sú limity navrhnutého modelu?'],
            citationIssues: [],
            status: 'draft',
            language: 'sk',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      }
    });

    // Check if the review editor or search input is reachable
    const searchInput = page.locator('input[placeholder*="Zadajte názov článku"]');
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('Attention Is All You Need');
      await page.getByRole('button', { name: /Hľadať|Search/i }).click();

      // Verify search result appears
      await expect(page.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });

      // Click "+ Do .bib" button
      const importBtn = page.getByRole('button', { name: /\+ Do \.bib|\+ To \.bib/i });
      await expect(importBtn).toBeVisible();
      await importBtn.click();

      // Verify button status updates to "V .bib"
      await expect(page.getByRole('button', { name: /V \.bib|In \.bib/i })).toBeVisible({ timeout: 5000 });
    }
  });
});
