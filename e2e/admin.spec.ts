import { expect, test } from "@playwright/test";
import { unico } from "./utils";

// Sem login (projeto `chromium`), o usuário é o inicial, que é admin (#50).
test("admin: alterna entre visão usuário e visão admin sem novo login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Modo admin")).toHaveCount(0);

  await page.getByRole("complementary").getByRole("button", { name: "Menu da conta" }).click();
  await expect(page.getByRole("menuitemradio", { name: "Visão usuário" })).toBeChecked();
  await page.getByRole("menuitemradio", { name: "Visão admin" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("status").filter({ hasText: "Modo admin" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação do painel admin" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);

  // A visão fica salva: o início leva ao painel.
  await page.goto("/");
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("button", { name: "Ir para a visão usuário" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Modo admin")).toHaveCount(0);
});

test("admin: último admin não é rebaixado; allowlist e auditoria", async ({ page }) => {
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("cell", { name: /\(você\)/ })).toBeVisible();
  // Ninguém bloqueia a própria conta: o botão nem aparece.
  await expect(page.getByRole("button", { name: /^Bloquear/ })).toHaveCount(0);
  await page.getByRole("button", { name: /^Rebaixar/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Rebaixar" }).click();
  await expect(page.getByRole("alertdialog").getByRole("alert")).toContainText(
    "último admin ativo",
  );
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar" }).click();

  const email = `convite-${unico()}@exemplo.com`;
  await page.goto("/admin/acesso");
  await page.getByLabel("E-mail da conta Google").fill(email);
  await page.getByRole("button", { name: "Liberar acesso" }).click();
  const linha = page.getByRole("listitem").filter({ hasText: email });
  await expect(linha).toContainText("Painel");

  await linha.getByRole("button", { name: `Retirar ${email}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retirar" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: email })).toHaveCount(0);

  await page.goto("/admin/auditoria");
  await expect(page.getByRole("row").filter({ hasText: email })).toHaveCount(2);
});
