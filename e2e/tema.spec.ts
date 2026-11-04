import { expect, type Page, test } from "@playwright/test";

const html = (page: Page) => page.locator("html");
// O tema fica só junto ao avatar (#82): no desktop, o seletor da barra lateral.
/** Fundo do <html> igual ao do <body> (tema), não transparente (#81). */
async function fundoDaRaizSegueOTema(page: Page) {
  const [raiz, corpo] = await page.evaluate(() => [
    getComputedStyle(document.documentElement).backgroundColor,
    getComputedStyle(document.body).backgroundColor,
  ]);
  expect(raiz).not.toBe("rgba(0, 0, 0, 0)");
  expect(raiz).toBe(corpo);
}

const seletor = (page: Page) =>
  page.getByRole("complementary").getByRole("group", { name: "Tema" });

test("tema: padrão do sistema, alternância e persistência sem flash", async ({ page }) => {
  // Padrão "Sistema": segue prefers-color-scheme.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(html(page)).toHaveClass(/\bdark\b/);
  await expect(seletor(page).getByRole("button", { name: "Sistema" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html(page)).not.toHaveClass(/\bdark\b/);

  // Escuro explícito vence o sistema claro e persiste após recarregar.
  await seletor(page).getByRole("button", { name: "Escuro" }).click();
  await expect(html(page)).toHaveClass(/\bdark\b/);
  // `color-scheme` e fundo da raiz seguem o tema (barra de gestos do Android, #81).
  await expect(html(page)).toHaveCSS("color-scheme", "dark");
  await fundoDaRaizSegueOTema(page);

  // Sem flash: o tema já está no <html> assim que o documento é analisado, antes da hidratação.
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
  await expect(seletor(page).getByRole("button", { name: "Escuro" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Claro explícito vence o sistema escuro e vale em outras páginas.
  await page.emulateMedia({ colorScheme: "dark" });
  await seletor(page).getByRole("button", { name: "Claro" }).click();
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  await page.goto("/calendario");
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  await expect(html(page)).toHaveCSS("color-scheme", "light");
  await fundoDaRaizSegueOTema(page);
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", "light dark");

  // A cor da barra de status (PWA, #66) segue o tema escolhido, inclusive após navegar no app.
  const corBarra = page.locator('meta[name="theme-color"]');
  await page.goto("/");
  await seletor(page).getByRole("button", { name: "Escuro" }).click();
  await expect(corBarra).toHaveAttribute("content", "#0a0a0a");
  await page.getByRole("complementary").getByRole("link", { name: "Calendário" }).click();
  await expect(page).toHaveURL(/\/calendario$/);
  await expect(corBarra).toHaveCount(1);
  await expect(corBarra).toHaveAttribute("content", "#0a0a0a");

  // Volta ao padrão.
  await page.goto("/");
  await seletor(page).getByRole("button", { name: "Sistema" }).click();
  await expect(html(page)).toHaveClass(/\bdark\b/);
});
