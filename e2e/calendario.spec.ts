import { expect, test } from "@playwright/test";
import { mesDaData } from "../src/domain/calendario";
import { hojeSP } from "../src/lib/tz";
import { cadastrarConcurso, emDias, unico } from "./utils";

test("calendário mensal: hoje, destaque crítico, detalhes em popup, navegação, agenda no celular", async ({
  page,
}) => {
  const id = unico();
  const orgao = `Calendário E2E ${id}`;
  const titulo = `Prova cal ${id}`;
  const data = emDias(2);
  const url = await cadastrarConcurso(page, { orgao, cargo: "Analista", status: "Inscrito" });

  await page.getByRole("tab", { name: /^Eventos/ }).click();
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: "Prova objetiva" });
  await dialogo.getByLabel("Título").fill(titulo);
  await dialogo.getByLabel("Data").fill(data);
  await dialogo.getByLabel("Hora").fill("09:00");
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();

  // Pela navegação: mês atual com hoje destacado.
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Calendário" })
    .click();
  await expect(page).toHaveURL(/\/calendario$/);
  await expect(page.locator(`td[data-data="${hojeSP()}"]`)).toHaveAttribute("aria-current", "date");

  // Mês do evento (pode ser o seguinte): item com destaque crítico.
  const mesUrl = new RegExp(`/calendario[?]mes=${mesDaData(data)}$`);
  await page.goto(`/calendario?mes=${mesDaData(data)}`);
  const item = page.locator(`td[data-data="${data}"]`).getByRole("button", { name: titulo });
  await expect(item).toBeVisible();
  await expect(item).toHaveAttribute("data-criticidade", "ALTA");
  await expect(item).toContainText("09:00");

  // Clique abre os detalhes sem sair do calendário; Esc fecha e devolve o foco.
  await item.click();
  const detalhes = page.getByRole("dialog", { name: titulo });
  await expect(detalhes).toBeVisible();
  await expect(detalhes).toContainText(`${orgao} — Analista`);
  await expect(detalhes).toContainText("09:00");
  await expect(detalhes).toContainText("Inscrito");
  // Leva ao evento na aba Eventos, guardando o mês para o "voltar" (#100).
  await expect(detalhes.getByRole("link", { name: /^Ver no concurso/ })).toHaveAttribute(
    "href",
    new RegExp(
      `^${new URL(url).pathname}[?]aba=eventos&evento=[0-9]+&de=calendario&mes=${mesDaData(data)}$`,
    ),
  );
  await page.keyboard.press("Escape");
  await expect(detalhes).toBeHidden();
  await expect(item).toBeFocused();
  await expect(page).toHaveURL(mesUrl);

  // Teclado: Enter no item reabre; o botão de fechar também fecha.
  await page.keyboard.press("Enter");
  await expect(detalhes).toBeVisible();
  await detalhes.getByRole("button", { name: "Fechar" }).click();
  await expect(detalhes).toBeHidden();

  // Navegação entre meses pela URL.
  await page.getByRole("link", { name: "Próximo mês" }).click();
  await expect(page).not.toHaveURL(new RegExp(`mes=${mesDaData(data)}`));
  await expect(page.getByRole("button", { name: titulo })).toHaveCount(0);
  await page.getByRole("link", { name: "Mês anterior" }).click();
  await expect(page).toHaveURL(mesUrl);

  // Celular: agenda do mês em lista; o item abre os detalhes, que levam ao concurso.
  await page.setViewportSize({ width: 390, height: 800 });
  const agenda = page.getByRole("button", { name: new RegExp(titulo) });
  await expect(agenda).toBeVisible();
  await expect(agenda).toContainText(orgao);
  await agenda.click();
  await expect(detalhes).toBeVisible();
  await expect(page).toHaveURL(mesUrl);
  await detalhes.getByRole("link", { name: /^Ver no concurso/ }).click();
  await expect(page).toHaveURL(new RegExp(`^${url}[?]aba=eventos&evento=[0-9]+&de=calendario`));
});
