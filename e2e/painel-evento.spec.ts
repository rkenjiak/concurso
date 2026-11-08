import { expect, type Page, test } from "@playwright/test";
import { mesDaData } from "../src/domain/calendario";
import { cadastrarConcurso, emDias, regiaoAvisos, unico } from "./utils";

/** Cadastra um evento na aba Eventos do concurso aberto. */
async function adicionarEvento(
  page: Page,
  { tipo, titulo, data }: { tipo: string; titulo: string; data: string },
) {
  await page.getByRole("tab", { name: /^Eventos/ }).click();
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: tipo });
  await dialogo.getByLabel("Título").fill(titulo);
  await dialogo.getByLabel("Data").fill(data);
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialogo).toBeHidden();
}

const avisos = regiaoAvisos;

test("dashboard: concluir na linha, Desfazer devolve o prazo e o foco (#100, D5/D6)", async ({
  page,
}) => {
  const id = unico();
  const titulo = `Boleto concluir ${id}`;
  await cadastrarConcurso(page, {
    orgao: `Concluir E2E ${id}`,
    cargo: "Analista",
    status: "Inscrito",
  });
  await adicionarEvento(page, { tipo: "Vencimento do boleto", titulo, data: emDias(4) });

  await page.goto("/");
  const item = page.getByRole("main").getByRole("listitem").filter({ hasText: titulo });
  // Linha: concluir, área principal (abre o painel) e o concurso como link — irmãos.
  await expect(item.locator("button button, a button, button a, a a")).toHaveCount(0);
  await item.getByRole("button", { name: `Marcar “${titulo}” como concluído` }).click();
  await expect(item).toHaveCount(0);
  await expect(avisos(page)).toContainText(`“${titulo}” concluído.`);

  await avisos(page).getByRole("button", { name: "Desfazer" }).click();
  await expect(item).toBeVisible();
  // O foco volta à área principal da linha, não fica perdido no body.
  await expect(item.locator("[data-painel-chave]")).toBeFocused();

  // Continua pendente depois de recarregar.
  await page.reload();
  await expect(item).toBeVisible();
});

test("calendário: concluir, reabrir e editar pelo painel do evento (#100)", async ({ page }) => {
  const id = unico();
  const titulo = `Boleto cal painel ${id}`;
  const data = emDias(3);
  await cadastrarConcurso(page, {
    orgao: `Cal painel ${id}`,
    cargo: "Analista",
    status: "Inscrito",
  });
  await adicionarEvento(page, { tipo: "Vencimento do boleto", titulo, data });

  await page.goto(`/calendario?mes=${mesDaData(data)}`);
  const item = page.locator(`td[data-data="${data}"]`).getByRole("button", { name: titulo });
  await item.click();
  const painel = page.getByRole("dialog", { name: titulo });
  await expect(painel.locator('[data-situacao="URGENTE"]')).toBeVisible();
  // Aparece no dashboard: o painel também oferece ocultar.
  await expect(painel.getByRole("button", { name: "Ocultar do dashboard" })).toBeVisible();

  await painel.getByRole("button", { name: "Marcar como concluído" }).click();
  await expect(painel.getByRole("button", { name: "Reabrir" })).toBeVisible();
  await expect(painel.locator('[data-situacao="CONCLUIDO"]')).toBeVisible();
  await expect(avisos(page)).toContainText(`“${titulo}” concluído.`);
  // Concluído não aparece no dashboard: sem ocultar.
  await expect(painel.getByRole("button", { name: "Ocultar do dashboard" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(painel).toBeHidden();
  await expect(item).toBeFocused();
  await expect(item).toHaveAttribute("data-esmaecido", "true");

  await item.click();
  await painel.getByRole("button", { name: "Reabrir" }).click();
  await expect(painel.getByRole("button", { name: "Marcar como concluído" })).toBeVisible();
  await expect(avisos(page)).toContainText(`“${titulo}” reaberto.`);

  // Editar reaproveita o formulário do evento.
  await painel.getByRole("button", { name: /^Editar/ }).click();
  const edicao = page.getByRole("dialog", { name: "Editar evento" });
  await edicao.getByLabel("Hora").fill("14:30");
  await edicao.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(edicao).toBeHidden();
  await expect(avisos(page)).toContainText(`“${titulo}” salvo.`);
  await expect(item).toContainText("14:30");
  await expect(item).not.toHaveAttribute("data-esmaecido");
});

test("teclado: com o painel aberto, o aviso é anunciado nele e o Desfazer é alcançável (#100, D4)", async ({
  page,
}) => {
  const id = unico();
  const titulo = `Boleto teclado ${id}`;
  const data = emDias(3);
  await cadastrarConcurso(page, {
    orgao: `Teclado ${id}`,
    cargo: "Analista",
    status: "Inscrito",
  });
  await adicionarEvento(page, { tipo: "Vencimento do boleto", titulo, data });

  await page.goto(`/calendario?mes=${mesDaData(data)}`);
  await page.locator(`td[data-data="${data}"]`).getByRole("button", { name: titulo }).focus();
  await page.keyboard.press("Enter");
  const painel = page.getByRole("dialog", { name: titulo });
  await expect(painel).toBeVisible();
  await painel.getByRole("button", { name: "Marcar como concluído" }).focus();
  await page.keyboard.press("Enter");

  // O aviso fica na região polite dentro do diálogo, fora de qualquer `aria-hidden`.
  const regiao = painel.locator("[data-avisos]");
  await expect(regiao).toHaveAttribute("aria-live", "polite");
  await expect(regiao).toContainText(`“${titulo}” concluído.`);
  expect(await regiao.evaluate((el) => el.closest("[aria-hidden=true]") === null)).toBe(true);

  // Tab (dentro do focus trap) chega ao "Desfazer".
  const desfazer = regiao.getByRole("button", { name: "Desfazer" });
  for (
    let i = 0;
    i < 20 && !(await desfazer.evaluate((el) => el === document.activeElement));
    i++
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(desfazer).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(painel.getByRole("button", { name: "Marcar como concluído" })).toBeVisible();
  await expect(regiao).not.toContainText(`“${titulo}” concluído.`);
  await expect(painel).toBeVisible();
});

test("concluir o fim das inscrições abre o painel com a pergunta de status (#100, D5)", async ({
  page,
}) => {
  const id = unico();
  const orgao = `Pergunta E2E ${id}`;
  const titulo = `Inscrições ${id}`;
  const url = await cadastrarConcurso(page, {
    orgao,
    cargo: "Analista",
    status: "Edital publicado",
  });
  await adicionarEvento(page, { tipo: "Fim das inscrições", titulo, data: emDias(5) });

  await page.goto("/");
  await page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ hasText: titulo })
    .getByRole("button", { name: `Marcar “${titulo}” como concluído` })
    .click();
  const painel = page.getByRole("dialog", { name: titulo });
  await expect(painel).toBeVisible();
  const sugestao = painel.getByTestId("sugestao-status");
  await expect(sugestao).toContainText("Você se inscreveu?");
  await sugestao.getByRole("button", { name: "Sim", exact: true }).click();
  await expect(sugestao).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(painel).toBeHidden();

  // A resposta usou a transição validada e ficou no histórico.
  await page.goto(url);
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText(/^Pendência: Você se inscreveu\? Sim\./)).toBeVisible();
});

test("celular: o painel é um drawer inferior com botões de 44 px (#100, D3)", async ({ page }) => {
  const id = unico();
  const titulo = `Prova drawer ${id}`;
  const data = emDias(6);
  await cadastrarConcurso(page, { orgao: `Drawer ${id}`, cargo: "Analista", status: "Inscrito" });
  await adicionarEvento(page, { tipo: "Prova objetiva", titulo, data });

  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`/calendario?mes=${mesDaData(data)}`);
  await page.getByRole("button", { name: new RegExp(titulo) }).click();
  const painel = page.getByRole("dialog", { name: titulo });
  await expect(painel).toBeVisible();
  // Espera a animação de entrada terminar antes de medir.
  await expect
    .poll(async () => {
      const caixa = await painel.boundingBox();
      return caixa ? Math.round(caixa.y + caixa.height) : 0;
    })
    .toBe(740);
  const caixa = await painel.boundingBox();
  expect(caixa?.x).toBe(0);
  expect(caixa?.width).toBe(360);
  for (const nome of ["Marcar como concluído", /^Editar/, "Fechar"]) {
    const botao = painel.getByRole("button", { name: nome });
    expect((await botao.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  expect(
    (await painel.getByRole("link", { name: /^Ver no concurso/ }).boundingBox())?.height,
  ).toBeGreaterThanOrEqual(44);

  // Desktop: diálogo centralizado.
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator(`td[data-data="${data}"]`).getByRole("button", { name: titulo }).click();
  await expect(painel).toBeVisible();
  await expect
    .poll(async () => {
      const c = await painel.boundingBox();
      return c ? Math.abs(c.x + c.width / 2 - 640) < 2 && c.y > 0 : false;
    })
    .toBe(true);
});
