import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { cadastrarConcurso, unico } from "./utils";

test("exportar backup, excluir dados e restaurar pela importação", async ({ page }, info) => {
  const orgao = `Backup E2E ${unico()}`;
  const detalhe = await cadastrarConcurso(page, { orgao, cargo: "Auditor", tags: ["backup"] });

  // Exportar JSON e CSV.
  await page.goto("/configuracoes");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Baixar backup (JSON)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^concursos-backup-\d{8}-\d{4}\.json$/);
  const arquivo = info.outputPath("backup.json");
  await download.saveAs(arquivo);
  const backup = JSON.parse(await readFile(arquivo, "utf8"));
  expect(backup).toMatchObject({ app: "concurso", schemaVersion: 1 });
  expect(backup.dados.concursos.map((c: { orgao: string }) => c.orgao)).toContain(orgao);

  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Baixar concursos (CSV)" }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(/^concursos-\d{8}-\d{4}\.csv$/);

  // Excluir o concurso.
  await page.goto(detalhe);
  await page
    .getByRole("button", { name: /Excluir/ })
    .first()
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page).toHaveURL(/\/concursos$/);
  await expect(page.getByRole("link", { name: new RegExp(orgao) })).toHaveCount(0);

  // Versão desconhecida é rejeitada com mensagem clara.
  const futuro = info.outputPath("futuro.json");
  await writeFile(futuro, JSON.stringify({ ...backup, schemaVersion: 99 }));
  await page.goto("/configuracoes");
  const entrada = page.getByLabel("Arquivo de backup (.json)");
  const confirmar = page.getByRole("alertdialog", { name: "Substituir todos os dados?" });
  const ciente = confirmar.getByLabel("Entendo que os dados atuais serão substituídos");
  const substituir = confirmar.getByRole("button", { name: "Substituir tudo" });

  await entrada.setInputFiles(futuro);
  await page.getByRole("button", { name: "Importar…" }).click();
  await expect(substituir).toBeDisabled();
  await ciente.check();
  await substituir.click();
  await expect(page.getByText(/versão 99 do formato/)).toBeVisible();

  // Importar o backup restaura o concurso.
  await entrada.setInputFiles(arquivo);
  await page.getByRole("button", { name: "Importar…" }).click();
  await ciente.check();
  await substituir.click();
  await expect(page.getByRole("status")).toContainText("Backup importado");

  await page.goto(detalhe);
  await expect(page.getByRole("heading", { level: 1, name: orgao })).toBeVisible();
  await expect(page.getByText("backup", { exact: true })).toBeVisible();
});
