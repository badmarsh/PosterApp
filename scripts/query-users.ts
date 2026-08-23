import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function main() {
  const response = await clerk.users.getUserList();
  // Clerk sdk might return { data: User[] } in v5/v6
  const users = Array.isArray(response) ? response : response.data;
  const list = users.map(u => ({ id: u.id, email: u.emailAddresses[0]?.emailAddress }));
  console.log(JSON.stringify(list, null, 2));
}

main().catch(console.error);
