import { defineConfig } from '@playwright/test'
import { clerkSetup } from '@clerk/testing/playwright'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  testDir: './tests',
  timeout: 240_000,
  globalSetup: require.resolve('./global-setup.ts'),
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3333',
  },
  webServer: {
    command: process.env.CI ? 'pnpm exec next dev --port 3333' : 'pnpm run dev',
    url: 'http://localhost:3333',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Client-only flag: skips the sign-in redirect in the UI.
      NEXT_PUBLIC_E2E_TEST: '1',
      // Server-only flag: enables the auth bypass (requires NODE_ENV=development|test).
      E2E_AUTH_BYPASS: '1',
      NODE_ENV: 'development',
    }
  },
})
