import { expect, type Page, test } from "@playwright/test";

/**
 * Configurações não tem mais a seção de tema (#82) e tem um só ponto de entrada por layout: no
 * desktop, a navegação lateral (o menu da conta não tem o link, #82); no celular, o menu da conta
 * (a barra inferior dá o lugar a Notificações, #105).
 */
async function semDuplicacao(page: Page, layout: "desktop" | "celular") {
  await page.goto("/configuracoes");
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("group", { name: "Tema" })).toHaveCount(0);
  await expect(page.getByRole("main").getByText("Aparência")).toHaveCount(0);

  const regiaoMenu = layout === "desktop" ? "complementary" : "banner";
  await page.getByRole(regiaoMenu).getByRole("button", { name: "Menu da conta" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Configurações" })).toHaveCount(
    layout === "desktop" ? 0 : 1,
  );
  await page.keyboard.press("Escape");

  const link = page
    .getByRole("navigation")
    .getByRole("link", { name: "Configurações" })
    .filter({ visible: true });
  await expect(link).toHaveCount(layout === "desktop" ? 1 : 0);
}

test.describe("desktop", () => {
  test("tema só na barra lateral e Configurações só na navegação (#82)", async ({ page }) => {
    await semDuplicacao(page, "desktop");
    await expect(
      page.getByRole("complementary").getByRole("group", { name: "Tema" }),
    ).toBeVisible();
  });
});

test.describe("celular (360 px)", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("tema e Configurações só no menu da conta (#82, #105)", async ({ page }) => {
    await semDuplicacao(page, "celular");
    await page.getByRole("banner").getByRole("button", { name: "Menu da conta" }).click();
    await expect(
      page.getByRole("menu").getByRole("menuitemradio", { name: "Escuro" }),
    ).toBeVisible();
  });
});
