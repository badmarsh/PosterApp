import { test, expect, type Page } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

const THEME_CLASSES = ['light', 'dark', 'vercel', 'vercel-dark', 'midnight'] as const;

const EXPECTED_THEMES = [
  { name: 'Light', cls: 'light' },
  { name: 'Dark', cls: 'dark' },
  { name: 'Vercel', cls: 'vercel' },
  { name: 'Vercel Dark', cls: 'vercel-dark' },
  { name: 'Midnight', cls: 'midnight' },
] as const;

const clsRegex = (cls: string) => new RegExp(`(?:^|\\s)${cls}(?:\\s|$)`);

test.describe('Theme Picker', () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  // Create a workspace via API and point the app at it so the forced
  // workspace-selection modal never blocks the top bar.
  async function seedWorkspace(page: Page) {
    const wsId = `test-theme-${Date.now()}`;
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: 'Theme Test' }),
      });
      if (!res.ok) {
        throw new Error(`Failed to create workspace: ${res.status}`);
      }
      const data = await res.json();
      window.localStorage.setItem(
        'posterapp-editor-storage',
        JSON.stringify({
          state: { selectedCardId: null, lastWorkspaceId: data.id },
          version: 1,
        }),
      );
    }, wsId);
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  }

  function themeItem(page: Page, name: string) {
    return page
      .getByRole('menuitemradio')
      .filter({ has: page.getByText(name, { exact: true }) });
  }

  async function expectOnlyTheme(page: Page, cls: string) {
    const html = page.locator('html');
    await expect(html).toHaveClass(clsRegex(cls));
    for (const other of THEME_CLASSES.filter((c) => c !== cls)) {
      await expect(html).not.toHaveClass(clsRegex(other));
    }
  }

  test('dropdown lists all five themes with the default one active', async ({ page }) => {
    await seedWorkspace(page);

    await page.getByRole('button', { name: 'Theme' }).click();

    await expect(page.getByText('Theme Palette')).toBeVisible();
    for (const t of EXPECTED_THEMES) {
      await expect(themeItem(page, t.name)).toBeVisible();
    }

    // Light is the app default and therefore the preselected radio item.
    await expect(themeItem(page, 'Light')).toHaveAttribute('aria-checked', 'true');
  });

  test('selecting a theme applies its class to <html>', async ({ page }) => {
    await seedWorkspace(page);

    for (const t of EXPECTED_THEMES) {
      await page.getByRole('button', { name: 'Theme' }).click();
      await themeItem(page, t.name).click();
      await expectOnlyTheme(page, t.cls);
      // The dropdown closes after selection; reopen it to verify the indicator moved.
      await page.getByRole('button', { name: 'Theme' }).click();
      await expect(themeItem(page, t.name)).toHaveAttribute('aria-checked', 'true');
    }
  });

  test('theme selection persists across a reload', async ({ page }) => {
    await seedWorkspace(page);

    await page.getByRole('button', { name: 'Theme' }).click();
    await themeItem(page, 'Midnight').click();
    await expectOnlyTheme(page, 'midnight');

    // next-themes persists to localStorage under the "theme" key.
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('midnight');

    await page.reload();
    await expect(page.locator('header')).toBeVisible();
    await expectOnlyTheme(page, 'midnight');
  });

  test('command palette theme items switch themes too', async ({ page }) => {
    await seedWorkspace(page);

    await page.getByRole('button', { name: 'Open command palette' }).click();
    await expect(page.getByText('Command Palette')).toBeVisible();

    await page.getByRole('option', { name: 'Midnight' }).click();

    await expectOnlyTheme(page, 'midnight');
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('midnight');
  });
});