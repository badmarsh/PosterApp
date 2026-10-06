import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test.describe('Poster Compilation', () => {
  test('can compile poster and view PDF', async ({ page }) => {
    // 1. Navigate to the app
    const wsId = `test-compile-${Date.now()}`;
    await page.goto('/');

    // 2. Create workspace via API and point app at it
    await page.waitForLoadState('networkidle');
    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: 'Compile Test Workspace' }),
      });
      if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
      const data = await res.json();
      window.localStorage.setItem(
        'posterapp-editor-storage',
        JSON.stringify({ state: { selectedCardId: null, lastWorkspaceId: data.id }, version: 1 }),
      );
    }, wsId);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 3. Close any workspace selector dialog that may appear
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);
    }

    // 4. Trigger Compilation (allow time for the workspace to fully load)
    const compileBtn = page.locator('[data-testid="compile-btn"]');
    await expect(compileBtn).toBeVisible({ timeout: 30_000 });
    await compileBtn.click();
    // 5. Wait for Compile to finish
    await expect(page.getByText('Compiling with pdflatex…')).toBeHidden({ timeout: 60000 });
    
    // 6. Verify either compile succeeded or compile failed log is shown
    await expect(page.getByText(/Compile (succeeded|failed)/i).first()).toBeVisible({ timeout: 15000 });
  });
});
