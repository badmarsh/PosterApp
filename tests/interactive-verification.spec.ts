import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.describe('Interactive Thesis Review & Math Typesetting Verification', () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test('loads robco-phd, renders manuscript KaTeX, verifies floating selection bar, and verifies new finding drawer', async ({ page }) => {
    // 1. Pre-configure localStorage to open workspace robco-phd
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      window.localStorage.setItem(
        'posterapp-editor-storage',
        JSON.stringify({
          state: { lastWorkspaceId: 'robco-phd', selectedCardId: null },
          version: 1,
        })
      );
    });

    // 2. If the "Select a Workspace" modal dialog is open, click "Robco PhD"
    const robcoBtn = page.getByRole('button', { name: /Robco PhD/i });
    if (await robcoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await robcoBtn.click();
    }

    // 3. Ensure we are in the Thesis Review workspace / tab
    const thesisTab = page.locator('button', { hasText: /Posudok/i }).first();
    if (await thesisTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await thesisTab.click();
      await page.waitForTimeout(500);
    }

    // 4. If review card is shown in the review list, click it to activate ExpertReviewWorkspace
    const reviewCard = page.locator('div[role="button"]').filter({ hasText: /Bose-Einstein/i }).first();
    if (await reviewCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reviewCard.click();
    } else {
      // Fallback: activate review directly via registry store if card isn't visible yet
      await page.evaluate(async () => {
        const stores = (window as any).__reviewStoreRegistry;
        if (stores) {
          for (const [key, store] of stores.entries()) {
            if (key.startsWith('robco-phd')) {
              await store.getState().loadReviews('robco-phd');
              const revs = store.getState().reviews;
              if (revs && revs.length > 0) {
                await store.getState().loadReview('robco-phd', revs[0].id);
              }
            }
          }
        }
      });
    }

    // 5. Verify expert review workspace is rendered
    await expect(page.getByText(/Zhrnutie práce|Odborné posúdenie|Dôkaz v texte|Bose-Einstein correlations/i).first()).toBeVisible({ timeout: 20000 });

    // 6. Verify KaTeX formulas are rendered inside the document paper sheet
    const katexElements = page.locator('.katex');
    await expect(katexElements.first()).toBeVisible({ timeout: 15000 });
    const katexCount = await katexElements.count();
    console.log(`Found ${katexCount} KaTeX rendered elements in the manuscript.`);
    expect(katexCount).toBeGreaterThan(0);

    // 7. Test text selection containing math and table data
    // Case A: Select a table snippet with math
    const sampleTableText = [
      '$\\alpha$    $\\equiv 2$    $\\equiv 1$    $0.81 \\pm 0.01 \\pm 0.18$',
      '$C_0$    $0.9778 \\pm 0.0002$    $0.9740 \\pm 0.0002$    $0.9725 \\pm 0.0003$',
      '$\\lambda$    $0.302 \\pm 0.002 \\pm 0.019$    $0.701 \\pm 0.006 \\pm 0.067$    $1.016 \\pm 0.030 \\pm 0.407$',
    ].join('\n');

    // Programmatically simulate selection on the document container
    await page.evaluate((textToSelect) => {
      // Find the document container inside EvidenceViewer
      const container = document.querySelector('.max-w-5xl') || document.body;
      const p = document.createElement('div');
      p.id = 'test-selection-target';
      p.style.position = 'relative';
      p.style.opacity = '0.9';
      p.innerText = textToSelect;
      container.prepend(p);

      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);

      // Trigger mouseup on container to fire EvidenceViewer handleMouseUp
      container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }, sampleTableText);

    // 7. Verify floating selection action bar appears
    const selectionBar = page.getByText('Vytvoriť pripomienku');
    await expect(selectionBar).toBeVisible({ timeout: 5000 });

    // Verify "Tabuľka" badge appears because multi-line table was selected
    const tableBadge = page.getByText('Tabuľka', { exact: true });
    await expect(tableBadge).toBeVisible();

    // Verify KaTeX rendering inside the floating bar snippet
    const floatingBarKatex = page.locator('.bg-primary .katex');
    await expect(floatingBarKatex.first()).toBeVisible();

    // Take screenshot of floating bar
    await page.screenshot({ path: 'test-floating-selection-bar.png' });

    // 8. Click "Vytvoriť pripomienku"
    await selectionBar.click();

    // 9. Verify that the new finding creation form/drawer opened
    await expect(page.getByText('Nová odborná pripomienka')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Dôkaz z textu:')).toBeVisible();

    // 10. Verify that EvidenceQuoteViewer rendered the selection as an interactive table with KaTeX cells
    // EvidenceQuoteViewer renders tables inside table/thead/tbody tags with .katex cells
    const drawerTable = page.locator('table');
    await expect(drawerTable.first()).toBeVisible();

    const drawerKatex = drawerTable.locator('.katex');
    await expect(drawerKatex.first()).toBeVisible();
    const drawerKatexCount = await drawerKatex.count();
    console.log(`Found ${drawerKatexCount} KaTeX formulas inside the EvidenceQuoteViewer table in drawer.`);
    expect(drawerKatexCount).toBeGreaterThan(0);

    // Take screenshot of new finding drawer with interactive table and KaTeX formulas
    await page.screenshot({ path: 'test-finding-drawer-table.png' });

    console.log('Interactive verification test completed successfully!');
  });
});
