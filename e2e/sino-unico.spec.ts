import { expect, type Page, test } from "@playwright/test";
import { cadastrarConcurso, emDias, unico } from "./utils";

/** Concurso com fim das inscrições amanhã: a regra padrão gera um aviso não lido. */
async function criarAvisoNaoLido(page: Page) {
  await cadastrarConcurso(page, { orgao: `Sino E2E ${unico()}`, cargo: "Analista" });
  await page.getByRole("tab", { name: /^Eventos/ }).click();
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: "Fim das inscrições" });
  await dialogo.getByLabel("Data").fill(emDias(1));
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();
}

/** Um único sino visível no dashboard (#78), com o contador na primeira dobra. */
async function umSinoNoDashboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  const sinos = page.getByTestId("sino-notificacoes").filter({ visible: true });
  await expect(sinos).toHaveCount(1);
  await expect(page.getByRole("link", { name: /^Notificações/ })).toHaveCount(1);
  // O card "Próximos prazos" não tem mais sino próprio.
  const card = page.locator("[data-slot='card']").filter({ hasText: "Próximos prazos" });
  await expect(card.getByTestId("sino-notificacoes")).toHaveCount(0);

  const contador = sinos.getByTestId("contador-notificacoes");
  await expect(contador).toBeVisible();
  await expect(contador).toBeInViewport();
}

test.describe("desktop", () => {
  test("sino único: só o da barra lateral no dashboard (#78)", async ({ page }) => {
    await criarAvisoNaoLido(page);
    await umSinoNoDashboard(page);
    await expect(page.getByRole("complementary").getByTestId("sino-notificacoes")).toBeVisible();
  });
});

test.describe("celular (360 px)", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("sino único: só o do cabeçalho, com o botão Atualizar ao lado (#77, #78)", async ({
    page,
  }) => {
    await criarAvisoNaoLido(page);
    await umSinoNoDashboard(page);
    const cabecalho = page.getByRole("banner");
    await expect(cabecalho.getByTestId("sino-notificacoes")).toBeVisible();

    // O tema saiu do cabeçalho (vai para o menu da conta, #78) e o espaço liberado recebe o botão
    // "Atualizar" (#77), no mesmo grupo do sino, sem encostar na marca.
    await expect(cabecalho.getByRole("group", { name: "Tema" })).toHaveCount(0);
    const medidas = await cabecalho.evaluate((el) => {
      const marca = el.querySelector("a[href='/']")?.getBoundingClientRect();
      const sino = el.querySelector("[data-testid='sino-notificacoes']");
      const grupo = sino?.parentElement;
      const atualizar = grupo?.querySelector("[data-testid='botao-atualizar']");
      const controles = grupo?.getBoundingClientRect();
      return {
        mesmoGrupo: Boolean(atualizar),
        folga: marca && controles ? controles.left - marca.right : 0,
        direita: controles?.right ?? Number.POSITIVE_INFINITY,
      };
    });
    expect(medidas.mesmoGrupo).toBe(true);
    expect(medidas.folga).toBeGreaterThanOrEqual(8);
    expect(medidas.direita).toBeLessThanOrEqual(360);
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
