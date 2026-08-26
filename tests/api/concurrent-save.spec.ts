import { test, expect } from '@playwright/test';

test('rejects concurrent saves with 409 Conflict', async ({ request }) => {
  // 1. Create a dummy workspace via API
  const createRes = await request.post('/api/workspaces', {
    data: { id: 'concurrent-test-' + Date.now(), name: 'Concurrent Test' }
  });
  const ws = await createRes.json();
  
  // 2. Client A saves with revision 0
  const saveA = await request.put(`/api/workspaces/${ws.id}`, {
    data: { ...ws, name: 'Client A Win', revision: ws.revision }
  });
  console.log(saveA.status(), await saveA.json());
  expect(saveA.ok()).toBeTruthy();
  
  // 3. Client B attempts to save with the stale revision 0
  const saveB = await request.put(`/api/workspaces/${ws.id}`, {
    data: { ...ws, name: 'Client B Lose', revision: ws.revision }
  });
  
  // 4. Assert Client B gets a 409
  expect(saveB.status()).toBe(409);
  const errBody = await saveB.json();
  expect(errBody.error).toContain('changed in another session');
});
