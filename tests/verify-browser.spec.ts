import { test, expect } from '@playwright/test';

test('App loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      // Ignore benign resource loading errors (404s for missing assets, favicons, etc.)
      const text = msg.text();
      if (!text.includes('Failed to load resource') && !text.includes('404')) {
        errors.push(text);
      }
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  if (errors.length > 0) {
    console.error("Browser errors:", errors);
  }
  expect(errors.length).toBe(0);
});
