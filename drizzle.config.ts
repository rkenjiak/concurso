import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

for (const arquivo of [".env.local", ".env"]) {
  if (existsSync(arquivo)) process.loadEnvFile(arquivo);
}

export default defineConfig({
  dialect: "turso",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./data/concurso.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  },
  strict: true,
  verbose: true,
});
