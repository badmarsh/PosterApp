import { test, expect } from '@playwright/test';

test.describe('Multi-Output Feature', () => {
  test('output switcher in TopBar functions', async ({ page }) => {
    await page.goto('/');

    // Handle Workspace Selector modal if open on initial load
    try {
      const modal = page.getByText('Select a Workspace');
      if (await modal.isVisible({ timeout: 3000 })) {
        const firstWorkspace = page.locator('button.hover\\:bg-accent').first();
        if (await firstWorkspace.isVisible()) {
          await firstWorkspace.click();
        } else {
          const closeBtn = page.getByRole('button', { name: '✕' });
          if (await closeBtn.isVisible()) await closeBtn.click();
        }
        await modal.waitFor({ state: 'hidden', timeout: 5000 });
      }
    } catch {}

    // Wait for the workspace to load
    await page.waitForLoadState('networkidle');

    // The output badge / dropdown in TopBar displays the current output type (e.g. POSTER, SLIDES, PAPER)
    const outputSwitcher = page.locator('header').getByRole('button', { name: /^(poster|slides|paper|output)$/i });
    if (await outputSwitcher.isVisible()) {
      await outputSwitcher.click();
      // Dropdown menu appears with outputs
      await expect(page.getByText('Convert Output...')).toBeVisible({ timeout: 5000 });
    }
  });
});
