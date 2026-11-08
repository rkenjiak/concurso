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
  /** Rótulo da cor (ex.: "Verde-água"); ausente = automática. */
  cor?: string;
  icone?: string;
}

/**
 * Escolhe a cor no formulário do concurso clicando na amostra (o rádio nativo é visualmente
 * oculto) e confere que o rádio ficou marcado.
 */
export async function escolherCor(page: Page, nome: string | RegExp): Promise<void> {
  const radio = page.getByRole("radio", { name: nome, exact: typeof nome === "string" });
  await page.locator("label").filter({ has: radio }).click();
  await expect(radio).toBeChecked();
}

/**
 * Cadastra um concurso pela interface e espera o detalhe, que abre na aba Eventos (#100, D9).
 * Retorna a URL do detalhe sem parâmetros (aba Visão geral).
 */
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
  if (dados.cor) await escolherCor(page, dados.cor);
  if (dados.icone) await page.getByLabel("Ícone (opcional)").fill(dados.icone);
  await page.getByRole("button", { name: "Cadastrar concurso" }).click();
  await expect(page).toHaveURL(/\/concursos\/\d+\?aba=eventos$/);
  await expect(page.getByRole("heading", { level: 1, name: dados.orgao })).toBeVisible();
  const url = new URL(page.url());
  return `${url.origin}${url.pathname}`;
}
