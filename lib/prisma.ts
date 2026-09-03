import { config } from "dotenv"
import type { PrismaClient as PrismaClientType } from "@prisma/client"

// Load .env.local / .env only when DATABASE_URL is not already provided by the
// process environment (containers, CI, PaaS). Avoids surprising overrides and
// filesystem reads on every cold import.
if (!process.env.DATABASE_URL) {
  config({ path: ".env.local" })
  config()
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined
}

/**
 * Lazily constructs the PrismaClient on first property access instead of at
 * module evaluation. Constructing at import time made every module that
 * (transitively) imports the client hard-fail in environments without the
 * query engine binary (unit tests) even when the importing code only calls
 * pure helpers. Properties are forwarded to the real client; the engine is
 * downloaded/generated in normal deployments, where this is transparent.
 */
function createLazyClient(): PrismaClientType {
  let client: PrismaClientType | null = null
  const getClient = (): PrismaClientType => {
    if (!client) {
      const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client")
      client = new PrismaClient()
    }
    return client
  }

  return new Proxy({} as PrismaClientType, {
    get(_target, prop, receiver) {
      const real = getClient() as unknown as Record<string | symbol, unknown>
      const value = real[prop]
      return typeof value === "function" ? value.bind(real) : Reflect.get(real as object, prop, receiver)
    },
  })
}

// Cache the client on globalThis in EVERY environment. In production this
// guards against multiple instances when the module is evaluated more than
// once (e.g. separate bundles for route handlers and the custom server).
export const prisma: PrismaClientType = globalForPrisma.prisma ?? createLazyClient()
globalForPrisma.prisma = prisma

export type { Prisma } from "@prisma/client"
