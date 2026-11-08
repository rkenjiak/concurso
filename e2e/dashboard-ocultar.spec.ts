import { expect, test } from "@playwright/test";
import { cadastrarConcurso, emDias, unico } from "./utils";

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
  const item = page.getByRole("listitem").filter({ hasText: titulo });
  await expect(item).toBeVisible();
  const contador = page.getByTestId("contador-ocultos");
  await expect(contador).toHaveCount(0);

  // Ocultar: some da lista e o contador aparece.
  await item.getByRole("button", { name: `Ocultar "${titulo}" do dashboard` }).click();
  await expect(item).toHaveCount(0);
  await expect(contador).toHaveText("1 oculto");

  // Persiste entre carregamentos (gravado no banco).
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: titulo })).toHaveCount(0);
  await expect(contador).toHaveText("1 oculto");

  // "Mostrar ocultos" exibe o prazo esmaecido, com a ação de reexibir.
  await page.getByRole("link", { name: "Mostrar ocultos" }).click();
  await expect(page).toHaveURL(/\?ocultos=1$/);
  await expect(item).toBeVisible();
  await expect(item).toHaveAttribute("data-oculto", "true");
  await expect(item).toContainText("Oculto");

  await item.getByRole("button", { name: `Mostrar "${titulo}" no dashboard` }).click();
  await expect(contador).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByRole("listitem").filter({ hasText: titulo })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: titulo })).not.toHaveAttribute(
    "data-oculto",
  );
});
