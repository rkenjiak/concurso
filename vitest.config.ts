import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Os testes rodam sempre em UTC para garantir que o código não depende do
// fuso da máquina (ARQUITETURA.md §7.2). Definido antes de os workers subirem.
process.env.TZ = "UTC";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    // Versão como o `next build` a fixaria (#118, `src/lib/versao-build.ts`), sem o git.
    env: {
      TZ: "UTC",
      APP_VERSAO: JSON.parse(readFileSync("package.json", "utf8")).version,
      APP_COMMIT: "dev",
      APP_AMBIENTE: "development",
      APP_DATA_BUILD: new Date().toISOString(),
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/app/**"],
    },
  },
});
