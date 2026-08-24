import { config } from "dotenv";
config({ path: ".env.local" });
config();
// @ts-expect-error Prisma beta type
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
