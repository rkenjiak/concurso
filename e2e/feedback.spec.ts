import { expect, type Page, test } from "@playwright/test";
import { regiaoAvisos, unico } from "./utils";

/**
 * Feedback de usuários (#117), no projeto sem login: o usuário inicial é admin, então envia pelo
 * menu da conta e trata na caixa de entrada `/admin/feedback`. Cada teste filtra pela própria
 * marca (`unico()`), porque o banco é compartilhado.
 */

async function abrirFeedbackPeloMenu(page: Page, regiao: "complementary" | "banner") {
  await page.getByRole(regiao).getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Enviar feedback" }).click();
  return page.getByRole("dialog", { name: "Enviar feedback" });
}

async function enviar(page: Page, mensagem: string, tipo = "Sugestão") {
  const dialogo = await abrirFeedbackPeloMenu(page, "complementary");
  await dialogo.getByRole("radio", { name: tipo }).check();
  await dialogo.getByLabel("Mensagem").fill(mensagem);
  await dialogo.getByRole("button", { name: "Enviar" }).click();
  await expect(dialogo).toBeHidden();
  await expect(regiaoAvisos(page).getByText("Feedback enviado. Obrigado!")).toBeVisible();
}

const caixa = (page: Page) => page.getByRole("main").getByRole("table");
const linha = (page: Page, texto: string) =>
  caixa(page).getByRole("row").filter({ hasText: texto });
const checkboxDe = (page: Page, texto: string) =>
  linha(page, texto).getByRole("checkbox", { name: /^Selecionar feedback de / });
const barra = (page: Page) => page.getByRole("region", { name: "Ações da seleção" });

test("feedback: enviar → selecionar vários (mouse e teclado) → exportar → descartar e desfazer (#117)", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const marca = `fb-${unico()}`;
  const mensagens = [1, 2, 3].map((n) => `${marca} mensagem número ${n} sobre o app`);

  // Envio: validação, contador, o que é anexado; a rota vai sem query string.
  await page.goto("/concursos?ordem=nome");
  const dialogo = await abrirFeedbackPeloMenu(page, "complementary");
  await expect(dialogo.getByRole("radio", { name: "Sugestão" })).toBeChecked();
  await expect(dialogo).toContainText("Vamos anexar: a página atual (/concursos)");
  await dialogo.getByLabel("Mensagem").fill("curta");
  await expect(dialogo).toContainText("5/2000");
  await dialogo.getByRole("button", { name: "Enviar" }).click();
  await expect(dialogo.getByRole("alert")).toHaveText("Escreva pelo menos 10 caracteres.");
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();

  await enviar(page, mensagens[0] as string, "Bug");
  await enviar(page, mensagens[1] as string);
  // Pelo teclado: menu da conta, item e formulário.
  const gatilho = page.getByRole("complementary").getByRole("button", { name: "Menu da conta" });
  await gatilho.focus();
  await page.keyboard.press("Enter");
  const item = page.getByRole("menuitem", { name: "Enviar feedback" });
  await item.focus();
  await page.keyboard.press("Enter");
  const teclado = page.getByRole("dialog", { name: "Enviar feedback" });
  await teclado.getByRole("radio", { name: "Outro" }).focus();
  await page.keyboard.press("Space");
  await teclado.getByLabel("Mensagem").focus();
  await page.keyboard.type(mensagens[2] as string);
  await teclado.getByRole("button", { name: "Enviar" }).focus();
  await page.keyboard.press("Enter");
  await expect(teclado).toBeHidden();
  await expect(gatilho).toBeFocused();

  // Caixa de entrada: contador de novos na navegação e os três na aba Novos.
  await page.goto(`/admin/feedback?busca=${marca}`);
  await expect(
    page.getByRole("navigation", { name: "Navegação do painel admin" }).getByRole("link", {
      name: /^Feedback \(\d+ novos?\)$/,
    }),
  ).toBeVisible();
  await expect(caixa(page).getByRole("row")).toHaveCount(4);
  await expect(linha(page, mensagens[0] as string)).toContainText("Bug");
  await expect(linha(page, mensagens[2] as string)).toContainText("/concursos");
  await expect(barra(page)).toHaveCount(0);

  // Mouse: um item e Shift+clique no intervalo; o cabeçalho fica marcado (todos os visíveis).
  const todos = caixa(page).getByRole("checkbox", {
    name: "Selecionar todos os feedbacks visíveis",
  });
  await checkboxDe(page, mensagens[2] as string).click();
  await expect(todos).toHaveAttribute("aria-checked", "mixed");
  await expect(barra(page)).toContainText("1 selecionado");
  await checkboxDe(page, mensagens[0] as string).click({ modifiers: ["Shift"] });
  await expect(barra(page)).toContainText("3 selecionados");
  await expect(todos).toHaveAttribute("aria-checked", "true");
  // Esc limpa a seleção e a barra some.
  await page.keyboard.press("Escape");
  await expect(barra(page)).toHaveCount(0);
  await expect(todos).toHaveAttribute("aria-checked", "false");

  // Teclado: Espaço no primeiro e Shift+Espaço no último marcam o intervalo.
  const ordem = await caixa(page)
    .getByRole("checkbox", { name: /^Selecionar feedback de / })
    .all();
  await ordem[0]?.focus();
  await page.keyboard.press("Space");
  await ordem[2]?.focus();
  await page.keyboard.press("Shift+Space");
  await expect(barra(page)).toContainText("3 selecionados");
  await expect(page.getByText("3 selecionados", { exact: true }).first()).toBeAttached();

  // Exportar: comandos gh, sem e-mail por padrão; copia e marca como exportados.
  await barra(page).getByRole("button", { name: "Exportar" }).click();
  const exportar = page.getByRole("dialog", { name: "Exportar 3 feedbacks" });
  await exportar.getByRole("radio", { name: /Comandos gh/ }).check();
  const previa = exportar.getByLabel("Prévia");
  await expect(previa).toHaveValue(/^# 3 issues: cole num terminal bash ou zsh/);
  await expect(previa).not.toHaveValue(/\*\*Usuário:\*\*/);
  await exportar.getByLabel(/Incluir e-mail do usuário/).check();
  await expect(previa).toHaveValue(/\*\*Usuário:\*\*/);
  // Fechar (Esc) e reabrir volta ao padrão seguro: sem e-mail.
  await page.keyboard.press("Escape");
  await expect(exportar).toBeHidden();
  await expect(barra(page)).toContainText("3 selecionados");
  await barra(page).getByRole("button", { name: "Exportar" }).click();
  await expect(exportar.getByLabel(/Incluir e-mail do usuário/)).not.toBeChecked();
  await exportar.getByRole("radio", { name: /Comandos gh/ }).check();
  await expect(previa).not.toHaveValue(/\*\*Usuário:\*\*/);
  await exportar.getByRole("button", { name: "Copiar e marcar como exportados" }).click();
  await expect(exportar).toBeHidden();
  await expect(
    regiaoAvisos(page).getByText("3 feedbacks exportados: conteúdo copiado."),
  ).toBeVisible();
  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiado.match(/^gh issue create /gm)).toHaveLength(3);
  expect(copiado).toContain("--label bug");
  expect(copiado).toContain(mensagens[1]);
  // Saem de Novos e aparecem em Exportados.
  await expect(caixa(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Exportados" }).click();
  await expect(caixa(page).getByRole("row")).toHaveCount(4);
  await expect(linha(page, mensagens[0] as string)).toContainText("Exportado");

  // Descartar com Desfazer: voltam para Exportados.
  await todos.click();
  await barra(page).getByRole("button", { name: "Descartar" }).click();
  const aviso = regiaoAvisos(page)
    .getByRole("listitem")
    .filter({ hasText: "3 feedbacks descartados." });
  await expect(aviso).toBeVisible();
  await expect(caixa(page)).toHaveCount(0);
  await aviso.getByRole("button", { name: "Desfazer" }).click();
  await expect(regiaoAvisos(page).getByText("Descarte desfeito.")).toBeVisible();
  await expect(caixa(page).getByRole("row")).toHaveCount(4);

  // Descartar de novo; em Descartados, restaurar um e excluir os outros.
  await todos.click();
  await barra(page).getByRole("button", { name: "Descartar" }).click();
  await expect(caixa(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Descartados" }).click();
  await expect(caixa(page).getByRole("row")).toHaveCount(4);
  await checkboxDe(page, mensagens[1] as string).click();
  await barra(page).getByRole("button", { name: "Restaurar" }).click();
  await expect(regiaoAvisos(page).getByText("1 feedback restaurado para Novos.")).toBeVisible();
  await expect(caixa(page).getByRole("row")).toHaveCount(3);
  await todos.click();
  await barra(page).getByRole("button", { name: "Excluir definitivamente" }).click();
  const confirmar = page.getByRole("alertdialog", { name: "Excluir 2 feedbacks definitivamente?" });
  await confirmar.getByRole("button", { name: "Excluir" }).click();
  await expect(regiaoAvisos(page).getByText("2 feedbacks excluídos.")).toBeVisible();
  await expect(caixa(page)).toHaveCount(0);
  await page.getByRole("link", { name: /^Novos/ }).click();
  await expect(caixa(page).getByRole("row")).toHaveCount(2);

  // Um registro de auditoria por lote.
  await page.goto("/admin/auditoria");
  const registros = page.getByRole("main").getByRole("row");
  await expect(registros.filter({ hasText: "Exportou" }).first()).toContainText("3 feedbacks");
  await expect(registros.filter({ hasText: "Excluiu definitivamente" }).first()).toContainText(
    "2 feedbacks",
  );
});

test.describe("celular (360 px)", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("enviar feedback pelo menu da conta e ver o contador na barra do admin (#117)", async ({
    page,
  }) => {
    const marca = `fb-cel-${unico()}`;
    await page.goto("/calendario");
    const dialogo = await abrirFeedbackPeloMenu(page, "banner");
    await dialogo.getByLabel("Mensagem").fill(`${marca}: o calendário é ótimo no celular`);
    await dialogo.getByRole("button", { name: "Enviar" }).click();
    await expect(dialogo).toBeHidden();
    await expect(regiaoAvisos(page).getByText("Feedback enviado. Obrigado!")).toBeVisible();

    await page.goto(`/admin/feedback?busca=${marca}`);
    await expect(caixa(page)).toContainText("/calendario");
    const nav = page.getByRole("navigation", { name: "Navegação do painel admin" });
    await expect(nav.getByRole("link", { name: /^Feedback \(\d+ novos?\)$/ })).toBeVisible();
    const semRolagem = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(semRolagem).toBe(true);
  });
});
