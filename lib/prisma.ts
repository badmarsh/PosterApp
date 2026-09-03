import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"
export type { Prisma } from "@prisma/client"

// Load .env.local / .env only when DATABASE_URL is not already provided by the
// process environment (containers, CI, PaaS). Avoids surprising overrides and
// filesystem reads on every cold import.
if (!process.env.DATABASE_URL) {
  config({ path: ".env.local" })
  config()
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Cache the client on globalThis in EVERY environment. In production this
// guards against multiple instances when the module is evaluated more than
// once (e.g. separate bundles for route handlers and the custom server).
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
globalForPrisma.prisma = prisma
