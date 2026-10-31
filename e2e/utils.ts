import { expect, type Page } from "@playwright/test";
import { hojeSP, somarDias } from "../src/lib/tz";

/** Sufixo único por teste, para não depender da ordem nem de dados de outros testes. */
export const unico = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Data `YYYY-MM-DD` daqui a `dias` dias (horário de Brasília). */
export const emDias = (dias: number) => somarDias(hojeSP(), dias);

export interface NovoConcurso {
  orgao: string;
  cargo: string;
  status?: string;
  tags?: string[];
}

/** Cadastra um concurso pela interface e espera a página de detalhe. Retorna a URL. */
export async function cadastrarConcurso(page: Page, dados: NovoConcurso): Promise<string> {
  await page.goto("/concursos/novo");
  await page.getByLabel("Nome / órgão").fill(dados.orgao);
  await page.getByLabel("Cargo(s) / área").fill(dados.cargo);
  if (dados.status) {
    await page.getByRole("combobox", { name: /^Status/ }).selectOption({ label: dados.status });
  }
  const tags = page.getByRole("combobox", { name: "Tags", exact: true });
  for (const tag of dados.tags ?? []) {
    await tags.fill(tag);
    await tags.press("Enter");
  }
  await page.getByRole("button", { name: "Cadastrar concurso" }).click();
  await expect(page).toHaveURL(/\/concursos\/\d+$/);
  await expect(page.getByRole("heading", { level: 1, name: dados.orgao })).toBeVisible();
  return page.url();
}
