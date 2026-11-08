import { expect, type Page, test } from "@playwright/test";
import { mesDaData } from "../src/domain/calendario";
import { formatarMes } from "../src/lib/format";
import { cadastrarConcurso, emDias, unico } from "./utils";

/** Cadastra um evento na aba Eventos do concurso aberto e devolve o id (do `id="evento-<id>"`). */
async function adicionarEvento(
  page: Page,
  { tipo, titulo, data }: { tipo: string; titulo: string; data: string },
): Promise<number> {
  await page.getByRole("tab", { name: /^Eventos/ }).click();
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: tipo });
  await dialogo.getByLabel("Título").fill(titulo);
  await dialogo.getByLabel("Data").fill(data);
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();
  const li = page.locator('li[id^="evento-"]').filter({ hasText: titulo });
  await expect(li).toBeVisible();
  return Number((await li.getAttribute("id"))?.replace("evento-", ""));
}

test("dashboard → prazo abre a aba Eventos com o evento focado; voltar leva ao dashboard (#100)", async ({
  page,
}) => {
  const id = unico();
  const orgao = `Deep-link E2E ${id}`;
  const titulo = `Boleto deep ${id}`;
  const url = await cadastrarConcurso(page, { orgao, cargo: "Analista", status: "Inscrito" });
  const detalhe = new URL(url).pathname;
  const eventoId = await adicionarEvento(page, {
    tipo: "Vencimento do boleto",
    titulo,
    data: emDias(3),
  });

  await page.goto("/");
  await page
    .getByRole("region", { name: /^Próximos \d+ dias$/ })
    .getByRole("link", { name: new RegExp(titulo) })
    .click();
  await expect(page).toHaveURL(`${detalhe}?aba=eventos&evento=${eventoId}&de=dashboard`);
  await expect(page.getByRole("tab", { name: /^Eventos/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const alvo = page.locator(`#evento-${eventoId}`);
  await expect(alvo).toHaveAttribute("aria-current", "true");
  await expect(alvo).toBeFocused();
  await expect(alvo).toHaveAttribute("data-destaque", "forte");
  // Depois de ~5 s o destaque fica sutil, mas o parâmetro e o `aria-current` permanecem.
  await expect(alvo).toHaveAttribute("data-destaque", "sutil", { timeout: 8_000 });
  await expect(alvo).toHaveAttribute("aria-current", "true");

  // Trocar de aba remove o destaque e mantém a origem.
  await page.getByRole("tab", { name: /^Links/ }).click();
  await expect(page).toHaveURL(`${detalhe}?aba=links&de=dashboard`);

  await page.getByRole("link", { name: "Voltar para Dashboard" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("calendário → detalhes → Ver no concurso → voltar ao mesmo mês e filtro (#100)", async ({
  page,
}) => {
  const id = unico();
  const titulo = `Prova cal deep ${id}`;
  const data = emDias(40);
  const mes = mesDaData(data);
  // Dois concursos, para o filtro com um só não ser "todos".
  await cadastrarConcurso(page, { orgao: `Outro cal ${id}`, cargo: "Técnico" });
  const url = await cadastrarConcurso(page, {
    orgao: `Cal deep E2E ${id}`,
    cargo: "Analista",
    status: "Inscrito",
  });
  const detalhe = new URL(url).pathname;
  const concursoId = detalhe.split("/").at(-1);
  const eventoId = await adicionarEvento(page, { tipo: "Prova objetiva", titulo, data });

  const calendario = `/calendario?mes=${mes}&concursos=${concursoId}`;
  await page.goto(calendario);
  await page.locator(`td[data-data="${data}"]`).getByRole("button", { name: titulo }).click();
  const detalhes = page.getByRole("dialog", { name: titulo });
  await detalhes.getByRole("link", { name: /^Ver no concurso/ }).click();
  await expect(page).toHaveURL(
    `${detalhe}?aba=eventos&evento=${eventoId}&de=calendario&mes=${mes}&concursos=${concursoId}`,
  );
  await expect(page.locator(`#evento-${eventoId}`)).toBeFocused();

  await page.getByRole("link", { name: `Voltar para Calendário · ${formatarMes(mes)}` }).click();
  await expect(page).toHaveURL(calendario);
  await expect(page.getByRole("button", { name: titulo })).toBeVisible();
});

test("deep-link inválido é ignorado e removido; validade derivada foca o card (#100)", async ({
  page,
}) => {
  const url = await cadastrarConcurso(page, { orgao: `Inválido E2E ${unico()}`, cargo: "X" });
  const detalhe = new URL(url).pathname;

  for (const evento of ["999999999", "abc"]) {
    await page.goto(`${detalhe}?aba=eventos&evento=${evento}&de=notificacoes`);
    await expect(page).toHaveURL(`${detalhe}?aba=eventos&de=notificacoes`);
    await expect(page.locator('[aria-current="true"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Adicionar evento" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar para Notificações" })).toHaveAttribute(
      "href",
      "/notificacoes",
    );
  }

  // Origem fora da allowlist: volta para a lista de concursos.
  await page.goto(`${detalhe}?de=https://exemplo.invalido`);
  await expect(page.getByRole("link", { name: "Voltar para Concursos" })).toHaveAttribute(
    "href",
    "/concursos",
  );

  await page.goto(`${detalhe}?aba=geral&foco=validade`);
  const card = page.getByTestId("card-validade");
  await expect(card).toBeFocused();
  await expect(card).toHaveAttribute("aria-current", "true");

  await page.goto(`${detalhe}?foco=outra`);
  await expect(page).toHaveURL(detalhe);
  await expect(page.getByTestId("card-validade")).not.toHaveAttribute("aria-current");
});
