import { expect, type Page, type Response, test } from "@playwright/test";

/** Cabeçalhos de segurança (#95) presentes na resposta. */
function conferirCabecalhos(resposta: Response | null) {
  const h = resposta?.headers() ?? {};
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("camera=()");
}

/** Coleta violações de CSP e erros do console (inclusive de Permissions-Policy). */
function vigiarConsole(page: Page): string[] {
  const erros: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || /Content.Security.Policy|Permissions.Policy/i.test(m.text())) {
      erros.push(m.text());
    }
  });
  page.on("pageerror", (e) => erros.push(e.message));
  return erros;
}

test("páginas do app enviam os cabeçalhos de segurança, sem violações de CSP", async ({ page }) => {
  const erros = vigiarConsole(page);
  for (const rota of ["/", "/concursos", "/calendario", "/configuracoes"]) {
    conferirCabecalhos(await page.goto(rota));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  // Navegação no cliente (scripts do Next carregados sob a CSP).
  await page.getByRole("complementary").getByRole("link", { name: "Calendário" }).click();
  await expect(page).toHaveURL(/\/calendario$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(erros).toEqual([]);
});
