import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * Versão do app no site (#118). O build dos e2e é de produção (`next build` local, sem
 * `VERCEL_ENV`): o menu mostra só `vX.Y.Z`; o commit vem do git (SHA curto) ou é `dev`.
 */
const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const ROTULO = `v${version}`;

test("versão: GET /api/versao é público e só traz versão, commit e ambiente", async ({
  request,
}) => {
  const resposta = await request.get("/api/versao");
  expect(resposta.status()).toBe(200);
  expect(resposta.headers()["cache-control"]).toContain("no-store");
  const corpo = await resposta.json();
  expect(Object.keys(corpo).sort()).toEqual(["ambiente", "commit", "versao"]);
  expect(corpo.versao).toBe(version);
  expect(corpo.ambiente).toBe("production");
  expect(corpo.commit).toMatch(/^([0-9a-f]{7}|dev)$/);
});

test("versão: no rodapé do menu da conta, só a versão em produção", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("complementary").getByRole("button", { name: "Menu da conta" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByText(ROTULO, { exact: true })).toBeVisible();
  await expect(menu).not.toContainText("production");
});

test("versão: Configurações → Sobre, com a release e o CHANGELOG", async ({ page }) => {
  await page.goto("/configuracoes");
  await page
    .getByRole("navigation", { name: "Nesta página" })
    .getByRole("link", { name: "Versão" })
    .click();
  await expect(page).toHaveURL(/\/configuracoes#sobre$/);

  const sobre = page.getByRole("region", { name: "Sobre", exact: true });
  await expect(sobre.getByRole("heading", { level: 3, name: "Versão" })).toBeInViewport();
  await expect(sobre.getByText(ROTULO, { exact: true })).toBeVisible();
  const novidades = sobre.getByRole("link", { name: /^O que há de novo/ });
  await expect(novidades).toHaveAttribute(
    "href",
    `https://github.com/rkenjiak/concurso/releases/tag/${ROTULO}`,
  );
  await expect(novidades).toHaveAttribute("target", "_blank");
  await expect(sobre.getByRole("link", { name: /CHANGELOG/ })).toHaveAttribute(
    "href",
    "https://github.com/rkenjiak/concurso/blob/master/CHANGELOG.md",
  );
});

test("versão: card no painel admin com versão, commit, ambiente e data do build", async ({
  page,
}) => {
  await page.goto("/admin");
  const card = page.locator("[data-slot=card]").filter({ hasText: "Versão no ar" });
  await expect(card.getByRole("definition")).toHaveCount(4);
  await expect(card).toContainText(version);
  await expect(card).toContainText("production");
  await expect(card.getByText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)).toBeVisible();
});
