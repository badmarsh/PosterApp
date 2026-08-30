import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.describe('Collaboration Feature (Two Clients)', () => {
  test('synchronizes finding status between two clients', async ({ browser }) => {
    // We need two distinct browser contexts to simulate two users
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Authenticate both
    await setupClerkTestingToken({ page: pageA });
    await setupClerkTestingToken({ page: pageB });

    const wsId = `collab-ws-${Date.now()}`;

    // A creates the workspace
    await pageA.goto('/');
    await pageA.waitForLoadState('networkidle');

    await pageA.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: 'Collab Test Project',
          outputType: 'thesis-review',
          templateId: 'posudok-sk',
        }),
      });
      if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
      const data = await res.json();
      window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
        state: { selectedCardId: null, lastWorkspaceId: data.id },
        version: 1,
      }));
    }, wsId);

    await pageA.goto('/');
    await pageA.waitForLoadState('networkidle');

    // Wait for App to load
    await expect(pageA.locator('body')).toBeVisible();

    // Client A creates a review via UI
    await pageA.locator('input[placeholder*="Ján Novák"]').fill('Alice');
    await pageA.locator('input[placeholder*="Návrh a"]').fill('Collab Title');
    
    // Mock the POST request so we don't call actual AI
    await pageA.route(`**/api/workspaces/${wsId}/thesis-review`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'collab-review-1',
            studentName: 'Alice',
            thesisTitle: 'Collab Title',
            thesisType: 'master',
            reviewerRole: 'opponent',
            grade: 'A',
            recommendation: 'Good',
            sections: [],
            defenseQuestions: [],
            citationIssues: [],
            findings: [
              {
                id: 'f-1',
                category: 'methodology',
                title: 'Shared Finding',
                explanation: 'This finding should sync.',
                severity: 'major',
                status: 'unreviewed',
                createdBy: 'ai',
                includeInExport: true,
                evidence: [],
              }
            ],
            status: 'draft',
            language: 'sk',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await pageA.getByRole('button', { name: /Vygenerovať.*posudok/i }).click();

    // Wait for generation to complete and finding to show up
    await expect(pageA.getByText('Shared Finding')).toBeVisible({ timeout: 15000 });

    // Client B connects to the same workspace
    await pageB.goto('/');
    await pageB.waitForLoadState('networkidle');
    await pageB.evaluate(async (id) => {
      window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
        state: { selectedCardId: null, lastWorkspaceId: id },
        version: 1,
      }));
    }, wsId);
    
    // B needs to mock GET to return the DB state so loadReview works
    await pageB.route(`**/api/workspaces/${wsId}/thesis-review`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            reviews: [
              {
                id: 'collab-review-1',
                studentName: 'Alice',
                thesisTitle: 'Collab Title',
                thesisType: 'master',
                reviewerRole: 'opponent',
                grade: 'A',
                recommendation: 'Good',
                status: 'draft',
                language: 'sk',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            ]
          }),
        });
      } else {
        await route.continue();
      }
    });

    await pageB.route(`**/api/workspaces/${wsId}/thesis-review/collab-review-1`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'collab-review-1',
          studentName: 'Alice',
          thesisTitle: 'Collab Title',
          thesisType: 'master',
          reviewerRole: 'opponent',
          grade: 'A',
          recommendation: 'Good',
          sections: [],
          defenseQuestions: [],
          citationIssues: [],
          findings: [
            {
              id: 'f-1',
              category: 'methodology',
              title: 'Shared Finding',
              explanation: 'This finding should sync.',
              severity: 'major',
              status: 'unreviewed',
              createdBy: 'ai',
              includeInExport: true,
              evidence: [],
            }
          ],
          status: 'draft',
          language: 'sk',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await pageB.goto('/');
    await pageB.waitForLoadState('networkidle');

    // B clicks on the review in the list
    await pageB.getByText('Alice').click();

    // Client B should see the finding synced from A
    await expect(pageB.getByText('Shared Finding')).toBeVisible({ timeout: 15000 });

    // Client B accepts the finding
    const acceptBtnB = pageB.getByRole('button', { name: /Prijať/i });
    await expect(acceptBtnB).toBeVisible();
    await acceptBtnB.click();

    // Verify Client A sees the finding status change to accepted
    await expect(pageA.getByText('Prijaté').first()).toBeVisible({ timeout: 10000 });

    // Client A modifies the finding text
    const editBtnA = pageA.getByRole('button', { name: /Upraviť/i }).first();
    await editBtnA.click();
    
    // In edit mode, find textarea for explanation and edit it
    const textareaA = pageA.locator('textarea').first();
    await textareaA.fill('Updated explanation by A');
    await pageA.getByRole('button', { name: /Uložiť/i }).click();

    // Client B sees the update
    await expect(pageB.getByText('Updated explanation by A')).toBeVisible({ timeout: 10000 });

    // Ensure state persists after A disconnects
    await pageA.close();
    
    // B should still see the finding
    await expect(pageB.getByText('Updated explanation by A')).toBeVisible();

    await contextA.close();
    await contextB.close();
  });
});
