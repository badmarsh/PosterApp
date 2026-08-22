import { test, expect } from '@playwright/test';

test.describe('Generate API Robustness', () => {
  test('returns 401 Unauthorized when no clerk session is present', async ({ request }) => {
    const res = await request.post('/api/workspaces/test-ws/cards/test-card/generate', {
      data: {
        topic: 'test',
        assets: [],
        sourceIds: [],
        characterLimit: 100,
        bibKeys: []
      }
    });

    expect(res.status()).toBe(401);
  });
});
