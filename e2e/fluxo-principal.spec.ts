import { expect, test } from "@playwright/test";
import { cadastrarConcurso, emDias, unico } from "./utils";

test("cadastrar concurso → mudar status → adicionar evento → ver no dashboard", async ({
  page,
}) => {
  const id = unico();
  const orgao = `Tribunal E2E ${id}`;
  const titulo = `Prova E2E ${id}`;
  await cadastrarConcurso(page, { orgao, cargo: "Analista" });

  // Status: Previsto → Inscrito (aba Histórico).
  await page.getByRole("tab", { name: "Histórico" }).click();
  await page.getByLabel("Novo status").selectOption({ label: "Inscrito" });
  await page.getByLabel("Observação (opcional)").fill("boleto pago");
  await page.getByRole("button", { name: "Alterar status" }).click();
  await expect(page.getByText("boleto pago")).toBeVisible();

  // Evento daqui a 5 dias (aba Eventos).
  await page.getByRole("tab", { name: /^Eventos/ }).click();
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: "Prova objetiva" });
  await dialogo.getByLabel("Título").fill(titulo);
  await dialogo.getByLabel("Data").fill(emDias(5));
  await dialogo.getByLabel("Hora").fill("13:00");
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByText(titulo)).toBeVisible();

  // Dashboard: o prazo aparece com o concurso e leva ao detalhe.
  await page.goto("/");
  const prazo = page.getByRole("link", { name: new RegExp(titulo) });
  await expect(prazo).toBeVisible();
  await expect(prazo).toContainText(orgao);
  await prazo.click();
  await expect(page.getByRole("heading", { level: 1, name: orgao })).toBeVisible();
});
