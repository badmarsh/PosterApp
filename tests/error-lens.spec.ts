import { test, expect, type Page } from '@playwright/test'

/**
 * Error Lens, Quick Fixes, Height Meter & Search Credibility — E2E.
 *
 * These specs drive the REAL editor UI against the in-memory demo workspace
 * (`demo_ws`), stubbing only the HTTP boundary with `page.route`. They
 * therefore run in any environment (no database, no LaTeX compiler, no
 * external academic APIs required) and pin the user-visible behaviour of:
 *
 *   1. Compile error lens  — structured triage list with counts, line badges,
 *      fix hints and jump-to-card attribution.
 *   2. Quick fixes         — one-click "close unclosed $…$" from the
 *      Validation tab, reflected in the Content textarea.
 *   3. Height budget meter — live usage bar with soft/hard overflow text.
 *   4. Credibility pill    — high-trust and RETRACTED badges in academic
 *      search results.
 */

test.beforeEach(async ({ page }) => {
  // Deterministic boot: no persisted last-workspace, no workspace list.
  await page.addInitScript(() => window.localStorage.clear())
})

/**
 * With no stored workspace and an empty workspace list the shell opens its
 * onboarding dialog on top of the in-memory demo editor — close it so the
 * specs drive the demo workspace.
 */
async function dismissOnboardingDialog(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Select a Workspace' })
  try {
    await dialog.waitFor({ state: 'visible', timeout: 8_000 })
    await page.getByRole('button', { name: 'Close' }).click()
  } catch {
    // Real environments with a last-workspace pointer boot straight into the
    // editor — nothing to dismiss.
  }
}

// The editor shell is a desktop workspace: side panels and top-bar actions
// only mount above the `xl` breakpoint (a 1280px viewport minus scrollbars
// sits BELOW it). These specs exercise the full shell.
test.use({ viewport: { width: 1680, height: 1000 } })

const FAILING_LOG = [
  'This is pdfTeX, Version 3.141592653 (TeX Live 2024)',
  ' entering extended mode',
  ' restricted \\write18 enabled.',
  '! Undefined control sequence.',
  '<argument> \\textbf ',
  'l.27 \\textbf{evidence} lower bound (ELBO)',
  'LaTeX Warning: Citation `reyes2026\' on page 1 undefined on input line 27.',
  'Overfull \\hbox (12.45pt too wide) in paragraph at lines 40--44',
].join('\n')

async function stubDemoWorkspace(page: Page) {
  await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }))
  // Catch-all for demo-workspace API polling (agent inbox, equations, bib…).
  // Registered first, so the stubs below take precedence.
  await page.route('**/api/workspaces/demo_ws/**', (route) =>
    route.fulfill({ json: { changes: [] } })
  )
  // The failed-compile flow hands the log to the assistant panel; answer
  // locally so the spec does not depend on a live AI provider.
  await page.route('**/api/workspaces/demo_ws/chat', (route) =>
    route.fulfill({ json: { role: 'assistant', content: 'Analysed the compile log — see the error lens list.' } })
  )
}

async function stubFailingCompile(page: Page) {
  await page.route('**/api/workspaces/demo_ws/compile**', (route) =>
    route.fulfill({ json: { ok: false, log: FAILING_LOG } })
  )
  await page.route('**/api/workspaces/demo_ws/autofix-compile**', (route) =>
    route.fulfill({ json: { explanation: 'Could not determine a safe auto-fix.', patches: [] } })
  )
}

test.describe('Compile error lens', () => {
  test('failed compile renders a structured triage list and jumps to the implicated card', async ({ page }) => {
    await stubDemoWorkspace(page)
    await stubFailingCompile(page)
    await page.goto('/')
    await dismissOnboardingDialog(page)

    // Demo workspace loaded — the compile button lives in the preview header.
    const compile = page.getByRole('button', { name: 'Compile', exact: true })
    await expect(compile).toBeVisible({ timeout: 30_000 })
    await compile.click()

    // Summary bar: failed state + parsed counts (1 error, 1 warning).
    await expect(page.getByText(/✗ Compile failed/)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/1 error/)).toBeVisible()
    await expect(page.getByText(/1 warning/)).toBeVisible()

    // Expand the triage list (collapsed by default).
    await page.getByRole('button', { name: /Compile failed — show error details/ }).click()

    // Triage list: message, l.NNN badge and fix hint for the control sequence.
    await expect(page.getByText('Undefined control sequence.').first()).toBeVisible()
    await expect(page.getByText('l.27').first()).toBeVisible()

    // Attribution hint — the l.NNN context matches the Mathematical Framework
    // card ("…maximize the evidence lower bound (ELBO)…"). Clicking it opens
    // the card in the inspector on the Validation tab. (The citation warning
    // maps to the same card, hence .first().)
    const jump = page.getByRole('button', { name: /Open card Mathematical Framework/ }).first()
    await expect(jump).toBeVisible()
    await jump.click()
    await expect(page.getByLabel(/Inspector for Mathematical Framework/)).toBeVisible()
  })

  test('raw log stays available behind the toggle', async ({ page }) => {
    await stubDemoWorkspace(page)
    await stubFailingCompile(page)
    await page.goto('/')
    await dismissOnboardingDialog(page)

    await page.getByRole('button', { name: 'Compile', exact: true }).click()
    await expect(page.getByText(/✗ Compile failed/)).toBeVisible({ timeout: 20_000 })

    // Expand the log panel first, then toggle the raw view inside it.
    await page.getByRole('button', { name: /Compile failed — show error details/ }).click()
    await page.getByRole('button', { name: 'Show raw log' }).click()
    await expect(page.locator('pre', { hasText: 'This is pdfTeX' })).toBeVisible()
    await page.getByRole('button', { name: 'Hide raw log' }).click()
    await expect(page.locator('pre', { hasText: 'This is pdfTeX' })).toBeHidden()
  })
})

test.describe('Quick fixes and height meter', () => {
  test('close-unclosed-$ fix is offered and applied from the Validation tab', async ({ page }) => {
    await stubDemoWorkspace(page)
    await page.goto('/')
    await dismissOnboardingDialog(page)

    // Select the Introduction card from the demo workspace.
    await page.getByText('Introduction', { exact: true }).first().click()
    const inspector = page.getByLabel(/Inspector for Introduction/)
    await expect(inspector).toBeVisible({ timeout: 15_000 })

    // Break the content: an odd number of $ delimiters.
    await page.getByRole('tab', { name: 'Content' }).click()
    const content = page.getByLabel('Card content')
    await content.fill('Discovered a latent $variable missing')

    await page.getByRole('tab', { name: 'Validation' }).click()
    const apply = page.getByRole('button', { name: 'Apply quick fix: Close unclosed $…$' })
    await expect(apply).toBeVisible()
    await apply.click()

    // The fix must be reflected in the editor content.
    await page.getByRole('tab', { name: 'Content' }).click()
    await expect(page.getByLabel('Card content')).toHaveValue(/missing\$$/)
  })

  test('height meter shows live usage and flags overflow', async ({ page }) => {
    await stubDemoWorkspace(page)
    await page.goto('/')
    await dismissOnboardingDialog(page)

    await page.getByText('Introduction', { exact: true }).first().click()
    await expect(page.getByLabel(/Inspector for Introduction/)).toBeVisible({ timeout: 15_000 })

    await page.getByRole('tab', { name: 'Content' }).click()

    // Live usage meter is present with a numeric ratio.
    const meter = page.getByLabel('Card height usage relative to column budget')
    await expect(meter).toBeVisible()

    // Fill the card far past the 900u gemini column budget.
    const filler = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(90)
    await page.getByLabel('Card content').fill(filler)

    await expect(page.getByText(/Over budget by \d+u/)).toBeVisible({ timeout: 10_000 })
    const value = Number(await meter.getAttribute('aria-valuenow'))
    expect(value).toBeGreaterThan(100)
  })
})

test.describe('Academic search credibility', () => {
  test('results show a credibility pill and retracted papers are flagged', async ({ page }) => {
    await stubDemoWorkspace(page)
    await page.route('**/api/academic/search', (route) =>
      route.fulfill({
        json: {
          results: [
            {
              source: 'openalex',
              title: 'Highly Reliable Method',
              authors: ['A. Author'],
              year: 2025,
              venue: 'NeurIPS',
              doi: '10.1234/solid',
              citationCount: 500,
              influentialCitationCount: 20,
              openAccessPdfUrl: 'https://example.org/solid.pdf',
            },
            {
              source: 'openalex',
              title: 'Retracted Study',
              authors: ['B. Author'],
              year: 2024,
              venue: 'Nature',
              doi: '10.1234/retracted',
              citationCount: 900,
              isRetracted: true,
            },
          ],
        },
      })
    )

    await page.goto('/')
    await dismissOnboardingDialog(page)
    await page.getByRole('button', { name: 'Academic Search' }).click()

    // Placeholder is localized (EN/SK/CS) — target the dialog's search textbox.
    const input = page.getByRole('dialog').getByRole('textbox').first()
    await input.fill('latent dynamics')
    await input.press('Enter')

    await expect(page.getByText('Highly Reliable Method')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Retracted Study')).toBeVisible()

    // Trust pill on the solid paper; hard destructive flag on the retracted one.
    await expect(page.getByText('Dôveryhodný')).toBeVisible()
    await expect(page.getByText('RETRACTED — necitovať')).toBeVisible()
  })
})
