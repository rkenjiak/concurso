import { expect, type Page, test } from "@playwright/test";
import { cadastrarConcurso, unico } from "./utils";

/** Aviso global (#100, D4) com o texto dado. */
const aviso = (page: Page, texto: string) =>
  page
    .getByRole("listitem")
    .filter({ hasText: texto })
    .filter({
      has: page.getByRole("button", { name: "Fechar aviso" }),
    });

const coluna = (page: Page, nome: string) =>
  page.getByRole("region", { name: new RegExp(`^${nome}\\s*\\d+$`) });

test("quadro: mover pelo menu, desfazer e arrastar com transição inválida", async ({ page }) => {
  const id = unico();
  const orgao = `Quadro E2E ${id}`;
  await cadastrarConcurso(page, { orgao, cargo: "Analista", tags: [`q${id}`] });

  // Alterna para o quadro mantendo a busca.
  await page.goto(`/concursos?q=${id}`);
  await page
    .getByRole("navigation", { name: "Visão" })
    .getByRole("link", { name: "Quadro" })
    .click();
  await expect(page).toHaveURL(/q=.*visao=quadro/);

  const cartao = page.getByRole("listitem", { name: new RegExp(orgao) });
  await expect(coluna(page, "Previsto").getByRole("listitem", { name: /Quadro E2E/ })).toHaveCount(
    1,
  );

  // Teclado/celular: "Mover para" usa as transições permitidas.
  await cartao.getByRole("combobox", { name: /Mover/ }).selectOption({ label: "Inscrito" });
  // O aviso global anuncia a mudança (região polite) e oferece Desfazer.
  await expect(aviso(page, "movido para “Inscrito”")).toBeVisible();
  await expect(
    page.locator("[aria-live=polite]").getByText("movido para “Inscrito”"),
  ).toBeVisible();
  // A dica de uso continua no quadro.
  await expect(page.getByText("Arraste os cartões entre as colunas")).toBeVisible();
  await expect(coluna(page, "Inscrito").getByRole("listitem", { name: /Quadro E2E/ })).toHaveCount(
    1,
  );

  // Desfazer volta ao status anterior.
  await aviso(page, "movido para “Inscrito”").getByRole("button", { name: "Desfazer" }).click();
  await expect(aviso(page, "de volta a “Previsto”")).toBeVisible();
  // O aviso de "movido" foi substituído (mesmo concurso), não empilhado.
  await expect(aviso(page, "movido para “Inscrito”")).toHaveCount(0);
  await expect(coluna(page, "Previsto").getByRole("listitem", { name: /Quadro E2E/ })).toHaveCount(
    1,
  );

  // Arrastar para uma coluna válida.
  await cartao.dragTo(coluna(page, "Edital publicado"));
  await expect(
    coluna(page, "Edital publicado").getByRole("listitem", { name: /Quadro E2E/ }),
  ).toHaveCount(1);

  // Arrastar para trás é rejeitado com a mensagem do domínio.
  await cartao.dragTo(coluna(page, "Previsto"));
  // Erro: role="alert"; fecha pelo botão com nome acessível.
  const erro = page.getByRole("alert").filter({ hasText: "Não é possível mudar o status" });
  await expect(erro).toBeVisible();
  await erro.getByRole("button", { name: "Fechar aviso" }).click();
  await expect(erro).toHaveCount(0);
  await expect(
    coluna(page, "Edital publicado").getByRole("listitem", { name: /Quadro E2E/ }),
  ).toHaveCount(1);

  // O histórico registra a mudança e o cartão abre o detalhe.
  await cartao.getByRole("link", { name: orgao }).click();
  await expect(page.getByRole("heading", { level: 1, name: orgao })).toBeVisible();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText("Edital publicado").first()).toBeVisible();
});

test("quadro: Desfazer recusa quando o status mudou em outra aba (#100)", async ({
  page,
  context,
}) => {
  const id = unico();
  const orgao = `Quadro Guarda ${id}`;
  const detalhe = await cadastrarConcurso(page, { orgao, cargo: "Analista", tags: [`g${id}`] });

  await page.goto(`/concursos?q=${id}&visao=quadro`);
  const cartao = page.getByRole("listitem", { name: new RegExp(orgao) });
  await cartao.getByRole("combobox", { name: /Mover/ }).selectOption({ label: "Inscrito" });
  await expect(aviso(page, "movido para “Inscrito”")).toBeVisible();

  // Outra aba muda o status de novo.
  const outra = await context.newPage();
  await outra.goto(detalhe);
  await outra.getByRole("button", { name: "Mudar status" }).click();
  const dialogo = outra.getByRole("dialog", { name: "Mudar status" });
  await dialogo.getByLabel("Novo status").selectOption({ label: "Prova agendada" });
  await dialogo.getByRole("button", { name: "Alterar status" }).click();
  await expect(dialogo).toBeHidden();
  await outra.close();

  // O Desfazer do aviso não desfaz a mudança da outra aba.
  await aviso(page, "movido para “Inscrito”").getByRole("button", { name: "Desfazer" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "O status mudou desde então; nada foi desfeito." }),
  ).toBeVisible();
  await expect(
    coluna(page, "Prova agendada").getByRole("listitem", { name: new RegExp(orgao) }),
  ).toHaveCount(1);
});
