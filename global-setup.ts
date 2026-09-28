import { clerkSetup } from '@clerk/testing/playwright';

export default async function globalSetup() {
  if (process.env.E2E_AUTH_BYPASS === '1' || process.env.NEXT_PUBLIC_E2E_TEST === '1') {
    console.log('[e2e] Skipping Clerk setup due to E2E_AUTH_BYPASS');
    return;
  }
  await clerkSetup();
}
