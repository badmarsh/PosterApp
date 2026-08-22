import { auth as clerkAuth } from "@clerk/nextjs/server"

export async function auth() {
  if (process.env.NEXT_PUBLIC_E2E_TEST === "1") {
    return { userId: "test-user-id" }
  }
  return await clerkAuth()
}
