import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { hojeSP, somarDias } from "../src/lib/tz";

/**
 * Região de avisos que está mostrando os avisos: a global ou, com um diálogo aberto, a de dentro
 * dele (a outra fica vazia) (#100, D4).
 */
export const regiaoAvisos = (page: Page) => page.locator("[data-avisos]").filter({ visible: true });

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

/**
 * Confere a invalidação imediata do cache ISR exigindo transição para `statusEsperado` com
 * `x-nextjs-cache: MISS` (nunca `STALE`). Tolera até `timeoutMs` (padrão 5 s, muito abaixo do
 * TTL de 300 s) para absorver eventuais saltos de relógio do host no `FileSystemCache` do Next.js.
 */
export async function esperarInvalidacaoIsr(
  request: APIRequestContext,
  caminho: string,
  statusEsperado: 200 | 404,
  timeoutMs = 5_000,
): Promise<void> {
  const limite = performance.now() + timeoutMs;
  let ultimoStatus = 0;
  let ultimoCache: string | undefined;

  while (true) {
    const resp = await request.get(caminho, { maxRedirects: 0 });
    ultimoStatus = resp.status();
    ultimoCache = resp.headers()["x-nextjs-cache"];
    expect(ultimoCache, `GET ${caminho} devolveu cache ${ultimoCache}`).not.toBe("STALE");

    if (ultimoStatus === statusEsperado) {
      expect(ultimoCache, `GET ${caminho} atingiu ${statusEsperado} via ${ultimoCache}`).toBe(
        "MISS",
      );
      return;
    }

    if (performance.now() >= limite) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  expect(ultimoStatus, `GET ${caminho} (x-nextjs-cache=${ultimoCache})`).toBe(statusEsperado);
}
