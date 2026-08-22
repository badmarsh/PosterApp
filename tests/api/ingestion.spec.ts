import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import fs from 'fs';
import path from 'path';

test.describe('Ingestion API Robustness', () => {
  test('returns 401 Unauthorized when no clerk session is present', async ({ request }) => {
    const formData = new FormData();
    formData.append('workspaceId', 'test-ws');
    formData.append('filename', 'test.pdf');
    
    // We create a tiny fake PDF using a buffer
    const fakePdfBuffer = Buffer.from('%PDF-1.4\n%EOF\n');
    formData.append('file', new Blob([fakePdfBuffer], { type: 'application/pdf' }), 'test.pdf');

    const res = await request.post('/api/ingestion/parse?workspaceId=test-ws', {
      // Intentionally omitting Clerk testing token
      multipart: {
        workspaceId: 'test-ws',
        filename: 'test.pdf',
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: fakePdfBuffer
        }
      }
    });

    expect(res.status()).toBe(401);
  });
});
