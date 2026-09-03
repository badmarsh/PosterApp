import { test, expect, type Page } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

/**
 * Runtime verification for the per-output scoped thesis-review store.
 *
 * Before the fix, every thesis-review tab read/wrote the single global
 * Zustand store, so a second "Thesis Review" tab mirrored the first one's
 * form values. The fix scopes the store per output tab via a factory +
 * registry + React context (see components/thesis-review/thesis-review-provider.tsx),
 * and a follow-up "Maximum update depth exceeded" loop was patched via
 * primitive selectors in the shell and a memoized provider value.
 *
 * NOTE: the old specs that mock state through `window.__thesisReviewStore.setState`
 * no longer drive the tabbed UI — the components read the SCOPED store from
 * context, while the window handle still points at the singleton. This spec is
 * therefore fully UI-driven.
 */

// Only these indicate the render-loop regression (dev build spells it out;
// prod builds surface it as "Minified React error #185").
const LOOP_ERROR = /Maximum update depth exceeded|Minified React error #185|Maximum update depth/i;

// Harmless dev-network noise that must not fail the test.
const BENIGN =
  /favicon|404|Failed to load resource|net::ERR|ResizeObserver|Download the React DevTools|WebSocket|SSE|EventSource/i;

const NAME_PLACEHOLDER = 'input[placeholder*="Maroš Bednár"]';
const TITLE_PLACEHOLDER = 'input[placeholder*="automatizované vyhľadávanie"]';

const REVIEWER_PLACEHOLDER = 'input[placeholder*="Richard Marko"]';

interface ErrorSink {
  console: string[];
  page: string[];
}

function collectErrors(page: Page): ErrorSink {
  const sink: ErrorSink = { console: [], page: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') sink.console.push(msg.text());
  });
  page.on('pageerror', (err) => sink.page.push(String(err)));
  return sink;
}

function assertNoLoopErrors(sink: ErrorSink) {
  const all = [...sink.console, ...sink.page];
  const noise = all.filter((e) => BENIGN.test(e));
  const real = all.filter((e) => !BENIGN.test(e));
  // Always surface everything for honest reporting.
  for (const e of noise) console.log(`[benign error] ${e}`);
  for (const e of real) console.log(`[error] ${e}`);
  const loopErrors = all.filter((e) => LOOP_ERROR.test(e));
  expect(
    loopErrors,
    `Render-loop errors detected:\n${loopErrors.join('\n')}`,
  ).toHaveLength(0);
}

async function bootstrapThesisWorkspace(page: Page): Promise<string> {
  const wsId = `test-tab-indep-${Date.now()}`;

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.evaluate(async (id) => {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name: 'Tab Independence Test',
        outputType: 'thesis-review',
        templateId: 'posudok-sk',
      }),
    });
    if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
    const data = await res.json();

    window.localStorage.setItem(
      'posterapp-editor-storage',
      JSON.stringify({
        state: { lastWorkspaceId: data.id, selectedCardId: null },
        version: 1,
      }),
    );
  }, wsId);

  // Reload so the app boots with the workspace as active.
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  return wsId;
}

test.describe('Thesis review tab independence & shared thesis context', () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test('two thesis-review tabs share thesis identity while keeping reviewer-specific state isolated', async ({
    page,
  }) => {
    const errors = collectErrors(page);

    const nameInput = page.locator(NAME_PLACEHOLDER);
    const titleInput = page.locator(TITLE_PLACEHOLDER);
    const reviewerNameInput = page.locator(REVIEWER_PLACEHOLDER);
    const tabBar = page.locator('button[aria-label="Add output"]').locator('..');
    const thesisTabs = tabBar.getByRole('button', { name: /Posudok/ });

    await bootstrapThesisWorkspace(page);

    // ---- Tab 1: initial form renders and accepts input -------------------
    await test.step('tab 1 renders the blank metadata form', async () => {
      await expect(page.getByText('Nový posudok')).toBeVisible({ timeout: 15000 });
      await expect(nameInput).toBeVisible({ timeout: 15000 });
      await expect(titleInput).toBeVisible();
      await expect(nameInput).toHaveValue('');
      await expect(titleInput).toHaveValue('');
    });

    await test.step('tab 1 accepts author, title, and reviewer values', async () => {
      await nameInput.fill('Ján Novák');
      await titleInput.fill('Tab One Thesis');
      await reviewerNameInput.fill('prof. RNDr. Peter Varga, DrSc.');
      await expect(nameInput).toHaveValue('Ján Novák');
      await expect(titleInput).toHaveValue('Tab One Thesis');
      await expect(reviewerNameInput).toHaveValue('prof. RNDr. Peter Varga, DrSc.');
    });

    // ---- Add a second thesis-review output via the dialog -----------------
    await test.step('add a second thesis-review output', async () => {
      await page.click('button[aria-label="Add output"]');
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Dialog defaults to "Slides" — select the thesis-review pill
      await dialog.getByRole('button', { name: /Thesis Review \(Posudok\)/ }).click();
      await dialog.getByRole('button', { name: 'Create Output' }).click();
      await expect(dialog).toBeHidden();

      // App auto-switches to the newly created tab → two thesis tabs exist ("Posudok školiteľa" & "Posudok oponenta")
      await expect(thesisTabs).toHaveCount(2);
    });

    // ---- INHERITED METADATA & DOCUMENT BINDING CHECK ----------------------
    await test.step('tab 2 inherits student name and thesis title from tab 1', async () => {
      await expect(nameInput).toHaveValue('Ján Novák', { timeout: 10000 });
      await expect(titleInput).toHaveValue('Tab One Thesis');
      // Reviewer-specific field is independent and blank on tab 2
      await expect(reviewerNameInput).toHaveValue('');
    });

    // ---- INDEPENDENT REVIEWER STATE CHECK ---------------------------------
    await test.step('tab 2 accepts reviewer-specific values without modifying tab 1', async () => {
      await reviewerNameInput.fill('doc. Ing. Elena Horváthová, PhD.');
      await expect(reviewerNameInput).toHaveValue('doc. Ing. Elena Horváthová, PhD.');
    });

    // ---- Switch back to tab 1: tab 1 reviewerName is intact --------------
    await test.step('switching back to tab 1 retains tab 1 reviewer-specific state', async () => {
      await thesisTabs.first().click();
      await expect(nameInput).toHaveValue('Ján Novák', { timeout: 10000 });
      await expect(titleInput).toHaveValue('Tab One Thesis');
      await expect(reviewerNameInput).toHaveValue('prof. RNDr. Peter Varga, DrSc.');
    });

    // ---- Check updating shared thesis title in tab 1 updates tab 2 -------
    await test.step('updating thesis title in tab 1 updates shared metadata in tab 2', async () => {
      await titleInput.fill('Updated Joint Thesis Title');
      await expect(titleInput).toHaveValue('Updated Joint Thesis Title');

      await thesisTabs.nth(1).click();
      await expect(titleInput).toHaveValue('Updated Joint Thesis Title', { timeout: 10000 });
      await expect(nameInput).toHaveValue('Ján Novák');
      await expect(reviewerNameInput).toHaveValue('doc. Ing. Elena Horváthová, PhD.');
    });

    // ---- Switch away to a non-thesis output, then back --------------------
    await test.step('switching to a Slides output renders the slides editor', async () => {
      await page.click('button[aria-label="Add output"]');
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      // Dialog defaults to "Slides" — create immediately.
      await dialog.getByRole('button', { name: 'Create Output' }).click();
      await expect(dialog).toBeHidden();

      // Thesis form unmounts; the Structure header bar is thesis-excluded.
      await expect(nameInput).toBeHidden();
      await expect(titleInput).toBeHidden();
      await expect(tabBar.getByRole('button', { name: 'Slides' })).toBeVisible();
      await expect(page.getByText('Structure', { exact: true })).toBeVisible();
    });

    await test.step('returning to tab 1 still shows tab 1 state and updated title', async () => {
      await thesisTabs.first().click();
      await expect(nameInput).toHaveValue('Ján Novák', { timeout: 10000 });
      await expect(titleInput).toHaveValue('Updated Joint Thesis Title');
      await expect(reviewerNameInput).toHaveValue('prof. RNDr. Peter Varga, DrSc.');

      // And tab 2 still has its own reviewerName and the shared title
      await thesisTabs.nth(1).click();
      await expect(nameInput).toHaveValue('Ján Novák', { timeout: 10000 });
      await expect(titleInput).toHaveValue('Updated Joint Thesis Title');
      await expect(reviewerNameInput).toHaveValue('doc. Ing. Elena Horváthová, PhD.');
    });

    // ---- Render-loop guard -------------------------------------------------
    await test.step('no render-loop or React fatal errors were logged', async () => {
      assertNoLoopErrors(errors);
    });
  });
});
