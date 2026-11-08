import { expect, test } from "@playwright/test";
import { cadastrarConcurso, emDias, regiaoAvisos, unico } from "./utils";

test("dashboard: ocultar um prazo, mostrar ocultos e reexibir (persistente)", async ({ page }) => {
  const id = unico();
  const titulo = `Boleto ocultar ${id}`;
  await cadastrarConcurso(page, {
    orgao: `Ocultar E2E ${id}`,
    cargo: "Analista",
    status: "Inscrito",
  });

  await page.getByRole("tab", { name: /^Eventos/ }).click();
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: "Vencimento do boleto" });
  await dialogo.getByLabel("Título").fill(titulo);
  await dialogo.getByLabel("Data").fill(emDias(4));
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialogo).toBeHidden();

  await page.goto("/");
  const item = page.getByRole("main").getByRole("listitem").filter({ hasText: titulo });
  await expect(item).toBeVisible();
  const contador = page.getByTestId("contador-ocultos");
  await expect(contador).toHaveCount(0);

  // Ocultar fica no painel do evento (#100, D6), com a dica de que não conclui o prazo.
  await item.locator("[data-painel-chave]").click();
  const painel = page.getByRole("dialog", { name: titulo });
  const ocultar = painel.getByRole("button", { name: "Ocultar do dashboard" });
  await expect(ocultar).toHaveAccessibleDescription(
    "Ocultar só remove do dashboard; o prazo continua pendente.",
  );
  await ocultar.click();
  await expect(item).toHaveCount(0);
  await expect(contador).toHaveText("1 oculto");
  // O painel continua aberto (o item saiu da lista) e já oferece reexibir.
  await expect(painel.getByRole("button", { name: "Mostrar no dashboard" })).toBeVisible();
  // O aviso sai dentro do painel (fora dele ficaria `aria-hidden`).
  await expect(painel.locator("[data-avisos]")).toContainText(`“${titulo}” oculto do dashboard.`);
  await expect(regiaoAvisos(page)).toContainText(`“${titulo}” oculto do dashboard.`);
  await page.keyboard.press("Escape");
  await expect(painel).toBeHidden();

  // Persiste entre carregamentos (gravado no banco).
  await page.reload();
  await expect(
    page.getByRole("main").getByRole("listitem").filter({ hasText: titulo }),
  ).toHaveCount(0);
  await expect(contador).toHaveText("1 oculto");

  // "Mostrar ocultos" exibe o prazo esmaecido; o painel oferece reexibir.
  await page.getByRole("link", { name: "Mostrar ocultos" }).click();
  await expect(page).toHaveURL(/\?ocultos=1$/);
  await expect(item).toBeVisible();
  await expect(item).toHaveAttribute("data-oculto", "true");
  await expect(item).toContainText("Oculto");

  await item.locator("[data-painel-chave]").click();
  await painel.getByRole("button", { name: "Mostrar no dashboard" }).click();
  await expect(contador).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/");
  await expect(
    page.getByRole("main").getByRole("listitem").filter({ hasText: titulo }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("listitem").filter({ hasText: titulo }),
  ).not.toHaveAttribute("data-oculto");
});
