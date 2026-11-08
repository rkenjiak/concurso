import { expect, type Locator, test } from "@playwright/test";
import { mesDaData } from "../src/domain/calendario";
import { corPadrao } from "../src/domain/cores";
import { cadastrarConcurso, emDias, escolherCor, unico } from "./utils";

/** Cor de fundo calculada do ponto do marcador. */
const corDoPonto = (marcador: Locator) =>
  marcador
    .locator("span")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);

test("cor e ícone do concurso: formulário, calendário, legenda, detalhes e cor automática", async ({
  page,
}) => {
  const id = unico();
  const orgao = `Cor E2E ${id}`;
  const titulo = `Prova cor ${id}`;
  const data = emDias(10);
  const url = await cadastrarConcurso(page, {
    orgao,
    cargo: "Analista",
    status: "Inscrito",
    cor: "Verde-água",
    icone: "⚖️",
  });
  const concursoId = Number(new URL(url).pathname.split("/").pop());

  // Detalhe do concurso: marcador decorativo ao lado do nome (o h1 continua só com o órgão).
  const titulo1 = page.getByRole("heading", { level: 1, name: orgao, exact: true });
  await expect(titulo1.locator('[data-cor-concurso="VERDE_AGUA"]')).toContainText("⚖️");

  await page.getByRole("tab", { name: /^Eventos/ }).click();
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: "Prova objetiva" });
  await dialogo.getByLabel("Título").fill(titulo);
  await dialogo.getByLabel("Data").fill(data);
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialogo).toBeHidden();

  // Calendário: o item mostra a cor/ícone do concurso e mantém a criticidade.
  await page.goto(`/calendario?mes=${mesDaData(data)}`);
  const item = page.locator(`td[data-data="${data}"]`).getByRole("button", { name: titulo });
  await expect(item).toBeVisible();
  const marcador = item.locator('[data-cor-concurso="VERDE_AGUA"]');
  await expect(marcador).toContainText("⚖️");
  await expect(item).toHaveAttribute("data-criticidade", "NORMAL");

  // Legenda cor → concurso.
  const legenda = page.getByRole("list", { name: "Concursos" });
  const entrada = legenda.getByRole("listitem").filter({ hasText: orgao });
  await expect(entrada.getByRole("img", { name: "Cor Verde-água, ⚖️" })).toBeVisible();

  // A cor tem variantes clara e escura (tokens CSS).
  const claro = await corDoPonto(marcador);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  const escuro = await corDoPonto(marcador);
  expect(escuro).not.toBe(claro);
  await page.evaluate(() => document.documentElement.classList.remove("dark"));

  // Diálogo de detalhes também mostra a cor/ícone.
  await item.click();
  const detalhes = page.getByRole("dialog", { name: titulo });
  await expect(detalhes.getByRole("img", { name: "Cor Verde-água, ⚖️" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Edição: volta à cor automática (derivada do ID) e remove o ícone.
  await page.goto(`${new URL(url).pathname}/editar`);
  await expect(page.getByRole("radio", { name: "Verde-água", exact: true })).toBeChecked();
  await expect(page.getByLabel("Ícone (opcional)")).toHaveValue("⚖️");
  await escolherCor(page, /^Automática/);
  await page.getByRole("button", { name: "Sem ícone" }).click();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(url);

  await page.goto(`/calendario?mes=${mesDaData(data)}`);
  const automatica = corPadrao(concursoId);
  await expect(
    page
      .locator(`td[data-data="${data}"]`)
      .getByRole("button", { name: titulo })
      .locator(`[data-cor-concurso="${automatica}"]`),
  ).not.toContainText("⚖️");
});

test("ícone inválido mostra erro no formulário", async ({ page }) => {
  await page.goto("/concursos/novo");
  await page.getByLabel("Nome / órgão").fill(`Ícone inválido ${unico()}`);
  await page.getByLabel("Cargo(s) / área").fill("Analista");
  await page.getByLabel("Ícone (opcional)").fill("ab");
  await page.getByRole("button", { name: "Cadastrar concurso" }).click();
  await expect(page.getByText("Use um único emoji ou símbolo.")).toBeVisible();
  await expect(page).toHaveURL(/\/concursos\/novo$/);
});
