import { expect, type Page, test } from "@playwright/test";
import { cadastrarConcurso, unico } from "./utils";

// Aba na URL e botão "Atualizar" (#77).

/** Botão "Atualizar" da navegação lateral (desktop). */
const botaoAtualizar = (page: Page) =>
  page.getByRole("complementary").getByTestId("botao-atualizar");

/** Conta as requisições de RSC do `router.refresh()` (sem os prefetches dos links). */
function contarRefresh(page: Page) {
  const contador = { total: 0 };
  page.on("request", (req) => {
    const h = req.headers();
    if (h.rsc === "1" && !h["next-router-prefetch"]) contador.total++;
  });
  return contador;
}

test("aba do detalhe fica na URL e sobrevive ao recarregar", async ({ page }) => {
  const url = await cadastrarConcurso(page, { orgao: `Órgão Abas ${unico()}`, cargo: "Analista" });
  const caminho = new URL(url).pathname;

  await page.getByRole("tab", { name: /^Links/ }).click();
  await expect(page).toHaveURL(`${url}?aba=links`);
  await page.reload();
  await expect(page.getByRole("tab", { name: /^Links/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Adicionar link" })).toBeVisible();

  // Trocar de aba não chama o servidor (replaceState, não router.replace).
  const refresh = contarRefresh(page);
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page).toHaveURL(`${url}?aba=historico`);
  await page.getByRole("tab", { name: "Visão geral" }).click();
  await expect(page).toHaveURL(url);
  expect(refresh.total).toBe(0);

  // Valor desconhecido cai na visão geral.
  await page.goto(`${caminho}?aba=inexistente`);
  await expect(page.getByRole("tab", { name: "Visão geral" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("Atualizar traz dados novos sem recarregar e bloqueia por 60 s", async ({ page, context }) => {
  await page.clock.install();
  const url = await cadastrarConcurso(page, {
    orgao: `Órgão Atualizar ${unico()}`,
    cargo: "Analista",
  });
  await page.getByRole("tab", { name: /^Links/ }).click();
  await expect(page.getByRole("tab", { name: "Links (0)" })).toBeVisible();

  // Outra aba do navegador (como o MCP) cadastra um link; esta página ainda não sabe.
  const outra = await context.newPage();
  await outra.goto(`${new URL(url).pathname}?aba=links`);
  await outra.getByRole("button", { name: "Adicionar link" }).click();
  const dialogo = outra.getByRole("dialog", { name: "Novo link" });
  await dialogo.getByLabel("Rótulo").fill("Edital atualizado");
  await dialogo.getByLabel("URL").fill("https://example.com/edital.pdf");
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();
  await outra.close();

  // Marca a página: um reload completo apagaria a marca.
  await page.evaluate(() => {
    (window as unknown as { semReload: boolean }).semReload = true;
  });
  const refresh = contarRefresh(page);
  const botao = botaoAtualizar(page);
  await expect(botao).toHaveAccessibleName("Atualizar");
  await botao.click();
  await expect(page.getByText("Edital atualizado")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Links (1)" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("complementary").getByText("Dados atualizados")).toBeAttached();
  expect(await page.evaluate(() => (window as unknown as { semReload?: boolean }).semReload)).toBe(
    true,
  );
  expect(refresh.total).toBe(1);

  // Na espera: continua focável, com aria-disabled e o tempo restante no rótulo.
  await expect(botao).toHaveAttribute("aria-disabled", "true");
  await expect(botao).toHaveAccessibleName(/^Atualizar \(disponível em \d+ s\)$/);
  await expect(botao).toHaveAttribute("title", /disponível em \d+ s/);
  await botao.focus();
  await page.keyboard.press("Enter");
  await page.clock.runFor(1000);
  expect(refresh.total).toBe(1);

  // O limite vale nas outras páginas (sessionStorage).
  await page.getByRole("complementary").getByRole("link", { name: "Calendário" }).click();
  await expect(page).toHaveURL(/\/calendario$/);
  await expect(botaoAtualizar(page)).toHaveAttribute("aria-disabled", "true");
  const antes = refresh.total;
  await botaoAtualizar(page).focus();
  await page.keyboard.press("Enter");
  await page.clock.runFor(1000);
  expect(refresh.total).toBe(antes);

  // Depois de 60 s, libera de novo.
  await page.clock.fastForward(60_000);
  await expect(botaoAtualizar(page)).not.toHaveAttribute("aria-disabled");
  await expect(botaoAtualizar(page)).toHaveAccessibleName("Atualizar");
  await botaoAtualizar(page).click();
  await expect.poll(() => refresh.total).toBe(antes + 1);
});
