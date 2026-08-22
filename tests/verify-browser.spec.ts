import { test, expect } from '@playwright/test';

test('App loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  if (errors.length > 0) {
    console.error("Browser errors:", errors);
  }
  expect(errors.length).toBe(0);
});
