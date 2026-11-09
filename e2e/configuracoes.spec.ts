import { expect, type Page, test } from "@playwright/test";

/** Seções (h2) e cards (h3) de Configurações, na ordem da página, com a âncora de cada card (#106). */
const SECOES = ["Avisos", "Dados", "Integrações", "Conta"];
const CARDS = [
  { id: "notificacoes", titulo: "Notificações" },
  { id: "calendario", titulo: "Calendário (.ics)" },
  { id: "exportar", titulo: "Exportar e importar" },
  { id: "mcp", titulo: "Token do MCP" },
  { id: "acesso", titulo: "Acesso" },
];

const indice = (page: Page) => page.getByRole("navigation", { name: "Nesta página" });

/** O card da âncora está visível e com o título abaixo do cabeçalho fixo (se houver). */
async function cardVisivel(page: Page, id: string, titulo: string) {
  const card = page.locator(`#${id}`);
  await expect(card).toBeInViewport();
  const heading = card.getByRole("heading", { level: 3, name: titulo, exact: true });
  await expect(heading).toBeInViewport();
  const topoTitulo = (await heading.boundingBox())?.y ?? -1;
  const fundoCabecalho = await page.evaluate(() => {
    const cabecalho = [...document.querySelectorAll("header")].find(
      (el) => getComputedStyle(el).position === "sticky" && el.getBoundingClientRect().height > 0,
    );
    return cabecalho?.getBoundingClientRect().bottom ?? 0;
  });
  expect(topoTitulo).toBeGreaterThanOrEqual(fundoCabecalho);
}

test("configurações: seções h2, cards h3 e índice com âncoras (#106)", async ({ page }) => {
  await page.goto("/configuracoes");
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 2 })).toHaveText(SECOES);
  await expect(main.getByRole("heading", { level: 3 })).toHaveText(CARDS.map((c) => c.titulo));
  // Cada card fica dentro da sua seção.
  await expect(
    page.getByRole("region", { name: "Avisos" }).getByRole("heading", { level: 3 }),
  ).toHaveText(["Notificações", "Calendário (.ics)"]);
  await expect(
    page.getByRole("region", { name: "Conta" }).getByRole("heading", { level: 3 }),
  ).toHaveText(["Acesso"]);

  const links = indice(page).getByRole("link");
  await expect(links).toHaveText(CARDS.map((c) => c.titulo));
  for (const [i, { id }] of CARDS.entries()) {
    await expect(links.nth(i)).toHaveAttribute("href", `#${id}`);
  }

  // Clique: leva ao card.
  await indice(page).getByRole("link", { name: "Token do MCP" }).click();
  await expect(page).toHaveURL(/\/configuracoes#mcp$/);
  await cardVisivel(page, "mcp", "Token do MCP");

  // Teclado: foco no link do índice e Enter.
  await page.evaluate(() => window.scrollTo(0, 0));
  const exportar = indice(page).getByRole("link", { name: "Exportar e importar" });
  await exportar.focus();
  await expect(exportar).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/configuracoes#exportar$/);
  await cardVisivel(page, "exportar", "Exportar e importar");
});

for (const { id, titulo } of CARDS.slice(0, 2)) {
  test(`configurações: /configuracoes#${id} abre no card certo (#106)`, async ({ page }) => {
    await page.goto(`/configuracoes#${id}`);
    await cardVisivel(page, id, titulo);
  });
}

test.describe("celular (360 px)", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("índice com alvos de toque de 44 px e âncora abaixo do cabeçalho fixo (#106)", async ({
    page,
  }) => {
    await page.goto("/configuracoes");
    const links = indice(page).getByRole("link");
    await expect(links).toHaveCount(CARDS.length);
    for (const link of await links.all()) {
      const caixa = await link.boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await indice(page).getByRole("link", { name: "Acesso" }).click();
    await expect(page).toHaveURL(/\/configuracoes#acesso$/);
    await cardVisivel(page, "acesso", "Acesso");

    await page.goto("/configuracoes#calendario");
    await cardVisivel(page, "calendario", "Calendário (.ics)");
  });
});
