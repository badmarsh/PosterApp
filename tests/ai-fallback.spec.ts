import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.describe('AI Fallback & Error Handling', () => {
  test('gracefully handles AI API errors and timeouts', async ({ page }) => {
    await setupClerkTestingToken({ page });
    const wsId = `ai-error-ws-${Date.now()}`;

    // Create workspace
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: 'AI Error Project',
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

    // Mock API to return 500 error
    await page.route(`**/api/workspaces/${wsId}/thesis-review`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 504,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'AI Provider Timeout',
            message: 'Upstream AI model timed out after 90 seconds',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Fill form and submit
    await page.locator('input[placeholder*="Ján Novák"]').fill('Test Error Author');
    await page.locator('input[placeholder*="Návrh a"]').fill('Test Error Title');
    
    const generateBtn = page.getByRole('button', { name: /Vygenerovať.*posudok/i });
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // Verify error message is displayed
    await expect(page.getByText('Upstream AI model timed out after 90 seconds')).toBeVisible({ timeout: 5000 });
    
    // The generate button should become enabled again for retry
    await expect(generateBtn).toBeEnabled();
  });
});
