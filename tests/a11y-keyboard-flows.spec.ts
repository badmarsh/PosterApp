import { test, expect, type Page } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

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
      JSON.stringify({ state: { selectedCardId: null, lastWorkspaceId: data.id }, version: 1 }),
    );
  }, wsId);
  await page.goto('/');
  await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
}

test.describe('Keyboard-only flows', () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await seedWorkspace(page);
  });

  test('command palette: open, filter, escape', async ({ page }) => {
    const opener = page.getByRole('button', { name: 'Open command palette' });
    await expect(opener).toBeVisible({ timeout: 10_000 });
    await opener.focus();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.type('structure');
    const items = page.getByRole('option');
    await expect(items.first()).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
    await opener.focus();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
  });

  test('structure sidebar: tab to card row, enter selects', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: 'Toggle structure panel' });
    await expect(toggleBtn).toBeVisible({ timeout: 15_000 });
    await toggleBtn.click();
    const row = page.getByRole('button', { name: /Edit card .* \\(/ });
    await expect(row.first()).toBeVisible({ timeout: 15_000 });
    await row.first().focus();
    await expect(row.first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Basics' }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('ingestion drawer: keyboard open, escape closes', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Ingest source PDFs' });
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const drawer = page.locator('[data-testid="ingestion-panel"]');
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden({ timeout: 5_000 });
  });

  test('history panel: keyboard open, escape closes', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Save History' });
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('dialog', { name: 'Save history' });
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden({ timeout: 5_000 });
  });

  test('workspace selector dialog: escape closes', async ({ page }) => {
    await page.getByRole('button', { name: 'Open command palette' }).focus();
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type('workspace');
    const items = page.getByRole('option');
    await expect(items.first()).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog.first()).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(dialog.first()).toBeHidden({ timeout: 5_000 });
  });
});
