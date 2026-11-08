import { expect, test } from "@playwright/test";
import { ehMesISO } from "../src/domain/calendario";
import { formatarMes } from "../src/lib/format";
import { cadastrarConcurso, emDias, unico } from "./utils";

// Fluxo de cadastro de eventos (#100, Fase 1c: D9 e D13).

test("concurso novo abre na aba Eventos com estado vazio; salvar e adicionar outro; cancelar", async ({
  page,
}) => {
  const id = unico();
  const url = await cadastrarConcurso(page, { orgao: `Fluxo eventos ${id}`, cargo: "Analista" });

  // Aba Eventos selecionada, estado vazio orientativo e nenhum modal aberto sozinho.
  await expect(page.getByRole("tab", { name: /^Eventos/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const vazio = page.getByRole("region", { name: "Cadastre as datas deste concurso" });
  await expect(vazio).toContainText("dashboard, o calendário e os avisos");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // "Salvar e adicionar outro": salva, limpa o formulário e devolve o foco ao 1º campo.
  await vazio.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: "Fim das inscrições" });
  await dialogo.getByLabel("Título").fill(`Inscrições ${id}`);
  await dialogo.getByLabel("Data").fill(emDias(10));
  await dialogo.getByRole("button", { name: "Salvar e adicionar outro" }).click();
  await expect(dialogo.getByRole("status")).toHaveText(
    `“Inscrições ${id}” salvo. Preencha o próximo evento.`,
  );
  await expect(dialogo.getByLabel("Tipo")).toBeFocused();
  await expect(dialogo.getByLabel("Título")).toHaveValue("");
  await expect(dialogo.getByLabel("Data")).toHaveValue("");
  await expect(
    page.locator('li[id^="evento-"]').filter({ hasText: `Inscrições ${id}` }),
  ).toBeAttached();

  await dialogo.getByLabel("Tipo").selectOption({ label: "Prova objetiva" });
  await dialogo.getByLabel("Título").fill(`Prova ${id}`);
  await dialogo.getByLabel("Data").fill(emDias(40));
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByText(`Inscrições ${id}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Prova ${id}`, { exact: true })).toBeVisible();
  await expect(vazio).toBeHidden();

  // Cancelar fecha o modal sem salvar; na edição não há "Salvar e adicionar outro".
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  await dialogo.getByLabel("Título").fill(`Descartado ${id}`);
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByText(`Descartado ${id}`)).toHaveCount(0);
  await page.getByRole("button", { name: `Editar evento Prova ${id}` }).click();
  const edicao = page.getByRole("dialog", { name: "Editar evento" });
  await expect(edicao.getByRole("button", { name: "Salvar e adicionar outro" })).toHaveCount(0);
  await edicao.getByRole("button", { name: "Cancelar" }).click();
  await expect(edicao).toBeHidden();

  // Cancelar do formulário do concurso vai para rota fixa, mesmo sem histórico.
  const detalhe = new URL(url).pathname;
  await page.goto(`${detalhe}/editar`);
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page).toHaveURL(url);
  await page.goto("/concursos/novo");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page).toHaveURL(/\/concursos$/);
});

test("dashboard: “Ver mais” das próximas provas abre o calendário no mês da 7ª (#100)", async ({
  page,
}) => {
  // Garante mais de 6 contagens (uma por concurso em andamento com prova futura).
  const id = unico();
  for (let i = 0; i < 7; i++) {
    await cadastrarConcurso(page, { orgao: `Ver mais ${id} ${i}`, cargo: "Analista" });
    await page.getByRole("button", { name: "Adicionar evento" }).click();
    const dialogo = page.getByRole("dialog", { name: "Novo evento" });
    await dialogo.getByLabel("Tipo").selectOption({ label: "Prova objetiva" });
    await dialogo.getByLabel("Data").fill(emDias(20 + i * 15));
    await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dialogo).toBeHidden();
  }

  await page.goto("/");
  await expect(page.getByTestId("lista-contagens").getByRole("listitem")).toHaveCount(6);
  const link = page.getByRole("link", { name: /^Ver mais \d+ a partir de / });
  const href = (await link.getAttribute("href")) ?? "";
  const mes = /^\/calendario\?mes=(\d{4}-\d{2})$/.exec(href)?.[1] ?? "";
  expect(ehMesISO(mes)).toBe(true);
  await expect(link).toHaveText(new RegExp(` a partir de ${formatarMes(mes)}$`));
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/calendario\\?mes=${mes}$`));
});
