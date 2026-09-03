import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20000,
    include: ["__tests__/**/*.test.ts", "lib/**/__tests__/**/*.test.ts"],
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
