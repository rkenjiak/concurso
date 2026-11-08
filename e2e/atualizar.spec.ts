import { expect, type Page, type Request, test } from "@playwright/test";
import { cadastrarConcurso, unico } from "./utils";

// Aba na URL e botão "Atualizar" (#77).

/** Botão "Atualizar" da navegação lateral (desktop). */
const botaoAtualizar = (page: Page) =>
  page.getByRole("complementary").getByTestId("botao-atualizar");

/** Requisição de RSC da página atual (refresh ou navegação), sem os prefetches dos links. */
const ehRefresh = (req: Request) => {
  const h = req.headers();
  return h.rsc === "1" && !h["next-router-prefetch"];
};

/** Executa a ação e confere, com tempo real, que nenhuma requisição de RSC saiu. */
async function semRequisicao(page: Page, acao: () => Promise<void>) {
  const espera = page.waitForRequest(ehRefresh, { timeout: 1500 });
  await acao();
  await expect(espera).rejects.toThrow();
}

test("aba do detalhe fica na URL e sobrevive ao recarregar e ao voltar", async ({ page }) => {
  const url = await cadastrarConcurso(page, { orgao: `Órgão Abas ${unico()}`, cargo: "Analista" });
  const aba = (nome: string | RegExp) => page.getByRole("tab", { name: nome });

  // Trocar de aba não chama o servidor (replaceState, não router.replace).
  await semRequisicao(page, async () => {
    await aba(/^Links/).click();
    await expect(page).toHaveURL(`${url}?aba=links`);
  });
  await page.reload();
  await expect(aba(/^Links/)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Adicionar link" })).toBeVisible();

  // Navegar e voltar: a aba acompanha a URL (o Next reaproveita a renderização anterior).
  await semRequisicao(page, async () => {
    await aba("Histórico").click();
    await expect(page).toHaveURL(`${url}?aba=historico`);
  });
  await page.getByRole("complementary").getByRole("link", { name: "Calendário" }).click();
  await expect(page).toHaveURL(/\/calendario$/);
  await page.goBack();
  await expect(page).toHaveURL(`${url}?aba=historico`);
  await expect(aba("Histórico")).toHaveAttribute("aria-selected", "true");

  await aba("Visão geral").click();
  await expect(page).toHaveURL(url);

  // Valor desconhecido cai na visão geral.
  await page.goto(`${url}?aba=inexistente`);
  await expect(aba("Visão geral")).toHaveAttribute("aria-selected", "true");
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
  await outra.goto(`${url}?aba=links`);
  await outra.getByRole("button", { name: "Adicionar link" }).click();
  const dialogo = outra.getByRole("dialog", { name: "Novo link" });
  await dialogo.getByLabel("Rótulo").fill("Edital atualizado");
  await dialogo.getByLabel("URL").fill("https://example.com/edital.pdf");
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialogo).toBeHidden();
  await outra.close();

  // Marca a página: um reload completo apagaria a marca.
  await page.evaluate(() => {
    (window as unknown as { semReload: boolean }).semReload = true;
  });
  const botao = botaoAtualizar(page);
  await expect(botao).toHaveAccessibleName("Atualizar");
  const pedido = page.waitForRequest(ehRefresh);
  await botao.click();
  await pedido;
  await expect(page.getByText("Edital atualizado")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Links (1)" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("complementary").getByText("Dados atualizados")).toBeAttached();
  expect(await page.evaluate(() => (window as unknown as { semReload?: boolean }).semReload)).toBe(
    true,
  );

  // Na espera: continua focável, com aria-disabled e o tempo restante no rótulo; clicar (ou
  // Enter) não faz requisição.
  await expect(botao).toHaveAttribute("aria-disabled", "true");
  await expect(botao).toHaveAccessibleName(/^Atualizar \(disponível em \d+ s\)$/);
  await expect(botao).toHaveAttribute("title", /disponível em \d+ s/);
  await semRequisicao(page, async () => {
    await botao.click({ force: true });
    await botao.focus();
    await page.keyboard.press("Enter");
  });

  // O limite vale nas outras páginas (sessionStorage).
  await page.getByRole("complementary").getByRole("link", { name: "Calendário" }).click();
  await expect(page).toHaveURL(/\/calendario$/);
  await expect(botaoAtualizar(page)).toHaveAttribute("aria-disabled", "true");
  await semRequisicao(page, () => botaoAtualizar(page).click({ force: true }));

  // Depois de 60 s, libera de novo.
  await page.clock.fastForward(60_000);
  await expect(botaoAtualizar(page)).not.toHaveAttribute("aria-disabled");
  await expect(botaoAtualizar(page)).toHaveAccessibleName("Atualizar");
  const outro = page.waitForRequest(ehRefresh);
  await botaoAtualizar(page).click();
  await outro;
});
