import { test, expect } from "@playwright/test"

/**
 * Optional DeerFlow E2E suite.
 *
 * Requires a live DeerFlow sidecar AND explicit opt-in:
 *   DEERFLOW_E2E=1 docker compose --profile deerflow up -d
 *   DEERFLOW_E2E=1 DEERFLOW_ENABLED=1 pnpm test:e2e -- deerflow
 *
 * Skipped by default (and in CI) so the regular suite never depends on the
 * sidecar. Mirrors the `LATEX_AVAILABLE` gating pattern.
 */
const enabled = process.env.DEERFLOW_E2E === "1"
test.skip(!enabled, "DEERFLOW_E2E is not set — DeerFlow suite skipped")

test("deep research panel starts a run and applies a proposal", async ({ page }) => {
  await page.goto("/")

  // The agent panel tab is visible; switch to Deep research.
  await page.getByRole("button", { name: "Deep research" }).click()
  await expect(page.getByText("Deep research kopilot")).toBeVisible()

  // Fill focus + start.
  await page.getByPlaceholder(/Čo má agent preskúmať/).fill("Deep learning in medical imaging 2026")
  await page.getByRole("button", { name: "Spustiť výskum" }).click()

  // The run goes through queue → running → done; proposal drawer appears.
  await expect(page.getByText(/Návrh výskumu/)).toBeVisible({ timeout: 180_000 })
  await page.getByRole("button", { name: /Použiť do plátna/ }).click()
  await expect(page.getByText(/Použité/)).toBeVisible({ timeout: 30_000 })
})
