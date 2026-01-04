// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // ✅ Use the DIRECT connection for migrations/introspection
    // (your old DIRECT_URL)
    url: env("DIRECT_URL"),
  },
});
