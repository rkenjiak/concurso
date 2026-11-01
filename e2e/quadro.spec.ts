import { expect, type Page, test } from "@playwright/test";
import { cadastrarConcurso, unico } from "./utils";

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
  await expect(page.getByText("movido para “Inscrito”")).toBeVisible();
  await expect(coluna(page, "Inscrito").getByRole("listitem", { name: /Quadro E2E/ })).toHaveCount(
    1,
  );

  // Desfazer volta ao status anterior.
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByText("de volta a “Previsto”")).toBeVisible();
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
  await expect(page.getByText("Não é possível mudar o status")).toBeVisible();
  await expect(
    coluna(page, "Edital publicado").getByRole("listitem", { name: /Quadro E2E/ }),
  ).toHaveCount(1);

  // O histórico registra a mudança e o cartão abre o detalhe.
  await cartao.getByRole("link", { name: orgao }).click();
  await expect(page.getByRole("heading", { level: 1, name: orgao })).toBeVisible();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText("Edital publicado").first()).toBeVisible();
});
