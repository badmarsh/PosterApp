import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('AddOutputDialog resets state when reopened', async ({ page }) => {
  const wsId = 'test-workspace-' + Date.now();
  await page.goto('/'); // navigate to root to get the auth cookie ready
  await page.waitForLoadState('networkidle'); // let Clerk initialize
  const realWsId = await page.evaluate(async (id) => {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: 'Test Workspace' })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to create workspace: ${res.status} ${text}`);
    }
    const data = await res.json();
    
    // Set the selected workspace in localStorage so the app loads it
    window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
      state: { lastWorkspaceId: data.id, selectedCardId: null },
      version: 1
    }));
  }, wsId);
  
  // Reload the app to pick up the local storage state
  await page.goto('/');
  
  // 1. Open dialog and change type
  await page.click('button[aria-label="Add output"]');
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  
  await page.click('button:has-text("Paper")'); // Select paper
  await expect(page.locator('button.bg-primary\\/10:has-text("Paper")')).toBeVisible();
  
  // 2. Close by pressing Escape
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).toBeHidden();
  
  // 3. Re-open and verify it reset to 'Slides' (the default)
  await page.click('button[aria-label="Add output"]');
  await expect(page.locator('button.bg-primary\\/10:has-text("Slides")')).toBeVisible();
  await expect(page.locator('button.bg-primary\\/10:has-text("Paper")')).toBeHidden();
});

test('AddOutputDialog shows an isometric mockup for every template, in the list and in the detail panel', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.click('button[aria-label="Add output"]');
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Template list: one preview per option, all on the shared 4:3 canvas.
  const options = page.locator('[data-testid="template-option"]');
  await expect(options.first()).toBeVisible();
  const optionCount = await options.count();
  expect(optionCount).toBeGreaterThan(0);

  const listPreviews = page.locator('[data-testid="template-option"] [data-testid="template-preview-image"]');
  await expect(listPreviews).toHaveCount(optionCount);

  const firstPreview = listPreviews.first();
  const firstBox = await firstPreview.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(firstBox!.width / firstBox!.height).toBeCloseTo(4 / 3, 1);

  // Each template serves its own asset, and the image really decoded.
  await page.waitForFunction(() => {
    const imgs = Array.from(document.querySelectorAll('[data-testid="template-option"] [data-testid="template-preview-image"] img')) as HTMLImageElement[];
    return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
  }, { timeout: 15_000 }).catch(() => {});

  const listSrcs = await listPreviews.locator('img').evaluateAll((imgs) =>
    imgs.map((img) => ({ src: (img as HTMLImageElement).getAttribute('src'), width: (img as HTMLImageElement).naturalWidth })),
  );
  expect(listSrcs.length).toBe(optionCount);
  expect(new Set(listSrcs.map((entry) => entry.src)).size).toBe(optionCount);
  for (const entry of listSrcs) {
    expect(entry.src).toMatch(/^\/template-previews\/[a-z0-9-]+\.(png|svg)$/);
    expect(entry.width).toBeGreaterThan(0);
  }

  // Detail panel: the selected template renders the same artwork, larger.
  const detailPreview = page.locator('[data-testid="template-preview-image"]').last();
  await expect(detailPreview).toBeVisible();
  const detailBox = await detailPreview.boundingBox();
  expect(detailBox!.width).toBeGreaterThan(firstBox!.width);
  expect(detailBox!.width / detailBox!.height).toBeCloseTo(4 / 3, 1);
  const detailSrc = await detailPreview.locator('img').first().getAttribute('src');
  expect(detailSrc).toBe(listSrcs[0].src);

  // Selecting another template swaps the detail preview to that template's art.
  if (optionCount > 1) {
    await options.nth(1).click();
    await expect(detailPreview.locator('img').first()).toHaveAttribute('src', listSrcs[1].src!);
  }
});
