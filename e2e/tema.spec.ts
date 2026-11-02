import { expect, type Page, test } from "@playwright/test";

const html = (page: Page) => page.locator("html");
const seletor = (page: Page) => page.getByRole("main").getByRole("group", { name: "Tema" });

test("tema: padrão do sistema, alternância e persistência sem flash", async ({ page }) => {
  // Padrão "Sistema": segue prefers-color-scheme.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/configuracoes");
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
  // Seletor da navegação lateral acompanha a escolha.
  await expect(
    page.getByRole("complementary").getByRole("button", { name: "Escuro" }),
  ).toHaveAttribute("aria-pressed", "true");

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

  // A cor da barra de status (PWA, #66) segue o tema escolhido, inclusive após navegar no app.
  const corBarra = page.locator('meta[name="theme-color"]');
  await page.goto("/configuracoes");
  await seletor(page).getByRole("button", { name: "Escuro" }).click();
  await expect(corBarra).toHaveAttribute("content", "#0a0a0a");
  await page.getByRole("complementary").getByRole("link", { name: "Calendário" }).click();
  await expect(page).toHaveURL(/\/calendario$/);
  await expect(corBarra).toHaveCount(1);
  await expect(corBarra).toHaveAttribute("content", "#0a0a0a");

  // Volta ao padrão.
  await page.goto("/configuracoes");
  await seletor(page).getByRole("button", { name: "Sistema" }).click();
  await expect(html(page)).toHaveClass(/\bdark\b/);
});
