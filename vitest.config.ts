import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20000,
    include: ["__tests__/**/*.test.ts", "lib/**/__tests__/**/*.test.ts"],
    alias: {
      "@": path.resolve(__dirname, "./"),
      // `server-only` throws outside the React server condition; stub it in unit tests.
      "server-only": path.resolve(__dirname, "./__tests__/stubs/server-only.ts"),
    },
  },
})
