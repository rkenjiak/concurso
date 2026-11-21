import { expect, test } from "@playwright/test";
import { SENHA_E2E } from "./constantes";
import { cadastrarConcurso, esperarInvalidacaoIsr, unico } from "./utils";

// Projeto `autenticacao` (#129): mesmo com login ligado, `/compartilhado/*` não passa pelo
// proxy nem redireciona para `/login`, e tokens inválidos/inexistentes respondem HTTP 404.
test("compartilhamento público funciona sem login enquanto rotas privadas redirecionam", async ({
  page,
  request,
}) => {
  const privado = await request.get("/concursos", { maxRedirects: 0 });
  expect(privado.status()).toBe(307);

  expect((await request.get("/compartilhado/invalido", { maxRedirects: 0 })).status()).toBe(404);
  expect(
    (
      await request.get("/compartilhado/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { maxRedirects: 0 })
    ).status(),
  ).toBe(404);

  await page.goto("/login");
  await page.getByLabel("Senha").fill(SENHA_E2E);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  const orgao = `Público Auth ${unico()}`;
  await cadastrarConcurso(page, { orgao, cargo: "Analista" });
  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Compartilhar…" }).click();
  const dialogo = page.getByRole("dialog", { name: "Compartilhar cronograma" });
  await dialogo.getByRole("button", { name: "Ativar compartilhamento" }).click();
  const campoUrl = dialogo.getByTestId("url-compartilhamento");
  await expect(campoUrl).toHaveValue(/\/compartilhado\/[A-Za-z0-9_-]{32}$/);
  const caminho = new URL(await campoUrl.inputValue()).pathname;

  // Visitante sem cookies nem sessão acessa normalmente (200) e recebe X-Robots-Tag.
  const resposta = await request.get(caminho, { maxRedirects: 0 });
  expect(resposta.status()).toBe(200);
  expect(resposta.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  const html = await resposta.text();
  expect(html).toContain(orgao);
  expect(html).toContain("Analista");

  // Revoga (com confirmação) e valida 404 imediato para o visitante.
  await dialogo.getByRole("button", { name: "Revogar acesso" }).click();
  await dialogo.getByRole("button", { name: "Confirmar revogação" }).click();
  await expect(dialogo.getByRole("button", { name: "Ativar compartilhamento" })).toBeVisible();
  await esperarInvalidacaoIsr(request, caminho, 404);
});
