import { defineConfig } from '@playwright/test'
import { clerkSetup } from '@clerk/testing/playwright'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  globalSetup: require.resolve('./global-setup.ts'),
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3333',
  },
})
