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

test("admin: selos MCP/.ics, detalhe do usuário e revogar tokens sem bloquear (#108)", async ({
  page,
  request,
}) => {
  // Sem login, o token do usuário inicial vale para o MCP e o feed.
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Gerar token" }).click();
  const campoMcp = page.getByLabel(/Novo token/);
  await expect(campoMcp).toHaveValue(/^cmcp_/);
  const token = await campoMcp.inputValue();
  await page.getByRole("button", { name: "Gerar link de assinatura" }).click();
  const campoIcs = page.getByTestId("url-feed-ics");
  await expect(campoIcs).toHaveValue(/token=cics_/);
  const feed = new URL(await campoIcs.inputValue());
  const urlFeed = `${feed.pathname}${feed.search}`;

  const chamarMcp = () =>
    request.post("/api/mcp", {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json, text/event-stream",
      },
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "e2e", version: "0.0.0" },
        },
      },
    });
  expect((await chamarMcp()).status()).toBe(200);
  expect((await request.get(urlFeed)).status()).toBe(200);

  // Tabela: selos dos tokens ativos, com o último uso para leitores de tela.
  await page.goto("/admin/usuarios");
  const linha = page.getByRole("row").filter({ hasText: "(você)" });
  await expect(linha.getByTitle(/^MCP ativo, usado por último em/)).toBeVisible();
  await expect(linha.getByTitle(/^\.ics ativo, usado por último em/)).toBeVisible();
  await expect(linha).toContainText("token ativo, usado por último em");

  // Detalhe: origem, contagens e tokens; revogar não bloqueia.
  await linha.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/admin\/usuarios\/\d+$/);
  await expect(page.getByText("Com acesso hoje")).toBeVisible();
  await expect(page.getByText("Usuário inicial (senha ou uso sem login)")).toBeVisible();
  await expect(
    page.getByText("Só contagens: o conteúdo dos concursos continua privado."),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Revogar tokens de/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Revogar" }).click();
  await expect(page.getByText(/^Tokens de .+ revogados\.$/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Revogar tokens de/ })).toHaveCount(0);
  await expect(page.getByText("Inativo")).toHaveCount(2);
  await expect(page.getByText("Com acesso hoje")).toBeVisible();

  expect((await chamarMcp()).status()).toBe(401);
  expect((await request.get(urlFeed)).status()).toBe(404);

  await page.goto("/admin/auditoria");
  await expect(page.getByRole("row").filter({ hasText: "Revogou os tokens" })).toHaveCount(1);

  // ID inexistente: página 404 (com o loading.tsx do painel, o status HTTP já saiu como 200).
  await page.goto("/admin/usuarios/999999");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
