import { test, expect } from '@playwright/test';
import WebSocket from 'ws';

test('WebSocket upgrade handles invalid tickets without crashing server', async () => {
  return new Promise<void>((resolve, reject) => {
    // Attempt to connect with an invalid ticket format
    const ws = new WebSocket('ws://localhost:3333/api/yjs?workspaceId=test1234', [
      'posterapp-yjs-v1',
      'invalid-ticket-that-is-way-too-short'
    ]);

    ws.on('error', (err) => {
      // The server should reject the connection (401) and destroy the socket.
      // It MUST NOT crash the node process.
      expect(err.message).toContain('Unexpected server response: 401');
      resolve();
    });
    
    ws.on('open', () => {
      reject(new Error("Connection should have been rejected"));
    });
  });
});
