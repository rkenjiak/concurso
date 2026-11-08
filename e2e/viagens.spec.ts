import { expect, type Page, type Request, test } from "@playwright/test";
import { cadastrarConcurso, emDias, unico } from "./utils";

/**
 * Conta as requisições ao servidor feitas durante `acao` (#73): POSTs (Server Actions) e GETs de
 * RSC que não são prefetch (os de `router.refresh()` e navegação). Prefetches de links ficam de
 * fora: o Next os refaz depois de uma revalidação, sem bloquear a tela.
 */
async function contarViagens(page: Page, acao: () => Promise<void>) {
  const vistas: Request[] = [];
  const ouvir = (r: Request) => {
    if (r.resourceType() !== "fetch") return;
    const h = r.headers();
    if (r.method() === "POST" && h["next-action"]) vistas.push(r);
    else if (r.method() === "GET" && h.rsc === "1" && !h["next-router-prefetch"]) vistas.push(r);
  };
  page.on("request", ouvir);
  await acao();
  // Espera explícita: um refresh do cliente sairia logo após a resposta da action. O
  // `networkidle` não serve aqui, porque resolve na hora se a página já estava ociosa.
  await page.waitForTimeout(500);
  page.off("request", ouvir);
  return {
    posts: vistas.filter((r) => r.method() === "POST").length,
    refreshes: vistas.filter((r) => r.method() === "GET").length,
  };
}

const naoLidas = async (page: Page) => {
  const sino = page.getByRole("link", { name: /^Notificações/ });
  const nome = (await sino.getAttribute("aria-label")) ?? "";
  return Number(/\((\d+) não/.exec(nome)?.[1] ?? 0);
};

test("mutações fazem uma viagem só e o sino atualiza sem recarregar (#73)", async ({ page }) => {
  const orgao = `Viagem E2E ${unico()}`;
  await cadastrarConcurso(page, { orgao, cargo: "Analista", status: "Inscrito" });
  const antes = await naoLidas(page);

  // Criar o prazo de amanhã: um POST, sem refresh, e o sino do layout já conta o aviso novo.
  await page.getByRole("tab", { name: /^Eventos/ }).click();
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: "Fim das inscrições" });
  await dialogo.getByLabel("Data").fill(emDias(1));
  const criar = await contarViagens(page, async () => {
    await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dialogo).toBeHidden();
  });
  expect(criar).toEqual({ posts: 1, refreshes: 0 });
  await expect.poll(() => naoLidas(page)).toBe(antes + 1);

  // Marcar como lida na central: um POST e o contador cai na mesma resposta.
  await page.goto("/notificacoes");
  const item = page
    .getByTestId("lista-notificacoes")
    .getByRole("listitem")
    .filter({ hasText: orgao });
  const ler = await contarViagens(page, async () => {
    await item.getByRole("button", { name: /^Marcar como lida/ }).click();
    await expect(item).toHaveAttribute("data-lida", "true");
  });
  expect(ler).toEqual({ posts: 1, refreshes: 0 });
  await expect.poll(() => naoLidas(page)).toBe(antes);
});

test("editar e excluir concurso redirecionam na própria resposta da action (#73)", async ({
  page,
}) => {
  const orgao = `Redireciona E2E ${unico()}`;
  const url = await cadastrarConcurso(page, { orgao, cargo: "Analista" });
  const detalhe = new URL(url).pathname;

  await page.goto(`${detalhe}/editar`);
  await page.getByLabel("Cargo(s) / área").fill("Técnico");
  const editar = await contarViagens(page, async () => {
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page).toHaveURL(new RegExp(`${detalhe}$`));
    await expect(page.getByText("Técnico", { exact: true })).toBeVisible();
  });
  expect(editar).toEqual({ posts: 1, refreshes: 0 });

  const excluir = await contarViagens(page, async () => {
    await page.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: /^Excluir/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
    await expect(page).toHaveURL(/\/concursos$/);
  });
  expect(excluir).toEqual({ posts: 1, refreshes: 0 });
  await expect(page.getByText(orgao)).toHaveCount(0);
});

test("navegar mostra o esqueleto antes da resposta do servidor (#73)", async ({ page }) => {
  await page.goto("/");
  // O fallback só aparece na hora depois que o prefetch dos links (que traz o loading.tsx) termina.
  await page.waitForLoadState("networkidle");
  // Segura a resposta da navegação para o fallback do loading.tsx ficar visível.
  let liberar = () => {};
  const segurando = new Promise<void>((r) => {
    liberar = r;
  });
  await page.route(
    (url) => url.pathname === "/calendario",
    async (rota) => {
      const h = rota.request().headers();
      if (h.rsc === "1" && !h["next-router-prefetch"]) await segurando;
      await rota.continue();
    },
  );
  await page.getByRole("navigation").first().getByRole("link", { name: "Calendário" }).click();
  await expect(page.getByTestId("esqueleto")).toBeVisible();
  liberar();
  await expect(page.getByRole("heading", { level: 1, name: "Calendário" })).toBeVisible();
  await expect(page.getByTestId("esqueleto")).toBeHidden();
});
