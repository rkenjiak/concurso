import { expect, test } from "@playwright/test";

// Projeto `autenticacao` (#66): o navegador busca o manifest e os ícones sem sessão, então o
// proxy não pode redirecioná-los para /login.
test("pwa: manifest e ícones acessíveis sem login", async ({ request, page }) => {
  const resposta = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
  expect(resposta.status()).toBe(200);
  const manifest = await resposta.json();
  expect(manifest).toMatchObject({
    name: "Concursos",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
  });
  const icones = manifest.icons as { src: string; sizes: string; purpose: string }[];
  expect(icones.map((i) => `${i.sizes} ${i.purpose}`)).toEqual([
    "192x192 any",
    "512x512 any",
    "512x512 maskable",
  ]);

  for (const src of [...icones.map((i) => i.src), "/icon.svg", "/apple-icon.png"]) {
    const icone = await request.get(src, { maxRedirects: 0 });
    expect(icone.status(), src).toBe(200);
    expect(icone.headers()["content-type"], src).toMatch(/^image\//);
  }

  // A página de login já anuncia o manifest, o ícone da Apple e as cores da barra de status.
  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
});
