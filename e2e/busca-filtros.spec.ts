import { expect, test } from "@playwright/test";
import { cadastrarConcurso, unico } from "./utils";

test("buscar sem acento e filtrar por status", async ({ page }) => {
  const id = unico();
  const tj = `Tribunal de Justiça ${id}`;
  const pref = `Prefeitura Municipal ${id}`;
  await cadastrarConcurso(page, { orgao: tj, cargo: "Técnico Judiciário", status: "Inscrito" });
  await cadastrarConcurso(page, { orgao: pref, cargo: "Agente", tags: [`zeta${id}`] });

  await page.goto("/concursos");
  const busca = page.getByRole("searchbox", { name: "Buscar por órgão, cargo, banca ou tag" });
  const linkTj = page.getByRole("link", { name: new RegExp(tj) });
  const linkPref = page.getByRole("link", { name: new RegExp(pref) });

  // Busca sem acento/maiúsculas, termos em qualquer ordem.
  await busca.fill(`${id} JUSTICA tecnico`);
  await busca.press("Enter");
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(page.getByText("1 concurso encontrado.")).toBeVisible();
  await expect(linkTj).toBeVisible();
  await expect(linkPref).toHaveCount(0);

  // Busca por tag.
  await busca.fill(`zeta${id}`);
  await busca.press("Enter");
  await expect(linkPref).toBeVisible();
  await expect(page.getByText("1 concurso encontrado.")).toBeVisible();

  // Filtro por status mantendo o termo comum aos dois.
  await busca.fill(id);
  await page.getByText("Filtros", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Inscrito", exact: true }).check();
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(/status=INSCRITO/);
  await expect(linkTj).toBeVisible();
  await expect(linkPref).toHaveCount(0);

  // Limpar filtros mostra os dois.
  await page.getByRole("link", { name: "Limpar filtros" }).click();
  await expect(linkTj).toBeVisible();
  await expect(linkPref).toBeVisible();
});
