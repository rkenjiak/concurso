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
    env: { TZ: "UTC" },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/app/**"],
    },
  },
});
