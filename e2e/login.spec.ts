import { expect, test } from "@playwright/test";
import { SENHA_E2E } from "./constantes";

test("exige login, rejeita senha errada, entra e sai", async ({ page, request }) => {
  // APIs sem sessão respondem 401; o health check é público.
  expect((await request.get("/api/export")).status()).toBe(401);
  expect((await request.get("/api/health")).status()).toBe(200);

  await page.goto("/concursos?ordem=nome");
  await expect(page).toHaveURL(/\/login\?para=%2Fconcursos%3Fordem%3Dnome$/);
  await expect(page.getByRole("navigation")).toHaveCount(0);

  await page.getByLabel("Senha").fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Senha" })).toHaveText("Senha incorreta.");

  await page.getByLabel("Senha").fill(SENHA_E2E);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/concursos\?ordem=nome$/);
  await expect(page.getByRole("heading", { level: 1, name: "Concursos" })).toBeVisible();

  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "concurso_sessao")).toMatchObject({
    httpOnly: true,
    sameSite: "Lax",
  });
  // Com sessão, as APIs respondem.
  expect((await page.request.get("/api/export?formato=csv")).status()).toBe(200);

  // Já autenticado, /login volta para o app.
  await page.goto("/login");
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/configuracoes");
  await expect(page).toHaveURL(/\/login\?para=%2Fconfiguracoes$/);
});
