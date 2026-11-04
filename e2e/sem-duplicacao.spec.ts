import { expect, type Page, test } from "@playwright/test";

/** Configurações não tem mais a seção de tema, e o menu da conta não tem o link (#82). */
async function semDuplicacao(page: Page, regiaoMenu: "banner" | "complementary") {
  await page.goto("/configuracoes");
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("group", { name: "Tema" })).toHaveCount(0);
  await expect(page.getByRole("main").getByText("Aparência")).toHaveCount(0);

  await page.getByRole(regiaoMenu).getByRole("button", { name: "Menu da conta" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Configurações" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Configurações continua na navegação principal.
  const link = page
    .getByRole("navigation")
    .getByRole("link", { name: "Configurações" })
    .filter({ visible: true });
  await expect(link).toHaveCount(1);
}

test.describe("desktop", () => {
  test("tema só na barra lateral e Configurações só na navegação (#82)", async ({ page }) => {
    await semDuplicacao(page, "complementary");
    await expect(
      page.getByRole("complementary").getByRole("group", { name: "Tema" }),
    ).toBeVisible();
  });
});

test.describe("celular (360 px)", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("tema só no menu da conta e Configurações só na barra inferior (#82)", async ({ page }) => {
    await semDuplicacao(page, "banner");
    await page.getByRole("banner").getByRole("button", { name: "Menu da conta" }).click();
    await expect(
      page.getByRole("menu").getByRole("menuitemradio", { name: "Escuro" }),
    ).toBeVisible();
  });
});
