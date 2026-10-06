import { clerkSetup } from '@clerk/testing/playwright';

export default async function globalSetup() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const isMock = !secretKey || secretKey.startsWith('sk_test_mock');

  if (isMock) {
    console.log('[e2e] Skipping Clerk setup: CLERK_SECRET_KEY is missing or mock');
    process.env.CLERK_FAPI = process.env.CLERK_FAPI || 'clerk.dummy.accounts.dev';
    return;
  }

  try {
    await clerkSetup();
  } catch (err) {
    console.warn('[e2e] clerkSetup failed, providing fallback FAPI:', err);
    process.env.CLERK_FAPI = process.env.CLERK_FAPI || 'clerk.dummy.accounts.dev';
  }
}
