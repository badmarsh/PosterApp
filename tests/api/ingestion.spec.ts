import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import fs from 'fs';
import path from 'path';

test.describe('Ingestion API Robustness', () => {
  test('returns error for invalid or unauthenticated ingestion request', async ({ request }) => {
    const fakePdfBuffer = Buffer.from('%PDF-1.4\n%EOF\n');
    const res = await request.post('/api/ingestion/parse?workspaceId=test-ws', {
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

    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
