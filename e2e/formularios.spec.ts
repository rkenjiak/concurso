import { expect, type Page, test } from "@playwright/test";
import { cadastrarConcurso, emDias, regiaoAvisos, unico } from "./utils";

// Avisos das ações de escrita, alterações não salvas e foco no erro (#100, Fase 4: itens 12–15).

/** Link da navegação visível (lateral, no desktop). */
const linkNavegacao = (page: Page, nome: string) =>
  page
    .getByRole("navigation")
    .filter({ visible: true })
    .getByRole("link", { name: nome, exact: true })
    .first();

test("avisos após cadastrar, editar e excluir o concurso; o parâmetro sai da URL", async ({
  page,
}) => {
  const orgao = `Avisos E2E ${unico()}`;
  const url = await cadastrarConcurso(page, { orgao, cargo: "Analista" });
  await expect(regiaoAvisos(page)).toContainText("Concurso cadastrado.");
  // Recarregar não repete o aviso: `?aviso=` já saiu da URL.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: orgao })).toBeVisible();
  await expect(page.getByText("Concurso cadastrado.")).toHaveCount(0);

  await page.goto(`${url}/editar`);
  await page.getByLabel("Cargo(s) / área").fill("Técnico");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(url);
  await expect(regiaoAvisos(page)).toContainText("Alterações do concurso salvas.");

  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: /^Excluir/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page).toHaveURL(/\/concursos$/);
  const aviso = regiaoAvisos(page).getByRole("listitem").filter({ hasText: "Concurso excluído." });
  await expect(aviso).toBeVisible();
  // Exclusão não é reversível: sem Desfazer.
  await expect(aviso.getByRole("button", { name: "Desfazer" })).toHaveCount(0);
});

test("formulário sujo: link da navegação pede confirmação para ficar ou sair (D10)", async ({
  page,
}) => {
  await page.goto("/concursos/novo");
  // Limpo: navega sem perguntar.
  await linkNavegacao(page, "Calendário").click();
  await expect(page).toHaveURL(/\/calendario$/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  await page.goto("/concursos/novo");
  const orgao = page.getByLabel("Nome / órgão");
  await orgao.fill("Rascunho não salvo");
  await linkNavegacao(page, "Concursos").click();
  const confirmacao = page.getByRole("alertdialog", { name: "Descartar alterações?" });
  await expect(confirmacao).toBeVisible();
  await confirmacao.getByRole("button", { name: "Continuar editando" }).click();
  await expect(confirmacao).toBeHidden();
  await expect(page).toHaveURL(/\/concursos\/novo$/);
  await expect(orgao).toHaveValue("Rascunho não salvo");

  // "Cancelar" do formulário também pergunta; confirmando, sai.
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirmacao).toBeVisible();
  await confirmacao.getByRole("button", { name: "Continuar editando" }).click();
  await linkNavegacao(page, "Concursos").click();
  await confirmacao.getByRole("button", { name: "Descartar e sair" }).click();
  await expect(page).toHaveURL(/\/concursos$/);
});

test("modal de evento: Esc com alterações pede confirmação; foco no 1º campo inválido", async ({
  page,
}) => {
  await cadastrarConcurso(page, { orgao: `Modal sujo ${unico()}`, cargo: "Analista" });
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });

  // Sem data: o foco vai para o campo inválido.
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialogo.getByLabel("Data")).toBeFocused();
  await expect(dialogo.getByLabel("Data")).toHaveAttribute("aria-invalid", "true");

  const titulo = dialogo.getByLabel("Título");
  await titulo.fill("Rascunho");
  await page.keyboard.press("Escape");
  const confirmacao = page.getByRole("alertdialog", { name: "Descartar alterações?" });
  await expect(confirmacao.getByRole("button", { name: "Continuar editando" })).toBeFocused();
  // Espera a animação de abertura (durante ela, o Radix ainda não trata o Esc da camada nova).
  await confirmacao.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  // Esc fecha só a confirmação: o modal continua, com o que foi digitado e o foco no campo.
  await page.keyboard.press("Escape");
  await expect(confirmacao).toBeHidden();
  await expect(titulo).toHaveValue("Rascunho");
  await expect(titulo).toBeFocused();

  await dialogo.getByRole("button", { name: "Fechar", exact: true }).click();
  await confirmacao.getByRole("button", { name: "Descartar e sair" }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByText("Rascunho")).toHaveCount(0);
  // O foco volta a quem abriu o modal.
  await expect(page.getByRole("button", { name: "Adicionar evento" })).toBeFocused();

  // Sem alterações, Esc fecha direto.
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(confirmacao).toHaveCount(0);
});

test("concurso: erro de validação foca o primeiro campo inválido", async ({ page }) => {
  await page.goto("/concursos/novo");
  await page.getByLabel("Nome / órgão").fill("Só o órgão");
  await page.getByRole("button", { name: "Cadastrar concurso" }).click();
  await expect(page.getByLabel("Cargo(s) / área")).toBeFocused();
  await expect(
    page.getByRole("alert").filter({ hasText: "Verifique os campos destacados." }),
  ).toBeVisible();
});

test("aba Eventos: concluir é por item, com aviso e Desfazer (#100, item 14)", async ({ page }) => {
  const id = unico();
  await cadastrarConcurso(page, { orgao: `Concluir aba ${id}`, cargo: "Analista" });
  for (const [titulo, dias] of [
    [`Primeiro ${id}`, 10],
    [`Segundo ${id}`, 20],
  ] as const) {
    await page.getByRole("button", { name: "Adicionar evento" }).click();
    const dialogo = page.getByRole("dialog", { name: "Novo evento" });
    await dialogo.getByLabel("Título").fill(titulo);
    await dialogo.getByLabel("Data").fill(emDias(dias));
    await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dialogo).toBeHidden();
    const salvo = regiaoAvisos(page)
      .getByRole("listitem")
      .filter({ hasText: `“${titulo}” salvo.` });
    await expect(salvo).toBeVisible();
    // Fecha o aviso: no máximo três ficam visíveis e o de concluir não pode ficar na fila.
    await salvo.getByRole("button", { name: "Fechar aviso" }).click();
  }

  const primeiro = page.getByRole("checkbox", { name: `Marcar "Primeiro ${id}" como concluído` });
  await primeiro.click();
  await expect(
    page.getByRole("checkbox", { name: `Desmarcar "Primeiro ${id}" como concluído` }),
  ).toBeChecked();
  // Só o item gravado fica ocupado: o outro continua disponível.
  await expect(
    page.getByRole("checkbox", { name: `Marcar "Segundo ${id}" como concluído` }),
  ).toBeEnabled();
  const aviso = regiaoAvisos(page)
    .getByRole("listitem")
    .filter({ hasText: `“Primeiro ${id}” concluído.` });
  await expect(aviso).toBeVisible();

  await aviso.getByRole("button", { name: "Desfazer" }).click();
  await expect(aviso).toBeHidden();
  const reaberto = page.getByRole("checkbox", { name: `Marcar "Primeiro ${id}" como concluído` });
  await expect(reaberto).not.toBeChecked();
  await expect(reaberto).toBeFocused();
  await page.reload();
  await expect(reaberto).not.toBeChecked();
});
