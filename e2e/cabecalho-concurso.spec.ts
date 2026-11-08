import { expect, test } from "@playwright/test";
import { cadastrarConcurso, regiaoAvisos, unico } from "./utils";

test("mudar status pelo cabeçalho, com Desfazer no aviso (#100, D7)", async ({ page }) => {
  const id = unico();
  const orgao = `Status E2E ${id}`;
  const url = await cadastrarConcurso(page, { orgao, cargo: "Analista" });
  const cabecalho = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
  await expect(cabecalho).toContainText("Previsto");

  await cabecalho.getByRole("button", { name: "Mudar status" }).click();
  const dialogo = page.getByRole("dialog", { name: "Mudar status" });
  await expect(dialogo).toContainText("Atual: “Previsto”");
  await dialogo.getByLabel("Novo status").selectOption({ label: "Inscrito" });
  await dialogo.getByLabel("Observação (opcional)").fill("taxa paga");
  await dialogo.getByRole("button", { name: "Alterar status" }).click();
  await expect(dialogo).toBeHidden();
  await expect(cabecalho).toContainText("Inscrito");
  // O foco volta ao botão que abriu o diálogo.
  await expect(cabecalho.getByRole("button", { name: "Mudar status" })).toBeFocused();

  const aviso = regiaoAvisos(page).getByRole("listitem").filter({ hasText: "Status → “Inscrito”" });
  await expect(aviso).toBeVisible();
  await aviso.getByRole("button", { name: "Desfazer" }).click();
  await expect(
    regiaoAvisos(page).getByText("Mudança desfeita: de volta a “Previsto”."),
  ).toBeVisible();
  await expect(cabecalho).toContainText("Previsto");

  // A aba Histórico fica só com a timeline: sem o formulário de status.
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText("Histórico de status")).toBeVisible();
  await expect(page.getByLabel("Novo status")).toHaveCount(0);

  // A edição do concurso leva ao controle de status (`?mudar=status`); fechar limpa a URL.
  await page.goto(`${url}/editar`);
  await page.getByRole("link", { name: "altere na página do concurso" }).click();
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(page).toHaveURL(url);
});

test("silenciar notificações pelo menu Mais ações (#100, D8)", async ({ page }) => {
  await cadastrarConcurso(page, { orgao: `Silenciar E2E ${unico()}`, cargo: "Analista" });
  const mais = page.getByRole("button", { name: "Mais ações" });
  const item = page.getByRole("menuitemcheckbox", { name: "Silenciar notificações" });

  await mais.click();
  await expect(page.getByRole("menuitem", { name: /\.ics/ })).toHaveAttribute(
    "href",
    /\/api\/export\?formato=ics&concurso=\d+/,
  );
  await expect(item).toHaveAttribute("aria-checked", "false");
  await item.click();
  await expect(page.getByRole("menu")).toBeHidden();
  const aviso = regiaoAvisos(page)
    .getByRole("listitem")
    .filter({ hasText: "Notificações e alarmes deste concurso silenciados." });
  await expect(aviso).toBeVisible();

  await mais.click();
  await expect(item).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  // Desfazer reativa.
  await aviso.getByRole("button", { name: "Desfazer" }).click();
  await expect(regiaoAvisos(page).getByText(/silenciados?\.|reativados\./)).toHaveText(
    "Notificações e alarmes deste concurso reativados.",
  );
  await page.reload();
  await mais.click();
  await expect(item).toHaveAttribute("aria-checked", "false");
});

test("excluir pelo menu Mais ações pede confirmação (#100, D8)", async ({ page }) => {
  const orgao = `Excluir E2E ${unico()}`;
  await cadastrarConcurso(page, { orgao, cargo: "Analista" });
  const mais = page.getByRole("button", { name: "Mais ações" });

  // Cancelar mantém o concurso e devolve o foco ao botão do menu.
  await mais.click();
  await page.getByRole("menuitem", { name: /^Excluir/ }).click();
  const confirmacao = page.getByRole("alertdialog", { name: "Excluir concurso?" });
  await expect(confirmacao).toBeVisible();
  await confirmacao.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirmacao).toBeHidden();
  await expect(mais).toBeFocused();

  // A página continua interativa depois de fechar (o menu não deixou a tela bloqueada).
  await mais.click();
  await page.getByRole("menuitem", { name: /^Excluir/ }).click();
  await confirmacao.getByRole("button", { name: "Excluir" }).click();
  await expect(page).toHaveURL(/\/concursos$/);
  await expect(page.getByRole("link", { name: new RegExp(orgao) })).toHaveCount(0);
});

test("celular: cabeçalho cabe em 360 px com botões de 44 px (#100, D7/D8)", async ({ page }) => {
  await cadastrarConcurso(page, {
    orgao: `Tribunal Regional do Trabalho da 15ª Região ${unico()}`,
    cargo: "Analista Judiciário — Área Administrativa",
  });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.reload();
  for (const botao of [
    page.getByRole("button", { name: "Mudar status" }),
    page.getByRole("link", { name: "Editar", exact: true }),
    page.getByRole("button", { name: "Mais ações" }),
  ]) {
    const caixa = await botao.boundingBox();
    expect(caixa?.height).toBeGreaterThanOrEqual(44);
    expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(360);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
