import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('Verify app loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  
  page.on('console', msg => {
    console.log('BROWSER CONSOLE:', msg.type(), msg.text());
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('request', req => {
    if (req.url().includes('clerk')) {
      console.log('REQ:', req.url());
    }
  });
  page.on('response', res => {
    if (res.url().includes('clerk')) {
      console.log('RES:', res.status(), res.url());
    }
  });

  page.on('pageerror', exception => {
    errors.push(exception.message);
  });

  // Navigate to the app
  const response = await page.goto('http://localhost:3333');
  
  // Wait for network idle to ensure everything loaded
  await page.waitForLoadState('networkidle');

  // Verify response was successful or redirected
  expect(response?.status()).toBeLessThan(400);

  // Assert no errors in console
  if (errors.length > 0) {
    console.error('Browser Console Errors:', errors);
  }
  expect(errors.length, 'There should be 0 console errors').toBe(0);
});
