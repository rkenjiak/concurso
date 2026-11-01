/**
 * Testes e2e (ARQUITETURA.md §8.1): Chromium contra o build de produção (`next start`), cada
 * servidor com um banco SQLite temporário em `e2e/.tmp/` recriado a cada execução.
 *
 * - projeto `chromium`: app sem autenticação (`ALLOW_NO_AUTH=true`);
 * - projeto `autenticacao`: app com `APP_PASSWORD` e `MCP_TOKEN`, para o login e o endpoint MCP.
 *
 * Rode `pnpm e2e` (faz o build antes) ou `pnpm exec playwright test` com um build existente.
 */
import { defineConfig, devices } from "@playwright/test";
import { MCP_TOKEN_E2E, SENHA_E2E } from "./e2e/constantes";

const PORTA = 3200;
const PORTA_AUTH = 3201;
const SPECS_AUTH = /(login|mcp)\.spec\.ts/;

const servidor = (porta: number, banco: string, env: Record<string, string>) => ({
  command: `pnpm exec tsx e2e/servidor.ts ${porta} ${banco}`,
  url: `http://localhost:${porta}/api/health`,
  reuseExistingServer: false,
  timeout: 120_000,
  stdout: "pipe" as const,
  env: { NEXT_TELEMETRY_DISABLED: "1", ...env },
});

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  // Os testes compartilham o banco de cada servidor (a importação substitui tudo): em série.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: SPECS_AUTH,
      use: { baseURL: `http://localhost:${PORTA}` },
    },
    {
      name: "autenticacao",
      testMatch: SPECS_AUTH,
      use: { baseURL: `http://localhost:${PORTA_AUTH}` },
    },
  ],
  webServer: [
    servidor(PORTA, "sem-auth", { ALLOW_NO_AUTH: "true", APP_PASSWORD: "", AUTH_SECRET: "" }),
    servidor(PORTA_AUTH, "com-auth", {
      APP_PASSWORD: SENHA_E2E,
      AUTH_SECRET: "segredo-somente-para-testes-e2e-0123456789",
      ALLOW_NO_AUTH: "",
      MCP_TOKEN: MCP_TOKEN_E2E,
    }),
  ],
});
