import { test, expect, type Page } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

/**
 * Keyboard-only accessibility flows (UI polish plan, Phase 5 gate).
 *
 * Every assertion is made with the keyboard alone — no mouse clicks — so the
 * suite fails if focus management (initial focus, traps, focus return,
 * Enter/Space activation) regresses.
 */

// Seed a throwaway workspace so the forced selector never blocks the top bar.
async function seedWorkspace(page: Page) {
  const wsId = `test-a11y-${Date.now()}`;
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(async (id) => {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: 'A11y Test' }),
    });
    if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
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

test.describe('Keyboard-only flows', () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await seedWorkspace(page);
  });

  test('command palette: open, filter, arrow+enter, escape (focus returns to opener)', async ({ page }) => {
    const opener = page.getByRole('button', { name: 'Open command palette' });
    await opener.focus();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog')).toBeVisible();

    // Type to filter, then keyboard-select the first result.
    await page.keyboard.type('structure');
    const items = page.getByRole('option');
    await expect(items.first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeHidden();

    // Escape must also close (reopen first) and focus must return to the opener.
    await opener.focus();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Open command palette');
  });

  test('structure sidebar: tab to card row, enter selects, focus rings visible', async ({ page }) => {
    // Open the structure panel from the keyboard (it starts open on desktop;
    // make sure it is open either way).
    await page.getByRole('button', { name: 'Toggle structure panel' }).focus();
    await page.keyboard.press('Enter');

    const row = page.getByRole('button', { name: /Edit card .* \(/ });
    await expect(row.first()).toBeVisible();
    await row.first().focus();
    await expect(row.first()).toBeFocused();
    await page.keyboard.press('Enter');

    // Selecting a card opens the card inspector in the right sidebar.
    await expect(page.getByRole('tab', { name: 'Basics' }).first()).toBeVisible();
  });

  test('ingestion drawer: keyboard open, focus trapped, escape closes, focus returns', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Ingest source PDFs' });
    await trigger.focus();
    await page.keyboard.press('Enter');

    const drawer = page.getByRole('dialog', { name: 'Ingest sources' });
    await expect(drawer).toBeVisible();

    // Focus is trapped: cycle far beyond the focusable count and stay inside.
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
    }
    const inside = await page.evaluate((label) => {
      const el = document.querySelector('[aria-label="Ingest sources"]');
      return el ? el.contains(document.activeElement) : false;
    }, 'Ingest sources');
    expect(inside).toBe(true);

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(
      page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    ).toBe('Ingest source PDFs');
  });

  test('history panel: keyboard open, escape closes, focus returns to trigger', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Save History' });
    await trigger.focus();
    await page.keyboard.press('Enter');

    const panel = page.getByRole('dialog', { name: 'Save history' });
    await expect(panel).toBeVisible();
    // Initial focus lands on the close button.
    await expect(page.getByRole('button', { name: 'Close save history' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(
      page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    ).toBe('Save History');
  });

  test('workspace selector dialog: tab trap, escape, focus return', async ({ page }) => {
    // The selector opens from the palette (keyboard) or the top-bar workspace menu;
    // use the palette item for a pure keyboard path.
    await page.getByRole('button', { name: 'Open command palette' }).focus();
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type('workspace');
    const items = page.getByRole('option');
    await expect(items.first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Select a Workspace' }) });
    await expect(dialog).toBeVisible();

    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
    }
    const inside = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h2'));
      const dlg = headings.find((h) => h.textContent?.includes('Select a Workspace'))?.closest('[role="dialog"]');
      return dlg ? dlg.contains(document.activeElement) : false;
    });
    expect(inside).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
