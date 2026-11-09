import { expect, type Locator, type Page, test } from "@playwright/test";
import { cadastrarConcurso, emDias, unico } from "./utils";

/** Concurso com fim das inscrições amanhã: a regra padrão gera um aviso não lido. */
async function criarAvisoNaoLido(page: Page) {
  await cadastrarConcurso(page, { orgao: `Sino E2E ${unico()}`, cargo: "Analista" });
  await page.getByRole("tab", { name: /^Eventos/ }).click();
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: "Fim das inscrições" });
  await dialogo.getByLabel("Data").fill(emDias(1));
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialogo).toBeHidden();
}

/**
 * Um único ponto de entrada das notificações visível no dashboard (#78, #105), com o contador na
 * primeira dobra e o número real no nome acessível. Devolve a entrada visível.
 */
async function umaEntradaNoDashboard(page: Page): Promise<Locator> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  const entradas = page.locator("a[href='/notificacoes']").filter({ visible: true });
  await expect(entradas).toHaveCount(1);
  await expect(page.getByRole("link", { name: /^Notificações/ })).toHaveCount(1);
  // O card "Próximos prazos" não tem mais sino próprio.
  const card = page.locator("[data-slot='card']").filter({ hasText: "Próximos prazos" });
  await expect(card.getByTestId("sino-notificacoes")).toHaveCount(0);

  const contador = entradas.getByTestId("contador-notificacoes");
  await expect(contador).toBeVisible();
  await expect(contador).toBeInViewport();

  // O nome acessível traz o número real de não lidas (o selo pode abreviar para "99+").
  const nome = await entradas.getAttribute("aria-label");
  const numero = Number(/^Notificações \((\d+) não lidas?\)$/.exec(nome ?? "")?.[1]);
  expect(numero, `nome acessível: ${nome}`).toBeGreaterThanOrEqual(1);
  await expect(contador).toHaveText(numero > 99 ? "99+" : String(numero));
  return entradas;
}

test.describe("desktop", () => {
  test("sino único: só o da barra lateral no dashboard (#78)", async ({ page }) => {
    await criarAvisoNaoLido(page);
    const entrada = await umaEntradaNoDashboard(page);
    await expect(entrada).toHaveAttribute("data-testid", "sino-notificacoes");
    await expect(page.getByRole("complementary").getByTestId("sino-notificacoes")).toBeVisible();
    // A barra lateral segue com Configurações (#105 muda só o celular).
    await expect(
      page
        .getByRole("navigation", { name: "Navegação principal" })
        .getByRole("link", { name: "Configurações" }),
    ).toBeVisible();
  });
});

test.describe("celular (360 px)", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("entrada única: Notificações na barra inferior, sem sino no cabeçalho (#78, #105)", async ({
    page,
  }) => {
    await criarAvisoNaoLido(page);
    const entrada = await umaEntradaNoDashboard(page);
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByTestId("nav-notificacoes")).toBeVisible();
    await expect(entrada).toHaveAttribute("data-testid", "nav-notificacoes");

    const cabecalho = page.getByRole("banner");
    await expect(cabecalho.getByTestId("sino-notificacoes")).toHaveCount(0);
    await expect(cabecalho.locator("a[href='/notificacoes']")).toHaveCount(0);

    // Cabeçalho: tema no menu da conta (#78); sobram Atualizar (#77) e o menu, no mesmo grupo,
    // sem encostar na marca.
    await expect(cabecalho.getByRole("group", { name: "Tema" })).toHaveCount(0);
    const medidas = await cabecalho.evaluate((el) => {
      const marca = el.querySelector("a[href='/']")?.getBoundingClientRect();
      const atualizar = el.querySelector("[data-testid='botao-atualizar']");
      const grupo = atualizar?.parentElement;
      const menu = grupo?.querySelector("button[aria-label='Menu da conta']");
      const controles = grupo?.getBoundingClientRect();
      return {
        mesmoGrupo: Boolean(menu),
        folga: marca && controles ? controles.left - marca.right : 0,
        direita: controles?.right ?? Number.POSITIVE_INFINITY,
      };
    });
    expect(medidas.mesmoGrupo).toBe(true);
    expect(medidas.folga).toBeGreaterThanOrEqual(8);
    expect(medidas.direita).toBeLessThanOrEqual(360);

    // Leva à central, marcada como página atual.
    await entrada.click();
    await expect(page).toHaveURL(/\/notificacoes$/);
    await expect(nav.getByTestId("nav-notificacoes")).toHaveAttribute("aria-current", "page");
  });

  test("tema pelo menu da conta no celular (#78)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const html = page.locator("html");
    await page.getByRole("banner").getByRole("button", { name: "Menu da conta" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitemradio", { name: "Sistema" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // Escolher mantém o menu aberto, para comparar os temas.
    await menu.getByRole("menuitemradio", { name: "Escuro" }).click();
    await expect(html).toHaveClass(/\bdark\b/);
    await expect(menu.getByRole("menuitemradio", { name: "Escuro" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // Persiste ao recarregar.
    await page.reload();
    await expect(html).toHaveClass(/\bdark\b/);

    // Volta ao padrão.
    await page.getByRole("banner").getByRole("button", { name: "Menu da conta" }).click();
    await page.getByRole("menu").getByRole("menuitemradio", { name: "Sistema" }).click();
    await expect(html).not.toHaveClass(/\bdark\b/);
  });
});
