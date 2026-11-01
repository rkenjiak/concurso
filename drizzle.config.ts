import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";
import { tokenDoBanco, urlDoBanco } from "./src/server/db/url";

for (const arquivo of [".env.local", ".env"]) {
  if (existsSync(arquivo)) process.loadEnvFile(arquivo);
}

export default defineConfig({
  dialect: "turso",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: urlDoBanco(),
    authToken: tokenDoBanco(),
  },
  strict: true,
  verbose: true,
});
