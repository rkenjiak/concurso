/**
 * Testes e2e (ARQUITETURA.md §8.1): Chromium contra o build de produção (`next start`), cada
 * servidor com um banco SQLite temporário em `e2e/.tmp/` recriado a cada execução.
 *
 * - projeto `chromium`: app sem autenticação (`ALLOW_NO_AUTH=true`);
 * - projeto `autenticacao`: app com `APP_PASSWORD`, para o login, as rotas com token pessoal
 *   (endpoint MCP e feed .ics) e compartilhamento público com sessão exigida (`compartilhamento-auth.spec.ts`);
 * - projeto `google` (porta 3202, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`ADMIN_EMAILS`):
 *   fluxos administrativos com usuários Google, incluindo invalidação do cache ISR (`compartilhamento-admin.spec.ts`).
 *
 * Rode `pnpm e2e` (faz o build antes) ou `pnpm exec playwright test` com um build existente.
 */
import { defineConfig, devices } from "@playwright/test";
import { SENHA_E2E } from "./e2e/constantes";

const PORTA = 3200;
const PORTA_AUTH = 3201;
const PORTA_GOOGLE = 3202;
const SPECS_AUTH = /(login|mcp|pwa|lembretes|compartilhamento-auth)\.spec\.ts/;
const SPECS_GOOGLE = /compartilhamento-admin\.spec\.ts/;

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
      testIgnore:
        /(login|mcp|pwa|lembretes|compartilhamento-auth|compartilhamento-admin)\.spec\.ts/,
      use: { baseURL: `http://localhost:${PORTA}` },
    },
    {
      name: "autenticacao",
      testMatch: SPECS_AUTH,
      use: { baseURL: `http://localhost:${PORTA_AUTH}` },
    },
    {
      name: "google",
      testMatch: SPECS_GOOGLE,
      use: { baseURL: `http://localhost:${PORTA_GOOGLE}` },
    },
  ],
  webServer: [
    servidor(PORTA, "sem-auth", { ALLOW_NO_AUTH: "true", APP_PASSWORD: "", AUTH_SECRET: "" }),
    servidor(PORTA_AUTH, "com-auth", {
      APP_PASSWORD: SENHA_E2E,
      AUTH_SECRET: "segredo-somente-para-testes-e2e-0123456789",
      ALLOW_NO_AUTH: "",
    }),
    servidor(PORTA_GOOGLE, "google-auth", {
      GOOGLE_CLIENT_ID: "e2e-google-id",
      GOOGLE_CLIENT_SECRET: "e2e-google-secret",
      ADMIN_EMAILS: "admin@e2e.test",
      AUTH_SECRET: "segredo-google-somente-para-testes-e2e-0123456789",
      ALLOW_NO_AUTH: "",
      APP_PASSWORD: "",
    }),
  ],
});
