const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', error => {
    errors.push(error.message);
  });

  try {
    await page.goto('http://localhost:3333', { waitUntil: 'networkidle' });
    console.log("Page loaded successfully.");
    
    // Check if Clerk redirect happened or main page loaded
    const url = page.url();
    console.log(`Current URL: ${url}`);
    
    if (errors.length > 0) {
      console.error("Found console errors:");
      console.error(errors.join("\n"));
      process.exit(1);
    }
    
    console.log("No console errors found. UI is stable.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to load page:");
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
